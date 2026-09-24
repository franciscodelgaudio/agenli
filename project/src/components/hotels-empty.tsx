import { Building2Icon } from "lucide-react"
import { CreateHotelSheet } from "@/components/create-hotel-sheet"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export function HotelsEmpty({ workspaceId }: { workspaceId: string }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Building2Icon />
        </EmptyMedia>
        <EmptyTitle>Nenhuma unidade cadastrada</EmptyTitle>
        <EmptyDescription>
          Este workspace ainda não tem unidades. Cadastre a primeira para começar.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <CreateHotelSheet workspaceId={workspaceId} />
      </EmptyContent>
    </Empty>
  )
}
