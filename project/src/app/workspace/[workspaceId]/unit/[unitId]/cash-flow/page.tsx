import { notFound } from "next/navigation"
import { isObjectIdOrHexString, Types } from "mongoose"
import {
  applyStaffCosts,
  cashFlowBuckets,
  cashFlowFetchRange,
  dailyAppointmentTotalsPipeline,
  dailyBookingForecastPipeline,
  parseCashFlowQuery,
  serviceAppointmentTotalsPipeline,
  serviceBookingForecastPipeline,
  summarizeCashFlow,
  summarizeServices,
  summarizeTherapists,
  type CommissionRates,
  type DayTotal,
  type ServiceTotal,
} from "@/lib/cash-flow"
import type { RevenueShare } from "@/lib/revenue-share"
import { requirePage } from "@/lib/page-guard"
import { requireUser, workspaceAccessStages } from "@/lib/session"
import { Appointment } from "@/models/Appointment"
import { Booking } from "@/models/Booking"
import { Workspace } from "@/models/Workspace"
import { WorkspaceMember } from "@/models/WorkspaceMember"
import { CashFlowNav } from "@/components/cash-flow-nav"
import { CashFlowServicesTable } from "@/components/cash-flow-services-table"
import { CashFlowTable } from "@/components/cash-flow-table"
import { CashFlowTherapistsTable } from "@/components/cash-flow-therapists-table"

// Layout e página podem renderizar em paralelo, então a página refaz a verificação de acesso.
export default async function CashFlowPage({
  params,
  searchParams,
}: PageProps<"/workspace/[workspaceId]/unit/[unitId]/cash-flow">) {
  const { workspaceId, unitId } = await params
  const now = new Date()
  const query = parseCashFlowQuery(await searchParams, now)
  const user = await requireUser()
  await requirePage(workspaceId, user.id, { unit: "cash_flow", unitId })
  const access = workspaceAccessStages(workspaceId, user.id)
  if (!access || !isObjectIdOrHexString(unitId)) notFound()

  // Parte do workspace para garantir o acesso; a regra de repasse define quantos dias buscar.
  const [workspace] = await Workspace.aggregate<{ id: string; unit: { revenueShare: RevenueShare | null } | null }>([
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
    { $project: { _id: 0, id: { $toString: "$_id" }, unit: { $ifNull: [{ $first: "$unit" }, null] } } },
  ])
  if (!workspace?.unit) notFound()
  const { revenueShare } = workspace.unit

  const buckets = cashFlowBuckets(query)
  const shown = { from: buckets[0].from, to: buckets.at(-1)!.to }
  const range = cashFlowFetchRange(buckets, revenueShare?.period ?? null)
  const unitMatch = { $match: { unitId: new Types.ObjectId(unitId) } }
  const [appointments, bookings, serviceAppointments, serviceBookings, team] = await Promise.all([
    Appointment.aggregate<DayTotal>([unitMatch, ...dailyAppointmentTotalsPipeline(range)]),
    Booking.aggregate<DayTotal>([unitMatch, ...dailyBookingForecastPipeline(range, now)]),
    Appointment.aggregate<ServiceTotal>([unitMatch, ...serviceAppointmentTotalsPipeline(shown)]),
    Booking.aggregate<ServiceTotal>([unitMatch, ...serviceBookingForecastPipeline(shown, now)]),
    // Remuneração da equipe vinculada a esta unidade (o proprietário não tem).
    WorkspaceMember.find({
      workspaceId: workspace.id,
      role: { $in: ["massage_therapist", "receptionist"] },
      "units.unitId": unitId,
    })
      .select({ userId: 1, role: 1, units: 1 })
      .lean(),
  ])
  // Comissão de massagista vai pelo id de usuário, que identifica quem fez o serviço.
  // Comissão de recepcionista é sobre o bruto; salário vale mesmo com convite pendente.
  const commissionRates: CommissionRates = {}
  let grossCommissionPercent = 0
  let monthlySalaryCents = 0
  for (const member of team) {
    const link = member.units.find((unit) => unit.unitId.equals(unitId))
    if (link?.salaryCents != null) monthlySalaryCents += link.salaryCents
    if (link?.commissionPercent == null) continue
    if (member.role === "receptionist") grossCommissionPercent += link.commissionPercent
    else if (member.userId) commissionRates[member.userId.toString()] = link.commissionPercent
  }
  const today = parseCashFlowQuery({}, now).date
  const summary = applyStaffCosts(summarizeCashFlow(buckets, appointments, bookings, revenueShare, commissionRates), {
    grossCommissionPercent,
    monthlySalaryCents,
    today,
  })
  const services = summarizeServices(serviceAppointments, serviceBookings)
  const therapistRows = summarizeTherapists(shown, appointments, bookings, commissionRates)
  const hasCommission = Object.keys(commissionRates).length > 0 || grossCommissionPercent > 0
  const hasSalary = monthlySalaryCents > 0

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
      <CashFlowTable
        view={query.view}
        summary={summary}
        hasPartnerShare={!!revenueShare}
        hasCommission={hasCommission}
        hasSalary={hasSalary}
        today={today}
      />
      <h4 className="mt-4 font-semibold tracking-tight">Por serviço</h4>
      <CashFlowServicesTable services={services} />
      <h4 className="mt-4 font-semibold tracking-tight">Por massagista</h4>
      <CashFlowTherapistsTable therapists={therapistRows} />
    </div>
  )
}
