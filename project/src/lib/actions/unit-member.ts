"use server"

import { refresh } from "next/cache"
import { isObjectIdOrHexString, Types } from "mongoose"
import { getSessionUserId } from "@/lib/session"
import { updateUnitMember, type UpdateUnitMemberError } from "@/lib/unit-member"
import { findWorkspaceAccess } from "@/lib/workspace-access"
import { Unit } from "@/models/Unit"
import { WorkspaceMember } from "@/models/WorkspaceMember"

const errorMessages: Record<UpdateUnitMemberError | "unauthenticated", string> = {
  workspace_not_found: "Workspace não encontrado ou sem permissão.",
  forbidden: "Só o proprietário e administradores gerenciam a equipe; massagistas, só o proprietário.",
  member_not_found: "Usuário não encontrado nesta unidade.",
  invalid_input: "Preencha todos os campos.",
  invalid_commission: "Informe uma comissão entre 0% e 100%.",
  unauthenticated: "Sua sessão expirou. Entre novamente.",
}

export type UnitMemberFormState = { error: string | null }

// workspaceId e unitId vêm via argumento do cliente; o acesso é conferido aqui, no servidor.
export async function updateUnitMemberAction(
  workspaceId: string,
  unitId: string,
  memberId: string,
  _prev: UnitMemberFormState,
  formData: FormData,
): Promise<UnitMemberFormState> {
  const userId = await getSessionUserId()
  if (!userId) return { error: errorMessages.unauthenticated }
  const access = await findWorkspaceAccess(workspaceId, userId)

  // Membro e unidade precisam ser do workspace; ids inválidos contam como não encontrados.
  const valid = access && isObjectIdOrHexString(unitId) && isObjectIdOrHexString(memberId)
  const unitObjectId = valid ? new Types.ObjectId(unitId) : null
  const filter = valid ? { _id: new Types.ObjectId(memberId), workspaceId: new Types.ObjectId(access.id) } : null

  const result = await updateUnitMember(
    { linked: formData.get("linked") === "on", commissionPercent: formData.get("commissionPercent") },
    memberId,
    { actorRole: access?.role ?? null },
    {
      findMember: async () => {
        if (!filter || !(await Unit.exists({ _id: unitObjectId, workspaceId: filter.workspaceId }))) return null
        const member = await WorkspaceMember.findOne(filter).select("role").lean()
        return member && { id: member._id.toString(), role: member.role }
      },
      // Tira o vínculo antigo e, se for o caso, grava o novo: vale para criar e para editar.
      update: async (_id, data) => {
        await WorkspaceMember.updateOne(filter!, { $pull: { units: { unitId: unitObjectId } } })
        if (data.linked) {
          await WorkspaceMember.updateOne(filter!, {
            $push: { units: { unitId: unitObjectId, commissionPercent: data.commissionPercent } },
          })
        }
      },
    },
  )

  if (!result.ok) return { error: errorMessages[result.error] }

  refresh()
  return { error: null }
}
