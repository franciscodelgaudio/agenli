import { notFound } from "next/navigation"
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
import { UnitFilter } from "@/components/unit-filter"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

const HOUR_MS = 60 * 60 * 1000

// Agendamentos do dia de todas as unidades do workspace, em lista.
export default async function CalendarListPage({
  params,
  searchParams,
}: PageProps<"/workspace/[workspaceId]/calendar/list">) {
  const { workspaceId } = await params
  const now = new Date()
  const query = parseBookingListQuery(await searchParams, now)
  const user = await requireUser()
  const access = workspaceAccessStages(workspaceId, user.id)
  if (!access) notFound()

  // Parte do workspace -> unidades -> agendamentos/serviços, então só entram unidades do
  // workspace. O total do dia sem busca nem filtros separa "dia vazio" de "filtro sem resultado".
  const [workspace] = await Workspace.aggregate<BookingOptions & {
    role: WorkspaceRole
    bookings: BookingRow[]
    dayCount: number
  }>([
    ...access,
    {
      $lookup: {
        from: "units",
        localField: "_id",
        foreignField: "workspaceId",
        as: "units",
        pipeline: [{ $sort: { name: 1, _id: 1 } }, { $project: { name: 1 } }],
      },
    },
    {
      $lookup: {
        from: "bookings",
        localField: "units._id",
        foreignField: "unitId",
        as: "bookings",
        pipeline: bookingDayListPipeline(query),
      },
    },
    {
      $lookup: {
        from: "bookings",
        localField: "units._id",
        foreignField: "unitId",
        as: "dayCount",
        pipeline: [bookingDayListPipeline({ ...query, q: "", unit: "", therapist: "" })[0], { $count: "n" }],
      },
    },
    {
      $lookup: {
        from: "services",
        localField: "units._id",
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
    ...therapistOptionsStages(),
    {
      $project: {
        _id: 0,
        role: 1,
        units: { $map: { input: "$units", as: "unit", in: { id: { $toString: "$$unit._id" }, name: "$$unit.name" } } },
        bookings: 1,
        dayCount: { $ifNull: [{ $first: "$dayCount.n" }, 0] },
        services: 1,
        therapists: 1,
      },
    },
  ])
  if (!workspace) notFound()
  const { role, bookings, dayCount, ...options } = workspace
  const canManage = canManageMembers(role)

  const today = parseBookingListQuery({}, now).date
  const base = `/workspace/${workspaceId}/calendar`
  const pathname = `${base}/list`
  // Hoje: a próxima hora cheia de Brasília; outro dia: 9h daquele dia.
  const defaultStartsAt =
    query.date === today
      ? new Date(Math.ceil((now.getTime() - BRT_OFFSET_HOURS * HOUR_MS) / HOUR_MS) * HOUR_MS).toISOString().slice(0, 16)
      : `${query.date}T09:00`

  // O proprietário sempre está entre as massagistas, então basta haver uma unidade.
  const createButton = canManage && options.units.length > 0 && (
    <CreateBookingSheet
      workspaceId={workspaceId}
      therapistId={query.therapist}
      defaultStartsAt={defaultStartsAt}
      {...options}
    />
  )

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">Calendário</h2>
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
              {!canManage
                ? "Os agendamentos das unidades aparecerão aqui."
                : !options.units.length
                  ? "Cadastre uma unidade antes de criar agendamentos."
                  : "Agende escolhendo a massagista, a unidade, o serviço, o hóspede e o horário."}
            </EmptyDescription>
          </EmptyHeader>
          {createButton && <EmptyContent>{createButton}</EmptyContent>}
        </Empty>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:flex-nowrap">
              <ListSearch query={query} placeholder="Buscar hóspede ou quarto..." />
              <UnitFilter query={query} units={options.units} />
              <TherapistFilter query={query} therapists={options.therapists} />
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
