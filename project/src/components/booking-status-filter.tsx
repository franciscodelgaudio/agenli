"use client"

import { usePathname, useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const ALL = "all"

const items = [
  { value: ALL, label: "Todos os status" },
  { value: "pending", label: "Pendentes" },
  { value: "done", label: "Atendidos" },
]

type Props = {
  // status vazio = todos; os demais campos da query são preservados na URL.
  query: { status: string } & Record<string, string>
}

export function BookingStatusFilter({ query }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <Select
      items={items}
      value={query.status || ALL}
      onValueChange={(value) => {
        const status = value === ALL ? "" : (value as string)
        const params = new URLSearchParams(Object.entries({ ...query, status }).filter(([, v]) => v))
        router.replace(`${pathname}?${params}`)
      }}
    >
      <SelectTrigger className="w-full sm:w-44" aria-label="Filtrar por status">
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
