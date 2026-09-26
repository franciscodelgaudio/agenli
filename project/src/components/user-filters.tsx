"use client"

import { useReplaceQuery } from "@/components/navigation-progress"
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

// Select de filtro que grava o valor escolhido na URL, preservando os demais campos da query.
export function QuerySelect<F extends string>({
  query,
  field,
  items,
  label,
}: {
  query: Record<F, string> & Record<string, string>
  field: F
  items: { value: string; label: string }[]
  label: string
}) {
  const replaceQuery = useReplaceQuery()

  return (
    <Select
      items={items}
      value={query[field] || ALL}
      onValueChange={(value) => {
        const selected = value === ALL ? "" : (value as string)
        replaceQuery({ ...query, [field]: selected })
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
