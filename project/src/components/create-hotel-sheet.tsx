"use client"

import { useActionState, useState } from "react"
import { PlusIcon } from "lucide-react"
import { createHotelAction, type CreateHotelState } from "@/lib/actions/hotel"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export function CreateHotelSheet({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(
    async (prev: CreateHotelState, formData: FormData) => {
      const next = await createHotelAction(workspaceId, prev, formData)
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
      <SheetContent>
        <form action={formAction} className="flex flex-1 flex-col">
          <SheetHeader>
            <SheetTitle>Cadastrar unidade</SheetTitle>
            <SheetDescription>Adicione uma unidade a este workspace.</SheetDescription>
          </SheetHeader>
          <FieldGroup className="px-4">
            {state.error && <FieldError>{state.error}</FieldError>}
            <Field>
              <FieldLabel htmlFor="hotel-name">Nome</FieldLabel>
              <Input
                id="hotel-name"
                name="name"
                placeholder="Unidade Centro"
                maxLength={80}
                autoFocus
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="hotel-avatar-url">URL do avatar (opcional)</FieldLabel>
              <Input
                id="hotel-avatar-url"
                name="avatarUrl"
                type="url"
                placeholder="https://exemplo.com/logo.png"
              />
            </Field>
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
