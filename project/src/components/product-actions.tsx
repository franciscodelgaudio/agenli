"use client"

import { useActionState, useState, useTransition } from "react"
import Link from "next/link"
import { EllipsisIcon, HistoryIcon, PackageXIcon, PencilIcon, Trash2Icon } from "lucide-react"
import {
  deleteProductAction,
  depleteProductAction,
  updateProductAction,
  type ProductActionState,
} from "@/lib/actions/product"
import type { ProductUsageSummary } from "@/lib/product-usage"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FieldError, FieldGroup } from "@/components/ui/field"
import { ProductFields } from "@/components/product-fields"
import { formatUses } from "@/components/product-format"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type Product = {
  id: string
  name: string
  quantity: number
  costCents: number
  notes: string | null
  rating: number | null
  avatarUrl: string | null
  usage: ProductUsageSummary
}

type Props = { workspaceId: string; unitId: string; product: Product }

export function ProductActions({ workspaceId, unitId, product }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [depleteOpen, setDepleteOpen] = useState(false)
  // Muda a cada abertura para remontar o formulário com os valores atuais e sem erro antigo.
  const [editKey, setEditKey] = useState(0)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={`Ações de ${product.name}`} />}
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            onClick={() => {
              setEditKey((k) => k + 1)
              setEditOpen(true)
            }}
          >
            <PencilIcon />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDepleteOpen(true)}>
            <PackageXIcon />
            Marcar como acabou
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href={`/workspace/${workspaceId}/unit/${unitId}/stock/${product.id}`} />}>
            <HistoryIcon />
            Histórico de uso
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2Icon />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent>
          <EditProductForm
            key={editKey}
            workspaceId={workspaceId}
            unitId={unitId}
            product={product}
            onDone={() => setEditOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <DeleteProductDialog
        workspaceId={workspaceId}
        unitId={unitId}
        product={product}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />

      <DepleteProductDialog
        workspaceId={workspaceId}
        unitId={unitId}
        product={product}
        open={depleteOpen}
        onOpenChange={setDepleteOpen}
      />
    </>
  )
}

function EditProductForm({ workspaceId, unitId, product, onDone }: Props & { onDone: () => void }) {
  const [state, formAction, pending] = useActionState(
    async (prev: ProductActionState, formData: FormData) => {
      const next = await updateProductAction(workspaceId, unitId, product.id, prev, formData)
      if (!next.error) onDone()
      return next
    },
    { error: null },
  )

  return (
    <form action={formAction} className="flex min-h-0 flex-1 flex-col">
      <SheetHeader>
        <SheetTitle>Editar produto</SheetTitle>
        <SheetDescription>Altere os dados deste produto.</SheetDescription>
      </SheetHeader>
      {/* Só os campos rolam; título e botões ficam fixos. */}
      <FieldGroup className="min-h-0 flex-1 overflow-y-auto px-4">
        {state.error && <FieldError>{state.error}</FieldError>}
        <ProductFields
          idPrefix={`edit-product-${product.id}`}
          workspaceId={workspaceId}
          unitId={unitId}
          defaultValues={product}
        />
      </FieldGroup>
      <SheetFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </Button>
      </SheetFooter>
    </form>
  )
}

function DeleteProductDialog({
  workspaceId,
  unitId,
  product,
  open,
  onOpenChange,
}: Props & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteProductAction(workspaceId, unitId, product.id)
      setError(result.error)
      if (!result.error) onOpenChange(false)
    })
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null)
        onOpenChange(next)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
          <AlertDialogDescription>
            O produto <strong>{product.name}</strong> será excluído permanentemente. Essa ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <FieldError>{error}</FieldError>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <Button variant="destructive" onClick={handleDelete} disabled={pending}>
            {pending ? "Excluindo..." : "Excluir"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function DepleteProductDialog({
  workspaceId,
  unitId,
  product,
  open,
  onOpenChange,
}: Props & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleDeplete() {
    startTransition(async () => {
      const result = await depleteProductAction(workspaceId, unitId, product.id)
      setError(result.error)
      if (!result.error) onOpenChange(false)
    })
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null)
        onOpenChange(next)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Marcar como acabou?</AlertDialogTitle>
          <AlertDialogDescription>
            Registra que uma unidade de <strong>{product.name}</strong> acabou agora, depois de{" "}
            {formatUses(product.usage.usesSinceLastDepletion)}, e tira 1 da quantidade em estoque (hoje{" "}
            {product.quantity}).
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <FieldError>{error}</FieldError>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <Button onClick={handleDeplete} disabled={pending}>
            {pending ? "Registrando..." : "Acabou"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
