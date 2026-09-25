import { notFound, redirect } from "next/navigation"
import { ClipboardListIcon } from "lucide-react"
import { canManageMembers, type WorkspaceRole } from "@/lib/member"
import { requireUser, workspaceAccessStages } from "@/lib/session"
import {
  APPOINTMENT_PAGE_SIZE,
  appointmentSearchPipeline,
  BRT_OFFSET_HOURS,
  parseAppointmentListQuery,
  type AppointmentPage,
} from "@/lib/appointment-list"
import { therapistOptionsStages } from "@/lib/therapist"
import { Workspace } from "@/models/Workspace"
import { AppointmentTable, type AppointmentRow } from "@/components/appointment-table"
import type { AppointmentOptions } from "@/components/appointment-form"
import { CreateAppointmentSheet } from "@/components/create-appointment-sheet"
import { ListPagination } from "@/components/list-pagination"
import { ListSearch } from "@/components/list-search"
import { PeriodFilter } from "@/components/period-filter"
import { currencyFormat } from "@/components/service-format"
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

type Units = NonNullable<AppointmentOptions["units"]>

// Todos os atendimentos das unidades do workspace, em lista, com busca e filtros.
export default async function WorkspaceAppointmentsPage({
  params,
  searchParams,
}: PageProps<"/workspace/[workspaceId]/appointments">) {
  const { workspaceId } = await params
  const now = new Date()
  const query = parseAppointmentListQuery(await searchParams)
  const user = await requireUser()
  const access = workspaceAccessStages(workspaceId, user.id)
  if (!access) notFound()

  // Parte do workspace -> unidades -> atendimentos/serviços, então só entram unidades do
  // workspace. O total sem busca nem filtros separa "sem atendimentos" de "filtro sem resultado".
  const [workspace] = await Workspace.aggregate<{
    role: WorkspaceRole
    units: Units
    appointments: AppointmentPage<AppointmentRow>
    total: number
    services: AppointmentOptions["services"]
    products: AppointmentOptions["products"]
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
        pipeline: appointmentSearchPipeline(query),
      },
    },
    {
      $lookup: {
        from: "appointments",
        localField: "units._id",
        foreignField: "unitId",
        as: "total",
        pipeline: [{ $count: "n" }],
      },
    },
    {
      $lookup: {
        from: "products",
        localField: "units._id",
        foreignField: "unitId",
        as: "products",
        pipeline: [
          { $sort: { name: 1, _id: 1 } },
          {
            $project: {
              _id: 0,
              id: { $toString: "$_id" },
              unitId: { $toString: "$unitId" },
              name: 1,
            },
          },
        ],
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
              productIds: { $map: { input: "$productIds", as: "id", in: { $toString: "$$id" } } },
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
        appointments: { $first: "$appointments" },
        total: { $ifNull: [{ $first: "$total.n" }, 0] },
        services: 1,
        products: 1,
        therapists: 1,
      },
    },
  ])
  if (!workspace) notFound()
  const { units, appointments: result, total, services, products, therapists } = workspace
  const canManage = canManageMembers(workspace.role)

  const pathname = `/workspace/${workspaceId}/appointments`
  // Filtros mudam sem levar a página junto, então a lista volta para a primeira.
  const { page, ...filters } = query
  // Página além da última (ex.: depois de excluir o último atendimento dela) vai para a última.
  const pages = Math.ceil(result.total / APPOINTMENT_PAGE_SIZE)
  if (pages > 0 && page > pages) {
    const params = new URLSearchParams(Object.entries({ ...filters, page: pages > 1 ? String(pages) : "" }).filter(([, v]) => v))
    redirect(`${pathname}?${params}`)
  }
  // Hora atual de Brasília.
  const defaultPerformedAt = new Date(now.getTime() - BRT_OFFSET_HOURS * 60 * 60 * 1000).toISOString().slice(0, 16)
  const options = { services, products, therapists, units }

  // O proprietário sempre está entre quem pode atender, então basta haver serviço.
  const createButton = canManage && services.length > 0 && (
    <CreateAppointmentSheet workspaceId={workspaceId} defaultPerformedAt={defaultPerformedAt} {...options} />
  )

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">Atendimentos</h2>
      </div>

      {total === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardListIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum atendimento</EmptyTitle>
            <EmptyDescription>
              {!canManage
                ? "Os atendimentos registrados nas unidades aparecerão aqui."
                : !units.length
                  ? "Cadastre uma unidade antes de registrar atendimentos."
                  : !services.length
                    ? "Cadastre os serviços de uma unidade (na aba Serviços da unidade) antes de registrar atendimentos."
                    : "Registre os atendimentos escolhendo a unidade, o hóspede, os serviços e as massagistas."}
            </EmptyDescription>
          </EmptyHeader>
          {createButton && <EmptyContent>{createButton}</EmptyContent>}
        </Empty>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
              <ListSearch query={filters} placeholder="Buscar hóspede, quarto, massagista ou serviço..." />
              <UnitFilter query={filters} units={units} />
              <TherapistFilter query={filters} therapists={therapists} />
              <PeriodFilter query={filters} />
            </div>
            <div className="flex items-center gap-4">
              <p className="text-sm text-muted-foreground">
                {result.total} {result.total === 1 ? "atendimento" : "atendimentos"} ·{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {currencyFormat.format(result.totalCents / 100)}
                </span>
              </p>
              {createButton}
            </div>
          </div>
          <AppointmentTable
            appointments={result.rows}
            query={filters}
            pathname={pathname}
            workspaceId={workspaceId}
            options={options}
            canManage={canManage}
          />
          <ListPagination
            query={filters}
            page={page}
            pageSize={APPOINTMENT_PAGE_SIZE}
            total={result.total}
            pathname={pathname}
            itemLabel="atendimentos"
          />
        </>
      )}
    </div>
  )
}
