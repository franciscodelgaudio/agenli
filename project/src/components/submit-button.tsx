"use client"

import { useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"

// Botão de envio que carrega junto com o form (useFormStatus), para forms de server action sem
// estado no cliente. Com name/value, só este botão mostra o spinner quando foi ele o clicado:
// o React inclui o botão que enviou no FormData.
export function SubmitButton({ name, value, ...props }: React.ComponentProps<typeof Button> & { value?: string }) {
  const { pending, data } = useFormStatus()
  const submitter = !name || data?.get(name) === value
  return <Button type="submit" name={name} value={value} {...props} loading={pending && submitter} disabled={pending} />
}
