import { BanknoteIcon, BedDoubleIcon, Building2Icon, ClockIcon, SettingsIcon, SparklesIcon } from "lucide-react"
import { AppointmentActions } from "@/components/appointment-actions"
import type { AppointmentOptions } from "@/components/appointment-form"
import { SortableHead } from "@/components/sortable-head"
import { currencyFormat, formatDuration, timeFormat } from "@/components/service-format"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AppointmentListQuery } from "@/lib/appointment-list"

export type AppointmentRow = {
  id: string
  unitId: string
  performedAt: Date
  guest: { name: string; room: string }
  items: {
    serviceId: string
    serviceName: string
    priceCents: number
    durationMinutes: number
    therapistId: string
    therapistName: string
  }[]
  totalCents: number
}

type Props = {
  appointments: AppointmentRow[]
  // Sem a página: ordenar volta para a primeira.
  query: Omit<AppointmentListQuery, "page">
  pathname: string
  workspaceId: string
  // Opções do formulário de edição; com units (visão do workspace), aparece a coluna Unidade.
  options: AppointmentOptions
  // Sem permissão, a coluna de ações (editar/excluir) não aparece.
  canManage: boolean
}

const dayFormat = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
})

function Head({ icon: Icon, label }: { icon: typeof ClockIcon; label: string }) {
  return (
    <TableHead className="px-4">
      <span className="inline-flex items-center gap-1">
        <Icon className="size-4 text-muted-foreground" />
        {label}
      </span>
    </TableHead>
  )
}

export function AppointmentTable({ appointments, query, pathname, workspaceId, options, canManage }: Props) {
  const unitNames = options.units && new Map(options.units.map((unit) => [unit.id, unit.name]))
  const columns = 4 + (unitNames ? 1 : 0) + (canManage ? 1 : 0)
  return (
    <div className="border">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead field="performedAt" label="Horário" icon={ClockIcon} query={query} pathname={pathname} />
            {unitNames && <Head icon={Building2Icon} label="Unidade" />}
            <SortableHead field="guestName" label="Hóspede" icon={BedDoubleIcon} query={query} pathname={pathname} />
            <Head icon={SparklesIcon} label="Serviços" />
            <SortableHead field="totalCents" label="Total" icon={BanknoteIcon} query={query} pathname={pathname} />
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
          {appointments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns} className="h-24 px-4 text-center text-muted-foreground">
                Nenhum atendimento encontrado.
              </TableCell>
            </TableRow>
          ) : (
            appointments.map((appointment) => (
              <TableRow key={appointment.id} className="align-top">
                <TableCell className="px-4">
                  <div className="font-medium">{dayFormat.format(appointment.performedAt)}</div>
                  <div className="text-muted-foreground tabular-nums">{timeFormat.format(appointment.performedAt)}</div>
                </TableCell>
                {unitNames && (
                  <TableCell className="px-4">{unitNames.get(appointment.unitId) ?? "—"}</TableCell>
                )}
                <TableCell className="px-4">
                  <div className="font-medium">{appointment.guest.name}</div>
                  <div className="text-muted-foreground">Quarto {appointment.guest.room}</div>
                </TableCell>
                <TableCell className="px-4">
                  <ul className="grid gap-1">
                    {appointment.items.map((item, index) => (
                      <li key={index}>
                        {item.serviceName}{" "}
                        <span className="text-muted-foreground">
                          · {item.therapistName} · {formatDuration(item.durationMinutes)} ·{" "}
                          {currencyFormat.format(item.priceCents / 100)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </TableCell>
                <TableCell className="px-4 font-medium tabular-nums">
                  {currencyFormat.format(appointment.totalCents / 100)}
                </TableCell>
                {canManage && (
                  <TableCell className="px-4 text-right">
                    <AppointmentActions
                      workspaceId={workspaceId}
                      appointment={appointment}
                      {...options}
                    />
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
