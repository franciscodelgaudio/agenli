"use server"

import { refresh } from "next/cache"
import { isObjectIdOrHexString, Types } from "mongoose"
import { getSessionUserId } from "@/lib/session"
import { findManagedUnit } from "@/lib/unit-access"
import { createAppointment, deleteAppointment, type CreateAppointmentError } from "@/lib/appointment"
import { Appointment } from "@/models/Appointment"
import { Service } from "@/models/Service"
import { WorkspaceMember } from "@/models/WorkspaceMember"

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
  therapist_not_found: "Alguma massagista não foi encontrada neste workspace. Recarregue a página.",
  hotel_not_found: "Unidade não encontrada ou sem permissão.",
  appointment_not_found: "Atendimento não encontrado ou sem permissão.",
  unauthenticated: "Sua sessão expirou. Entre novamente.",
}

export type AppointmentActionState = { error: string | null }

// Ids inválidos são descartados antes da consulta; createAppointment os trata como não encontrados.
function objectIds(ids: string[]) {
  return ids.filter((id) => isObjectIdOrHexString(id)).map((id) => new Types.ObjectId(id))
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

  const result = await createAppointment(
    {
      guestName: formData.get("guestName"),
      room: formData.get("room"),
      performedAt: formData.get("performedAt"),
      serviceIds: formData.getAll("serviceId"),
      therapistIds: formData.getAll("therapistId"),
    },
    unit?.hotelId,
    {
      findServices: async (ids) => {
        const services = await Service.find({ _id: { $in: objectIds(ids) }, hotelId: unit!.hotelId })
          .select({ name: 1, priceCents: 1, durationMinutes: 1 })
          .lean()
        return services.map(({ _id, name, priceCents, durationMinutes }) => ({
          id: _id.toString(),
          name,
          priceCents,
          durationMinutes,
        }))
      },
      // Só membros que aceitaram o convite e têm função de massagista.
      findTherapists: (ids) =>
        WorkspaceMember.aggregate<{ id: string; name: string }>([
          {
            $match: {
              _id: { $in: objectIds(ids) },
              workspaceId: new Types.ObjectId(unit!.workspaceId),
              role: "massage_therapist",
              userId: { $ne: null },
            },
          },
          { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
          { $set: { user: { $first: "$user" } } },
          { $project: { _id: 0, id: { $toString: "$_id" }, name: { $ifNull: ["$user.name", "$user.email"] } } },
        ]),
      insert: async (data) => {
        const appointment = await Appointment.create({ ...data, createdBy: userId })
        return { id: appointment._id.toString() }
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
