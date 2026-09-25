"use client"

import { useActionState, useState } from "react"
import { PlusIcon } from "lucide-react"
import { createServiceAction, type ServiceActionState } from "@/lib/actions/service"

import { Button } from "@/components/ui/button"
import { FieldError, FieldGroup } from "@/components/ui/field"
import { ServiceFields } from "@/components/service-fields"
import type { ProductOption } from "@/components/product-picker"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

type Props = { workspaceId: string; unitId: string; products: ProductOption[] }

export function CreateServiceSheet({ workspaceId, unitId, products }: Props) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(
    async (prev: ServiceActionState, formData: FormData) => {
      const next = await createServiceAction(workspaceId, unitId, prev, formData)
      if (!next.error) setOpen(false)
      return next
    },
    { error: null },
  )

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button />}>
        <PlusIcon />
        Cadastrar serviço
      </SheetTrigger>
      <SheetContent>
        <form action={formAction} className="flex min-h-0 flex-1 flex-col">
          <SheetHeader>
            <SheetTitle>Cadastrar serviço</SheetTitle>
            <SheetDescription>Adicione um serviço prestado nesta unidade.</SheetDescription>
          </SheetHeader>
          {/* Só os campos rolam; título e botões ficam fixos. */}
          <FieldGroup className="min-h-0 flex-1 overflow-y-auto px-4">
            {state.error && <FieldError>{state.error}</FieldError>}
            <ServiceFields idPrefix="create-service" products={products} />
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
