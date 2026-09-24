import { isObjectIdOrHexString } from "mongoose"
import { canManageMembers } from "@/lib/member"
import { findWorkspaceAccess } from "@/lib/workspace-access"
import { Hotel } from "@/models/Hotel"

// Para server actions: ids do workspace e da unidade se a unidade for de um
// workspace que o usuário gerencia (dono ou administrador); senão null.
export async function findManagedUnit(workspaceId: string, hotelId: string, userId: string) {
  const access = await findWorkspaceAccess(workspaceId, userId)
  if (!access || !canManageMembers(access.role) || !isObjectIdOrHexString(hotelId)) return null
  const hotel = await Hotel.exists({ _id: hotelId, workspaceId: access.id })
  return hotel ? { workspaceId: access.id, hotelId } : null
}
