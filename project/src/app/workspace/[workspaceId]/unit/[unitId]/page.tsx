import { LayoutDashboardIcon } from "lucide-react"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

// Cabeçalho, navegação e verificação de posse ficam no layout da unidade.
export default function UnitOverviewPage() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LayoutDashboardIcon />
        </EmptyMedia>
        <EmptyTitle>Visão geral</EmptyTitle>
        <EmptyDescription>Os indicadores desta unidade aparecerão aqui.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
