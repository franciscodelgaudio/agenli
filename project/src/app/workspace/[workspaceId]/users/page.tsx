import { notFound } from "next/navigation"
import { MailIcon, UserIcon } from "lucide-react"
import { requireUser, workspaceAccessStages } from "@/lib/session"
import { Workspace } from "@/models/Workspace"
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

export default async function UsersPage({
  params,
}: PageProps<"/workspace/[workspaceId]/users">) {
  const { workspaceId } = await params
  const user = await requireUser()
  const access = workspaceAccessStages(workspaceId, user.id)
  if (!access) notFound()

  // Layout e página renderizam em paralelo, então a posse é verificada aqui
  // também. Por enquanto o único usuário do workspace é o dono.
  const [workspace] = await Workspace.aggregate<{
    users: { id: string; name: string | null; email: string; image: string | null }[]
  }>([
    ...access,
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "users",
        pipeline: [
          {
            $project: {
              _id: 0,
              id: { $toString: "$_id" },
              name: { $ifNull: ["$name", null] },
              email: 1,
              image: { $ifNull: ["$image", null] },
            },
          },
        ],
      },
    },
    { $project: { _id: 0, users: 1 } },
  ])
  if (!workspace) notFound()

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h2 className="text-2xl font-semibold tracking-tight">Usuários</h2>
      <div className="border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4">
                <span className="inline-flex items-center gap-1">
                  <UserIcon className="size-4 text-muted-foreground" />
                  Nome
                </span>
              </TableHead>
              <TableHead className="px-4">
                <span className="inline-flex items-center gap-1">
                  <MailIcon className="size-4 text-muted-foreground" />
                  Email
                </span>
              </TableHead>
              <TableHead className="w-0 px-4 text-right">Função</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workspace.users.map((member) => {
              const displayName = member.name ?? member.email
              return (
                <TableRow key={member.id}>
                  <TableCell className="px-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        {member.image && <AvatarImage src={member.image} alt={displayName} />}
                        <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="truncate font-medium">{displayName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">{member.email}</TableCell>
                  <TableCell className="px-4 text-right">
                    <Badge variant="secondary">Proprietário</Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
