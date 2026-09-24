"use client"

import { useActionState, useState, useTransition } from "react"
import { EllipsisIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { deleteHotelAction, updateHotelAction, type UpdateHotelState } from "@/lib/actions/hotel"

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
import { HotelFields } from "@/components/hotel-fields"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type Hotel = { id: string; name: string; avatarUrl: string | null }

export function HotelActions({ workspaceId, hotel }: { workspaceId: string; hotel: Hotel }) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  // Muda a cada abertura para remontar o formulário com os valores atuais e sem erro antigo.
  const [editKey, setEditKey] = useState(0)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={`Ações de ${hotel.name}`} />}
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            onClick={() => {
              setEditKey((k) => k + 1)
              setEditOpen(true)
            }}
          >
            <PencilIcon />
            Editar
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
          <EditHotelForm
            key={editKey}
            workspaceId={workspaceId}
            hotel={hotel}
            onDone={() => setEditOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <DeleteHotelDialog
        workspaceId={workspaceId}
        hotel={hotel}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  )
}

function EditHotelForm({
  workspaceId,
  hotel,
  onDone,
}: {
  workspaceId: string
  hotel: Hotel
  onDone: () => void
}) {
  const [state, formAction, pending] = useActionState(
    async (prev: UpdateHotelState, formData: FormData) => {
      const next = await updateHotelAction(workspaceId, hotel.id, prev, formData)
      if (!next.error) onDone()
      return next
    },
    { error: null },
  )

  return (
    <form action={formAction} className="flex flex-1 flex-col">
      <SheetHeader>
        <SheetTitle>Editar unidade</SheetTitle>
        <SheetDescription>Altere os dados desta unidade.</SheetDescription>
      </SheetHeader>
      <FieldGroup className="px-4">
        {state.error && <FieldError>{state.error}</FieldError>}
        <HotelFields idPrefix={`edit-hotel-${hotel.id}`} defaultValues={hotel} />
      </FieldGroup>
      <SheetFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </Button>
      </SheetFooter>
    </form>
  )
}

function DeleteHotelDialog({
  workspaceId,
  hotel,
  open,
  onOpenChange,
}: {
  workspaceId: string
  hotel: Hotel
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteHotelAction(workspaceId, hotel.id)
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
          <AlertDialogTitle>Excluir unidade?</AlertDialogTitle>
          <AlertDialogDescription>
            A unidade <strong>{hotel.name}</strong> será excluída permanentemente. Essa ação não pode ser desfeita.
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
