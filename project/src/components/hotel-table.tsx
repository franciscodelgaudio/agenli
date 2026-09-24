import Link from "next/link"
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  Building2Icon,
  CalendarClockIcon,
  CalendarPlusIcon,
  SettingsIcon,
  type LucideIcon,
} from "lucide-react"
import { HotelActions } from "@/components/hotel-actions"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { HotelListQuery, HotelSortField } from "@/lib/hotel-list"
import { dateTimeFormat } from "@/lib/utils"

type Props = {
  hotels: { id: string; name: string; avatarUrl: string | null; createdAt: Date; updatedAt: Date }[]
  query: HotelListQuery
  pathname: string
  workspaceId: string
  // Sem permissão, a coluna de ações (editar/excluir) não aparece.
  canManage: boolean
}

function SortableHead({
  field,
  label,
  icon: LabelIcon,
  query,
  pathname,
}: {
  field: HotelSortField
  label: string
  icon: LucideIcon
  query: HotelListQuery
  pathname: string
}) {
  const active = query.sort === field
  // Clicar na coluna ativa inverte a direção; numa coluna nova começa crescente.
  const dir = active && query.dir === "asc" ? "desc" : "asc"
  const params = new URLSearchParams({ sort: field, dir })
  if (query.q) params.set("q", query.q)
  const Icon = !active ? ArrowUpDownIcon : query.dir === "asc" ? ArrowUpIcon : ArrowDownIcon

  return (
    <TableHead
      className="px-4"
      aria-sort={active ? (query.dir === "asc" ? "ascending" : "descending") : undefined}
    >
      <Link
        href={`${pathname}?${params}`}
        replace
        scroll={false}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        <LabelIcon className="size-4 text-muted-foreground" />
        {label}
        <Icon className={active ? "size-3.5" : "size-3.5 text-muted-foreground"} />
      </Link>
    </TableHead>
  )
}

export function HotelTable({ hotels, query, pathname, workspaceId, canManage }: Props) {
  return (
    <div className="border">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead field="name" label="Nome" icon={Building2Icon} query={query} pathname={pathname} />
            <SortableHead field="createdAt" label="Criado em" icon={CalendarPlusIcon} query={query} pathname={pathname} />
            <SortableHead field="updatedAt" label="Atualizado em" icon={CalendarClockIcon} query={query} pathname={pathname} />
            {canManage && (
              <TableHead className="w-0 px-4 text-right">
                <span className="inline-flex items-center gap-1">
                  <SettingsIcon className="size-4 text-muted-foreground" />
                  Ações
                </span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {hotels.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canManage ? 4 : 3} className="h-24 px-4 text-center text-muted-foreground">
                Nenhuma unidade encontrada.
              </TableCell>
            </TableRow>
          ) : (
            hotels.map((hotel) => (
              <TableRow key={hotel.id} className="relative cursor-pointer">
                <TableCell className="px-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8 rounded-lg after:rounded-lg">
                      {hotel.avatarUrl && (
                        <AvatarImage src={hotel.avatarUrl} alt={hotel.name} className="rounded-lg" />
                      )}
                      <AvatarFallback className="rounded-lg">
                        {hotel.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {/* O ::after estica o link sobre a linha inteira; a célula de ações fica por cima. */}
                    <Link
                      href={`${pathname}/${hotel.id}`}
                      className="truncate font-medium after:absolute after:inset-0 hover:underline"
                    >
                      {hotel.name}
                    </Link>
                  </div>
                </TableCell>
                <TableCell className="px-4 text-muted-foreground">{dateTimeFormat.format(hotel.createdAt)}</TableCell>
                <TableCell className="px-4 text-muted-foreground">{dateTimeFormat.format(hotel.updatedAt)}</TableCell>
                {canManage && (
                  <TableCell className="relative z-10 px-4 text-right">
                    <HotelActions workspaceId={workspaceId} hotel={hotel} />
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
