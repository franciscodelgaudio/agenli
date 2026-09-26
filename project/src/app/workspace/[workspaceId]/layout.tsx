import { cookies } from "next/headers"
import { notFound } from "next/navigation"
import { NavigationProgressBar, NavigationProgressProvider } from "@/components/navigation-progress"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { requireUser, workspaceAccessStages } from "@/lib/session"
import { Workspace } from "@/models/Workspace"

// O layout espera o workspace antes de renderizar: ao abrir a página inteira, a espera cai no
// loading.tsx da raiz (tela do agenli). Na navegação interna ele não recarrega, e as páginas
// mostram seus skeletons dentro da moldura.
export default async function WorkspaceLayout({
  children,
  sidebar,
  params,
}: LayoutProps<"/workspace/[workspaceId]">) {
  const { workspaceId } = await params
  const user = await requireUser()
  const access = workspaceAccessStages(workspaceId, user.id)
  if (!access) notFound()

  const [workspace] = await Workspace.aggregate<{ name: string }>([
    ...access,
    { $project: { _id: 0, name: 1 } },
  ])
  if (!workspace) notFound()

  // Mesmo cookie que o SidebarProvider grava ao abrir/fechar.
  const defaultOpen = (await cookies()).get("sidebar_state")?.value !== "false"

  return (
    <NavigationProgressProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        {sidebar}
        <SidebarInset>
          <header className="relative flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-center" />
            <h1 className="truncate text-sm font-medium">{workspace.name}</h1>
            <NavigationProgressBar />
          </header>
          {children}
        </SidebarInset>
      </SidebarProvider>
    </NavigationProgressProvider>
  )
}

