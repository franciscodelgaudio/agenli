"use client"

import { usePathname, useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { TherapistLabel, TherapistSelectValue, type TherapistOption } from "@/components/therapist-avatar"

const ALL = "all"

type Props = {
  // therapist vazio = todas; os demais campos da query são preservados na URL.
  query: { therapist: string } & Record<string, string>
  therapists: TherapistOption[]
}

export function TherapistFilter({ query, therapists }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const items = [
    { value: ALL, label: "Todas as massagistas" },
    ...therapists.map((therapist) => ({ value: therapist.id, label: therapist.name })),
  ]

  return (
    <Select
      items={items}
      value={query.therapist || ALL}
      onValueChange={(value) => {
        const therapist = value === ALL ? "" : (value as string)
        const params = new URLSearchParams(Object.entries({ ...query, therapist }).filter(([, v]) => v))
        router.replace(`${pathname}?${params}`)
      }}
    >
      <SelectTrigger className="w-full sm:w-56" aria-label="Filtrar por massagista">
        <TherapistSelectValue therapists={therapists} fallback="Todas as massagistas" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Todas as massagistas</SelectItem>
        {therapists.map((therapist) => (
          <SelectItem key={therapist.id} value={therapist.id}>
            <TherapistLabel therapist={therapist} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
