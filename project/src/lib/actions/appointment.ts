"use server"

import { refresh } from "next/cache"
import { isObjectIdOrHexString } from "mongoose"
import { getSessionUserId } from "@/lib/session"
import { findWorkspaceTherapists, objectIds } from "@/lib/therapist-lookup"
import { findManagedUnit } from "@/lib/unit-access"
import {
  createAppointment,
  deleteAppointment,
  updateAppointment,
  type CreateAppointmentError,
} from "@/lib/appointment"
import { Appointment } from "@/models/Appointment"
import { Hotel } from "@/models/Hotel"
import { Service } from "@/models/Service"

const errorMessages: Record<CreateAppointmentError | "appointment_not_found" | "unauthenticated", string> = {
  invalid_input: "Preencha hóspede, quarto, data/hora e os serviços.",
  invalid_guest_name: "Informe o nome do hóspede.",
  guest_name_too_long: "O nome do hóspede pode ter no máximo 80 caracteres.",
  invalid_room: "Informe o quarto.",
  room_too_long: "O quarto pode ter no máximo 20 caracteres.",
  invalid_performed_at: "Informe uma data e hora válidas.",
  no_items: "Adicione pelo menos um serviço.",
  too_many_items: "Um atendimento pode ter no máximo 20 serviços.",
  invalid_item: "Escolha o serviço e a massagista de cada linha.",
  service_not_found: "Algum serviço não foi encontrado nesta unidade. Recarregue a página.",
  therapist_not_found: "Algum profissional escolhido não pode atender neste workspace. Recarregue a página.",
  hotel_not_found: "Escolha uma unidade válida deste workspace.",
  appointment_not_found: "Atendimento não encontrado ou sem permissão.",
  unauthenticated: "Sua sessão expirou. Entre novamente.",
}

export type AppointmentActionState = { error: string | null }

function appointmentInput(formData: FormData) {
  return {
    guestName: formData.get("guestName"),
    room: formData.get("room"),
    performedAt: formData.get("performedAt"),
    serviceIds: formData.getAll("serviceId"),
    therapistIds: formData.getAll("therapistId"),
  }
}

// Buscas usadas por createAppointment/updateAppointment, restritas à unidade e ao workspace.
function appointmentLookups(unit: { workspaceId: string; hotelId: string }) {
  return {
    findServices: async (ids: string[]) => {
      const services = await Service.find({ _id: { $in: objectIds(ids) }, hotelId: unit.hotelId })
        .select({ name: 1, priceCents: 1, durationMinutes: 1 })
        .lean()
      return services.map(({ _id, name, priceCents, durationMinutes }) => ({
        id: _id.toString(),
        name,
        priceCents,
        durationMinutes,
      }))
    },
    findTherapists: (ids: string[]) => findWorkspaceTherapists(unit.workspaceId, ids),
  }
}

// workspaceId e hotelId vêm via argumento do cliente; a posse é conferida aqui, no servidor.
export async function createAppointmentAction(
  workspaceId: string,
  hotelId: string,
  _prev: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  const userId = await getSessionUserId()
  if (!userId) return { error: errorMessages.unauthenticated }
  const unit = await findManagedUnit(workspaceId, hotelId, userId)

  const result = await createAppointment(appointmentInput(formData), unit?.hotelId, {
    ...appointmentLookups(unit!),
    insert: async (data) => {
      const appointment = await Appointment.create({ ...data, createdBy: userId })
      return { id: appointment._id.toString() }
    },
  })

  if (!result.ok) return { error: errorMessages[result.error] }

  refresh()
  return { error: null }
}

export async function updateAppointmentAction(
  workspaceId: string,
  hotelId: string,
  appointmentId: string,
  _prev: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  const userId = await getSessionUserId()
  if (!userId) return { error: errorMessages.unauthenticated }
  const unit = await findManagedUnit(workspaceId, hotelId, userId)

  // Só repassa o id quando a unidade é gerenciável; a escrita ainda filtra por hotelId.
  const result = await updateAppointment(
    appointmentInput(formData),
    unit && isObjectIdOrHexString(appointmentId) ? appointmentId : null,
    {
      ...appointmentLookups(unit!),
      update: async (id, fields) => {
        const { matchedCount } = await Appointment.updateOne({ _id: id, hotelId: unit!.hotelId }, { $set: fields })
        return matchedCount > 0
      },
    },
  )

  if (!result.ok) return { error: errorMessages[result.error] }

  refresh()
  return { error: null }
}

// Visão do workspace: a unidade vem do formulário (campo hotelId) e a posse é conferida
// em createAppointmentAction.
export async function createWorkspaceAppointmentAction(
  workspaceId: string,
  prev: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  const hotelId = formData.get("hotelId")
  return createAppointmentAction(workspaceId, typeof hotelId === "string" ? hotelId : "", prev, formData)
}

// Visão do workspace: permite mover o atendimento para outra unidade. O atendimento
// precisa ser de alguma unidade do workspace, e a nova unidade precisa ser gerenciável.
export async function updateWorkspaceAppointmentAction(
  workspaceId: string,
  appointmentId: string,
  _prev: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  const userId = await getSessionUserId()
  if (!userId) return { error: errorMessages.unauthenticated }
  const hotelId = formData.get("hotelId")
  const unit = await findManagedUnit(workspaceId, typeof hotelId === "string" ? hotelId : "", userId)
  if (!unit) return { error: errorMessages.hotel_not_found }

  const result = await updateAppointment(
    appointmentInput(formData),
    isObjectIdOrHexString(appointmentId) ? appointmentId : null,
    {
      ...appointmentLookups(unit),
      update: async (id, fields) => {
        const workspaceHotelIds = await Hotel.find({ workspaceId: unit.workspaceId }).distinct("_id")
        const { matchedCount } = await Appointment.updateOne(
          { _id: id, hotelId: { $in: workspaceHotelIds } },
          { $set: { ...fields, hotelId: unit.hotelId } },
        )
        return matchedCount > 0
      },
    },
  )

  if (!result.ok) return { error: errorMessages[result.error] }

  refresh()
  return { error: null }
}

export async function deleteAppointmentAction(
  workspaceId: string,
  hotelId: string,
  appointmentId: string,
): Promise<AppointmentActionState> {
  const userId = await getSessionUserId()
  if (!userId) return { error: errorMessages.unauthenticated }
  const unit = await findManagedUnit(workspaceId, hotelId, userId)

  // Só repassa o id quando a unidade é gerenciável; a exclusão ainda filtra por hotelId.
  const result = await deleteAppointment(
    unit && isObjectIdOrHexString(appointmentId) ? appointmentId : null,
    async (id) => {
      const { deletedCount } = await Appointment.deleteOne({ _id: id, hotelId: unit!.hotelId })
      return deletedCount > 0
    },
  )

  if (!result.ok) return { error: errorMessages[result.error] }

  refresh()
  return { error: null }
}
