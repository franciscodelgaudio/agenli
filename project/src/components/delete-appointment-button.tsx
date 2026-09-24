"use client"

import { useState, useTransition } from "react"
import { Trash2Icon } from "lucide-react"
import { deleteAppointmentAction } from "@/lib/actions/appointment"

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
import { FieldError } from "@/components/ui/field"

type Props = {
  workspaceId: string
  unitId: string
  appointment: { id: string; guest: { name: string; room: string } }
}

export function DeleteAppointmentButton({ workspaceId, unitId, appointment }: Props) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteAppointmentAction(workspaceId, unitId, appointment.id)
      setError(result.error)
      if (!result.error) setOpen(false)
    })
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Excluir atendimento de ${appointment.guest.name}`}
        onClick={() => setOpen(true)}
      >
        <Trash2Icon />
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) setError(null)
          setOpen(next)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir atendimento?</AlertDialogTitle>
            <AlertDialogDescription>
              O atendimento de <strong>{appointment.guest.name}</strong> (quarto {appointment.guest.room}) será
              excluído permanentemente. Essa ação não pode ser desfeita.
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
    </>
  )
}
