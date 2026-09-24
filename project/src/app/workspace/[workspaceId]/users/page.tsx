import { notFound } from "next/navigation"
import { MailIcon, SettingsIcon, ShieldIcon, UserIcon } from "lucide-react"
import { canManageMembers, type MemberRole, type WorkspaceRole } from "@/lib/member-role"
import { requireUser, workspaceAccessStages } from "@/lib/session"
import { Workspace } from "@/models/Workspace"
import { InviteMemberSheet } from "@/components/invite-member-sheet"
import { MemberActions } from "@/components/member-actions"
import { roleLabels } from "@/components/role-labels"
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

type Person = { name: string | null; email: string; image: string | null }
type Member = Person & { id: string; role: MemberRole; pending: boolean; expiresAt: Date | null }

export default async function UsersPage({ params }: PageProps<"/workspace/[workspaceId]/users">) {
  const { workspaceId } = await params
  const user = await requireUser()
  const access = workspaceAccessStages(workspaceId, user.id)
  if (!access) notFound()

  // Layout e página renderizam em paralelo, então o acesso é verificado aqui
  // também. O dono vem de Workspace.userId; membros e convites, de workspace_members.
  const [workspace] = await Workspace.aggregate<{ role: WorkspaceRole; owner: Person | null; members: Member[] }>([
    ...access,
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          { $project: { _id: 0, name: { $ifNull: ["$name", null] }, email: 1, image: { $ifNull: ["$image", null] } } },
        ],
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
          // Aceitos primeiro, depois convites; cada grupo por ordem de criação.
          { $sort: { acceptedAt: -1, createdAt: 1 } },
          {
            $project: {
              _id: 0,
              id: { $toString: "$_id" },
              role: 1,
              email: { $ifNull: ["$user.email", "$email"] },
              name: { $ifNull: ["$user.name", null] },
              image: { $ifNull: ["$user.image", null] },
              pending: { $eq: [{ $ifNull: ["$userId", null] }, null] },
              expiresAt: { $ifNull: ["$expiresAt", null] },
            },
          },
        ],
      },
    },
    { $project: { _id: 0, role: 1, owner: { $first: "$owner" }, members: 1 } },
  ])
  if (!workspace) notFound()
  const canManage = canManageMembers(workspace.role)
  const now = new Date()

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">Usuários</h2>
        {canManage && <InviteMemberSheet workspaceId={workspaceId} />}
      </div>
      <div className="border">
        <Table>
          <TableHeader>
            <TableRow>
              <HeadWithIcon icon={UserIcon} label="Nome" />
              <HeadWithIcon icon={MailIcon} label="Email" />
              <HeadWithIcon icon={ShieldIcon} label="Função" />
              {canManage && <HeadWithIcon icon={SettingsIcon} label="Ações" className="w-0 text-right" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {workspace.owner && (
              <PersonRow person={workspace.owner} canManage={canManage}>
                <Badge>{roleLabels.owner}</Badge>
              </PersonRow>
            )}
            {workspace.members.map((member) => (
              <PersonRow
                key={member.id}
                person={member}
                canManage={canManage}
                actions={<MemberActions workspaceId={workspaceId} member={member} />}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">{roleLabels[member.role]}</Badge>
                  {member.pending && (
                    <Badge variant="outline">
                      {member.expiresAt && member.expiresAt <= now ? "Convite expirado" : "Convite pendente"}
                    </Badge>
                  )}
                </div>
              </PersonRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function HeadWithIcon({
  icon: Icon,
  label,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  className?: string
}) {
  return (
    <TableHead className={`px-4 ${className ?? ""}`}>
      <span className="inline-flex items-center gap-1">
        <Icon className="size-4 text-muted-foreground" />
        {label}
      </span>
    </TableHead>
  )
}

function PersonRow({
  person,
  canManage,
  actions,
  children,
}: {
  person: Person
  canManage: boolean
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const displayName = person.name ?? person.email
  return (
    <TableRow>
      <TableCell className="px-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            {person.image && <AvatarImage src={person.image} alt={displayName} />}
            <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className={person.name ? "truncate font-medium" : "truncate text-muted-foreground"}>
            {person.name ?? "—"}
          </span>
        </div>
      </TableCell>
      <TableCell className="px-4 text-muted-foreground">{person.email}</TableCell>
      <TableCell className="px-4">{children}</TableCell>
      {canManage && <TableCell className="px-4 text-right">{actions}</TableCell>}
    </TableRow>
  )
}
