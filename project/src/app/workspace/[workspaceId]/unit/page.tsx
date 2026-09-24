import { notFound } from "next/navigation"
import { matchOwnedWorkspace, requireUser } from "@/lib/session"
import { Workspace } from "@/models/Workspace"
import { CreateHotelSheet } from "@/components/create-hotel-sheet"
import { HotelList } from "@/components/hotel-list"
import { HotelsEmpty } from "@/components/hotels-empty"

export default async function HotelsPage({ params }: PageProps<"/workspace/[workspaceId]/unidades">) {
  const { workspaceId } = await params
  const user = await requireUser()
  const match = matchOwnedWorkspace(workspaceId, user.id)
  if (!match) notFound()

  // Parte do workspace (e não de hotels) para que o $match garanta a posse.
  const [workspace] = await Workspace.aggregate<{
    hotels: { id: string; name: string; avatarUrl: string | null }[]
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
    { $project: { _id: 0, hotels: 1 } },
  ])
  if (!workspace) notFound()
  const { hotels } = workspace

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">Unidades</h2>
        {hotels.length > 0 && <CreateHotelSheet workspaceId={workspaceId} />}
      </div>
      {hotels.length === 0 ? (
        <HotelsEmpty workspaceId={workspaceId} />
      ) : (
        <HotelList hotels={hotels} />
      )}
    </div>
  )
}
