import Link from "next/link"
import { notFound } from "next/navigation"
import { canManageMembers, type WorkspaceRole } from "@/lib/member"
import { requireUser, workspaceAccessStages } from "@/lib/session"
import { Workspace } from "@/models/Workspace"
import { Button } from "@/components/ui/button"
import { CreateUnitSheet } from "@/components/create-unit-sheet"
import { UnitList } from "@/components/unit-list"
import { UnitsEmpty } from "@/components/units-empty"

export default async function WorkspacePage({ params }: PageProps<"/workspace/[workspaceId]">) {
  const { workspaceId } = await params
  const user = await requireUser()
  const access = workspaceAccessStages(workspaceId, user.id)
  if (!access) notFound()

  // Workspace + as 5 primeiras unidades + o total, numa consulta só.
  const [workspace] = await Workspace.aggregate<{
    id: string
    name: string
    role: WorkspaceRole
    units: { id: string; name: string; avatarUrl: string | null }[]
    unitCount: number
  }>([
    ...access,
    {
      $lookup: {
        from: "units",
        localField: "_id",
        foreignField: "workspaceId",
        as: "units",
        pipeline: [
          { $sort: { name: 1 } },
          {
            $project: {
              _id: 0,
              id: { $toString: "$_id" },
              name: 1,
              avatarUrl: { $ifNull: ["$avatarUrl", null] },
            },
          },
        ],
      },
    },
    {
      $project: {
        _id: 0,
        id: { $toString: "$_id" },
        name: 1,
        role: 1,
        units: { $slice: ["$units", 5] },
        unitCount: { $size: "$units" },
      },
    },
  ])
  if (!workspace) notFound()
  const { units, unitCount } = workspace
  const canManage = canManageMembers(workspace.role)

  if (unitCount === 0) {
    return (
      <div className="flex flex-1 flex-col p-4">
        <UnitsEmpty workspaceId={workspace.id} canManage={canManage} />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">{workspace.name}</h2>
        {canManage && <CreateUnitSheet workspaceId={workspace.id} />}
      </div>
      <UnitList units={units} />
      {unitCount > units.length && (
        <Button
          variant="link"
          className="self-start"
          nativeButton={false}
          render={<Link href={`/workspace/${workspace.id}/unit`} />}
        >
          Ver todas as {unitCount} unidades
        </Button>
      )}
    </div>
  )
}
