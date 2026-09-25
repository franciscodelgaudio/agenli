import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { isObjectIdOrHexString, Types } from "mongoose"
import { ArrowLeftIcon } from "lucide-react"
import { requireUser, workspaceAccessStages } from "@/lib/session"
import { findProductUsage } from "@/lib/product-lookup"
import {
  PRODUCT_HISTORY_PAGE_SIZE,
  parseProductHistoryQuery,
  productHistoryPipeline,
  type ProductHistoryPage,
} from "@/lib/product-history"
import { Appointment } from "@/models/Appointment"
import { Workspace } from "@/models/Workspace"
import { ListPagination } from "@/components/list-pagination"
import { ListSearch } from "@/components/list-search"
import { PeriodFilter } from "@/components/period-filter"
import { formatAverage, formatUses } from "@/components/product-format"
import { ProductHistoryKindFilter } from "@/components/product-history-kind-filter"
import { ProductHistoryTable } from "@/components/product-history-table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

type ProductHeader = { name: string; quantity: number; avatarUrl: string | null }

// Histórico de uso de um produto: atendimentos, agendamentos e cada vez que ele acabou.
// Layout e página podem renderizar em paralelo, então a página refaz a verificação de acesso.
export default async function ProductHistoryPage({
  params,
  searchParams,
}: PageProps<"/workspace/[workspaceId]/unit/[unitId]/stock/[productId]">) {
  const { workspaceId, unitId, productId } = await params
  const query = parseProductHistoryQuery(await searchParams)
  const user = await requireUser()
  const access = workspaceAccessStages(workspaceId, user.id)
  if (!access || !isObjectIdOrHexString(unitId) || !isObjectIdOrHexString(productId)) notFound()

  // Parte do workspace -> unidade -> produto para que o acesso seja garantido em cada nível.
  const [workspace] = await Workspace.aggregate<{ product: ProductHeader | null }>([
    ...access,
    {
      $lookup: {
        from: "units",
        localField: "_id",
        foreignField: "workspaceId",
        as: "unit",
        pipeline: [{ $match: { _id: new Types.ObjectId(unitId) } }, { $project: { _id: 1 } }],
      },
    },
    {
      $lookup: {
        from: "products",
        localField: "unit._id",
        foreignField: "unitId",
        as: "product",
        pipeline: [
          { $match: { _id: new Types.ObjectId(productId) } },
          { $project: { _id: 0, name: 1, quantity: 1, avatarUrl: { $ifNull: ["$avatarUrl", null] } } },
        ],
      },
    },
    { $project: { _id: 0, product: { $ifNull: [{ $first: "$product" }, null] } } },
  ])
  const product = workspace?.product
  if (!product) notFound()

  const [[history], usageOf] = await Promise.all([
    Appointment.aggregate<ProductHistoryPage>(productHistoryPipeline(productId, query)),
    findProductUsage(unitId, productId),
  ])
  const usage = usageOf(productId)
  const cycleUses = Object.fromEntries(usage.cycles.map((cycle) => [cycle.depletedAt.toISOString(), cycle.uses]))

  const pathname = `/workspace/${workspaceId}/unit/${unitId}/stock/${productId}`
  // Filtros mudam sem levar a página junto, então a lista volta para a primeira.
  const { page, ...filters } = query
  // Página além da última (ex.: depois de mudar o filtro) vai para a última.
  const pages = Math.ceil(history.total / PRODUCT_HISTORY_PAGE_SIZE)
  if (pages > 0 && page > pages) {
    const next = new URLSearchParams(
      Object.entries({ ...filters, page: pages > 1 ? String(pages) : "" }).filter(([, v]) => v),
    )
    redirect(`${pathname}?${next}`)
  }

  const stats = [
    { label: "Média até acabar", value: formatAverage(usage.averageUsesPerDepletion) },
    { label: "Desde a última vez que acabou", value: formatUses(usage.usesSinceLastDepletion) },
    { label: "Vezes que acabou", value: String(usage.cycles.length) },
    { label: "Quantidade em estoque", value: String(product.quantity) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        nativeButton={false}
        render={<Link href={`/workspace/${workspaceId}/unit/${unitId}/stock`} />}
      >
        <ArrowLeftIcon />
        Estoque
      </Button>
      <div className="flex items-center gap-3">
        <Avatar className="size-10 rounded-md after:rounded-md">
          {product.avatarUrl && <AvatarImage src={product.avatarUrl} alt={product.name} className="rounded-md" />}
          <AvatarFallback className="rounded-md">{product.name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="grid gap-0.5">
          <h3 className="truncate text-lg font-semibold tracking-tight">{product.name}</h3>
          <p className="text-sm text-muted-foreground">Histórico de uso</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="border p-3">
            <dt className="text-sm text-muted-foreground">{stat.label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        Contam os atendimentos e os agendamentos que ainda não viraram atendimento, até agora. Agendamentos futuros
        aparecem na lista, mas só contam quando a data chegar.
      </p>

      <div className="flex w-full flex-wrap items-center gap-2">
        <ListSearch query={filters} placeholder="Buscar hóspede, quarto, serviço ou massagista..." />
        <ProductHistoryKindFilter query={filters} />
        <PeriodFilter query={filters} />
        <p className="ml-auto text-sm text-muted-foreground">
          {history.total} {history.total === 1 ? "registro" : "registros"}
        </p>
      </div>
      <ProductHistoryTable
        rows={history.rows}
        query={filters}
        pathname={pathname}
        cycleUses={cycleUses}
        now={new Date()}
      />
      <ListPagination
        query={filters}
        page={page}
        pageSize={PRODUCT_HISTORY_PAGE_SIZE}
        total={history.total}
        pathname={pathname}
        itemLabel="registros"
      />
    </div>
  )
}
