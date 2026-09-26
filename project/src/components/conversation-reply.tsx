"use client"

import { useActionState, useEffect, useRef } from "react"
import { SendHorizontalIcon } from "lucide-react"
import {
  markConversationReadAction,
  sendReplyAction,
  type MessagingActionState,
} from "@/lib/actions/messaging"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

type Props = { workspaceId: string; conversationId: string; maxLength: number }

export function ConversationReply({ workspaceId, conversationId, maxLength }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState(
    async (prev: MessagingActionState, formData: FormData) => {
      const next = await sendReplyAction(workspaceId, conversationId, prev, formData)
      if (!next.error) formRef.current?.reset()
      return next
    },
    { error: null },
  )

  return (
    <form ref={formRef} action={formAction} className="flex shrink-0 flex-col gap-2 border-t p-3">
      {state.error && <FieldError>{state.error}</FieldError>}
      <div className="flex items-end gap-2">
        <Textarea
          name="text"
          placeholder="Escreva uma mensagem..."
          aria-label="Mensagem"
          maxLength={maxLength}
          rows={1}
          className="max-h-40 min-h-9 resize-none"
          required
          autoFocus
          // Enter envia; Shift+Enter quebra a linha.
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              if (!pending) event.currentTarget.form?.requestSubmit()
            }
          }}
        />
        <Button type="submit" size="icon" loading={pending} aria-label="Enviar">
          <SendHorizontalIcon />
        </Button>
      </div>
    </form>
  )
}

// Zera as não lidas ao abrir a conversa e sempre que chegar mensagem nova com ela aberta.
export function MarkConversationRead({
  workspaceId,
  conversationId,
  unreadCount,
}: {
  workspaceId: string
  conversationId: string
  unreadCount: number
}) {
  useEffect(() => {
    if (unreadCount > 0) void markConversationReadAction(workspaceId, conversationId)
  }, [workspaceId, conversationId, unreadCount])
  return null
}
