import { notFound } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { logoutAction } from "@/lib/actions/auth"
import { matchOwnedWorkspace, requireUser } from "@/lib/session"
import { Workspace } from "@/models/Workspace"

// Único arquivo do slot: o default.tsx é renderizado para qualquer sub-rota
// de /workspace/[workspaceId], então a sidebar aparece em todas elas.
export default async function SidebarSlot({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  const user = await requireUser()
  const match = matchOwnedWorkspace(workspaceId, user.id)
  if (!match) notFound()

  const [workspace] = await Workspace.aggregate<{
    id: string
    name: string
    avatarUrl: string | null
  }>([
    match,
    {
      $project: {
        _id: 0,
        id: { $toString: "$_id" },
        name: 1,
        avatarUrl: { $ifNull: ["$avatarUrl", null] },
      },
    },
  ])
  if (!workspace) notFound()

  return <AppSidebar workspace={workspace} user={user} logoutAction={logoutAction} />
}
