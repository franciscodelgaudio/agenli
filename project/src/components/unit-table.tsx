import Link from "next/link"
import { Building2Icon, CalendarClockIcon, CalendarPlusIcon, SettingsIcon } from "lucide-react"
import { HotelActions } from "@/components/hotel-actions"
import { SortableHead } from "@/components/sortable-head"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { HotelListQuery } from "@/lib/hotel-list"
import type { RevenueShare } from "@/lib/revenue-share"
import { dateTimeFormat } from "@/lib/utils"

type Props = {
  hotels: {
    id: string
    name: string
    avatarUrl: string | null
    revenueShare: RevenueShare | null
    createdAt: Date
    updatedAt: Date
  }[]
  query: HotelListQuery
  pathname: string
  workspaceId: string
  // Sem permissão, a coluna de ações (editar/excluir) não aparece.
  canManage: boolean
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
