import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { NavUser } from "@/components/nav-user"
import { WorkspaceHeader } from "@/components/workspace-header"

type Props = React.ComponentProps<typeof NavUser> &
  React.ComponentProps<typeof WorkspaceHeader>

export function AppSidebar({ workspace, user, logoutAction }: Props) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <WorkspaceHeader workspace={workspace} />
      </SidebarHeader>
      {/* Itens de navegação do workspace entram aqui. */}
      <SidebarContent />
      <SidebarFooter>
        <NavUser user={user} logoutAction={logoutAction} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
