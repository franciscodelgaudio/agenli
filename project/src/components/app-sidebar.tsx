import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { WorkspaceHeader } from "@/components/workspace-header"

type Props = React.ComponentProps<typeof NavUser> & {
  workspace: React.ComponentProps<typeof WorkspaceHeader>["workspace"] & { id: string }
}

export function AppSidebar({ workspace, user, logoutAction }: Props) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <WorkspaceHeader workspace={workspace} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain workspaceId={workspace.id} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} logoutAction={logoutAction} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
