"use client"

import { useActionState, useState } from "react"
import { PlusIcon } from "lucide-react"
import { createUnitAction, type CreateUnitState } from "@/lib/actions/unit"

import { Button } from "@/components/ui/button"
import { FieldError, FieldGroup } from "@/components/ui/field"
import { UnitFields } from "@/components/unit-fields"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export function CreateUnitSheet({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(
    async (prev: CreateUnitState, formData: FormData) => {
      const next = await createUnitAction(workspaceId, prev, formData)
      if (!next.error) setOpen(false)
      return next
    },
    { error: null },
  )

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button />}>
        <PlusIcon />
        Cadastrar unidade
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <form action={formAction} className="flex flex-1 flex-col">
          <SheetHeader>
            <SheetTitle>Cadastrar unidade</SheetTitle>
            <SheetDescription>Adicione uma unidade a este workspace.</SheetDescription>
          </SheetHeader>
          <FieldGroup className="px-4">
            {state.error && <FieldError>{state.error}</FieldError>}
            <UnitFields idPrefix="create-unit" />
          </FieldGroup>
          <SheetFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Cadastrando..." : "Cadastrar"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
