import { notFound } from "next/navigation"
import { isObjectIdOrHexString, Types } from "mongoose"
import {
  cashFlowBuckets,
  cashFlowFetchRange,
  dailyAppointmentTotalsPipeline,
  dailyBookingForecastPipeline,
  parseCashFlowQuery,
  summarizeCashFlow,
  type DayTotal,
} from "@/lib/cash-flow"
import type { RevenueShare } from "@/lib/revenue-share"
import { requireUser, workspaceAccessStages } from "@/lib/session"
import { Appointment } from "@/models/Appointment"
import { Booking } from "@/models/Booking"
import { Workspace } from "@/models/Workspace"
import { CashFlowNav } from "@/components/cash-flow-nav"
import { CashFlowTable } from "@/components/cash-flow-table"
import { periodLabels } from "@/components/revenue-share-labels"

// Layout e página podem renderizar em paralelo, então a página refaz a verificação de acesso.
export default async function CashFlowPage({
  params,
  searchParams,
}: PageProps<"/workspace/[workspaceId]/unit/[unitId]/cash-flow">) {
  const { workspaceId, unitId } = await params
  const now = new Date()
  const query = parseCashFlowQuery(await searchParams, now)
  const user = await requireUser()
  const access = workspaceAccessStages(workspaceId, user.id)
  if (!access || !isObjectIdOrHexString(unitId)) notFound()

  // Parte do workspace para garantir o acesso; a regra de repasse define quantos dias buscar.
  const [workspace] = await Workspace.aggregate<{ unit: { revenueShare: RevenueShare | null } | null }>([
    ...access,
    {
      $lookup: {
        from: "units",
        localField: "_id",
        foreignField: "workspaceId",
        as: "unit",
        pipeline: [
          { $match: { _id: new Types.ObjectId(unitId) } },
          { $project: { _id: 0, revenueShare: { $ifNull: ["$revenueShare", null] } } },
        ],
      },
    },
    { $project: { _id: 0, unit: { $ifNull: [{ $first: "$unit" }, null] } } },
  ])
  if (!workspace?.unit) notFound()
  const { revenueShare } = workspace.unit

  const buckets = cashFlowBuckets(query)
  const range = cashFlowFetchRange(buckets, revenueShare?.period ?? null)
  const unitMatch = { $match: { unitId: new Types.ObjectId(unitId) } }
  const [appointments, bookings] = await Promise.all([
    Appointment.aggregate<DayTotal>([unitMatch, ...dailyAppointmentTotalsPipeline(range)]),
    Booking.aggregate<DayTotal>([unitMatch, ...dailyBookingForecastPipeline(range, now)]),
  ])
  const summary = summarizeCashFlow(buckets, appointments, bookings, revenueShare)

  const today = parseCashFlowQuery({}, now).date
  const shown = { from: buckets[0].from, to: buckets.at(-1)!.to }
  const pathname = `/workspace/${workspaceId}/unit/${unitId}/cash-flow`

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold tracking-tight">Caixa</h3>
      <CashFlowNav
        query={query}
        range={shown}
        isCurrent={shown.from <= today && today <= shown.to}
        today={today}
        pathname={pathname}
      />
      <CashFlowTable view={query.view} summary={summary} hasPartnerShare={!!revenueShare} today={today} />
      <p className="text-sm text-muted-foreground">
        Real soma os atendimentos registrados. Previsto soma também os agendamentos de agora em diante, pelo
        preço atual do serviço.{" "}
        {revenueShare
          ? `O repasse ao estabelecimento é calculado sobre o faturamento ${periodLabels[revenueShare.period].toLowerCase()} e distribuído proporcionalmente entre os períodos.`
          : "Unidade em espaço próprio: sem repasse, o lucro líquido é igual ao bruto."}
      </p>
    </div>
  )
}
