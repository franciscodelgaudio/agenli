"use client"

import { usePathname, useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const ALL = "all"

type Props = {
  // unit vazio = todas; os demais campos da query são preservados na URL.
  query: { unit: string } & Record<string, string>
  units: { id: string; name: string }[]
}

export function UnitFilter({ query, units }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const items = [{ value: ALL, label: "Todas as unidades" }, ...units.map((unit) => ({ value: unit.id, label: unit.name }))]

  return (
    <Select
      items={items}
      value={query.unit || ALL}
      onValueChange={(value) => {
        const unit = value === ALL ? "" : (value as string)
        const params = new URLSearchParams(Object.entries({ ...query, unit }).filter(([, v]) => v))
        router.replace(`${pathname}?${params}`)
      }}
    >
      <SelectTrigger className="w-full sm:w-56" aria-label="Filtrar por unidade">
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
