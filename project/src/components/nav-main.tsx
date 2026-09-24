"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Building2Icon, CalendarDaysIcon, ClipboardListIcon, HomeIcon, UsersIcon, type LucideIcon } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type NavItem = { title: string; href: string; icon: LucideIcon }

export function NavMain({ workspaceId }: { workspaceId: string }) {
  const pathname = usePathname()
  const base = `/workspace/${workspaceId}`
  const groups: { label?: string; items: NavItem[] }[] = [
    { items: [{ title: "Início", href: base, icon: HomeIcon }] },
    {
      label: "Geral",
      items: [
        { title: "Unidades", href: `${base}/unit`, icon: Building2Icon },
        { title: "Atendimentos", href: `${base}/appointments`, icon: ClipboardListIcon },
        { title: "Calendário", href: `${base}/calendar`, icon: CalendarDaysIcon },
      ],
    },
    {
      label: "Configurações",
      items: [{ title: "Usuários", href: `${base}/users`, icon: UsersIcon }],
    },
  ]

  return groups.map((group, i) => (
    <SidebarGroup key={group.label ?? i}>
      {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
      <SidebarMenu>
        {group.items.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              tooltip={item.title}
              isActive={pathname === item.href}
              render={<Link href={item.href} />}
            >
              <item.icon />
              <span>{item.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  ))
}
