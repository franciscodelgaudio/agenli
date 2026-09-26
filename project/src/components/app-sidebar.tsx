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

type Props = React.ComponentProps<typeof NavUser> &
  Pick<React.ComponentProps<typeof NavMain>, "pages" | "canManage" | "inbox"> & {
    workspace: React.ComponentProps<typeof WorkspaceHeader>["workspace"] & { id: string }
  }

export function AppSidebar({ workspace, pages, canManage, inbox, user, logoutAction }: Props) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <WorkspaceHeader workspace={workspace} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain workspaceId={workspace.id} pages={pages} canManage={canManage} inbox={inbox} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} logoutAction={logoutAction} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
