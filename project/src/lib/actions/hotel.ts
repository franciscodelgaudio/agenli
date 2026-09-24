"use server"

import { refresh } from "next/cache"
import { isObjectIdOrHexString } from "mongoose"
import { getSessionUserId } from "@/lib/session"
import { canManageMembers } from "@/lib/member"
import { findWorkspaceAccess } from "@/lib/workspace-access"
import {
  createHotel,
  deleteHotel,
  updateHotel,
  type CreateHotelError,
  type UpdateHotelError,
} from "@/lib/hotel"
import { Appointment } from "@/models/Appointment"
import { Hotel } from "@/models/Hotel"
import { Service } from "@/models/Service"

const errorMessages: Record<CreateHotelError | UpdateHotelError | "unauthenticated", string> = {
  invalid_input: "Informe o nome da unidade.",
  invalid_name: "Informe o nome da unidade.",
  name_too_long: "O nome pode ter no máximo 80 caracteres.",
  invalid_avatar_url: "Informe uma URL válida começando com http:// ou https://.",
  workspace_not_found: "Workspace não encontrado ou sem permissão.",
  hotel_not_found: "Unidade não encontrada ou sem permissão.",
  unauthenticated: "Sua sessão expirou. Entre novamente.",
}

export type CreateHotelState = { error: string | null }
export type UpdateHotelState = CreateHotelState
export type DeleteHotelState = CreateHotelState

// id do workspace se o usuário puder gerenciá-lo (dono ou administrador); senão undefined.
async function findManagedWorkspaceId(workspaceId: string, userId: string) {
  const access = await findWorkspaceAccess(workspaceId, userId)
  return access && canManageMembers(access.role) ? access.id : undefined
}

// workspaceId vem via argumento do cliente; a posse é conferida aqui, no servidor.
export async function createHotelAction(
  workspaceId: string,
  _prev: CreateHotelState,
  formData: FormData,
): Promise<CreateHotelState> {
  const userId = await getSessionUserId()
  if (!userId) return { error: errorMessages.unauthenticated }

  const ownedId = await findManagedWorkspaceId(workspaceId, userId)

  const result = await createHotel(
    { name: formData.get("name"), avatarUrl: formData.get("avatarUrl") },
    ownedId,
    async (data) => {
      const hotel = await Hotel.create(data)
      return { id: hotel._id.toString() }
    },
  )

  if (!result.ok) return { error: errorMessages[result.error] }

  refresh()
  return { error: null }
}

// Só repassa o hotelId quando o usuário gerencia o workspace; a escrita ainda filtra
// por workspaceId para que um hotel de outro workspace não seja encontrado.
// null = sessão expirada.
async function resolveHotelTarget(workspaceId: string, hotelId: string) {
  const userId = await getSessionUserId()
  if (!userId) return null
  const ownedId = await findManagedWorkspaceId(workspaceId, userId)
  return { ownedId, hotelId: ownedId && isObjectIdOrHexString(hotelId) ? hotelId : null }
}

export async function updateHotelAction(
  workspaceId: string,
  hotelId: string,
  _prev: UpdateHotelState,
  formData: FormData,
): Promise<UpdateHotelState> {
  const target = await resolveHotelTarget(workspaceId, hotelId)
  if (!target) return { error: errorMessages.unauthenticated }

  const result = await updateHotel(
    { name: formData.get("name"), avatarUrl: formData.get("avatarUrl") },
    target.hotelId,
    async (id, { name, avatarUrl }) => {
      const { matchedCount } = await Hotel.updateOne(
        { _id: id, workspaceId: target.ownedId },
        avatarUrl ? { $set: { name, avatarUrl } } : { $set: { name }, $unset: { avatarUrl: 1 } },
      )
      return matchedCount > 0
    },
  )

  if (!result.ok) return { error: errorMessages[result.error] }

  refresh()
  return { error: null }
}

export async function deleteHotelAction(workspaceId: string, hotelId: string): Promise<DeleteHotelState> {
  const target = await resolveHotelTarget(workspaceId, hotelId)
  if (!target) return { error: errorMessages.unauthenticated }

  const result = await deleteHotel(target.hotelId, async (id) => {
    const { deletedCount } = await Hotel.deleteOne({ _id: id, workspaceId: target.ownedId })
    if (deletedCount === 0) return false
    await Promise.all([Service.deleteMany({ hotelId: id }), Appointment.deleteMany({ hotelId: id })])
    return true
  })

  if (!result.ok) return { error: errorMessages[result.error] }

  refresh()
  return { error: null }
}
