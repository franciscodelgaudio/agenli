import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type Props = {
  idPrefix: string
  defaultValues?: { name: string; priceCents: number; durationMinutes: number }
}

export function ServiceFields({ idPrefix, defaultValues }: Props) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-name`}>Nome</FieldLabel>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          placeholder="Massagem Candle"
          defaultValue={defaultValues?.name}
          maxLength={80}
          autoFocus
          required
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-price`}>Valor (R$)</FieldLabel>
        {/* type="number" envia sempre ponto decimal, o formato que o servidor espera. */}
        <Input
          id={`${idPrefix}-price`}
          name="price"
          type="number"
          inputMode="decimal"
          min={0}
          max={1000000}
          step={0.01}
          placeholder="350,00"
          defaultValue={defaultValues ? (defaultValues.priceCents / 100).toFixed(2) : undefined}
          required
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-duration`}>Duração média (minutos)</FieldLabel>
        <Input
          id={`${idPrefix}-duration`}
          name="durationMinutes"
          type="number"
          inputMode="numeric"
          min={1}
          max={1440}
          step={1}
          placeholder="60"
          defaultValue={defaultValues?.durationMinutes}
          required
        />
      </Field>
    </>
  )
}
