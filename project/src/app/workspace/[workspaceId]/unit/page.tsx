import { notFound } from "next/navigation"
import { matchOwnedWorkspace, requireUser } from "@/lib/session"
import { hotelListPipeline, parseHotelListQuery } from "@/lib/hotel-list"
import { Workspace } from "@/models/Workspace"
import { CreateHotelSheet } from "@/components/create-hotel-sheet"
import { HotelSearch } from "@/components/hotel-search"
import { HotelTable } from "@/components/hotel-table"
import { HotelsEmpty } from "@/components/hotels-empty"

export default async function HotelsPage({
  params,
  searchParams,
}: PageProps<"/workspace/[workspaceId]/unit">) {
  const { workspaceId } = await params
  const query = parseHotelListQuery(await searchParams)
  const user = await requireUser()
  const match = matchOwnedWorkspace(workspaceId, user.id)
  if (!match) notFound()

  // Parte do workspace (e não de hotels) para que o $match garanta a posse.
  // O total sem filtro separa "workspace sem unidades" de "busca sem resultado".
  const [workspace] = await Workspace.aggregate<{
    hotels: { id: string; name: string; avatarUrl: string | null; createdAt: Date; updatedAt: Date }[]
    hotelCount: number
  }>([
    match,
    {
      $lookup: {
        from: "hotels",
        localField: "_id",
        foreignField: "workspaceId",
        as: "hotels",
        pipeline: hotelListPipeline(query),
      },
    },
    {
      $lookup: {
        from: "hotels",
        localField: "_id",
        foreignField: "workspaceId",
        as: "hotelCount",
        pipeline: [{ $count: "n" }],
      },
    },
    {
      $project: {
        _id: 0,
        hotels: 1,
        hotelCount: { $ifNull: [{ $first: "$hotelCount.n" }, 0] },
      },
    },
  ])
  if (!workspace) notFound()
  const { hotels, hotelCount } = workspace

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">Unidades</h2>
        {hotelCount > 0 && <CreateHotelSheet workspaceId={workspaceId} />}
      </div>
      {hotelCount === 0 ? (
        <HotelsEmpty workspaceId={workspaceId} />
      ) : (
        <>
          <HotelSearch query={query} />
          <HotelTable
            hotels={hotels}
            query={query}
            pathname={`/workspace/${workspaceId}/unit`}
            workspaceId={workspaceId}
          />
        </>
      )}
    </div>
  )
}
