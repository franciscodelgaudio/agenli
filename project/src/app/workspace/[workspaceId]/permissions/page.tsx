import { notFound, redirect } from "next/navigation"
import { canManageMembers, type WorkspaceRole } from "@/lib/member-role"
import { visiblePages, type HiddenPages } from "@/lib/page-access"
import { requireUser, workspaceAccessStages } from "@/lib/session"
import { Workspace } from "@/models/Workspace"
import { PageAccessForm } from "@/components/page-access-form"

export default async function PermissionsPage({ params }: PageProps<"/workspace/[workspaceId]/permissions">) {
  const { workspaceId } = await params
  const user = await requireUser()
  const access = workspaceAccessStages(workspaceId, user.id)
  if (!access) notFound()

  const [workspace] = await Workspace.aggregate<{ role: WorkspaceRole; hiddenPages: HiddenPages | null }>([
    ...access,
    { $project: { _id: 0, role: 1, hiddenPages: { $ifNull: ["$hiddenPages", null] } } },
  ])
  if (!workspace) notFound()
  // Só quem gerencia define permissões; os demais voltam para o início (que se redireciona se oculto).
  if (!canManageMembers(workspace.role)) redirect(`/workspace/${workspaceId}`)

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h2 className="text-2xl font-semibold tracking-tight">Permissões</h2>
      <PageAccessForm
        workspaceId={workspaceId}
        visible={{
          massage_therapist: visiblePages("massage_therapist", workspace.hiddenPages),
          receptionist: visiblePages("receptionist", workspace.hiddenPages),
        }}
      />
    </div>
  )
}
