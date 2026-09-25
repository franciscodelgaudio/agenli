import { BanknoteIcon, HashIcon, PackageIcon, SettingsIcon, StarIcon } from "lucide-react"
import { ProductActions } from "@/components/product-actions"
import { SortableHead } from "@/components/sortable-head"
import { StarRating } from "@/components/star-rating"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ProductListQuery } from "@/lib/product-list"
import { currencyFormat } from "@/components/service-format"

type Props = {
  products: {
    id: string
    name: string
    quantity: number
    costCents: number
    notes: string | null
    rating: number | null
    avatarUrl: string | null
  }[]
  query: ProductListQuery
  pathname: string
  workspaceId: string
  unitId: string
  // Sem permissão, a coluna de ações (editar/excluir) não aparece.
  canManage: boolean
}

export function ProductTable({ products, query, pathname, workspaceId, unitId, canManage }: Props) {
  return (
    <div className="border">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead field="name" label="Produto" icon={PackageIcon} query={query} pathname={pathname} />
            <SortableHead field="quantity" label="Quantidade" icon={HashIcon} query={query} pathname={pathname} />
            <SortableHead
              field="costCents"
              label="Preço de custo"
              icon={BanknoteIcon}
              query={query}
              pathname={pathname}
            />
            <SortableHead field="rating" label="Avaliação" icon={StarIcon} query={query} pathname={pathname} />
            {canManage && (
              <TableHead className="w-0 px-4 text-right">
                <span className="inline-flex items-center gap-1">
                  <SettingsIcon className="size-4 text-muted-foreground" />
                  Ações
                </span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canManage ? 5 : 4} className="h-24 px-4 text-center text-muted-foreground">
                Nenhum produto encontrado.
              </TableCell>
            </TableRow>
          ) : (
            products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="px-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="rounded-md after:rounded-md">
                      {product.avatarUrl && (
                        <AvatarImage src={product.avatarUrl} alt={product.name} className="rounded-md" />
                      )}
                      <AvatarFallback className="rounded-md">{product.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="grid min-w-0">
                      <span className="truncate font-medium">{product.name}</span>
                      {product.notes && (
                        <span className="max-w-xs truncate text-xs text-muted-foreground" title={product.notes}>
                          {product.notes}
                        </span>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-4 tabular-nums">{product.quantity}</TableCell>
                <TableCell className="px-4 tabular-nums">{currencyFormat.format(product.costCents / 100)}</TableCell>
                <TableCell className="px-4">
                  <StarRating value={product.rating} />
                </TableCell>
                {canManage && (
                  <TableCell className="px-4 text-right">
                    <ProductActions workspaceId={workspaceId} unitId={unitId} product={product} />
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
