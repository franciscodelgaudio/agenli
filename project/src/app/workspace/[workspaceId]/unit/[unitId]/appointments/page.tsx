import { notFound } from "next/navigation"
import { isObjectIdOrHexString, Types } from "mongoose"
import { ClipboardListIcon } from "lucide-react"
import { canManageMembers, type WorkspaceRole } from "@/lib/member"
import { requireUser, workspaceAccessStages } from "@/lib/session"
import {
  appointmentListPipeline,
  BRT_OFFSET_HOURS,
  parseAppointmentListQuery,
} from "@/lib/appointment-list"
import { therapistOptionsStages } from "@/lib/therapist"
import { Workspace } from "@/models/Workspace"
import { AppointmentTable, type AppointmentRow } from "@/components/appointment-table"
import { CreateAppointmentSheet } from "@/components/create-appointment-sheet"
import { DayNav } from "@/components/day-nav"
import { ListSearch } from "@/components/list-search"
import { currencyFormat } from "@/components/service-format"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

type ServiceOption = { id: string; name: string; priceCents: number; durationMinutes: number }
type TherapistOption = { id: string; name: string; image: string | null }

// Layout e página podem renderizar em paralelo, então a página refaz a verificação de acesso.
export default async function AppointmentsPage({
  params,
  searchParams,
}: PageProps<"/workspace/[workspaceId]/unit/[unitId]/appointments">) {
  const { workspaceId, unitId } = await params
  const now = new Date()
  const query = parseAppointmentListQuery(await searchParams, now)
  const user = await requireUser()
  const access = workspaceAccessStages(workspaceId, user.id)
  if (!access || !isObjectIdOrHexString(unitId)) notFound()

  // Parte do workspace -> unidade -> atendimentos para que o acesso seja garantido em cada nível.
  // Serviços da unidade e quem pode atender alimentam o formulário; o total do dia
  // sem busca separa "dia sem atendimentos" de "busca sem resultado".
  const [workspace] = await Workspace.aggregate<{
    role: WorkspaceRole
    therapists: TherapistOption[]
    unit: { appointments: AppointmentRow[]; dayCount: number; services: ServiceOption[] } | null
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
              from: "appointments",
              localField: "_id",
              foreignField: "unitId",
              as: "appointments",
              pipeline: appointmentListPipeline(query),
            },
          },
          {
            $lookup: {
              from: "appointments",
              localField: "_id",
              foreignField: "unitId",
              as: "dayCount",
              pipeline: [appointmentListPipeline({ ...query, q: "" })[0], { $count: "n" }],
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
                { $project: { _id: 0, id: { $toString: "$_id" }, name: 1, priceCents: 1, durationMinutes: 1 } },
              ],
            },
          },
          {
            $project: {
              _id: 0,
              appointments: 1,
              services: 1,
              dayCount: { $ifNull: [{ $first: "$dayCount.n" }, 0] },
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
        therapists: 1,
        unit: { $ifNull: [{ $first: "$unit" }, null] },
      },
    },
  ])
  if (!workspace?.unit) notFound()
  const { appointments, dayCount, services } = workspace.unit
  const { therapists } = workspace
  const canManage = canManageMembers(workspace.role)

  const today = parseAppointmentListQuery({}, now).date
  const pathname = `/workspace/${workspaceId}/unit/${unitId}/appointments`
  // Hoje: hora atual de Brasília; outro dia: meio-dia daquele dia.
  const defaultPerformedAt =
    query.date === today
      ? new Date(now.getTime() - BRT_OFFSET_HOURS * 60 * 60 * 1000).toISOString().slice(0, 16)
      : `${query.date}T12:00`
  const totalCents = appointments.reduce((sum, appointment) => sum + appointment.totalCents, 0)

  // O proprietário sempre está entre quem pode atender, então basta haver serviço.
  const createButton = canManage && services.length > 0 && (
    <CreateAppointmentSheet
      workspaceId={workspaceId}
      unitId={unitId}
      services={services}
      therapists={therapists}
      defaultPerformedAt={defaultPerformedAt}
    />
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold tracking-tight">Atendimentos</h3>
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
                ? "Os atendimentos registrados nesta unidade aparecerão aqui."
                : !services.length
                  ? "Cadastre os serviços da unidade na aba Serviços antes de registrar atendimentos."
                  : "Registre os atendimentos do dia com o hóspede, os serviços e as massagistas."}
            </EmptyDescription>
          </EmptyHeader>
          {createButton && <EmptyContent>{createButton}</EmptyContent>}
        </Empty>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <ListSearch query={query} placeholder="Buscar hóspede ou quarto..." />
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
            options={{ services, therapists }}
            canManage={canManage}
          />
        </>
      )}
    </div>
  )
}
