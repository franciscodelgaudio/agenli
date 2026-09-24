import Link from "next/link"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { shiftDay } from "@/lib/appointment-list"
import { Button } from "@/components/ui/button"

// A data da URL é um dia do calendário, então é formatada em UTC para não deslocar.
const dayFormat = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

type Props = {
  // Os demais campos da query (busca, ordenação, unidade...) são preservados nos links.
  query: { date: string } & Record<string, string>
  today: string
  pathname: string
}

// Navegação do fluxo do dia: dia anterior, próximo dia e atalho para hoje.
export function DayNav({ query, today, pathname }: Props) {
  function dayHref(date: string) {
    const params = new URLSearchParams(Object.entries({ ...query, date }).filter(([, value]) => value))
    return `${pathname}?${params}`
  }
  const [year, month, day] = query.date.split("-").map(Number)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Dia anterior"
        nativeButton={false}
        render={<Link href={dayHref(shiftDay(query.date, -1))} replace scroll={false} />}
      >
        <ChevronLeftIcon />
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Próximo dia"
        nativeButton={false}
        render={<Link href={dayHref(shiftDay(query.date, 1))} replace scroll={false} />}
      >
        <ChevronRightIcon />
      </Button>
      {query.date !== today && (
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href={dayHref(today)} replace scroll={false} />}>
          Hoje
        </Button>
      )}
      <span className="text-sm font-medium first-letter:uppercase">
        {dayFormat.format(new Date(Date.UTC(year, month - 1, day)))}
      </span>
    </div>
  )
}
