import { notFound } from "next/navigation"
import { canManageMembers, type WorkspaceRole } from "@/lib/member"
import { requireUser, workspaceAccessStages } from "@/lib/session"
import { hotelListPipeline, parseHotelListQuery } from "@/lib/hotel-list"
import type { RevenueShare } from "@/lib/revenue-share"
import { Workspace } from "@/models/Workspace"
import { CreateHotelSheet } from "@/components/create-hotel-sheet"
import { ListSearch } from "@/components/list-search"
import { HotelTable } from "@/components/hotel-table"
import { HotelsEmpty } from "@/components/hotels-empty"

export default async function HotelsPage({
  params,
  searchParams,
}: PageProps<"/workspace/[workspaceId]/unit">) {
  const { workspaceId } = await params
  const query = parseHotelListQuery(await searchParams)
  const user = await requireUser()
  const access = workspaceAccessStages(workspaceId, user.id)
  if (!access) notFound()

  // Parte do workspace (e não de hotels) para que o acesso ao workspace seja garantido.
  // O total sem filtro separa "workspace sem unidades" de "busca sem resultado".
  const [workspace] = await Workspace.aggregate<{
    hotels: {
      id: string
      name: string
      avatarUrl: string | null
      revenueShare: RevenueShare | null
      createdAt: Date
      updatedAt: Date
    }[]
    hotelCount: number
    role: WorkspaceRole
  }>([
    ...access,
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
        role: 1,
        hotelCount: { $ifNull: [{ $first: "$hotelCount.n" }, 0] },
      },
    },
  ])
  if (!workspace) notFound()
  const { hotels, hotelCount } = workspace
  const canManage = canManageMembers(workspace.role)

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">Unidades</h2>
        {canManage && hotelCount > 0 && <CreateHotelSheet workspaceId={workspaceId} />}
      </div>
      {hotelCount === 0 ? (
        <HotelsEmpty workspaceId={workspaceId} canManage={canManage} />
      ) : (
        <>
          <ListSearch query={query} placeholder="Buscar unidade..." />
          <HotelTable
            hotels={hotels}
            query={query}
            pathname={`/workspace/${workspaceId}/unit`}
            workspaceId={workspaceId}
            canManage={canManage}
          />
        </>
      )}
    </div>
  )
}
