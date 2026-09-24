import { notFound } from "next/navigation"
import { signOut } from "@/auth"
import { AppSidebar } from "@/components/app-sidebar"
import { getCurrentUser, getCurrentWorkspace } from "@/lib/dal"

// Único arquivo do slot: o default.tsx é renderizado para qualquer sub-rota
// de /workspace/[workspaceId], então a sidebar aparece em todas elas.
export default async function SidebarSlot({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  const [user, workspace] = await Promise.all([
    getCurrentUser(),
    getCurrentWorkspace(workspaceId),
  ])
  if (!user || !workspace) notFound()

  async function logout() {
    "use server"
    await signOut({ redirectTo: "/login" })
  }

  return <AppSidebar workspace={workspace} user={user} logoutAction={logout} />
}
