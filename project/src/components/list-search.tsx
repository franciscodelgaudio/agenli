"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { SearchIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import type { HotelListQuery } from "@/lib/hotel-list"

const DEBOUNCE_MS = 300

export function HotelSearch({ query }: { query: HotelListQuery }) {
  const router = useRouter()
  const pathname = usePathname()
  const [value, setValue] = useState(query.q)

  useEffect(() => {
    const q = value.trim()
    if (q === query.q) return
    const timeout = setTimeout(() => {
      const params = new URLSearchParams({ sort: query.sort, dir: query.dir })
      if (q) params.set("q", q)
      router.replace(`${pathname}?${params}`)
    }, DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [value, query, pathname, router])

  return (
    <div className="relative w-full max-w-sm">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buscar unidade..."
        aria-label="Buscar unidade"
        className="pl-8"
      />
    </div>
  )
}
