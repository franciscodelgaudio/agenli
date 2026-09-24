"use client"

import { useActionState, useState } from "react"
import { ClipboardCheckIcon } from "lucide-react"
import type { BookingActionState } from "@/lib/actions/booking"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { DateTimeField } from "@/components/date-time-field"
import { formatDuration } from "@/components/service-format"
import { TherapistLabel, TherapistSelectValue, type TherapistOption } from "@/components/therapist-avatar"

export type BookingFormValues = {
  unitId: string | null
  therapistId: string | null
  guestName: string
  room: string
  // "2026-09-24T14:30", no horário de Brasília.
  startsAt: string
  durationMinutes: number
  serviceId: string | null
}

export type BookingFormOptions = {
  // Ausente no calendário de uma unidade: a unidade vem de defaultValues e não é escolhida.
  units?: { id: string; name: string }[]
  therapists: TherapistOption[]
  // Cada serviço traz a unidade; o formulário só oferece os da unidade escolhida.
  // O preço só aparece quando o agendamento vira atendimento.
  services: { id: string; unitId: string; name: string; priceCents: number; durationMinutes: number }[]
}

type Props = BookingFormOptions & {
  mode: "create" | "edit"
  defaultValues: BookingFormValues
  action: (prev: BookingActionState, formData: FormData) => Promise<BookingActionState>
  onDone: () => void
  // Só na edição: botões de registrar atendimento e de excluir no rodapé.
  onConvert?: () => void
  onDelete?: () => void
}

const copy = {
  create: {
    title: "Novo agendamento",
    description: "Escolha a massagista, a unidade, o serviço, o hóspede e o horário.",
    submit: "Agendar",
    pending: "Agendando...",
  },
  edit: {
    title: "Editar agendamento",
    description: "Altere os dados do agendamento.",
    submit: "Salvar",
    pending: "Salvando...",
  },
}

export function BookingForm({
  units,
  therapists,
  services: allServices,
  mode,
  defaultValues,
  action,
  onDone,
  onConvert,
  onDelete,
}: Props) {
  const [unitId, setUnitId] = useState(defaultValues.unitId)
  const [therapistId, setTherapistId] = useState(defaultValues.therapistId)
  const [serviceId, setServiceId] = useState(defaultValues.serviceId)
  const [duration, setDuration] = useState(String(defaultValues.durationMinutes))
  const [state, formAction, pending] = useActionState(
    async (prev: BookingActionState, formData: FormData) => {
      const next = await action(prev, formData)
      if (!next.error) onDone()
      return next
    },
    { error: null },
  )

  const services = allServices.filter((service) => service.unitId === unitId)
  const serviceItems = services.map((service) => ({ value: service.id, label: service.name }))

  return (
    <form action={formAction} className="flex min-h-0 flex-1 flex-col">
      <SheetHeader>
        <SheetTitle>{copy[mode].title}</SheetTitle>
        <SheetDescription>{copy[mode].description}</SheetDescription>
      </SheetHeader>
      {/* Só os campos rolam; título e botões ficam fixos. */}
      <FieldGroup className="min-h-0 flex-1 overflow-y-auto px-4">
        {state.error && <FieldError>{state.error}</FieldError>}
        <Field>
          <FieldLabel htmlFor="booking-therapist">Massagista</FieldLabel>
          <Select
            name="therapistId"
            items={therapists.map((therapist) => ({ value: therapist.id, label: therapist.name }))}
            value={therapistId}
            onValueChange={(value) => setTherapistId(value as string | null)}
            required
          >
            <SelectTrigger id="booking-therapist" className="w-full">
              <TherapistSelectValue therapists={therapists} placeholder="Escolha a massagista" />
            </SelectTrigger>
            <SelectContent>
              {therapists.map((therapist) => (
                <SelectItem key={therapist.id} value={therapist.id}>
                  <TherapistLabel therapist={therapist} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {units ? (
          <Field>
            <FieldLabel htmlFor="booking-unit">Unidade</FieldLabel>
            <Select
              name="unitId"
              items={units.map((unit) => ({ value: unit.id, label: unit.name }))}
              value={unitId}
              onValueChange={(value) => {
                setUnitId(value as string | null)
                // Os serviços são de cada unidade, então trocar a unidade limpa o escolhido.
                setServiceId(null)
              }}
              required
            >
              <SelectTrigger id="booking-unit" className="w-full">
                <SelectValue placeholder="Escolha a unidade" />
              </SelectTrigger>
              <SelectContent>
                {units.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : (
          <input type="hidden" name="unitId" value={unitId ?? ""} />
        )}
        <Field>
          <FieldLabel htmlFor="booking-guest-name">Hóspede</FieldLabel>
          <Input
            id="booking-guest-name"
            name="guestName"
            placeholder="João Silva"
            defaultValue={defaultValues.guestName}
            maxLength={80}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="booking-room">Quarto</FieldLabel>
          <Input
            id="booking-room"
            name="room"
            placeholder="204"
            defaultValue={defaultValues.room}
            maxLength={20}
            required
          />
        </Field>
        <DateTimeField idPrefix="booking" name="startsAt" defaultValue={defaultValues.startsAt} />
        <Field>
          <FieldLabel htmlFor="booking-service">Serviço</FieldLabel>
          <Select
            name="serviceId"
            items={serviceItems}
            value={serviceId}
            onValueChange={(value) => {
              const next = value as string | null
              setServiceId(next)
              // A duração do serviço vira a sugestão, e ainda pode ser ajustada.
              const service = services.find((option) => option.id === next)
              if (service) setDuration(String(service.durationMinutes))
            }}
            disabled={!unitId}
            required
          >
            <SelectTrigger id="booking-service" className="w-full">
              <SelectValue placeholder={unitId ? "Escolha o serviço" : "Escolha a unidade primeiro"} />
            </SelectTrigger>
            <SelectContent>
              {serviceItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="booking-duration">Duração (minutos)</FieldLabel>
          <Input
            id="booking-duration"
            name="durationMinutes"
            type="number"
            inputMode="numeric"
            min={5}
            max={720}
            step={5}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            required
          />
          {Number(duration) >= 5 && Number(duration) <= 720 && (
            <FieldDescription>{formatDuration(Number(duration))}</FieldDescription>
          )}
        </Field>
      </FieldGroup>
      <SheetFooter>
        <Button type="submit" disabled={pending}>
          {pending ? copy[mode].pending : copy[mode].submit}
        </Button>
        {onConvert && (
          <Button type="button" variant="outline" onClick={onConvert} disabled={pending}>
            <ClipboardCheckIcon />
            Registrar atendimento
          </Button>
        )}
        {onDelete && (
          <Button type="button" variant="destructive" onClick={onDelete} disabled={pending}>
            Excluir
          </Button>
        )}
      </SheetFooter>
    </form>
  )
}
