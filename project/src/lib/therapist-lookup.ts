import { isObjectIdOrHexString, Types } from "mongoose"
import { User } from "@/models/User"
import { Workspace } from "@/models/Workspace"
import { WorkspaceMember } from "@/models/WorkspaceMember"

// Ids inválidos são descartados antes da consulta; a validação os trata como não encontrados.
export function objectIds(ids: string[]) {
  return ids.filter((id) => isObjectIdOrHexString(id)).map((id) => new Types.ObjectId(id))
}

// Para server actions: dos ids pedidos, quem pode atender no workspace — o proprietário e
// os membros com função de massagista que aceitaram o convite.
export async function findWorkspaceTherapists(workspaceId: string, ids: string[]) {
  const userIds = objectIds(ids)
  const [workspace, members] = await Promise.all([
    Workspace.findById(workspaceId).select({ userId: 1 }).lean(),
    WorkspaceMember.find({ workspaceId, role: "massage_therapist", userId: { $in: userIds } })
      .select({ userId: 1 })
      .lean(),
  ])
  const allowed = members.map((member) => member.userId!)
  if (workspace && userIds.some((id) => id.equals(workspace.userId))) allowed.push(workspace.userId)
  const users = await User.find({ _id: { $in: allowed } }).select({ name: 1, email: 1 }).lean()
  return users.map((user) => ({ id: user._id.toString(), name: user.name ?? user.email }))
}
