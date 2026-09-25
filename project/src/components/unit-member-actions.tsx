"use client"

import { useActionState, useState } from "react"
import { PencilIcon } from "lucide-react"
import { updateUnitMemberAction, type UnitMemberFormState } from "@/lib/actions/unit-member"
import type { MemberRole } from "@/lib/member-role"

import { AmountInput } from "@/components/amount-input"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const payLabels = { commission: "Comissão (%)", salary: "Salário mensal (R$)" } as const
type Pay = keyof typeof payLabels

// Comissão ou salário, nunca os dois; ambos null enquanto não foi definido.
type Member = {
  id: string
  label: string
  role: MemberRole
  commissionPercent: number | null
  salaryCents: number | null
}

type Props = { workspaceId: string; unitId: string; unitName: string; member: Member }

export function UnitMemberActions(props: Props) {
  const [open, setOpen] = useState(false)
  // Muda a cada abertura para remontar o formulário com os valores atuais e sem erro antigo.
  const [formKey, setFormKey] = useState(0)

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Editar remuneração de ${props.member.label} nesta unidade`}
        onClick={() => {
          setFormKey((k) => k + 1)
          setOpen(true)
        }}
      >
        <PencilIcon />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <UnitMemberForm key={formKey} {...props} onDone={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  )
}

function UnitMemberForm({ workspaceId, unitId, unitName, member, onDone }: Props & { onDone: () => void }) {
  const [pay, setPay] = useState<Pay>(member.salaryCents !== null ? "salary" : "commission")
  const [state, formAction, pending] = useActionState(
    async (prev: UnitMemberFormState, formData: FormData) => {
      const next = await updateUnitMemberAction(workspaceId, unitId, member.id, prev, formData)
      if (!next.error) onDone()
      return next
    },
    { error: null },
  )
  const isTherapist = member.role === "massage_therapist"
  const idPrefix = `unit-member-${member.id}`

  return (
    <form action={formAction} className="flex min-h-0 flex-1 flex-col">
      <SheetHeader>
        <SheetTitle>{member.label}</SheetTitle>
        <SheetDescription>Remuneração em {unitName}</SheetDescription>
      </SheetHeader>
      <FieldGroup className="min-h-0 flex-1 overflow-y-auto px-4">
        {state.error && <FieldError>{state.error}</FieldError>}
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-pay`}>Forma de pagamento</FieldLabel>
          <Select
            name="pay"
            items={Object.entries(payLabels).map(([value, label]) => ({ value, label }))}
            value={pay}
            onValueChange={(value) => setPay(value as Pay)}
            required
          >
            <SelectTrigger id={`${idPrefix}-pay`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(payLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {pay === "commission" ? (
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-commission`}>Comissão</FieldLabel>
            <AmountInput
              id={`${idPrefix}-commission`}
              mode="percent"
              name="commissionPercent"
              max={10_000}
              placeholder="0,00%"
              defaultValue={member.commissionPercent === null ? null : Math.round(member.commissionPercent * 100)}
              required
            />
            <FieldDescription>
              {isTherapist
                ? "Percentual sobre o valor dos serviços que ela fizer nesta unidade."
                : "Percentual sobre o faturamento bruto desta unidade."}{" "}
              Sai do líquido no caixa.
            </FieldDescription>
          </Field>
        ) : (
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-salary`}>Salário mensal</FieldLabel>
            <AmountInput
              id={`${idPrefix}-salary`}
              name="salary"
              placeholder="R$ 0,00"
              defaultValue={member.salaryCents}
              required
            />
            <FieldDescription>Rateado por dia no caixa desta unidade e descontado do líquido.</FieldDescription>
          </Field>
        )}
      </FieldGroup>
      <SheetFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </Button>
      </SheetFooter>
    </form>
  )
}
