import Link from "next/link"
import { notFound } from "next/navigation"
import { isObjectIdOrHexString, Types } from "mongoose"
import { ArrowLeftIcon } from "lucide-react"
import { matchOwnedWorkspace, requireUser } from "@/lib/session"
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
  const match = matchOwnedWorkspace(workspaceId, user.id)
  if (!match || !isObjectIdOrHexString(unitId)) notFound()

  // Parte do workspace (e não de hotels) para que o $match garanta a posse.
  const [workspace] = await Workspace.aggregate<{
    hotel: { id: string; name: string; avatarUrl: string | null; createdAt: Date; updatedAt: Date } | null
  }>([
    match,
    {
      $lookup: {
        from: "hotels",
        localField: "_id",
        foreignField: "workspaceId",
        as: "hotel",
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
    { $project: { _id: 0, hotel: { $ifNull: [{ $first: "$hotel" }, null] } } },
  ])
  const hotel = workspace?.hotel
  if (!hotel) notFound()

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
          {hotel.avatarUrl && <AvatarImage src={hotel.avatarUrl} alt={hotel.name} className="rounded-lg" />}
          <AvatarFallback className="rounded-lg text-lg">{hotel.name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="grid gap-1">
          <h2 className="truncate text-2xl font-semibold tracking-tight">{hotel.name}</h2>
          <p className="text-sm text-muted-foreground">
            Criado em {dateTimeFormat.format(hotel.createdAt)} · Atualizado em{" "}
            {dateTimeFormat.format(hotel.updatedAt)}
          </p>
        </div>
      </div>
      <UnitNav workspaceId={workspaceId} unitId={unitId} />
      {children}
    </div>
  )
}
