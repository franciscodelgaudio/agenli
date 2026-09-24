import { notFound } from "next/navigation"
import { isObjectIdOrHexString, Types } from "mongoose"
import { CalendarDaysIcon } from "lucide-react"
import { canManageMembers, type WorkspaceRole } from "@/lib/member"
import { requireUser, workspaceAccessStages } from "@/lib/session"
import { bookingDayListPipeline, parseBookingListQuery, type BookingRow } from "@/lib/booking-list"
import { BRT_OFFSET_HOURS } from "@/lib/timezone"
import { therapistOptionsStages } from "@/lib/therapist"
import { Workspace } from "@/models/Workspace"
import type { BookingOptions } from "@/components/booking-calendar"
import { BookingTable } from "@/components/booking-table"
import { CalendarNav } from "@/components/calendar-nav"
import { CreateBookingSheet } from "@/components/create-booking-sheet"
import { DayNav } from "@/components/day-nav"
import { ListSearch } from "@/components/list-search"
import { TherapistFilter } from "@/components/therapist-filter"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

const HOUR_MS = 60 * 60 * 1000

// Agendamentos do dia de uma unidade, em lista.
// Layout e página podem renderizar em paralelo, então a página refaz a verificação de acesso.
export default async function UnitCalendarListPage({
  params,
  searchParams,
}: PageProps<"/workspace/[workspaceId]/unit/[unitId]/calendar/list">) {
  const { workspaceId, unitId } = await params
  const now = new Date()
  // A unidade vem da rota, não da URL.
  const query = { ...parseBookingListQuery(await searchParams, now), unit: "" }
  const user = await requireUser()
  const access = workspaceAccessStages(workspaceId, user.id)
  if (!access || !isObjectIdOrHexString(unitId)) notFound()

  // Parte do workspace -> unidade -> agendamentos/serviços para que o acesso seja garantido em
  // cada nível. O total do dia sem busca nem filtro separa "dia vazio" de "filtro sem resultado".
  const [workspace] = await Workspace.aggregate<Pick<BookingOptions, "therapists"> & {
    role: WorkspaceRole
    unit: { bookings: BookingRow[]; dayCount: number; services: BookingOptions["services"] } | null
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
              from: "bookings",
              localField: "_id",
              foreignField: "unitId",
              as: "bookings",
              pipeline: bookingDayListPipeline(query),
            },
          },
          {
            $lookup: {
              from: "bookings",
              localField: "_id",
              foreignField: "unitId",
              as: "dayCount",
              pipeline: [bookingDayListPipeline({ ...query, q: "", therapist: "" })[0], { $count: "n" }],
            },
          },
          {
            $lookup: {
              from: "services",
              localField: "_id",
              foreignField: "unitId",
              as: "services",
              pipeline: [
                { $sort: { name: 1, _id: 1 } },
                {
                  $project: {
                    _id: 0,
                    id: { $toString: "$_id" },
                    unitId: { $toString: "$unitId" },
                    name: 1,
                    priceCents: 1,
                    durationMinutes: 1,
                  },
                },
              ],
            },
          },
          {
            $project: {
              _id: 0,
              bookings: 1,
              services: 1,
              dayCount: { $ifNull: [{ $first: "$dayCount.n" }, 0] },
            },
          },
        ],
      },
    },
    ...therapistOptionsStages(),
    { $project: { _id: 0, role: 1, therapists: 1, unit: { $ifNull: [{ $first: "$unit" }, null] } } },
  ])
  if (!workspace?.unit) notFound()
  const { bookings, dayCount, services } = workspace.unit
  const { therapists } = workspace
  const canManage = canManageMembers(workspace.role)
  const options = { services, therapists }

  const today = parseBookingListQuery({}, now).date
  const base = `/workspace/${workspaceId}/unit/${unitId}/calendar`
  const pathname = `${base}/list`
  // Hoje: a próxima hora cheia de Brasília; outro dia: 9h daquele dia.
  const defaultStartsAt =
    query.date === today
      ? new Date(Math.ceil((now.getTime() - BRT_OFFSET_HOURS * HOUR_MS) / HOUR_MS) * HOUR_MS).toISOString().slice(0, 16)
      : `${query.date}T09:00`

  // O proprietário sempre está entre as massagistas, então sempre dá para agendar.
  const createButton = canManage && (
    <CreateBookingSheet
      workspaceId={workspaceId}
      unitId={unitId}
      therapistId={query.therapist}
      defaultStartsAt={defaultStartsAt}
      {...options}
    />
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-lg font-semibold tracking-tight">Calendário</h3>
        <CalendarNav base={base} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <DayNav query={query} today={today} pathname={pathname} />
        {dayCount > 0 && createButton}
      </div>

      {dayCount === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarDaysIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum agendamento neste dia</EmptyTitle>
            <EmptyDescription>
              {canManage
                ? "Agende escolhendo a massagista, o serviço, o hóspede e o horário."
                : "Os agendamentos desta unidade aparecerão aqui."}
            </EmptyDescription>
          </EmptyHeader>
          {createButton && <EmptyContent>{createButton}</EmptyContent>}
        </Empty>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
              <ListSearch query={query} placeholder="Buscar hóspede ou quarto..." />
              <TherapistFilter query={query} therapists={therapists} />
            </div>
            <p className="text-sm text-muted-foreground">
              {bookings.length} {bookings.length === 1 ? "agendamento" : "agendamentos"}
            </p>
          </div>
          <BookingTable
            bookings={bookings}
            query={query}
            pathname={pathname}
            workspaceId={workspaceId}
            options={options}
            canManage={canManage}
          />
        </>
      )}
    </div>
  )
}
