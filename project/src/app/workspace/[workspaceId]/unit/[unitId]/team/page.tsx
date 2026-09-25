import { notFound } from "next/navigation"
import { isObjectIdOrHexString, Types } from "mongoose"
import { canManageMembers, type MemberRole, type WorkspaceRole } from "@/lib/member-role"
import { requireUser, workspaceAccessStages } from "@/lib/session"
import { Workspace } from "@/models/Workspace"
import { roleLabels } from "@/components/role-labels"
import { UnitMemberActions } from "@/components/unit-member-actions"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const percentFormat = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })

type Member = {
  id: string
  name: string | null
  email: string
  image: string | null
  role: MemberRole
  pending: boolean
  linked: boolean
  commissionPercent: number | null
}

// Layout e página podem renderizar em paralelo, então a página refaz a verificação de acesso.
export default async function UnitTeamPage({ params }: PageProps<"/workspace/[workspaceId]/unit/[unitId]/team">) {
  const { workspaceId, unitId } = await params
  const user = await requireUser()
  const access = workspaceAccessStages(workspaceId, user.id)
  if (!access || !isObjectIdOrHexString(unitId)) notFound()
  const unitObjectId = new Types.ObjectId(unitId)

  // Parte do workspace para garantir o acesso. Vinculados primeiro, depois por nome.
  const [workspace] = await Workspace.aggregate<{
    role: WorkspaceRole
    unit: { name: string } | null
    members: Member[]
  }>([
    ...access,
    {
      $lookup: {
        from: "units",
        localField: "_id",
        foreignField: "workspaceId",
        as: "unit",
        pipeline: [{ $match: { _id: unitObjectId } }, { $project: { _id: 0, name: 1 } }],
      },
    },
    {
      $lookup: {
        from: "workspace_members",
        localField: "_id",
        foreignField: "workspaceId",
        as: "members",
        pipeline: [
          { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
          { $set: { user: { $first: "$user" } } },
          {
            $set: {
              link: {
                $first: {
                  $filter: { input: { $ifNull: ["$units", []] }, cond: { $eq: ["$$this.unitId", unitObjectId] } },
                },
              },
            },
          },
          {
            $project: {
              _id: 0,
              id: { $toString: "$_id" },
              role: 1,
              email: { $ifNull: ["$user.email", "$email"] },
              name: { $ifNull: ["$user.name", null] },
              image: { $ifNull: ["$user.image", null] },
              pending: { $eq: [{ $ifNull: ["$userId", null] }, null] },
              linked: { $ne: [{ $ifNull: ["$link", null] }, null] },
              commissionPercent: { $ifNull: ["$link.commissionPercent", null] },
            },
          },
          { $sort: { linked: -1, name: 1, email: 1 } },
        ],
      },
    },
    { $project: { _id: 0, role: 1, unit: { $ifNull: [{ $first: "$unit" }, null] }, members: 1 } },
  ])
  if (!workspace?.unit) notFound()
  const { role, unit, members } = workspace
  const canManage = canManageMembers(role)

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold tracking-tight">Equipe</h3>
      <div className="border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4">Nome</TableHead>
              <TableHead className="px-4">Função</TableHead>
              <TableHead className="px-4">Nesta unidade</TableHead>
              <TableHead className="px-4 text-right">Comissão</TableHead>
              {canManage && <TableHead className="w-0 px-4 text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canManage ? 5 : 4} className="px-4 py-6 text-center text-muted-foreground">
                  Nenhum usuário convidado. Convide a equipe em Usuários.
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => {
                const label = member.name ?? member.email
                const isTherapist = member.role === "massage_therapist"
                // Só o proprietário vincula massagistas e define a comissão delas.
                const canEdit = canManage && (!isTherapist || role === "owner")
                return (
                  <TableRow key={member.id}>
                    <TableCell className="px-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          {member.image && <AvatarImage src={member.image} alt={label} />}
                          <AvatarFallback>{label.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="grid min-w-0">
                          <span className="truncate font-medium">{label}</span>
                          {member.name && <span className="truncate text-xs text-muted-foreground">{member.email}</span>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary">{roleLabels[member.role]}</Badge>
                        {member.pending && <Badge variant="outline">Convite pendente</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="px-4">
                      {member.linked ? <Badge>Sim</Badge> : <span className="text-muted-foreground">Não</span>}
                    </TableCell>
                    <TableCell className="px-4 text-right tabular-nums">
                      {isTherapist && member.linked && member.commissionPercent !== null
                        ? `${percentFormat.format(member.commissionPercent)}%`
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    {canManage && (
                      <TableCell className="px-4 text-right">
                        {canEdit && (
                          <UnitMemberActions
                            workspaceId={workspaceId}
                            unitId={unitId}
                            unitName={unit.name}
                            member={{
                              id: member.id,
                              label,
                              role: member.role,
                              linked: member.linked,
                              commissionPercent: member.commissionPercent,
                            }}
                          />
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        A comissão de cada massagista é descontada do caixa desta unidade, sobre o valor dos serviços que ela
        fez. O proprietário não tem comissão.
        {role === "admin" && " Só o proprietário vincula massagistas e define a comissão delas."}
      </p>
    </div>
  )
}
