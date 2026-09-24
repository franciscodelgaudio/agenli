"use client"

import { useState, useTransition } from "react"
import { EllipsisIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { deleteAppointmentAction, updateAppointmentAction } from "@/lib/actions/appointment"
import { BRT_OFFSET_HOURS } from "@/lib/appointment-list"

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
import { FieldError } from "@/components/ui/field"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { AppointmentForm, type AppointmentOptions } from "@/components/appointment-form"

type Appointment = {
  id: string
  performedAt: Date
  guest: { name: string; room: string }
  items: { serviceId: string; therapistId: string }[]
}

type Props = AppointmentOptions & { workspaceId: string; unitId: string; appointment: Appointment }

// Date (UTC) -> "2026-09-24T14:30" no horário de Brasília, o formato do formulário.
function toFormDateTime(date: Date) {
  return new Date(date.getTime() - BRT_OFFSET_HOURS * 60 * 60 * 1000).toISOString().slice(0, 16)
}

export function AppointmentActions({ workspaceId, unitId, appointment, ...options }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  // Muda a cada abertura para remontar o formulário com os valores atuais e sem erro antigo.
  const [editKey, setEditKey] = useState(0)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={`Ações do atendimento de ${appointment.guest.name}`} />
          }
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
        <SheetContent className="overflow-y-auto">
          <AppointmentForm
            key={editKey}
            {...options}
            mode="edit"
            defaultValues={{
              guestName: appointment.guest.name,
              room: appointment.guest.room,
              performedAt: toFormDateTime(appointment.performedAt),
              items: appointment.items.map(({ serviceId, therapistId }) => ({ serviceId, therapistId })),
            }}
            action={(prev, formData) => updateAppointmentAction(workspaceId, unitId, appointment.id, prev, formData)}
            onDone={() => setEditOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <DeleteAppointmentDialog
        workspaceId={workspaceId}
        unitId={unitId}
        appointment={appointment}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  )
}

function DeleteAppointmentDialog({
  workspaceId,
  unitId,
  appointment,
  open,
  onOpenChange,
}: {
  workspaceId: string
  unitId: string
  appointment: Appointment
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteAppointmentAction(workspaceId, unitId, appointment.id)
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
          <AlertDialogTitle>Excluir atendimento?</AlertDialogTitle>
          <AlertDialogDescription>
            O atendimento de <strong>{appointment.guest.name}</strong> (quarto {appointment.guest.room}) será excluído
            permanentemente. Essa ação não pode ser desfeita.
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
