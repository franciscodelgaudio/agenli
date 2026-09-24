import { notFound } from "next/navigation"
import { ClipboardListIcon } from "lucide-react"
import { canManageMembers, type WorkspaceRole } from "@/lib/member"
import { requireUser, workspaceAccessStages } from "@/lib/session"
import {
  appointmentListPipeline,
  BRT_OFFSET_HOURS,
  parseWorkspaceAppointmentListQuery,
  workspaceAppointmentListPipeline,
} from "@/lib/appointment-list"
import { therapistOptionsStages } from "@/lib/therapist"
import { Workspace } from "@/models/Workspace"
import { AppointmentTable, type AppointmentRow } from "@/components/appointment-table"
import type { AppointmentOptions } from "@/components/appointment-form"
import { CreateAppointmentSheet } from "@/components/create-appointment-sheet"
import { DayNav } from "@/components/day-nav"
import { ListSearch } from "@/components/list-search"
import { currencyFormat } from "@/components/service-format"
import { UnitFilter } from "@/components/unit-filter"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

type Units = NonNullable<AppointmentOptions["units"]>

// Atendimentos de todas as unidades do workspace.
export default async function WorkspaceAppointmentsPage({
  params,
  searchParams,
}: PageProps<"/workspace/[workspaceId]/appointments">) {
  const { workspaceId } = await params
  const now = new Date()
  const query = parseWorkspaceAppointmentListQuery(await searchParams, now)
  const user = await requireUser()
  const access = workspaceAccessStages(workspaceId, user.id)
  if (!access) notFound()

  // Parte do workspace -> unidades -> atendimentos/serviços, então só entram unidades do
  // workspace (localField com a lista de ids das unidades). O total do dia sem busca nem
  // filtro de unidade separa "dia sem atendimentos" de "filtro sem resultado".
  const [workspace] = await Workspace.aggregate<{
    role: WorkspaceRole
    units: Units
    appointments: AppointmentRow[]
    dayCount: number
    services: AppointmentOptions["services"]
    therapists: AppointmentOptions["therapists"]
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
        from: "appointments",
        localField: "units._id",
        foreignField: "unitId",
        as: "appointments",
        pipeline: workspaceAppointmentListPipeline(query),
      },
    },
    {
      $lookup: {
        from: "appointments",
        localField: "units._id",
        foreignField: "unitId",
        as: "dayCount",
        pipeline: [appointmentListPipeline({ ...query, q: "" })[0], { $count: "n" }],
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
        appointments: 1,
        dayCount: { $ifNull: [{ $first: "$dayCount.n" }, 0] },
        services: 1,
        therapists: 1,
      },
    },
  ])
  if (!workspace) notFound()
  const { units, appointments, dayCount, services, therapists } = workspace
  const canManage = canManageMembers(workspace.role)

  const today = parseWorkspaceAppointmentListQuery({}, now).date
  const pathname = `/workspace/${workspaceId}/appointments`
  // Hoje: hora atual de Brasília; outro dia: meio-dia daquele dia.
  const defaultPerformedAt =
    query.date === today
      ? new Date(now.getTime() - BRT_OFFSET_HOURS * 60 * 60 * 1000).toISOString().slice(0, 16)
      : `${query.date}T12:00`
  const totalCents = appointments.reduce((sum, appointment) => sum + appointment.totalCents, 0)
  const options = { services, therapists, units }

  // O proprietário sempre está entre quem pode atender, então basta haver serviço.
  const createButton = canManage && services.length > 0 && (
    <CreateAppointmentSheet workspaceId={workspaceId} defaultPerformedAt={defaultPerformedAt} {...options} />
  )

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">Atendimentos</h2>
        {dayCount > 0 && createButton}
      </div>

      <DayNav query={query} today={today} pathname={pathname} />

      {dayCount === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardListIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum atendimento neste dia</EmptyTitle>
            <EmptyDescription>
              {!canManage
                ? "Os atendimentos registrados nas unidades aparecerão aqui."
                : !units.length
                  ? "Cadastre uma unidade antes de registrar atendimentos."
                  : !services.length
                    ? "Cadastre os serviços de uma unidade (na aba Serviços da unidade) antes de registrar atendimentos."
                    : "Registre os atendimentos do dia escolhendo a unidade, o hóspede, os serviços e as massagistas."}
            </EmptyDescription>
          </EmptyHeader>
          {createButton && <EmptyContent>{createButton}</EmptyContent>}
        </Empty>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
              <ListSearch query={query} placeholder="Buscar hóspede ou quarto..." />
              <UnitFilter query={query} units={units} />
            </div>
            <p className="text-sm text-muted-foreground">
              {appointments.length} {appointments.length === 1 ? "atendimento" : "atendimentos"} ·{" "}
              <span className="font-medium text-foreground tabular-nums">{currencyFormat.format(totalCents / 100)}</span>
            </p>
          </div>
          <AppointmentTable
            appointments={appointments}
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
