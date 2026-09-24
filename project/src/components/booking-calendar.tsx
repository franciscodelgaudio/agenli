"use client"

import { useCallback, useRef, useState, useTransition } from "react"
import FullCalendar, {
  type CalendarRef,
  type EventChangeInfo,
  type EventInput,
  type EventSourceFuncInfo,
} from "@fullcalendar/react"
import classicThemePlugin from "@fullcalendar/react/themes/classic"
import dayGridPlugin from "@fullcalendar/react/daygrid"
import timeGridPlugin from "@fullcalendar/react/timegrid"
import interactionPlugin from "@fullcalendar/react/interaction"
import ptBrLocale from "@fullcalendar/react/locales/pt-br"
import "@fullcalendar/react/skeleton.css"
import "@fullcalendar/react/themes/classic/theme.css"
import "@fullcalendar/react/themes/classic/palette.css"
import Link from "next/link"
import { CheckIcon, PlusIcon } from "lucide-react"
import { convertBookingAction } from "@/lib/actions/appointment"
import {
  createBookingAction,
  deleteBookingAction,
  rescheduleBookingAction,
  updateBookingAction,
} from "@/lib/actions/booking"
import type { BookingRow } from "@/lib/booking-list"
import { BRT_OFFSET_HOURS } from "@/lib/timezone"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { AppointmentForm } from "@/components/appointment-form"
import { BookingForm, type BookingFormOptions, type BookingFormValues } from "@/components/booking-form"
import { formatDuration } from "@/components/service-format"
import { TherapistAvatar, TherapistLabel, TherapistSelectValue } from "@/components/therapist-avatar"

export type BookingOptions = Required<BookingFormOptions>

// unitId: calendário de uma unidade (units traz só ela); sem filtro nem escolha de unidade.
type Props = BookingOptions & { workspaceId: string; canManage: boolean; unitId?: string }

const ALL = "all"
const HOUR_MS = 60 * 60 * 1000

// Uma cor por massagista, na ordem da lista (o proprietário primeiro).
const THERAPIST_COLORS = ["#0e7490", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#2563eb", "#ca8a04", "#dc2626"]

// O calendário roda em UTC com os horários "de parede" de Brasília: a string
// "2026-09-24T14:30" vira um Date cujos campos UTC são 14:30, e volta igual.
function toWallTime(date: Date) {
  return date.toISOString().slice(0, 16)
}

function toDay(date: Date) {
  return date.toISOString().slice(0, 10)
}

// Hora atual de Brasília no mesmo esquema, para o "hoje" e a linha de agora.
function brtNow() {
  return new Date(Date.now() - BRT_OFFSET_HOURS * HOUR_MS)
}

// convert: formulário de atendimento pré-preenchido; done: resumo do agendamento já atendido.
type SheetInput =
  | { mode: "create"; values: BookingFormValues }
  | { mode: "edit"; values: BookingFormValues; booking: BookingRow }
  | { mode: "convert"; booking: BookingRow }
  | { mode: "done"; booking: BookingRow }

// key muda a cada abertura para remontar o formulário com os valores atuais e sem erro antigo.
type SheetState = SheetInput & { key: number }

export function BookingCalendar({ workspaceId, canManage, unitId, units, therapists, services }: Props) {
  const calendarRef = useRef<CalendarRef>(null)
  const [unit, setUnit] = useState(unitId ?? "")
  const [therapist, setTherapist] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  const therapistsById = new Map(therapists.map((option) => [option.id, option]))
  const colors = new Map(therapists.map((option, i) => [option.id, THERAPIST_COLORS[i % THERAPIST_COLORS.length]]))
  // O proprietário sempre está entre as massagistas, então basta haver uma unidade.
  const canCreate = canManage && units.length > 0
  const options = { units: unitId ? undefined : units, therapists, services }

  // Uma nova função a cada troca de filtro faz o calendário buscar de novo.
  const fetchEvents = useCallback(
    async (info: EventSourceFuncInfo): Promise<EventInput[]> => {
      // O FullCalendar também busca no render do servidor; lá não há sessão do navegador
      // nem URL base, então a busca fica para o cliente.
      if (typeof window === "undefined") return []
      const params = new URLSearchParams(
        Object.entries({ start: toDay(info.start), end: toDay(info.end), unit, therapist }).filter(([, v]) => v),
      )
      const response = await fetch(`/api/workspace/${workspaceId}/bookings?${params}`)
      const result: { bookings: BookingRow[] } | { error: string } = await response.json()
      if ("error" in result) {
        setError(result.error)
        throw new Error(result.error)
      }
      return result.bookings.map((booking) => ({
        id: booking.id,
        title: `${booking.guest.name} · Quarto ${booking.guest.room}`,
        start: booking.startsAt,
        end: booking.endsAt,
        color: colors.get(booking.therapistId) ?? "#64748b",
        // Já atendido: fica no calendário como histórico, esmaecido e sem arrastar.
        ...(booking.appointmentId && { editable: false, className: "opacity-55" }),
        extendedProps: { booking },
      }))
    },
    // colors deriva de therapists, que só muda com um novo render do servidor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspaceId, unit, therapist, therapists],
  )

  function refetch() {
    calendarRef.current?.getApi().refetchEvents()
  }

  function openSheet(next: SheetInput) {
    setSheet({ ...next, key: (sheet?.key ?? 0) + 1 })
    setSheetOpen(true)
  }

  function openCreate(startsAt: string, durationMinutes: number) {
    openSheet({
      mode: "create",
      values: {
        unitId: unit || (units.length === 1 ? units[0].id : null),
        therapistId: therapist || null,
        guestName: "",
        room: "",
        startsAt,
        durationMinutes,
        serviceId: null,
      },
    })
  }

  async function handleChange({ event, revert }: EventChangeInfo) {
    setError(null)
    const result = await rescheduleBookingAction(workspaceId, event.id, {
      startsAt: toWallTime(event.start!),
      endsAt: toWallTime(event.end!),
    })
    if (result.error) {
      revert()
      setError(result.error)
    } else {
      refetch()
    }
  }

  function handleDelete(booking: BookingRow) {
    startDelete(async () => {
      const result = await deleteBookingAction(workspaceId, booking.id)
      setDeleteError(result.error)
      if (!result.error) {
        setDeleteOpen(false)
        setSheetOpen(false)
        refetch()
      }
    })
  }

  // Nos eventos, o avatar vem da lista de massagistas; quem saiu do workspace fica só com o nome.
  const therapistAvatar = (booking: BookingRow, className: string) => {
    const option = therapistsById.get(booking.therapistId)
    return option && <TherapistAvatar therapist={option} className={className} />
  }

  const filterSelect = (
    label: string,
    allLabel: string,
    value: string,
    onChange: (value: string) => void,
    list: { id: string; name: string }[],
    // Filtro de massagista: o valor e as opções mostram o avatar.
    withAvatar = false,
  ) => {
    const items = [{ value: ALL, label: allLabel }, ...list.map((item) => ({ value: item.id, label: item.name }))]
    return (
      <Select items={items} value={value || ALL} onValueChange={(next) => onChange(next === ALL ? "" : (next as string))}>
        <SelectTrigger className="w-full sm:w-56" aria-label={label}>
          {withAvatar ? <TherapistSelectValue therapists={therapists} fallback={allLabel} /> : <SelectValue />}
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => {
            const option = withAvatar && therapistsById.get(item.value)
            return (
              <SelectItem key={item.value} value={item.value}>
                {option ? <TherapistLabel therapist={option} /> : item.label}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
          {!unitId && filterSelect("Filtrar por unidade", "Todas as unidades", unit, setUnit, units)}
          {filterSelect("Filtrar por massagista", "Todas as massagistas", therapist, setTherapist, therapists, true)}
        </div>
        {canCreate && (
          <Button onClick={() => openCreate(toWallTime(new Date(Math.ceil(brtNow().getTime() / HOUR_MS) * HOUR_MS)), 60)}>
            <PlusIcon />
            Novo agendamento
          </Button>
        )}
      </div>

      {therapists.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground" aria-label="Cores por massagista">
          {therapists.map((option) => (
            <li key={option.id} className="flex items-center gap-2">
              {/* O anel na cor da massagista faz a vez da legenda de cores. */}
              <TherapistAvatar
                therapist={option}
                className="size-5"
                style={{ outline: `2px solid ${colors.get(option.id)}`, outlineOffset: 1 }}
              />
              {option.name}
            </li>
          ))}
        </ul>
      )}

      {canManage && !canCreate && (
        <p className="text-sm text-muted-foreground">Cadastre uma unidade antes de criar agendamentos.</p>
      )}
      {error && <FieldError>{error}</FieldError>}

      <div className="booking-calendar">
        <FullCalendar
          ref={calendarRef}
          plugins={[classicThemePlugin, dayGridPlugin, timeGridPlugin, interactionPlugin]}
          locale={ptBrLocale}
          timeZone="UTC"
          now={brtNow}
          initialView="timeGridWeek"
          headerToolbar={{ start: "prev,next today", center: "title", end: "dayGridMonth,timeGridWeek,timeGridDay" }}
          height="auto"
          allDaySlot={false}
          slotMinTime="06:00"
          slotMaxTime="24:00"
          scrollTime="08:00"
          // Faixas de 30 min mais altas: um agendamento de 45 min já mostra hóspede, hora e quarto.
          slotMinHeight={32}
          nowIndicator
          dayMaxEvents
          events={fetchEvents}
          // Altura definida no miolo do evento, para o conteúdo esconder as linhas que não cabem inteiras.
          columnEventInnerClass={({ isShort }) => (isShort ? undefined : "h-full")}
          eventContent={({ event, timeText, view, isShort }) => {
            // O evento-espelho da seleção (selectMirror) não tem agendamento associado.
            const booking = event.extendedProps.booking as BookingRow | undefined
            if (!booking) return <div className="overflow-hidden px-1 text-xs font-medium">{timeText}</div>
            const guestName = (
              <span className="flex min-w-0 items-center gap-1 font-semibold">
                {booking.appointmentId && <CheckIcon className="size-3 shrink-0" aria-label="Atendido" />}
                <span className="truncate">{booking.guest.name}</span>
              </span>
            )
            // No mês e em eventos curtos cabe uma linha só: hora e hóspede.
            if (view.type.startsWith("dayGrid") || isShort) {
              return (
                <div className="flex min-w-0 items-center gap-1.5 overflow-hidden px-1 text-xs leading-tight">
                  {therapistAvatar(booking, "size-4 shrink-0")}
                  <span className="shrink-0 tabular-nums opacity-85">{toWallTime(event.start!).slice(11)}</span>
                  {guestName}
                </div>
              )
            }
            // Cada linha trunca sozinha. A coluna quebra (flex-wrap) e cada linha ocupa a largura toda:
            // a linha que não cabe inteira na altura vai para uma coluna fora da vista, em vez de aparecer cortada.
            return (
              <div className="flex h-full min-w-0 flex-col flex-wrap gap-y-0.5 overflow-hidden px-1.5 py-1 text-xs leading-snug">
                <div className="flex w-full min-w-0 items-center gap-1.5">
                  {therapistAvatar(booking, "size-5 shrink-0 ring-1 ring-white/60")}
                  {guestName}
                </div>
                <div className="w-full truncate tabular-nums opacity-85">
                  {timeText} · Quarto {booking.guest.room}
                </div>
                <div className="w-full truncate opacity-85">
                  {booking.service.serviceName} · {booking.therapistName}
                </div>
              </div>
            )
          }}
          selectable={canCreate}
          selectMirror
          select={(info) => {
            info.view.calendar.unselect()
            // No mês a seleção é do dia inteiro: sugere 9h com 1 hora.
            if (info.allDay) openCreate(`${toDay(info.start)}T09:00`, 60)
            else openCreate(toWallTime(info.start), Math.round((info.end.getTime() - info.start.getTime()) / 60000))
          }}
          editable={canManage}
          eventDrop={handleChange}
          eventResize={handleChange}
          eventClick={({ event }) => {
            if (!canManage) return
            const booking = event.extendedProps.booking as BookingRow
            setDeleteError(null)
            if (booking.appointmentId) return openSheet({ mode: "done", booking })
            openSheet({
              mode: "edit",
              booking,
              values: {
                unitId: booking.unitId,
                therapistId: booking.therapistId,
                guestName: booking.guest.name,
                room: booking.guest.room,
                startsAt: booking.startsAt,
                durationMinutes: booking.durationMinutes,
                serviceId: booking.service.serviceId,
              },
            })
          }}
        />
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          {(sheet?.mode === "create" || sheet?.mode === "edit") && (
            <BookingForm
              key={sheet.key}
              {...options}
              mode={sheet.mode}
              defaultValues={sheet.values}
              action={(prev, formData) =>
                sheet.mode === "edit"
                  ? updateBookingAction(workspaceId, sheet.booking.id, prev, formData)
                  : createBookingAction(workspaceId, prev, formData)
              }
              onDone={() => {
                setSheetOpen(false)
                refetch()
              }}
              onConvert={sheet.mode === "edit" ? () => openSheet({ mode: "convert", booking: sheet.booking }) : undefined}
              onDelete={sheet.mode === "edit" ? () => setDeleteOpen(true) : undefined}
            />
          )}
          {sheet?.mode === "convert" && (
            <AppointmentForm
              key={sheet.key}
              {...options}
              mode="create"
              defaultValues={{
                unitId: sheet.booking.unitId,
                guestName: sheet.booking.guest.name,
                room: sheet.booking.guest.room,
                performedAt: sheet.booking.startsAt,
                items: [{ serviceId: sheet.booking.service.serviceId, therapistId: sheet.booking.therapistId }],
              }}
              action={(prev, formData) => convertBookingAction(workspaceId, sheet.booking.id, prev, formData)}
              onDone={() => {
                setSheetOpen(false)
                refetch()
              }}
            />
          )}
          {sheet?.mode === "done" && <DoneSummary workspaceId={workspaceId} booking={sheet.booking} inUnit={!!unitId} />}
        </SheetContent>
      </Sheet>

      {sheet?.mode === "edit" && (
        <AlertDialog
          open={deleteOpen}
          onOpenChange={(next) => {
            if (!next) setDeleteError(null)
            setDeleteOpen(next)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir agendamento?</AlertDialogTitle>
              <AlertDialogDescription>
                O agendamento de <strong>{sheet.booking.guest.name}</strong> (quarto {sheet.booking.guest.room}) será
                excluído permanentemente. Essa ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteError && <FieldError>{deleteError}</FieldError>}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <Button variant="destructive" onClick={() => handleDelete(sheet.booking)} disabled={deleting}>
                {deleting ? "Excluindo..." : "Excluir"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

// A data do agendamento é um horário de Brasília "de parede", então é formatada em UTC.
const doneDateFormat = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
})

// Agendamento que já virou atendimento: só leitura, com atalho para o dia em Atendimentos
// (o da unidade, quando o calendário é de uma unidade).
function DoneSummary({ workspaceId, booking, inUnit }: { workspaceId: string; booking: BookingRow; inUnit: boolean }) {
  const date = booking.startsAt.slice(0, 10)
  return (
    <div className="flex flex-1 flex-col">
      <SheetHeader>
        <SheetTitle>Atendimento registrado</SheetTitle>
        <SheetDescription>
          Este agendamento já virou atendimento. Para alterar valores e serviços, edite o atendimento. Se ele for
          excluído, o agendamento volta a ser editável.
        </SheetDescription>
      </SheetHeader>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-4 text-sm">
        <dt className="text-muted-foreground">Hóspede</dt>
        <dd>
          {booking.guest.name} · Quarto {booking.guest.room}
        </dd>
        <dt className="text-muted-foreground">Massagista</dt>
        <dd>{booking.therapistName}</dd>
        <dt className="text-muted-foreground">Horário</dt>
        <dd className="first-letter:uppercase">
          {doneDateFormat.format(new Date(`${booking.startsAt}:00Z`))} · {formatDuration(booking.durationMinutes)}
        </dd>
        <dt className="text-muted-foreground">Serviço agendado</dt>
        <dd>{booking.service.serviceName}</dd>
      </dl>
      <SheetFooter>
        <Button
          nativeButton={false}
          render={
            <Link
              href={
                inUnit
                  ? `/workspace/${workspaceId}/unit/${booking.unitId}/appointments?${new URLSearchParams({ date })}`
                  : `/workspace/${workspaceId}/appointments?${new URLSearchParams({ date, unit: booking.unitId })}`
              }
            />
          }
        >
          Ver em Atendimentos
        </Button>
      </SheetFooter>
    </div>
  )
}
