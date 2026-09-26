"use client"

import * as React from "react"
import { cn } from "cn"

type Props = Omit<React.ComponentProps<"div">, "onDrop" | "children"> & {
  id?: string
  accept?: string
  disabled?: boolean
  onFile: (file: File) => void
  children: (state: { dragging: boolean }) => React.ReactNode
}

// Área que aceita arrastar, clicar (ou Enter/Espaço) e colar um arquivo; entrega só o primeiro.
function FileDropzone({ id, accept, disabled, onFile, className, children, ...props }: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = React.useState(false)
  // dragenter/dragleave disparam também nos filhos; o contador evita piscar.
  const depth = React.useRef(0)

  function pick(files: FileList | null | undefined) {
    const file = files?.[0]
    if (file && !disabled) onFile(file)
  }

  return (
    <div
      data-slot="file-dropzone"
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      data-dragging={dragging || undefined}
      className={cn(
        "relative flex cursor-pointer rounded-lg border border-dashed border-input bg-transparent transition-colors outline-none hover:border-ring/60 hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-disabled:pointer-events-none aria-disabled:opacity-60 data-dragging:border-primary data-dragging:bg-primary/5",
        className
      )}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          inputRef.current?.click()
        }
      }}
      onPaste={(event) => pick(event.clipboardData.files)}
      onDragEnter={(event) => {
        event.preventDefault()
        depth.current += 1
        if (!disabled) setDragging(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1)
        if (depth.current === 0) setDragging(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        depth.current = 0
        setDragging(false)
        pick(event.dataTransfer.files)
      }}
      {...props}
    >
      {children({ dragging })}
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        tabIndex={-1}
        className="sr-only"
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          pick(event.target.files)
          event.target.value = ""
        }}
      />
    </div>
  )
}

export { FileDropzone }
