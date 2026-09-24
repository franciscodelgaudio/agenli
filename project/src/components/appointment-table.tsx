import { BanknoteIcon, BedDoubleIcon, ClockIcon, SettingsIcon, SparklesIcon } from "lucide-react"
import { DeleteAppointmentButton } from "@/components/delete-appointment-button"
import { currencyFormat, formatDuration, timeFormat } from "@/components/service-format"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type AppointmentRow = {
  id: string
  performedAt: Date
  guest: { name: string; room: string }
  items: { serviceName: string; priceCents: number; durationMinutes: number; therapistName: string }[]
  totalCents: number
}

type Props = {
  appointments: AppointmentRow[]
  workspaceId: string
  unitId: string
  // Sem permissão, a coluna de ações (excluir) não aparece.
  canManage: boolean
}

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

export function AppointmentTable({ appointments, workspaceId, unitId, canManage }: Props) {
  return (
    <div className="border">
      <Table>
        <TableHeader>
          <TableRow>
            <Head icon={ClockIcon} label="Horário" />
            <Head icon={BedDoubleIcon} label="Hóspede" />
            <Head icon={SparklesIcon} label="Serviços" />
            <Head icon={BanknoteIcon} label="Total" />
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
              <TableCell colSpan={canManage ? 5 : 4} className="h-24 px-4 text-center text-muted-foreground">
                Nenhum atendimento encontrado.
              </TableCell>
            </TableRow>
          ) : (
            appointments.map((appointment) => (
              <TableRow key={appointment.id} className="align-top">
                <TableCell className="px-4 tabular-nums">{timeFormat.format(appointment.performedAt)}</TableCell>
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
                    <DeleteAppointmentButton workspaceId={workspaceId} unitId={unitId} appointment={appointment} />
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
