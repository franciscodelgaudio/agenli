import { isObjectIdOrHexString } from "mongoose"
import { canManageMembers } from "@/lib/member"
import { findWorkspaceAccess } from "@/lib/workspace-access"
import { Unit } from "@/models/Unit"

// Para server actions: ids do workspace e da unidade se a unidade for de um
// workspace que o usuário gerencia (dono ou administrador); senão null.
export async function findManagedUnit(workspaceId: string, unitId: string, userId: string) {
  const access = await findWorkspaceAccess(workspaceId, userId)
  if (!access || !canManageMembers(access.role) || !isObjectIdOrHexString(unitId)) return null
  const unit = await Unit.exists({ _id: unitId, workspaceId: access.id })
  return unit ? { workspaceId: access.id, unitId } : null
}
