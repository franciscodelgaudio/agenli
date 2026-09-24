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
  invalid_ownership: "Informe onde a unidade funciona.",
  invalid_period: "Escolha o período do faturamento.",
  invalid_mode: "Escolha como o percentual é calculado.",
  too_many_tiers: "Cadastre no máximo 10 faixas.",
  invalid_tier_limit: "Os limites das faixas devem ser valores maiores que zero, em ordem crescente.",
  invalid_tier_percent: "Os percentuais devem estar entre 0 e 100, com até 2 casas decimais.",
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

// A ordem dos campos no FormData forma as faixas: um limite para cada, menos a última.
function hotelInput(formData: FormData) {
  return {
    name: formData.get("name"),
    avatarUrl: formData.get("avatarUrl"),
    ownership: formData.get("ownership"),
    revenueShare: {
      period: formData.get("revenueSharePeriod"),
      mode: formData.get("revenueShareMode"),
      limits: formData.getAll("tierLimit"),
      percents: formData.getAll("tierPercent"),
    },
  }
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
    hotelInput(formData),
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
    hotelInput(formData),
    target.hotelId,
    async (id, { name, avatarUrl, revenueShare }) => {
      // Campos null saem do documento em vez de ficarem gravados como null.
      const $unset = { ...(!avatarUrl && { avatarUrl: 1 }), ...(!revenueShare && { revenueShare: 1 }) }
      const { matchedCount } = await Hotel.updateOne(
        { _id: id, workspaceId: target.ownedId },
        {
          $set: { name, ...(avatarUrl && { avatarUrl }), ...(revenueShare && { revenueShare }) },
          ...(Object.keys($unset).length && { $unset }),
        },
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
