"use server"

import { refresh } from "next/cache"
import { isObjectIdOrHexString } from "mongoose"
import { getSessionUserId } from "@/lib/session"
import { canManageMembers } from "@/lib/member"
import { findWorkspaceAccess } from "@/lib/workspace-access"
import {
  createUnit,
  deleteUnit,
  updateUnit,
  type CreateUnitError,
  type UpdateUnitError,
} from "@/lib/unit"
import { Appointment } from "@/models/Appointment"
import { Unit } from "@/models/Unit"
import { Service } from "@/models/Service"
import { WorkspaceMember } from "@/models/WorkspaceMember"

const errorMessages: Record<CreateUnitError | UpdateUnitError | "unauthenticated", string> = {
  invalid_input: "Informe o nome da unidade.",
  invalid_name: "Informe o nome da unidade.",
  name_too_long: "O nome pode ter no máximo 80 caracteres.",
  invalid_avatar_url: "Informe uma URL válida começando com http:// ou https://.",
  invalid_ownership: "Informe onde a unidade funciona.",
  invalid_period: "Escolha o período do faturamento.",
  too_many_tiers: "Cadastre no máximo 10 faixas.",
  invalid_tier_limit: "Os limites das faixas devem ser valores maiores que zero, em ordem crescente.",
  invalid_tier_percent: "Os percentuais devem estar entre 0 e 100, com até 2 casas decimais.",
  workspace_not_found: "Workspace não encontrado ou sem permissão.",
  unit_not_found: "Unidade não encontrada ou sem permissão.",
  unauthenticated: "Sua sessão expirou. Entre novamente.",
}

export type CreateUnitState = { error: string | null }
export type UpdateUnitState = CreateUnitState
export type DeleteUnitState = CreateUnitState

// id do workspace se o usuário puder gerenciá-lo (dono ou administrador); senão undefined.
async function findManagedWorkspaceId(workspaceId: string, userId: string) {
  const access = await findWorkspaceAccess(workspaceId, userId)
  return access && canManageMembers(access.role) ? access.id : undefined
}

// A ordem dos campos no FormData forma as faixas: um limite para cada, menos a última.
function unitInput(formData: FormData) {
  return {
    name: formData.get("name"),
    avatarUrl: formData.get("avatarUrl"),
    ownership: formData.get("ownership"),
    revenueShare: {
      period: formData.get("revenueSharePeriod"),
      limits: formData.getAll("tierLimit"),
      percents: formData.getAll("tierPercent"),
    },
  }
}

// workspaceId vem via argumento do cliente; a posse é conferida aqui, no servidor.
export async function createUnitAction(
  workspaceId: string,
  _prev: CreateUnitState,
  formData: FormData,
): Promise<CreateUnitState> {
  const userId = await getSessionUserId()
  if (!userId) return { error: errorMessages.unauthenticated }

  const ownedId = await findManagedWorkspaceId(workspaceId, userId)

  const result = await createUnit(
    unitInput(formData),
    ownedId,
    async (data) => {
      const unit = await Unit.create(data)
      return { id: unit._id.toString() }
    },
  )

  if (!result.ok) return { error: errorMessages[result.error] }

  refresh()
  return { error: null }
}

// Só repassa o unitId quando o usuário gerencia o workspace; a escrita ainda filtra
// por workspaceId para que uma unidade de outro workspace não seja encontrado.
// null = sessão expirada.
async function resolveUnitTarget(workspaceId: string, unitId: string) {
  const userId = await getSessionUserId()
  if (!userId) return null
  const ownedId = await findManagedWorkspaceId(workspaceId, userId)
  return { ownedId, unitId: ownedId && isObjectIdOrHexString(unitId) ? unitId : null }
}

export async function updateUnitAction(
  workspaceId: string,
  unitId: string,
  _prev: UpdateUnitState,
  formData: FormData,
): Promise<UpdateUnitState> {
  const target = await resolveUnitTarget(workspaceId, unitId)
  if (!target) return { error: errorMessages.unauthenticated }

  const result = await updateUnit(
    unitInput(formData),
    target.unitId,
    async (id, { name, avatarUrl, revenueShare }) => {
      // Campos null saem do documento em vez de ficarem gravados como null.
      const $unset = { ...(!avatarUrl && { avatarUrl: 1 }), ...(!revenueShare && { revenueShare: 1 }) }
      const { matchedCount } = await Unit.updateOne(
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

export async function deleteUnitAction(workspaceId: string, unitId: string): Promise<DeleteUnitState> {
  const target = await resolveUnitTarget(workspaceId, unitId)
  if (!target) return { error: errorMessages.unauthenticated }

  const result = await deleteUnit(target.unitId, async (id) => {
    const { deletedCount } = await Unit.deleteOne({ _id: id, workspaceId: target.ownedId })
    if (deletedCount === 0) return false
    await Promise.all([
      Service.deleteMany({ unitId: id }),
      Appointment.deleteMany({ unitId: id }),
      WorkspaceMember.updateMany({ "units.unitId": id }, { $pull: { units: { unitId: id } } }),
    ])
    return true
  })

  if (!result.ok) return { error: errorMessages[result.error] }

  refresh()
  return { error: null }
}
