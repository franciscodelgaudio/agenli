"use client"

import { useActionState, useState } from "react"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { createAppointmentAction, type AppointmentActionState } from "@/lib/actions/appointment"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { DateTimeField } from "@/components/date-time-field"
import { currencyFormat, formatDuration } from "@/components/service-format"

type ServiceOption = { id: string; name: string; priceCents: number; durationMinutes: number }
type TherapistOption = { id: string; name: string }

type Props = {
  workspaceId: string
  unitId: string
  services: ServiceOption[]
  therapists: TherapistOption[]
  // Data/hora inicial ("2026-09-24T14:30"), no horário de Brasília.
  defaultPerformedAt: string
}

export function CreateAppointmentSheet(props: Props) {
  const [open, setOpen] = useState(false)
  // Muda a cada abertura para remontar o formulário vazio e sem erro antigo.
  const [formKey, setFormKey] = useState(0)

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) setFormKey((k) => k + 1)
        setOpen(next)
      }}
    >
      <SheetTrigger render={<Button />}>
        <PlusIcon />
        Registrar atendimento
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <AppointmentForm key={formKey} {...props} onDone={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}

type Row = { key: number; serviceId: string | null; therapistId: string | null }

function AppointmentForm({
  workspaceId,
  unitId,
  services,
  therapists,
  defaultPerformedAt,
  onDone,
}: Props & { onDone: () => void }) {
  const [rows, setRows] = useState<Row[]>([{ key: 0, serviceId: null, therapistId: null }])
  const [state, formAction, pending] = useActionState(
    async (prev: AppointmentActionState, formData: FormData) => {
      const next = await createAppointmentAction(workspaceId, unitId, prev, formData)
      if (!next.error) onDone()
      return next
    },
    { error: null },
  )

  const servicesById = new Map(services.map((service) => [service.id, service]))
  const serviceItems = services.map((service) => ({ value: service.id, label: service.name }))
  const therapistItems = therapists.map((therapist) => ({ value: therapist.id, label: therapist.name }))
  const totalCents = rows.reduce((sum, row) => sum + (servicesById.get(row.serviceId ?? "")?.priceCents ?? 0), 0)

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  return (
    <form action={formAction} className="flex flex-1 flex-col">
      <SheetHeader>
        <SheetTitle>Registrar atendimento</SheetTitle>
        <SheetDescription>Informe o hóspede e os serviços prestados. O valor vem do cadastro do serviço.</SheetDescription>
      </SheetHeader>
      <FieldGroup className="px-4">
        {state.error && <FieldError>{state.error}</FieldError>}
        <Field>
          <FieldLabel htmlFor="appointment-guest-name">Hóspede</FieldLabel>
          <Input id="appointment-guest-name" name="guestName" placeholder="João Silva" maxLength={80} autoFocus required />
        </Field>
        <Field>
          <FieldLabel htmlFor="appointment-room">Quarto</FieldLabel>
          <Input id="appointment-room" name="room" placeholder="204" maxLength={20} required />
        </Field>
        <DateTimeField idPrefix="appointment" name="performedAt" defaultValue={defaultPerformedAt} />

        <FieldSeparator>Serviços</FieldSeparator>

        {rows.map((row, index) => {
          const service = servicesById.get(row.serviceId ?? "")
          return (
            <div key={row.key} className="grid gap-2 border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Serviço {index + 1}</span>
                {rows.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remover serviço ${index + 1}`}
                    onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                  >
                    <Trash2Icon />
                  </Button>
                )}
              </div>
              {/* A ordem dos campos no FormData forma os pares serviço/massagista. */}
              <Select
                name="serviceId"
                items={serviceItems}
                value={row.serviceId}
                onValueChange={(value) => updateRow(row.key, { serviceId: value as string | null })}
                required
              >
                <SelectTrigger className="w-full" aria-label={`Serviço ${index + 1}`}>
                  <SelectValue placeholder="Escolha o serviço" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name} · {currencyFormat.format(option.priceCents / 100)} ·{" "}
                      {formatDuration(option.durationMinutes)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                name="therapistId"
                items={therapistItems}
                value={row.therapistId}
                onValueChange={(value) => updateRow(row.key, { therapistId: value as string | null })}
                required
              >
                <SelectTrigger className="w-full" aria-label={`Massagista do serviço ${index + 1}`}>
                  <SelectValue placeholder="Escolha a massagista" />
                </SelectTrigger>
                <SelectContent>
                  {therapists.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {service && (
                <p className="text-xs text-muted-foreground">
                  {currencyFormat.format(service.priceCents / 100)} · {formatDuration(service.durationMinutes)}
                </p>
              )}
            </div>
          )
        })}

        {rows.length < 20 && (
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setRows((current) => [
                ...current,
                { key: Math.max(...current.map((r) => r.key)) + 1, serviceId: null, therapistId: null },
              ])
            }
          >
            <PlusIcon />
            Adicionar serviço
          </Button>
        )}

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="font-semibold tabular-nums">{currencyFormat.format(totalCents / 100)}</span>
        </div>
      </FieldGroup>
      <SheetFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Registrando..." : "Registrar"}
        </Button>
      </SheetFooter>
    </form>
  )
}
