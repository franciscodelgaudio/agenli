import Link from "next/link"
import { notFound } from "next/navigation"
import { matchOwnedWorkspace, requireUser } from "@/lib/session"
import { Workspace } from "@/models/Workspace"
import { Button } from "@/components/ui/button"
import { CreateHotelSheet } from "@/components/create-hotel-sheet"
import { HotelList } from "@/components/hotel-list"
import { HotelsEmpty } from "@/components/hotels-empty"

export default async function WorkspacePage({ params }: PageProps<"/workspace/[workspaceId]">) {
  const { workspaceId } = await params
  const user = await requireUser()
  const match = matchOwnedWorkspace(workspaceId, user.id)
  if (!match) notFound()

  // Workspace + as 5 primeiras unidades + o total, numa consulta só.
  const [workspace] = await Workspace.aggregate<{
    id: string
    name: string
    hotels: { id: string; name: string; avatarUrl: string | null }[]
    hotelCount: number
  }>([
    match,
    {
      $lookup: {
        from: "hotels",
        localField: "_id",
        foreignField: "workspaceId",
        as: "hotels",
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
        hotels: { $slice: ["$hotels", 5] },
        hotelCount: { $size: "$hotels" },
      },
    },
  ])
  if (!workspace) notFound()
  const { hotels, hotelCount } = workspace

  if (hotelCount === 0) {
    return (
      <div className="flex flex-1 flex-col p-4">
        <HotelsEmpty workspaceId={workspace.id} />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">{workspace.name}</h2>
        <CreateHotelSheet workspaceId={workspace.id} />
      </div>
      <HotelList hotels={hotels} />
      {hotelCount > hotels.length && (
        <Button
          variant="link"
          className="self-start"
          nativeButton={false}
          render={<Link href={`/workspace/${workspace.id}/unit`} />}
        >
          Ver todas as {hotelCount} unidades
        </Button>
      )}
    </div>
  )
}
