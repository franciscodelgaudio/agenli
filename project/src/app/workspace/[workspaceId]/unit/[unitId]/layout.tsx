import Link from "next/link"
import { notFound } from "next/navigation"
import { isObjectIdOrHexString, Types } from "mongoose"
import { ArrowLeftIcon } from "lucide-react"
import { requireUser, workspaceAccessStages } from "@/lib/session"
import { dateTimeFormat } from "@/lib/utils"
import { Workspace } from "@/models/Workspace"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { UnitNav } from "@/components/unit-nav"

export default async function UnitLayout({
  children,
  params,
}: LayoutProps<"/workspace/[workspaceId]/unit/[unitId]">) {
  const { workspaceId, unitId } = await params
  const user = await requireUser()
  const access = workspaceAccessStages(workspaceId, user.id)
  if (!access || !isObjectIdOrHexString(unitId)) notFound()

  // Parte do workspace (e não de units) para que o acesso ao workspace seja garantido.
  const [workspace] = await Workspace.aggregate<{
    unit: { id: string; name: string; avatarUrl: string | null; createdAt: Date; updatedAt: Date } | null
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
            $project: {
              _id: 0,
              id: { $toString: "$_id" },
              name: 1,
              avatarUrl: { $ifNull: ["$avatarUrl", null] },
              createdAt: 1,
              updatedAt: 1,
            },
          },
        ],
      },
    },
    { $project: { _id: 0, unit: { $ifNull: [{ $first: "$unit" }, null] } } },
  ])
  const unit = workspace?.unit
  if (!unit) notFound()

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        nativeButton={false}
        render={<Link href={`/workspace/${workspaceId}/unit`} />}
      >
        <ArrowLeftIcon />
        Unidades
      </Button>
      <div className="flex items-center gap-4">
        <Avatar className="size-14 rounded-lg after:rounded-lg">
          {unit.avatarUrl && <AvatarImage src={unit.avatarUrl} alt={unit.name} className="rounded-lg" />}
          <AvatarFallback className="rounded-lg text-lg">{unit.name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="grid gap-1">
          <h2 className="truncate text-2xl font-semibold tracking-tight">{unit.name}</h2>
          <p className="text-sm text-muted-foreground">
            Criado em {dateTimeFormat.format(unit.createdAt)} · Atualizado em{" "}
            {dateTimeFormat.format(unit.updatedAt)}
          </p>
        </div>
      </div>
      <UnitNav workspaceId={workspaceId} unitId={unitId} />
      {children}
    </div>
  )
}
