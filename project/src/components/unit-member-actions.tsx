"use client"

import { useActionState, useState } from "react"
import { PencilIcon } from "lucide-react"
import { updateUnitMemberAction, type UnitMemberFormState } from "@/lib/actions/unit-member"
import type { MemberRole } from "@/lib/member-role"

import { AmountInput } from "@/components/amount-input"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

// commissionPercent só existe para massagistas vinculadas.
type Member = {
  id: string
  label: string
  role: MemberRole
  linked: boolean
  commissionPercent: number | null
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
        aria-label={`Editar ${props.member.label} nesta unidade`}
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
  const [linked, setLinked] = useState(member.linked)
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
        <SheetDescription>Vínculo com {unitName}</SheetDescription>
      </SheetHeader>
      <FieldGroup className="min-h-0 flex-1 overflow-y-auto px-4">
        {state.error && <FieldError>{state.error}</FieldError>}
        <Field orientation="horizontal">
          <input
            id={`${idPrefix}-linked`}
            name="linked"
            type="checkbox"
            className="size-4 accent-primary"
            checked={linked}
            onChange={(event) => setLinked(event.target.checked)}
          />
          <FieldLabel htmlFor={`${idPrefix}-linked`}>Trabalha nesta unidade</FieldLabel>
        </Field>
        {isTherapist && linked && (
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
              Percentual sobre o valor dos serviços que ela fizer nesta unidade. Aparece no caixa.
            </FieldDescription>
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
