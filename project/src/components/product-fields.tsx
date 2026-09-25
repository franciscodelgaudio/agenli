import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { AmountInput } from "@/components/amount-input"
import { StarRatingInput } from "@/components/star-rating"

type Props = {
  idPrefix: string
  defaultValues?: {
    name: string
    quantity: number
    costCents: number
    notes: string | null
    rating: number | null
    avatarUrl: string | null
  }
}

export function ProductFields({ idPrefix, defaultValues }: Props) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-name`}>Nome</FieldLabel>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          placeholder="Óleo de amêndoas"
          defaultValue={defaultValues?.name}
          maxLength={80}
          autoFocus
          required
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-quantity`}>Quantidade</FieldLabel>
        <Input
          id={`${idPrefix}-quantity`}
          name="quantity"
          type="number"
          inputMode="numeric"
          min={0}
          max={1_000_000}
          step={1}
          placeholder="10"
          defaultValue={defaultValues?.quantity}
          required
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-cost`}>Preço de custo</FieldLabel>
        <AmountInput
          id={`${idPrefix}-cost`}
          name="cost"
          max={100_000_000}
          placeholder="R$ 45,90"
          defaultValue={defaultValues?.costCents}
          required
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-rating`}>Avaliação (opcional)</FieldLabel>
        <StarRatingInput id={`${idPrefix}-rating`} name="rating" defaultValue={defaultValues?.rating} />
        <FieldDescription>Clique na estrela marcada para limpar.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-notes`}>Observações (opcional)</FieldLabel>
        <Textarea
          id={`${idPrefix}-notes`}
          name="notes"
          placeholder="Fornecedor, validade, onde fica guardado..."
          defaultValue={defaultValues?.notes ?? undefined}
          maxLength={500}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-avatar-url`}>URL da imagem (opcional)</FieldLabel>
        <Input
          id={`${idPrefix}-avatar-url`}
          name="avatarUrl"
          type="url"
          placeholder="https://exemplo.com/produto.png"
          defaultValue={defaultValues?.avatarUrl ?? undefined}
        />
      </Field>
    </>
  )
}
