import Link from "next/link"
import { Building2Icon, CalendarClockIcon, CalendarPlusIcon, SettingsIcon } from "lucide-react"
import { UnitActions } from "@/components/unit-actions"
import { CodeCell, CodeHead } from "@/components/record-code"
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
import type { UnitListQuery } from "@/lib/unit-list"
import type { RevenueShare } from "@/lib/revenue-share"
import { dateTimeFormat } from "@/lib/utils"

type Props = {
  units: {
    id: string
    name: string
    avatarUrl: string | null
    revenueShare: RevenueShare | null
    createdAt: Date
    updatedAt: Date
  }[]
  query: UnitListQuery
  pathname: string
  workspaceId: string
  // Sem permissão, a coluna de ações (editar/excluir) não aparece.
  canManage: boolean
}

export function UnitTable({ units, query, pathname, workspaceId, canManage }: Props) {
  return (
    <div className="border">
      <Table>
        <TableHeader>
          <TableRow>
            <CodeHead />
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
          {units.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canManage ? 5 : 4} className="h-24 px-4 text-center text-muted-foreground">
                Nenhuma unidade encontrada.
              </TableCell>
            </TableRow>
          ) : (
            units.map((unit) => (
              <TableRow key={unit.id} className="relative cursor-pointer">
                <CodeCell id={unit.id} />
                <TableCell className="px-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8 rounded-lg after:rounded-lg">
                      {unit.avatarUrl && (
                        <AvatarImage src={unit.avatarUrl} alt={unit.name} className="rounded-lg" />
                      )}
                      <AvatarFallback className="rounded-lg">
                        {unit.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {/* O ::after estica o link sobre a linha inteira; a célula de ações fica por cima. */}
                    <Link
                      href={`${pathname}/${unit.id}`}
                      className="truncate font-medium after:absolute after:inset-0 hover:underline"
                    >
                      {unit.name}
                    </Link>
                  </div>
                </TableCell>
                <TableCell className="px-4 text-muted-foreground">{dateTimeFormat.format(unit.createdAt)}</TableCell>
                <TableCell className="px-4 text-muted-foreground">{dateTimeFormat.format(unit.updatedAt)}</TableCell>
                {canManage && (
                  <TableCell className="relative z-10 px-4 text-right">
                    <UnitActions workspaceId={workspaceId} unit={unit} />
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
