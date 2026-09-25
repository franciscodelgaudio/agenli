import { notFound, redirect } from "next/navigation"
import { isObjectIdOrHexString, Types } from "mongoose"
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
import { CreateAppointmentSheet } from "@/components/create-appointment-sheet"
import { ListPagination } from "@/components/list-pagination"
import { ListSearch } from "@/components/list-search"
import { PeriodFilter } from "@/components/period-filter"
import { currencyFormat } from "@/components/service-format"
import { TherapistFilter } from "@/components/therapist-filter"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

type ServiceOption = { id: string; name: string; priceCents: number; durationMinutes: number; productIds: string[] }
type TherapistOption = { id: string; name: string; image: string | null }

// Todos os atendimentos de uma unidade, em lista, com busca e filtros.
// Layout e página podem renderizar em paralelo, então a página refaz a verificação de acesso.
export default async function AppointmentsPage({
  params,
  searchParams,
}: PageProps<"/workspace/[workspaceId]/unit/[unitId]/appointments">) {
  const { workspaceId, unitId } = await params
  const now = new Date()
  // A unidade vem da rota, não da URL.
  const query = { ...parseAppointmentListQuery(await searchParams), unit: "" }
  const user = await requireUser()
  const access = workspaceAccessStages(workspaceId, user.id)
  if (!access || !isObjectIdOrHexString(unitId)) notFound()

  // Parte do workspace -> unidade -> atendimentos para que o acesso seja garantido em cada nível.
  // Serviços da unidade e quem pode atender alimentam o formulário; o total sem busca nem
  // filtros separa "sem atendimentos" de "filtro sem resultado".
  const [workspace] = await Workspace.aggregate<{
    role: WorkspaceRole
    therapists: TherapistOption[]
    unit: { appointments: AppointmentPage<AppointmentRow>; total: number; services: ServiceOption[] } | null
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
              pipeline: appointmentSearchPipeline(query),
            },
          },
          {
            $lookup: {
              from: "appointments",
              localField: "_id",
              foreignField: "unitId",
              as: "total",
              pipeline: [{ $count: "n" }],
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
                { $project: { _id: 0, id: { $toString: "$_id" }, name: 1, priceCents: 1, durationMinutes: 1, productIds: { $map: { input: "$productIds", as: "id", in: { $toString: "$$id" } } } } },
              ],
            },
          },
          {
            $project: {
              _id: 0,
              appointments: { $first: "$appointments" },
              services: 1,
              total: { $ifNull: [{ $first: "$total.n" }, 0] },
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
  const { appointments: result, total, services } = workspace.unit
  const { therapists } = workspace
  const canManage = canManageMembers(workspace.role)

  const pathname = `/workspace/${workspaceId}/unit/${unitId}/appointments`
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
                ? "Os atendimentos registrados nesta unidade aparecerão aqui."
                : !services.length
                  ? "Cadastre os serviços da unidade na aba Serviços antes de registrar atendimentos."
                  : "Registre os atendimentos com o hóspede, os serviços e as massagistas."}
            </EmptyDescription>
          </EmptyHeader>
          {createButton && <EmptyContent>{createButton}</EmptyContent>}
        </Empty>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <ListSearch query={filters} placeholder="Buscar hóspede, quarto, massagista ou serviço..." />
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
            options={{ services, therapists }}
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
