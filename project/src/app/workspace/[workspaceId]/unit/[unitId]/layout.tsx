import { notFound } from "next/navigation"
import { isObjectIdOrHexString, Types } from "mongoose"
import { canManageMembers, type WorkspaceRole } from "@/lib/member"
import { requireUser, workspaceAccessStages } from "@/lib/session"
import { Workspace } from "@/models/Workspace"
import { Avatar, AvatarImage } from "@/components/ui/avatar"
import { InitialFallback } from "@/components/initial-fallback"
import { ServicesSetupNotice, UnitNav } from "@/components/unit-nav"

export default async function UnitLayout({
  children,
  params,
}: LayoutProps<"/workspace/[workspaceId]/unit/[unitId]">) {
  const { workspaceId, unitId } = await params
  const user = await requireUser()
  const access = workspaceAccessStages(workspaceId, user.id)
  if (!access || !isObjectIdOrHexString(unitId)) notFound()

  // Parte do workspace (e não de units) para que o acesso ao workspace seja garantido.
  // Basta saber se há algum serviço: sem eles a unidade não agenda nem registra atendimentos.
  const [workspace] = await Workspace.aggregate<{
    role: WorkspaceRole
    unit: { id: string; name: string; avatarUrl: string | null; hasServices: boolean } | null
  }>([
    ...access,
    {
      $lookup: {
        from: "units",
        localField: "_id",
        foreignField: "workspaceId",
        as: "unit",
        pipeline: [
          { $match: { _id: new Types.ObjectId(unitId) } },
          {
            $lookup: {
              from: "services",
              localField: "_id",
              foreignField: "unitId",
              as: "services",
              pipeline: [{ $limit: 1 }, { $project: { _id: 1 } }],
            },
          },
          {
            $project: {
              _id: 0,
              id: { $toString: "$_id" },
              name: 1,
              avatarUrl: { $ifNull: ["$avatarUrl", null] },
              hasServices: { $gt: [{ $size: "$services" }, 0] },
            },
          },
        ],
      },
    },
    { $project: { _id: 0, role: 1, unit: { $ifNull: [{ $first: "$unit" }, null] } } },
  ])
  const unit = workspace?.unit
  if (!unit) notFound()

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center gap-4">
        <Avatar className="size-14 rounded-lg after:rounded-lg">
          {unit.avatarUrl && <AvatarImage src={unit.avatarUrl} alt={unit.name} className="rounded-lg" />}
          <InitialFallback name={unit.name} className="rounded-lg text-lg" />
        </Avatar>
        <h2 className="min-w-0 truncate text-2xl font-semibold tracking-tight">{unit.name}</h2>
      </div>
      {!unit.hasServices && (
        <ServicesSetupNotice workspaceId={workspaceId} unitId={unitId} canManage={canManageMembers(workspace.role)} />
      )}
      <UnitNav workspaceId={workspaceId} unitId={unitId} hasServices={unit.hasServices} />
      {children}
    </div>
  )
}
