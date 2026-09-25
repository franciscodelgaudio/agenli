import { notFound } from "next/navigation"
import { isObjectIdOrHexString, Types } from "mongoose"
import { PackageIcon } from "lucide-react"
import { canManageMembers, type WorkspaceRole } from "@/lib/member"
import { requireUser, workspaceAccessStages } from "@/lib/session"
import { parseProductListQuery, productListPipeline } from "@/lib/product-list"
import { summarizeProductUsage } from "@/lib/product-usage"
import { Product } from "@/models/Product"
import { Workspace } from "@/models/Workspace"
import { CreateProductSheet } from "@/components/create-product-sheet"
import { ListSearch } from "@/components/list-search"
import { ProductTable } from "@/components/product-table"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

type ProductRow = {
  id: string
  name: string
  quantity: number
  costCents: number
  notes: string | null
  rating: number | null
  avatarUrl: string | null
}

// Layout e página podem renderizar em paralelo, então a página refaz a verificação de acesso.
export default async function StockPage({
  params,
  searchParams,
}: PageProps<"/workspace/[workspaceId]/unit/[unitId]/stock">) {
  const { workspaceId, unitId } = await params
  const query = parseProductListQuery(await searchParams)
  const user = await requireUser()
  const access = workspaceAccessStages(workspaceId, user.id)
  if (!access || !isObjectIdOrHexString(unitId)) notFound()

  // Parte do workspace -> unidade -> produtos para que o acesso seja garantido em cada nível.
  // O total sem filtro separa "unidade sem produtos" de "busca sem resultado".
  const [workspace] = await Workspace.aggregate<{
    role: WorkspaceRole
    unit: { products: ProductRow[]; productCount: number } | null
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
              from: "products",
              localField: "_id",
              foreignField: "unitId",
              as: "products",
              pipeline: productListPipeline(query),
            },
          },
          {
            $lookup: {
              from: "products",
              localField: "_id",
              foreignField: "unitId",
              as: "productCount",
              pipeline: [{ $count: "n" }],
            },
          },
          {
            $project: {
              _id: 0,
              products: 1,
              productCount: { $ifNull: [{ $first: "$productCount.n" }, 0] },
            },
          },
        ],
      },
    },
    { $project: { _id: 0, role: 1, unit: { $ifNull: [{ $first: "$unit" }, null] } } },
  ])
  if (!workspace?.unit) notFound()
  const { products: rows, productCount } = workspace.unit
  const canManage = canManageMembers(workspace.role)

  // Uso de cada produto: atendimentos e agendamentos que o listaram. Agendamento que virou
  // atendimento já conta pelo atendimento, então só entram os que ainda não viraram.
  // A unidade já foi conferida acima, a partir do workspace.
  const usage = await Product.aggregate<{ id: string; depletedAt: Date[]; uses: Date[] }>([
    { $match: { unitId: new Types.ObjectId(unitId) } },
    {
      $lookup: {
        from: "appointments",
        localField: "_id",
        foreignField: "products.productId",
        as: "appointments",
        pipeline: [{ $project: { _id: 0, at: "$performedAt" } }],
      },
    },
    {
      $lookup: {
        from: "bookings",
        localField: "_id",
        foreignField: "products.productId",
        as: "bookings",
        pipeline: [{ $match: { appointmentId: null } }, { $project: { _id: 0, at: "$startsAt" } }],
      },
    },
    {
      $project: {
        _id: 0,
        id: { $toString: "$_id" },
        depletedAt: { $ifNull: ["$depletedAt", []] },
        uses: { $concatArrays: ["$appointments.at", "$bookings.at"] },
      },
    },
  ])
  const now = new Date()
  const usageById = new Map(usage.map((u) => [u.id, summarizeProductUsage(u.uses, u.depletedAt, now)]))
  const empty = summarizeProductUsage([], [], now)
  const products = rows.map((product) => ({ ...product, usage: usageById.get(product.id) ?? empty }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold tracking-tight">Estoque</h3>
        {canManage && productCount > 0 && <CreateProductSheet workspaceId={workspaceId} unitId={unitId} />}
      </div>
      {productCount === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackageIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum produto em estoque</EmptyTitle>
            <EmptyDescription>
              {canManage
                ? "Cadastre os produtos desta unidade, com quantidade, preço de custo e avaliação."
                : "Esta unidade ainda não tem produtos cadastrados."}
            </EmptyDescription>
          </EmptyHeader>
          {canManage && (
            <EmptyContent>
              <CreateProductSheet workspaceId={workspaceId} unitId={unitId} />
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <>
          <ListSearch query={query} placeholder="Buscar produto..." />
          <ProductTable
            products={products}
            query={query}
            pathname={`/workspace/${workspaceId}/unit/${unitId}/stock`}
            workspaceId={workspaceId}
            unitId={unitId}
            canManage={canManage}
          />
        </>
      )}
    </div>
  )
}
