import { notFound } from "next/navigation"
import { isObjectIdOrHexString, Types } from "mongoose"
import { SparklesIcon } from "lucide-react"
import { canManageMembers, type WorkspaceRole } from "@/lib/member"
import { requireUser, workspaceAccessStages } from "@/lib/session"
import { Workspace } from "@/models/Workspace"
import { CreateServiceSheet } from "@/components/create-service-sheet"
import { ServiceTable } from "@/components/service-table"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

type ServiceRow = { id: string; name: string; priceCents: number; durationMinutes: number }

// Layout e página podem renderizar em paralelo, então a página refaz a verificação de acesso.
export default async function ServicesPage({ params }: PageProps<"/workspace/[workspaceId]/unit/[unitId]/services">) {
  const { workspaceId, unitId } = await params
  const user = await requireUser()
  const access = workspaceAccessStages(workspaceId, user.id)
  if (!access || !isObjectIdOrHexString(unitId)) notFound()

  // Parte do workspace -> unidade -> serviços para que o acesso seja garantido em cada nível.
  const [workspace] = await Workspace.aggregate<{ role: WorkspaceRole; services: ServiceRow[] | null }>([
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
              from: "services",
              localField: "_id",
              foreignField: "hotelId",
              as: "services",
              pipeline: [
                { $sort: { name: 1 } },
                { $project: { _id: 0, id: { $toString: "$_id" }, name: 1, priceCents: 1, durationMinutes: 1 } },
              ],
            },
          },
          { $project: { _id: 0, services: 1 } },
        ],
      },
    },
    { $project: { _id: 0, role: 1, services: { $ifNull: [{ $first: "$hotel.services" }, null] } } },
  ])
  if (!workspace?.services) notFound()
  const { services } = workspace
  const canManage = canManageMembers(workspace.role)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold tracking-tight">Serviços</h3>
        {canManage && services.length > 0 && <CreateServiceSheet workspaceId={workspaceId} unitId={unitId} />}
      </div>
      {services.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SparklesIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum serviço cadastrado</EmptyTitle>
            <EmptyDescription>
              {canManage
                ? "Cadastre os serviços prestados nesta unidade, com valor e duração média."
                : "Esta unidade ainda não tem serviços cadastrados."}
            </EmptyDescription>
          </EmptyHeader>
          {canManage && (
            <EmptyContent>
              <CreateServiceSheet workspaceId={workspaceId} unitId={unitId} />
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <ServiceTable services={services} workspaceId={workspaceId} unitId={unitId} canManage={canManage} />
      )}
    </div>
  )
}
