import { WalletIcon } from "lucide-react"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

// Cabeçalho, navegação e verificação de posse ficam no layout da unidade.
export default function CashFlowPage() {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold tracking-tight">Caixa</h3>
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <WalletIcon />
          </EmptyMedia>
          <EmptyTitle>Nenhuma movimentação</EmptyTitle>
          <EmptyDescription>As entradas e saídas do caixa desta unidade aparecerão aqui.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  )
}
