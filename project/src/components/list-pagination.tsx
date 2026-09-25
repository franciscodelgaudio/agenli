import Link from "next/link"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

type Props = {
  // Os demais campos da query (busca, filtros, ordenação) são preservados nos links.
  query: Record<string, string>
  page: number
  pageSize: number
  total: number
  pathname: string
  // Plural do que está sendo listado, para a faixa ("1–20 de 45 agendamentos").
  itemLabel: string
}

// Anterior/próxima com a faixa mostrada; some quando tudo cabe numa página.
export function ListPagination({ query, page, pageSize, total, pathname, itemLabel }: Props) {
  const pages = Math.ceil(total / pageSize)
  if (pages <= 1) return null
  function pageHref(target: number) {
    // A página 1 fica fora da URL, como os demais valores padrão.
    const params = new URLSearchParams(
      Object.entries({ ...query, page: target > 1 ? String(target) : "" }).filter(([, value]) => value),
    )
    return `${pathname}?${params}`
  }
  const firstRow = (page - 1) * pageSize + 1
  const lastRow = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground tabular-nums">
        {firstRow}–{lastRow} de {total} {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-sm tabular-nums">
          Página {page} de {pages}
        </span>
        {page > 1 ? (
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Página anterior"
            nativeButton={false}
            render={<Link href={pageHref(page - 1)} replace />}
          >
            <ChevronLeftIcon />
          </Button>
        ) : (
          <Button variant="outline" size="icon-sm" aria-label="Página anterior" disabled>
            <ChevronLeftIcon />
          </Button>
        )}
        {page < pages ? (
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Próxima página"
            nativeButton={false}
            render={<Link href={pageHref(page + 1)} replace />}
          >
            <ChevronRightIcon />
          </Button>
        ) : (
          <Button variant="outline" size="icon-sm" aria-label="Próxima página" disabled>
            <ChevronRightIcon />
          </Button>
        )}
      </div>
    </div>
  )
}
