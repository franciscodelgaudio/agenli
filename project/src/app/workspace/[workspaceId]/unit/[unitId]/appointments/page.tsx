import Link from "next/link"
import { notFound } from "next/navigation"
import { isObjectIdOrHexString, Types } from "mongoose"
import { ChevronLeftIcon, ChevronRightIcon, ClipboardListIcon } from "lucide-react"
import { canManageMembers, type WorkspaceRole } from "@/lib/member"
import { requireUser, workspaceAccessStages } from "@/lib/session"
import {
  appointmentListPipeline,
  BRT_OFFSET_HOURS,
  parseAppointmentListQuery,
  shiftDay,
} from "@/lib/appointment-list"
import { Workspace } from "@/models/Workspace"
import { AppointmentTable, type AppointmentRow } from "@/components/appointment-table"
import { CreateAppointmentSheet } from "@/components/create-appointment-sheet"
import { ListSearch } from "@/components/list-search"
import { currencyFormat } from "@/components/service-format"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

type ServiceOption = { id: string; name: string; priceCents: number; durationMinutes: number }
type TherapistOption = { id: string; name: string }

// A data da URL é um dia do calendário, então é formatada em UTC para não deslocar.
const dayFormat = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

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
    hotel: { appointments: AppointmentRow[]; dayCount: number; services: ServiceOption[] } | null
  }>([
    ...access,
    {
      $lookup: {
        from: "hotels",
        localField: "_id",
        foreignField: "workspaceId",
        as: "hotel",
        pipeline: [
          { $match: { _id: new Types.ObjectId(unitId) } },
          {
            $lookup: {
              from: "appointments",
              localField: "_id",
              foreignField: "hotelId",
              as: "appointments",
              pipeline: appointmentListPipeline(query),
            },
          },
          {
            $lookup: {
              from: "appointments",
              localField: "_id",
              foreignField: "hotelId",
              as: "dayCount",
              pipeline: [appointmentListPipeline({ ...query, q: "" })[0], { $count: "n" }],
            },
          },
          {
            $lookup: {
              from: "services",
              localField: "_id",
              foreignField: "hotelId",
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
    // Quem pode atender: o proprietário (primeiro da lista) e os membros com função de
    // massagista que aceitaram o convite. O id é o do usuário nos dois casos.
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "owner",
        pipeline: [{ $project: { _id: 0, id: { $toString: "$_id" }, name: { $ifNull: ["$name", "$email"] } } }],
      },
    },
    {
      $lookup: {
        from: "workspace_members",
        localField: "_id",
        foreignField: "workspaceId",
        as: "therapists",
        pipeline: [
          { $match: { role: "massage_therapist", userId: { $ne: null } } },
          { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
          { $set: { user: { $first: "$user" } } },
          { $project: { _id: 0, id: { $toString: "$userId" }, name: { $ifNull: ["$user.name", "$user.email"] } } },
          { $sort: { name: 1 } },
        ],
      },
    },
    {
      $project: {
        _id: 0,
        role: 1,
        therapists: { $concatArrays: ["$owner", "$therapists"] },
        hotel: { $ifNull: [{ $first: "$hotel" }, null] },
      },
    },
  ])
  if (!workspace?.hotel) notFound()
  const { appointments, dayCount, services } = workspace.hotel
  const { therapists } = workspace
  const canManage = canManageMembers(workspace.role)

  const today = parseAppointmentListQuery({}, now).date
  const pathname = `/workspace/${workspaceId}/unit/${unitId}/appointments`
  function dayHref(date: string) {
    const params = new URLSearchParams({ ...query, date })
    if (!query.q) params.delete("q")
    return `${pathname}?${params}`
  }
  const [year, month, day] = query.date.split("-").map(Number)
  const dayLabel = dayFormat.format(new Date(Date.UTC(year, month - 1, day)))
  // Hoje: hora atual de Brasília; outro dia: meio-dia daquele dia.
  const defaultPerformedAt =
    query.date === today
      ? new Date(now.getTime() - BRT_OFFSET_HOURS * 60 * 60 * 1000).toISOString().slice(0, 16)
      : `${query.date}T12:00`
  const totalCents = appointments.reduce((sum, appointment) => sum + appointment.totalCents, 0)

  const canRegister = services.length > 0 && therapists.length > 0
  const createButton = canManage && canRegister && (
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

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Dia anterior"
          nativeButton={false}
          render={<Link href={dayHref(shiftDay(query.date, -1))} replace scroll={false} />}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Próximo dia"
          nativeButton={false}
          render={<Link href={dayHref(shiftDay(query.date, 1))} replace scroll={false} />}
        >
          <ChevronRightIcon />
        </Button>
        {query.date !== today && (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={dayHref(today)} replace scroll={false} />}
          >
            Hoje
          </Button>
        )}
        <span className="text-sm font-medium first-letter:uppercase">{dayLabel}</span>
      </div>

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
                  : !therapists.length
                    ? "Convide massagistas para o workspace (em Usuários) antes de registrar atendimentos."
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
            unitId={unitId}
            options={{ services, therapists }}
            canManage={canManage}
          />
        </>
      )}
    </div>
  )
}
