import { notFound } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { logoutAction } from "@/lib/actions/auth"
import { canManageMembers, canUseInbox, type WorkspaceRole } from "@/lib/member-role"
import { visiblePages, type HiddenPages } from "@/lib/page-access"
import { requireUser, workspaceAccessStages } from "@/lib/session"
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
  const access = workspaceAccessStages(workspaceId, user.id)
  if (!access) notFound()

  const [workspace] = await Workspace.aggregate<{
    id: string
    name: string
    avatarUrl: string | null
    role: WorkspaceRole
    hiddenPages: HiddenPages | null
  }>([
    ...access,
    {
      $project: {
        _id: 0,
        id: { $toString: "$_id" },
        name: 1,
        avatarUrl: { $ifNull: ["$avatarUrl", null] },
        role: 1,
        hiddenPages: { $ifNull: ["$hiddenPages", null] },
      },
    },
  ])
  if (!workspace) notFound()

  const { role, hiddenPages, ...header } = workspace
  return (
    <AppSidebar
      workspace={header}
      pages={visiblePages(role, hiddenPages).workspace}
      canManage={canManageMembers(role)}
      inbox={canUseInbox(role)}
      user={user}
      logoutAction={logoutAction}
    />
  )
}
