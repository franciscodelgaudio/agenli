"use client"

import { useActionState } from "react"
import { cn } from "@/lib/utils"
import { createWorkspaceAction } from "@/lib/actions/workspace"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function CreateWorkspaceForm({
  className,
  ...props
}: Omit<React.ComponentProps<"form">, "action">) {
  const [state, formAction, pending] = useActionState(createWorkspaceAction, {
    error: null,
  })

  return (
    <form
      action={formAction}
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Crie seu workspace</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Dê um nome para o seu workspace para começar
          </p>
        </div>
        {state.error && (
          <FieldError className="text-center">{state.error}</FieldError>
        )}
        <Field>
          <FieldLabel htmlFor="name">Nome</FieldLabel>
          <Input
            id="name"
            name="name"
            placeholder="Spa Central"
            maxLength={80}
            autoFocus
            required
          />
        </Field>
        <Field>
          <Button type="submit" disabled={pending}>
            {pending ? "Criando..." : "Criar workspace"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
