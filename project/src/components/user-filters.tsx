"use client"

import { usePathname, useRouter } from "next/navigation"
import { roleLabels } from "@/components/role-labels"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const ALL = "all"

const roleItems = [
  { value: ALL, label: "Todas as funções" },
  ...Object.entries(roleLabels).map(([value, label]) => ({ value, label })),
]

const statusItems = [
  { value: ALL, label: "Todos os status" },
  { value: "active", label: "Ativos" },
  { value: "pending", label: "Convite pendente" },
  { value: "expired", label: "Convite expirado" },
]

type Props = {
  // role/status vazios = todos; os demais campos da query são preservados na URL.
  query: { role: string; status: string } & Record<string, string>
}

export function UserRoleFilter({ query }: Props) {
  return <QuerySelect query={query} field="role" items={roleItems} label="Filtrar por função" />
}

export function UserStatusFilter({ query }: Props) {
  return <QuerySelect query={query} field="status" items={statusItems} label="Filtrar por status" />
}

function QuerySelect({
  query,
  field,
  items,
  label,
}: Props & { field: "role" | "status"; items: { value: string; label: string }[]; label: string }) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <Select
      items={items}
      value={query[field] || ALL}
      onValueChange={(value) => {
        const selected = value === ALL ? "" : (value as string)
        const params = new URLSearchParams(Object.entries({ ...query, [field]: selected }).filter(([, v]) => v))
        router.replace(`${pathname}?${params}`)
      }}
    >
      <SelectTrigger className="w-full sm:w-44" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
