import { cookies } from "next/headers"
import { notFound } from "next/navigation"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { matchOwnedWorkspace, requireUser } from "@/lib/session"
import { Workspace } from "@/models/Workspace"

export default async function WorkspaceLayout({
  children,
  sidebar,
  params,
}: LayoutProps<"/workspace/[workspaceId]">) {
  const { workspaceId } = await params
  const user = await requireUser()
  const match = matchOwnedWorkspace(workspaceId, user.id)
  if (!match) notFound()

  const [workspace] = await Workspace.aggregate<{ name: string }>([
    match,
    { $project: { _id: 0, name: 1 } },
  ])
  if (!workspace) notFound()

  // Mesmo cookie que o SidebarProvider grava ao abrir/fechar.
  const defaultOpen = (await cookies()).get("sidebar_state")?.value !== "false"

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      {sidebar}
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-vertical:h-4" />
          <h1 className="truncate text-sm font-medium">{workspace.name}</h1>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
