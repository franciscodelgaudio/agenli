"use client"

import { useActionState, useState, useTransition } from "react"
import { EllipsisIcon, HistoryIcon, PackageXIcon, PencilIcon, Trash2Icon } from "lucide-react"
import {
  deleteProductAction,
  depleteProductAction,
  updateProductAction,
  type ProductActionState,
} from "@/lib/actions/product"
import type { ProductUsageSummary } from "@/lib/product-usage"
import { dateTimeFormat } from "@/lib/utils"

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
import { formatAverage, formatUses } from "@/components/product-format"
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
  const [historyOpen, setHistoryOpen] = useState(false)
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
          <DropdownMenuItem onClick={() => setHistoryOpen(true)}>
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

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent>
          <UsageHistory product={product} />
        </SheetContent>
      </Sheet>
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
        <ProductFields idPrefix={`edit-product-${product.id}`} defaultValues={product} />
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

// Cada vez que o produto acabou, da mais recente para a mais antiga, com os usos do ciclo.
function UsageHistory({ product }: { product: Product }) {
  const { cycles, usesSinceLastDepletion, averageUsesPerDepletion } = product.usage

  return (
    <>
      <SheetHeader>
        <SheetTitle>Histórico de uso</SheetTitle>
        <SheetDescription>
          {product.name}: atendimentos e agendamentos que usaram o produto entre uma vez que ele acabou e a seguinte.
        </SheetDescription>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div className="border p-3">
            <dt className="text-muted-foreground">Média até acabar</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatAverage(averageUsesPerDepletion)}</dd>
          </div>
          <div className="border p-3">
            <dt className="text-muted-foreground">Desde a última vez</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatUses(usesSinceLastDepletion)}</dd>
          </div>
        </dl>
        {cycles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Este produto ainda não acabou nenhuma vez. Use &quot;Marcar como acabou&quot; quando isso acontecer.
          </p>
        ) : (
          <ol className="grid gap-2">
            {[...cycles].reverse().map((cycle) => (
              <li
                key={cycle.depletedAt.getTime()}
                className="flex items-center justify-between gap-4 border px-3 py-2 text-sm"
              >
                <span>Acabou em {dateTimeFormat.format(cycle.depletedAt)}</span>
                <span className="font-medium tabular-nums">{formatUses(cycle.uses)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  )
}
