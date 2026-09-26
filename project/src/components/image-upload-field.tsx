"use client"

import { useRef, useState } from "react"
import { ImageIcon, Loader2Icon, Trash2Icon, UploadIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"

type Props = {
  id: string
  label: string
  workspaceId: string
  // Define a pasta no bucket e a permissão conferida no servidor.
  target: "unit" | "product"
  unitId?: string
  defaultValue?: string | null
}

// Envia a imagem ao escolher o arquivo e guarda a URL pública no campo avatarUrl do formulário.
export function ImageUploadField({ id, label, workspaceId, target, unitId, defaultValue }: Props) {
  const [url, setUrl] = useState(defaultValue ?? "")
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    setUploading(true)
    setError(null)
    const body = new FormData()
    body.set("file", file)
    body.set("target", target)
    if (unitId) body.set("unitId", unitId)
    try {
      const response = await fetch(`/api/workspace/${workspaceId}/uploads`, { method: "POST", body })
      const data = (await response.json()) as { url?: string; error?: string }
      if (data.url) setUrl(data.url)
      else setError(data.error ?? "Não foi possível enviar a imagem. Tente novamente.")
    } catch {
      setError("Não foi possível enviar a imagem. Tente novamente.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-3">
        <Avatar size="lg" className="rounded-md after:rounded-md">
          {url && <AvatarImage src={url} alt="" className="rounded-md" />}
          <AvatarFallback className="rounded-md">
            <ImageIcon className="size-4" />
          </AvatarFallback>
        </Avatar>
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
          {uploading ? "Enviando..." : url ? "Trocar" : "Enviar imagem"}
        </Button>
        {url && !uploading && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setUrl("")}>
            <Trash2Icon />
            Remover
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (file) upload(file)
        }}
      />
      <input type="hidden" name="avatarUrl" value={url} />
      {error && <FieldError>{error}</FieldError>}
    </Field>
  )
}
