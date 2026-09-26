import { notFound } from "next/navigation"
import { isObjectIdOrHexString, Types } from "mongoose"
import {
  CalendarCheckIcon,
  CalendarXIcon,
  PiggyBankIcon,
  LeafIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react"
import {
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
import { requireUser, workspaceAccessStages } from "@/lib/session"
import { therapistOptionsStages } from "@/lib/therapist"
import { BRT_OFFSET_HOURS } from "@/lib/timezone"
import { Appointment } from "@/models/Appointment"
import { Booking } from "@/models/Booking"
import { Product } from "@/models/Product"
import { Workspace } from "@/models/Workspace"
import { WorkspaceMember } from "@/models/WorkspaceMember"
import { timeFormat } from "@/components/service-format"
import type { TherapistOption } from "@/components/therapist-avatar"
import {
  CardEmpty,
  CardLink,
  LowStockList,
  money,
  plural,
  RankList,
  RealForecastLegend,
  StatTile,
  TodaySchedule,
  WeekChart,
  type StockItem,
  type TodayBooking,
} from "@/components/unit-overview"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
// Produtos com até esta quantidade aparecem como acabando.
const LOW_STOCK_QUANTITY = 2
const TOP_ITEMS = 5

// Os dias são do calendário, então são formatados em UTC para não deslocar.
const monthFormat = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" })
const todayFormat = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })

function toDate(day: string) {
  const [year, month, date] = day.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, date))
}

// Cabeçalho e navegação ficam no layout da unidade. Layout e página podem renderizar em
// paralelo, então a página refaz a verificação de acesso.
export default async function UnitOverviewPage({ params }: PageProps<"/workspace/[workspaceId]/unit/[unitId]">) {
  const { workspaceId, unitId } = await params
  const now = new Date()
  const user = await requireUser()
  const access = workspaceAccessStages(workspaceId, user.id)
  if (!access || !isObjectIdOrHexString(unitId)) notFound()

  // Parte do workspace para garantir o acesso; a regra de repasse define quantos dias buscar.
  const [workspace] = await Workspace.aggregate<{
    id: string
    therapists: TherapistOption[]
    unit: { revenueShare: RevenueShare | null } | null
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
          { $project: { _id: 0, revenueShare: { $ifNull: ["$revenueShare", null] } } },
        ],
      },
    },
    ...therapistOptionsStages(),
    {
      $project: {
        _id: 0,
        id: { $toString: "$_id" },
        therapists: 1,
        unit: { $ifNull: [{ $first: "$unit" }, null] },
      },
    },
  ])
  if (!workspace?.unit) notFound()
  const { revenueShare } = workspace.unit

  // Mês corrente para os indicadores e rankings; semana corrente para o gráfico. Uma busca
  // só cobre os dois, com o resto dos períodos de repasse das pontas.
  const today = parseCashFlowQuery({}, now).date
  const monthBuckets = cashFlowBuckets({ view: "month", date: today })
  const weekBuckets = cashFlowBuckets({ view: "week", date: today })
  const month = { from: monthBuckets[0].from, to: monthBuckets.at(-1)!.to }
  const monthRange = cashFlowFetchRange(monthBuckets, revenueShare?.period ?? null)
  const weekRange = cashFlowFetchRange(weekBuckets, revenueShare?.period ?? null)
  const range = {
    from: monthRange.from < weekRange.from ? monthRange.from : weekRange.from,
    to: monthRange.to > weekRange.to ? monthRange.to : weekRange.to,
  }
  const [year, monthNumber, day] = today.split("-").map(Number)
  const todayStart = new Date(Date.UTC(year, monthNumber - 1, day, BRT_OFFSET_HOURS))
  const todayEnd = new Date(todayStart.getTime() + DAY_MS)

  const unitObjectId = new Types.ObjectId(unitId)
  const unitMatch = { $match: { unitId: unitObjectId } }
  const [appointments, bookings, serviceAppointments, serviceBookings, therapists, todayBookings, lowStock, productCount] =
    await Promise.all([
      Appointment.aggregate<DayTotal>([unitMatch, ...dailyAppointmentTotalsPipeline(range)]),
      Booking.aggregate<DayTotal>([unitMatch, ...dailyBookingForecastPipeline(range, now)]),
      Appointment.aggregate<ServiceTotal>([unitMatch, ...serviceAppointmentTotalsPipeline(month)]),
      Booking.aggregate<ServiceTotal>([unitMatch, ...serviceBookingForecastPipeline(month, now)]),
      // Comissão das massagistas vinculadas a esta unidade (o proprietário não tem).
      WorkspaceMember.find({
        workspaceId: workspace.id,
        role: "massage_therapist",
        userId: { $ne: null },
        units: { $elemMatch: { unitId, commissionPercent: { $ne: null } } },
      })
        .select({ userId: 1, units: 1 })
        .lean(),
      Booking.find({ unitId: unitObjectId, startsAt: { $gte: todayStart, $lt: todayEnd } })
        .sort({ startsAt: 1 })
        .select({ startsAt: 1, endsAt: 1, guest: 1, service: 1, therapistId: 1, therapistName: 1, appointmentId: 1 })
        .lean(),
      Product.find({ unitId: unitObjectId, quantity: { $lte: LOW_STOCK_QUANTITY } })
        .sort({ quantity: 1, name: 1 })
        .select({ name: 1, quantity: 1, avatarUrl: 1 })
        .lean(),
      Product.countDocuments({ unitId: unitObjectId }),
    ])

  const commissionRates: CommissionRates = {}
  for (const member of therapists) {
    const link = member.units.find((unit) => unit.unitId.equals(unitId))
    if (link?.commissionPercent != null) commissionRates[member.userId!.toString()] = link.commissionPercent
  }
  const monthTotal = summarizeCashFlow(monthBuckets, appointments, bookings, revenueShare, commissionRates).total
  const week = summarizeCashFlow(weekBuckets, appointments, bookings, revenueShare, commissionRates)
  const services = summarizeServices(serviceAppointments, serviceBookings)
  const therapistRows = summarizeTherapists(month, appointments, bookings, commissionRates)
  const therapistImages = new Map(workspace.therapists.map((therapist) => [therapist.id, therapist.image]))

  const servicesDone = services.reduce((sum, service) => sum + service.real.count, 0)
  const servicesScheduled = services.reduce((sum, service) => sum + service.forecast.count, 0) - servicesDone
  const hasDeductions = !!revenueShare || Object.keys(commissionRates).length > 0
  const deductionsCents = monthTotal.real.partnerShareCents + monthTotal.real.commissionCents

  const schedule: TodayBooking[] = todayBookings.map((booking) => ({
    id: booking._id.toString(),
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    guest: booking.guest!,
    serviceName: booking.service.serviceName,
    therapistId: booking.therapistId.toString(),
    therapistName: booking.therapistName,
    attended: !!booking.appointmentId,
  }))
  const attendedToday = schedule.filter((booking) => booking.attended).length
  const nextBooking = schedule.find((booking) => !booking.attended && booking.startsAt > now)
  const stock: StockItem[] = lowStock.map((product) => ({
    id: product._id.toString(),
    name: product.name,
    quantity: product.quantity,
    avatarUrl: product.avatarUrl ?? null,
  }))

  const base = `/workspace/${workspaceId}/unit/${unitId}`
  const monthName = monthFormat.format(toDate(today))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-lg font-semibold tracking-tight">Visão geral</h3>
        <span className="text-sm text-muted-foreground first-letter:uppercase">{todayFormat.format(toDate(today))}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={TrendingUpIcon}
          label={`Faturamento de ${monthName}`}
          value={money(monthTotal.real.grossCents)}
          progress={monthTotal.forecast.grossCents ? monthTotal.real.grossCents / monthTotal.forecast.grossCents : 0}
          detail={`de ${money(monthTotal.forecast.grossCents)} previstos`}
        />
        <StatTile
          icon={PiggyBankIcon}
          label="Líquido do mês"
          value={money(monthTotal.real.netCents)}
          detail={
            hasDeductions
              ? `${money(deductionsCents)} em repasse e comissões`
              : "Sem repasse nem comissões"
          }
        />
        <StatTile
          icon={LeafIcon}
          label="Serviços no mês"
          value={String(servicesDone)}
          detail={servicesScheduled ? `+ ${plural(servicesScheduled, "agendado", "agendados")} até o fim do mês` : "Nenhum outro agendado"}
        />
        <StatTile
          icon={CalendarCheckIcon}
          label="Hoje"
          value={plural(schedule.length, "agendamento", "agendamentos")}
          detail={
            nextBooking
              ? `Próximo às ${timeFormat.format(nextBooking.startsAt)} · ${attendedToday} atendidos`
              : schedule.length
                ? `${attendedToday} de ${schedule.length} atendidos`
                : "Dia livre"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Agenda de hoje</CardTitle>
            <CardDescription>
              {schedule.length
                ? `${plural(schedule.length, "agendamento", "agendamentos")}, ${attendedToday} ${attendedToday === 1 ? "atendido" : "atendidos"}`
                : "Nada agendado para hoje"}
            </CardDescription>
            <CardLink href={`${base}/calendar`}>Calendário</CardLink>
          </CardHeader>
          <CardContent className="flex-1">
            {schedule.length ? (
              <TodaySchedule bookings={schedule} therapists={workspace.therapists} now={now} />
            ) : (
              <CardEmpty icon={CalendarXIcon}>Nenhum agendamento hoje. Novos horários entram pelo calendário.</CardEmpty>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Esta semana</CardTitle>
            <CardDescription>
              {money(week.total.real.grossCents)} realizados de {money(week.total.forecast.grossCents)} previstos
            </CardDescription>
            <CardLink href={`${base}/cash-flow?view=week`}>Caixa</CardLink>
          </CardHeader>
          <CardContent className="gap-4">
            <WeekChart buckets={week.buckets} today={today} />
            <RealForecastLegend />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Serviços em destaque</CardTitle>
            <CardDescription className="first-letter:uppercase">{monthName}, pelo previsto</CardDescription>
            <CardLink href={`${base}/services`}>Serviços</CardLink>
          </CardHeader>
          <CardContent className="flex-1">
            {services.length ? (
              <RankList
                items={services.slice(0, TOP_ITEMS).map((service) => ({
                  id: service.serviceId,
                  name: service.serviceName,
                  real: service.real,
                  forecast: service.forecast,
                }))}
              />
            ) : (
              <CardEmpty icon={LeafIcon}>Nenhum serviço realizado ou agendado neste mês.</CardEmpty>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Massagistas</CardTitle>
            <CardDescription className="first-letter:uppercase">{monthName}, pelo previsto</CardDescription>
            <CardLink href={`${base}/team`}>Equipe</CardLink>
          </CardHeader>
          <CardContent className="flex-1">
            {therapistRows.length ? (
              <RankList
                avatar="round"
                items={therapistRows.slice(0, TOP_ITEMS).map((therapist) => ({
                  id: therapist.therapistId,
                  name: therapist.therapistName,
                  image: therapistImages.get(therapist.therapistId) ?? null,
                  real: therapist.real,
                  forecast: therapist.forecast,
                }))}
              />
            ) : (
              <CardEmpty icon={UsersIcon}>Ninguém atendeu nem tem agendamentos neste mês.</CardEmpty>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2 xl:col-span-1">
          <CardHeader>
            <CardTitle>Estoque acabando</CardTitle>
            <CardDescription>
              {productCount
                ? `${plural(stock.length, "produto", "produtos")} com até ${LOW_STOCK_QUANTITY} unidades, de ${productCount}`
                : "Nenhum produto cadastrado"}
            </CardDescription>
            <CardLink href={`${base}/stock`}>Estoque</CardLink>
          </CardHeader>
          <CardContent className="flex-1">
            {stock.length ? (
              <LowStockList products={stock.slice(0, TOP_ITEMS)} href={(product) => `${base}/stock/${product.id}`} />
            ) : (
              <CardEmpty>
                {productCount ? "Estoque em dia: nenhum produto acabando." : "Cadastre produtos na aba Estoque."}
              </CardEmpty>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
