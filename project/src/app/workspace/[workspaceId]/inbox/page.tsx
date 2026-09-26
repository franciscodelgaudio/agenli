import { MessagesSquareIcon } from "lucide-react"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

// Lado direito sem conversa aberta. O acesso é verificado no layout.
export default function InboxPage() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MessagesSquareIcon />
        </EmptyMedia>
        <EmptyTitle>Selecione uma conversa</EmptyTitle>
      </EmptyHeader>
    </Empty>
  )
}
