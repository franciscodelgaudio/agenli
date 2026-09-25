import { notFound } from "next/navigation"
import { isObjectIdOrHexString, Types } from "mongoose"
import { SparklesIcon } from "lucide-react"
import { canManageMembers, type WorkspaceRole } from "@/lib/member"
import { requireUser, workspaceAccessStages } from "@/lib/session"
import { parseServiceListQuery, serviceListPipeline } from "@/lib/service-list"
import { Workspace } from "@/models/Workspace"
import { CreateServiceSheet } from "@/components/create-service-sheet"
import { ListSearch } from "@/components/list-search"
import { ServiceTable } from "@/components/service-table"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

type ServiceRow = { id: string; name: string; priceCents: number; durationMinutes: number; productIds: string[] }
type ProductOption = { id: string; name: string }

// Layout e página podem renderizar em paralelo, então a página refaz a verificação de acesso.
export default async function ServicesPage({
  params,
  searchParams,
}: PageProps<"/workspace/[workspaceId]/unit/[unitId]/services">) {
  const { workspaceId, unitId } = await params
  const query = parseServiceListQuery(await searchParams)
  const user = await requireUser()
  const access = workspaceAccessStages(workspaceId, user.id)
  if (!access || !isObjectIdOrHexString(unitId)) notFound()

  // Parte do workspace -> unidade -> serviços para que o acesso seja garantido em cada nível.
  // O total sem filtro separa "unidade sem serviços" de "busca sem resultado".
  const [workspace] = await Workspace.aggregate<{
    role: WorkspaceRole
    unit: { services: ServiceRow[]; serviceCount: number; products: ProductOption[] } | null
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
              pipeline: serviceListPipeline(query),
            },
          },
          {
            $lookup: {
              from: "services",
              localField: "_id",
              foreignField: "unitId",
              as: "serviceCount",
              pipeline: [{ $count: "n" }],
            },
          },
          {
            $lookup: {
              from: "products",
              localField: "_id",
              foreignField: "unitId",
              as: "products",
              pipeline: [{ $sort: { name: 1, _id: 1 } }, { $project: { _id: 0, id: { $toString: "$_id" }, name: 1 } }],
            },
          },
          {
            $project: {
              _id: 0,
              services: 1,
              products: 1,
              serviceCount: { $ifNull: [{ $first: "$serviceCount.n" }, 0] },
            },
          },
        ],
      },
    },
    { $project: { _id: 0, role: 1, unit: { $ifNull: [{ $first: "$unit" }, null] } } },
  ])
  if (!workspace?.unit) notFound()
  const { services, serviceCount, products } = workspace.unit
  const canManage = canManageMembers(workspace.role)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold tracking-tight">Serviços</h3>
        {canManage && serviceCount > 0 && <CreateServiceSheet workspaceId={workspaceId} unitId={unitId} products={products} />}
      </div>
      {serviceCount === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SparklesIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum serviço cadastrado</EmptyTitle>
            <EmptyDescription>
              {canManage
                ? "Cadastre os serviços prestados nesta unidade, com valor e duração média."
                : "Esta unidade ainda não tem serviços cadastrados."}
            </EmptyDescription>
          </EmptyHeader>
          {canManage && (
            <EmptyContent>
              <CreateServiceSheet workspaceId={workspaceId} unitId={unitId} products={products} />
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <>
          <ListSearch query={query} placeholder="Buscar serviço..." />
          <ServiceTable
            services={services}
            products={products}
            query={query}
            pathname={`/workspace/${workspaceId}/unit/${unitId}/services`}
            workspaceId={workspaceId}
            unitId={unitId}
            canManage={canManage}
          />
        </>
      )}
    </div>
  )
}
