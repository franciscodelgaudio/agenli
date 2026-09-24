"use server"

import { isObjectIdOrHexString, Types } from "mongoose"
import { canManageMembers } from "@/lib/member"
import { getSessionUserId } from "@/lib/session"
import { findWorkspaceTherapists } from "@/lib/therapist-lookup"
import { findManagedUnit } from "@/lib/unit-access"
import { findWorkspaceAccess } from "@/lib/workspace-access"
import {
  createBooking,
  deleteBooking,
  rescheduleBooking,
  updateBooking,
  type BookingError,
} from "@/lib/booking"
import { Booking } from "@/models/Booking"
import { Hotel } from "@/models/Hotel"
import { Service } from "@/models/Service"

const errorMessages: Record<BookingError | "unauthenticated", string> = {
  invalid_input: "Preencha massagista, hóspede, quarto, início e duração.",
  invalid_therapist: "Escolha a massagista.",
  invalid_guest_name: "Informe o nome do hóspede.",
  guest_name_too_long: "O nome do hóspede pode ter no máximo 80 caracteres.",
  invalid_room: "Informe o quarto.",
  room_too_long: "O quarto pode ter no máximo 20 caracteres.",
  invalid_starts_at: "Informe uma data e hora válidas.",
  invalid_duration: "O agendamento precisa durar entre 5 minutos e 12 horas.",
  service_not_found: "O serviço escolhido não é desta unidade. Recarregue a página.",
  therapist_not_found: "A massagista escolhida não pode atender neste workspace. Recarregue a página.",
  therapist_busy: "A massagista já tem um agendamento nesse horário.",
  hotel_not_found: "Escolha uma unidade válida deste workspace.",
  booking_not_found: "Agendamento não encontrado ou sem permissão.",
  unauthenticated: "Sua sessão expirou. Entre novamente.",
}

export type BookingActionState = { error: string | null }

function bookingInput(formData: FormData) {
  return {
    therapistId: formData.get("therapistId"),
    guestName: formData.get("guestName"),
    room: formData.get("room"),
    startsAt: formData.get("startsAt"),
    durationMinutes: formData.get("durationMinutes"),
    serviceId: formData.get("serviceId"),
  }
}

// Unidades do workspace, se o usuário o gerencia (dono ou administrador); senão null.
async function findManagedHotelIds(workspaceId: string, userId: string) {
  const access = await findWorkspaceAccess(workspaceId, userId)
  if (!access || !canManageMembers(access.role)) return null
  return Hotel.find({ workspaceId: access.id }).distinct("_id")
}

// Conflito da massagista em qualquer unidade do workspace.
function conflictChecker(hotelIds: Types.ObjectId[]) {
  return async ({
    therapistId,
    startsAt,
    endsAt,
    excludeId,
  }: {
    therapistId: string
    startsAt: Date
    endsAt: Date
    excludeId?: string
  }) => {
    const conflict = await Booking.exists({
      therapistId,
      hotelId: { $in: hotelIds },
      startsAt: { $lt: endsAt },
      endsAt: { $gt: startsAt },
      ...(excludeId && { _id: { $ne: excludeId } }),
    })
    return conflict !== null
  }
}

// Buscas usadas por createBooking/updateBooking, restritas à unidade e ao workspace.
function bookingLookups(unit: { workspaceId: string; hotelId: string }, hotelIds: Types.ObjectId[]) {
  return {
    findService: async (id: string) => {
      if (!isObjectIdOrHexString(id)) return null
      const service = await Service.findOne({ _id: id, hotelId: unit.hotelId }).select({ name: 1 }).lean()
      return service && { id: service._id.toString(), name: service.name }
    },
    findTherapist: async (id: string) => (await findWorkspaceTherapists(unit.workspaceId, [id]))[0] ?? null,
    hasConflict: conflictChecker(hotelIds),
  }
}

// workspaceId vem via argumento e a unidade pelo formulário (campo hotelId); a posse é conferida aqui.
export async function createBookingAction(
  workspaceId: string,
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const userId = await getSessionUserId()
  if (!userId) return { error: errorMessages.unauthenticated }
  const hotelId = formData.get("hotelId")
  const unit = await findManagedUnit(workspaceId, typeof hotelId === "string" ? hotelId : "", userId)
  const hotelIds = unit ? await Hotel.find({ workspaceId: unit.workspaceId }).distinct("_id") : []

  const result = await createBooking(bookingInput(formData), unit?.hotelId, {
    ...bookingLookups(unit!, hotelIds),
    insert: async (data) => {
      const booking = await Booking.create({ ...data, createdBy: userId })
      return { id: booking._id.toString() }
    },
  })

  return { error: result.ok ? null : errorMessages[result.error] }
}

// Permite mover o agendamento para outra unidade: ele precisa ser de alguma unidade do
// workspace, e a nova unidade precisa ser gerenciável.
export async function updateBookingAction(
  workspaceId: string,
  bookingId: string,
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const userId = await getSessionUserId()
  if (!userId) return { error: errorMessages.unauthenticated }
  const hotelId = formData.get("hotelId")
  const unit = await findManagedUnit(workspaceId, typeof hotelId === "string" ? hotelId : "", userId)
  if (!unit) return { error: errorMessages.hotel_not_found }
  const hotelIds = await Hotel.find({ workspaceId: unit.workspaceId }).distinct("_id")

  const result = await updateBooking(bookingInput(formData), isObjectIdOrHexString(bookingId) ? bookingId : null, {
    ...bookingLookups(unit, hotelIds),
    update: async (id, fields) => {
      const { matchedCount } = await Booking.updateOne(
        { _id: id, hotelId: { $in: hotelIds } },
        { $set: { ...fields, hotelId: unit.hotelId } },
      )
      return matchedCount > 0
    },
  })

  return { error: result.ok ? null : errorMessages[result.error] }
}

// Arrastar ou redimensionar no calendário.
export async function rescheduleBookingAction(
  workspaceId: string,
  bookingId: string,
  times: { startsAt: string; endsAt: string },
): Promise<BookingActionState> {
  const userId = await getSessionUserId()
  if (!userId) return { error: errorMessages.unauthenticated }
  const hotelIds = await findManagedHotelIds(workspaceId, userId)

  // Só repassa o id quando o workspace é gerenciável; a escrita ainda filtra pelas unidades dele.
  const result = await rescheduleBooking(times, hotelIds && isObjectIdOrHexString(bookingId) ? bookingId : null, {
    findBooking: async (id) => {
      const booking = await Booking.findOne({ _id: id, hotelId: { $in: hotelIds! } })
        .select({ therapistId: 1 })
        .lean()
      return booking && { therapistId: booking.therapistId.toString() }
    },
    hasConflict: conflictChecker(hotelIds ?? []),
    update: async (id, fields) => {
      const { matchedCount } = await Booking.updateOne({ _id: id, hotelId: { $in: hotelIds! } }, { $set: fields })
      return matchedCount > 0
    },
  })

  return { error: result.ok ? null : errorMessages[result.error] }
}

export async function deleteBookingAction(workspaceId: string, bookingId: string): Promise<BookingActionState> {
  const userId = await getSessionUserId()
  if (!userId) return { error: errorMessages.unauthenticated }
  const hotelIds = await findManagedHotelIds(workspaceId, userId)

  const result = await deleteBooking(hotelIds && isObjectIdOrHexString(bookingId) ? bookingId : null, async (id) => {
    const { deletedCount } = await Booking.deleteOne({ _id: id, hotelId: { $in: hotelIds! } })
    return deletedCount > 0
  })

  return { error: result.ok ? null : errorMessages[result.error] }
}
