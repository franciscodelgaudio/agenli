"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ClipboardListIcon, LayoutDashboardIcon, SparklesIcon, WalletIcon, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type NavItem = { title: string; href: string; icon: LucideIcon }

export function UnitNav({ workspaceId, unitId }: { workspaceId: string; unitId: string }) {
  const pathname = usePathname()
  const base = `/workspace/${workspaceId}/unit/${unitId}`
  const items: NavItem[] = [
    { title: "Visão geral", href: base, icon: LayoutDashboardIcon },
    { title: "Atendimentos", href: `${base}/appointments`, icon: ClipboardListIcon },
    { title: "Serviços", href: `${base}/services`, icon: SparklesIcon },
    { title: "Caixa", href: `${base}/cash-flow`, icon: WalletIcon },
  ]

  return (
    <nav className="flex gap-1 overflow-x-auto border-b">
      {items.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors [&_svg]:size-4",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <item.icon />
            {item.title}
          </Link>
        )
      })}
    </nav>
  )
}
