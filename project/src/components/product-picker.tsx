"use client"

import { CheckIcon } from "lucide-react"
import { cn } from "cn"

export type ProductOption = { id: string; unitId?: string; name: string }

type Props = {
  products: ProductOption[]
  value: string[]
  onChange: (value: string[]) => void
  emptyMessage?: string
}

// Escolha de produtos como chips. Envia cada escolhido num campo oculto productId.
// Só registra o uso: não mexe na quantidade em estoque.
export function ProductPicker({ products, value, onChange, emptyMessage = "Nenhum produto nesta unidade." }: Props) {
  const selected = new Set(value)
  if (products.length === 0) return <p className="text-sm text-muted-foreground">{emptyMessage}</p>

  return (
    <div className="flex flex-wrap gap-2">
      {products.map((product) => {
        const active = selected.has(product.id)
        return (
          <button
            key={product.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? value.filter((id) => id !== product.id) : [...value, product.id])}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-3.5",
              active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {active && <CheckIcon />}
            {product.name}
          </button>
        )
      })}
      {value.map((id) => (
        <input key={id} type="hidden" name="productId" value={id} />
      ))}
    </div>
  )
}

// Acrescenta os produtos padrão do serviço aos já escolhidos, sem repetir.
export function withServiceProducts(value: string[], service: { productIds: string[] } | undefined) {
  return service ? [...new Set([...value, ...service.productIds])] : value
}
