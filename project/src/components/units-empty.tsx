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

export function HotelsEmpty({ workspaceId, canManage }: { workspaceId: string; canManage: boolean }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Building2Icon />
        </EmptyMedia>
        <EmptyTitle>Nenhuma unidade cadastrada</EmptyTitle>
        <EmptyDescription>
          {canManage
            ? "Este workspace ainda não tem unidades. Cadastre a primeira para começar."
            : "Este workspace ainda não tem unidades."}
        </EmptyDescription>
      </EmptyHeader>
      {canManage && (
        <EmptyContent>
          <CreateHotelSheet workspaceId={workspaceId} />
        </EmptyContent>
      )}
    </Empty>
  )
}
