"use client"

import { useActionState, useState } from "react"
import { PlusIcon } from "lucide-react"
import { createProductAction, type ProductActionState } from "@/lib/actions/product"

import { Button } from "@/components/ui/button"
import { FieldError, FieldGroup } from "@/components/ui/field"
import { ProductFields } from "@/components/product-fields"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export function CreateProductSheet({ workspaceId, unitId }: { workspaceId: string; unitId: string }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(
    async (prev: ProductActionState, formData: FormData) => {
      const next = await createProductAction(workspaceId, unitId, prev, formData)
      if (!next.error) setOpen(false)
      return next
    },
    { error: null },
  )

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button />}>
        <PlusIcon />
        Cadastrar produto
      </SheetTrigger>
      <SheetContent>
        <form action={formAction} className="flex min-h-0 flex-1 flex-col">
          <SheetHeader>
            <SheetTitle>Cadastrar produto</SheetTitle>
            <SheetDescription>Adicione um produto ao estoque desta unidade.</SheetDescription>
          </SheetHeader>
          {/* Só os campos rolam; título e botões ficam fixos. */}
          <FieldGroup className="min-h-0 flex-1 overflow-y-auto px-4">
            {state.error && <FieldError>{state.error}</FieldError>}
            <ProductFields idPrefix="create-product" />
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
