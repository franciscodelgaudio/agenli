import { BedDoubleIcon, MapPinIcon, CheckIcon, ClockIcon, SettingsIcon, LeafIcon, UserIcon } from "lucide-react"
import type { BookingListQuery, BookingRow } from "@/lib/booking-list"
import { BookingActions } from "@/components/booking-actions"
import type { BookingFormOptions } from "@/components/booking-form"
import { CodeCell, CodeHead } from "@/components/record-code"
import { SortableHead } from "@/components/sortable-head"
import { formatDuration } from "@/components/service-format"
import { TherapistAvatar } from "@/components/therapist-avatar"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Props = {
  bookings: BookingRow[]
  // Sem a página: ordenar volta para a primeira.
  query: Omit<BookingListQuery, "page">
  pathname: string
  workspaceId: string
  // Opções do formulário de edição; com units (visão do workspace), aparece a coluna Unidade.
  options: BookingFormOptions
  // Sem permissão, a coluna de ações não aparece.
  canManage: boolean
}

// As datas já vêm no horário de Brasília, então são formatadas em UTC para não deslocar.
const dayFormat = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})

function formatDay(dateTime: string) {
  return dayFormat.format(new Date(`${dateTime.slice(0, 10)}T00:00:00Z`))
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

export function BookingTable({ bookings, query, pathname, workspaceId, options, canManage }: Props) {
  const unitNames = options.units && new Map(options.units.map((unit) => [unit.id, unit.name]))
  const therapistsById = new Map(options.therapists.map((therapist) => [therapist.id, therapist]))
  const columns = 5 + (unitNames ? 1 : 0) + (canManage ? 1 : 0)
  return (
    <div className="border">
      <Table>
        <TableHeader>
          <TableRow>
            <CodeHead />
            <SortableHead field="startsAt" label="Horário" icon={ClockIcon} query={query} pathname={pathname} />
            {unitNames && <Head icon={MapPinIcon} label="Unidade" />}
            <SortableHead field="guestName" label="Hóspede" icon={BedDoubleIcon} query={query} pathname={pathname} />
            <SortableHead field="therapistName" label="Massagista" icon={UserIcon} query={query} pathname={pathname} />
            <Head icon={LeafIcon} label="Serviço" />
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
          {bookings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns} className="h-24 px-4 text-center text-muted-foreground">
                Nenhum agendamento encontrado.
              </TableCell>
            </TableRow>
          ) : (
            bookings.map((booking) => {
              // Quem saiu do workspace não está nas opções: fica só com o nome copiado.
              const therapist = therapistsById.get(booking.therapistId)
              return (
                <TableRow key={booking.id} className="align-top">
                  <CodeCell id={booking.id} />
                  <TableCell className="px-4">
                    <div className="font-medium">{formatDay(booking.startsAt)}</div>
                    <div className="text-muted-foreground tabular-nums">
                      {booking.startsAt.slice(11)}–{booking.endsAt.slice(11)}
                    </div>
                    {booking.appointmentId && (
                      <Badge variant="secondary" className="mt-1">
                        <CheckIcon />
                        Atendido
                      </Badge>
                    )}
                  </TableCell>
                  {unitNames && <TableCell className="px-4">{unitNames.get(booking.unitId) ?? "—"}</TableCell>}
                  <TableCell className="px-4">
                    <div className="font-medium">{booking.guest.name}</div>
                    <div className="text-muted-foreground">Quarto {booking.guest.room}</div>
                  </TableCell>
                  <TableCell className="px-4">
                    <span className="flex items-center gap-2">
                      {therapist && <TherapistAvatar therapist={therapist} className="size-6" />}
                      {booking.therapistName}
                    </span>
                  </TableCell>
                  <TableCell className="px-4">
                    {booking.service.serviceName}{" "}
                    <span className="text-muted-foreground">· {formatDuration(booking.durationMinutes)}</span>
                  </TableCell>
                  {canManage && (
                    <TableCell className="px-4 text-right">
                      <BookingActions workspaceId={workspaceId} booking={booking} {...options} />
                    </TableCell>
                  )}
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
