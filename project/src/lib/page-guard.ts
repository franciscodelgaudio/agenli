import { notFound, redirect } from "next/navigation"
import type { WorkspaceRole } from "@/lib/member-role"
import {
  UNIT_PAGE_PATHS,
  visiblePages,
  WORKSPACE_PAGE_PATHS,
  type HiddenPages,
  type UnitPage,
  type WorkspacePage,
} from "@/lib/page-access"
import { workspaceAccessStages } from "@/lib/session"
import { Workspace } from "@/models/Workspace"

// Papel do usuário no workspace e as páginas que ele pode ver; null sem acesso.
export async function findVisiblePages(workspaceId: string, userId: string) {
  const access = workspaceAccessStages(workspaceId, userId)
  if (!access) return null
  const [workspace] = await Workspace.aggregate<{ role: WorkspaceRole; hiddenPages: HiddenPages | null }>([
    ...access,
    { $project: { _id: 0, role: 1, hiddenPages: { $ifNull: ["$hiddenPages", null] } } },
  ])
  return workspace ? { role: workspace.role, pages: visiblePages(workspace.role, workspace.hiddenPages) } : null
}

// Para páginas: sem acesso ao workspace, 404; com a página oculta para a função do
// usuário, manda para a primeira aba liberada da unidade ou, sem nenhuma, para a
// primeira página liberada do sistema (sempre há ao menos uma).
export async function requirePage(
  workspaceId: string,
  userId: string,
  page: { workspace: WorkspacePage } | { unit: UnitPage; unitId: string },
) {
  const found = await findVisiblePages(workspaceId, userId)
  if (!found) notFound()
  const { pages } = found
  const base = `/workspace/${workspaceId}`

  if ("workspace" in page) {
    if (pages.workspace.includes(page.workspace)) return found
  } else {
    if (pages.unit.includes(page.unit)) return found
    if (pages.unit.length > 0) redirect(`${base}/unit/${page.unitId}${UNIT_PAGE_PATHS[pages.unit[0]]}`)
  }
  redirect(`${base}${WORKSPACE_PAGE_PATHS[pages.workspace[0]]}`)
}
