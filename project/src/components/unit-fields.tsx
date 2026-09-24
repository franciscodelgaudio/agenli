import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RevenueShareFields } from "@/components/revenue-share-fields"
import type { RevenueShare } from "@/lib/revenue-share"

type Props = {
  idPrefix: string
  defaultValues?: { name: string; avatarUrl: string | null; revenueShare: RevenueShare | null }
}

export function HotelFields({ idPrefix, defaultValues }: Props) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-name`}>Nome</FieldLabel>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          placeholder="Unidade Centro"
          defaultValue={defaultValues?.name}
          maxLength={80}
          autoFocus
          required
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-avatar-url`}>URL do avatar (opcional)</FieldLabel>
        <Input
          id={`${idPrefix}-avatar-url`}
          name="avatarUrl"
          type="url"
          placeholder="https://exemplo.com/logo.png"
          defaultValue={defaultValues?.avatarUrl ?? undefined}
        />
      </Field>
      <RevenueShareFields idPrefix={idPrefix} defaultValue={defaultValues?.revenueShare} />
    </>
  )
}
