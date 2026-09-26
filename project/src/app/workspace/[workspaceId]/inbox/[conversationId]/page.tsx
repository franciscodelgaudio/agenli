import Link from "@/components/link"
import { notFound } from "next/navigation"
import { isObjectIdOrHexString, Types } from "mongoose"
import { ArrowLeftIcon, CheckCheckIcon, CheckIcon, CircleAlertIcon, ClockIcon, PaperclipIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { canUseInbox, type WorkspaceRole } from "@/lib/member-role"
import { messageTypeLabels } from "@/lib/messaging-inbox"
import { isReplyWindowOpen, MAX_TEXT_LENGTH } from "@/lib/messaging-send"
import type { DeliveryStatus, MessageDirection, MessageType, MessagingPlatform } from "@/lib/messaging-types"
import { requireUser, workspaceAccessStages } from "@/lib/session"
import { Workspace } from "@/models/Workspace"
import { ConversationReply, MarkConversationRead } from "@/components/conversation-reply"
import { contactDisplayName, PlatformIcon, platformLabels } from "@/components/platform-labels"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { InitialFallback } from "@/components/initial-fallback"

// Mensagens mais recentes da conversa que aparecem na tela.
const MESSAGE_LIMIT = 200

type ConversationView = {
  id: string
  platform: MessagingPlatform
  contactName: string | null
  contactExternalId: string
  channelName: string
  lastInboundAt: Date | null
  unreadCount: number
  messages: {
    id: string
    direction: MessageDirection
    type: MessageType
    text: string | null
    status: DeliveryStatus | null
    error: string | null
    sentAt: Date
  }[]
}

const whenFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
})

export default async function ConversationPage({
  params,
}: PageProps<"/workspace/[workspaceId]/inbox/[conversationId]">) {
  const { workspaceId, conversationId } = await params
  const user = await requireUser()
  const access = workspaceAccessStages(workspaceId, user.id)
  if (!access || !isObjectIdOrHexString(conversationId)) notFound()

  const [workspace] = await Workspace.aggregate<{ role: WorkspaceRole; conversation: ConversationView | null }>([
    ...access,
    {
      $lookup: {
        from: "conversations",
        localField: "_id",
        foreignField: "workspaceId",
        as: "conversation",
        pipeline: [
          { $match: { _id: new Types.ObjectId(conversationId) } },
          {
            $lookup: {
              from: "messaging_channels",
              localField: "channelId",
              foreignField: "_id",
              as: "channel",
              pipeline: [{ $project: { _id: 0, name: 1 } }],
            },
          },
          {
            $lookup: {
              from: "messages",
              localField: "_id",
              foreignField: "conversationId",
              as: "messages",
              pipeline: [
                { $sort: { sentAt: -1 } },
                { $limit: MESSAGE_LIMIT },
                { $sort: { sentAt: 1 } },
                {
                  $project: {
                    _id: 0,
                    id: { $toString: "$_id" },
                    direction: 1,
                    type: 1,
                    text: 1,
                    status: 1,
                    error: 1,
                    sentAt: 1,
                  },
                },
              ],
            },
          },
          {
            $project: {
              _id: 0,
              id: { $toString: "$_id" },
              platform: 1,
              contactName: 1,
              contactExternalId: 1,
              channelName: { $ifNull: [{ $first: "$channel.name" }, ""] },
              lastInboundAt: 1,
              unreadCount: 1,
              messages: 1,
            },
          },
        ],
      },
    },
    { $project: { _id: 0, role: 1, conversation: { $first: "$conversation" } } },
  ])
  if (!workspace || !canUseInbox(workspace.role) || !workspace.conversation) notFound()

  const { conversation } = workspace
  const name = contactDisplayName(conversation)
  const canReply = isReplyWindowOpen(conversation.lastInboundAt, new Date())

  return (
    <>
      <MarkConversationRead
        workspaceId={workspaceId}
        conversationId={conversation.id}
        unreadCount={conversation.unreadCount}
      />
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
        <Button
          variant="ghost"
          size="icon-sm"
          className="-ml-2 md:hidden"
          aria-label="Voltar para as conversas"
          render={<Link href={`/workspace/${workspaceId}/inbox`} />}
        >
          <ArrowLeftIcon />
        </Button>
        <Avatar className="size-8">
          <InitialFallback name={name} />
        </Avatar>
        <div className="grid min-w-0 leading-tight">
          <span className="truncate text-sm font-medium">{name}</span>
          <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <PlatformIcon platform={conversation.platform} className="size-3" />
            {platformLabels[conversation.platform]} · {conversation.channelName}
          </span>
        </div>
      </header>

      {/* column-reverse mantém a rolagem ancorada na mensagem mais recente. */}
      <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto p-4">
        <ol className="flex flex-col gap-2">
          {conversation.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </ol>
      </div>

      {canReply ? (
        <ConversationReply
          workspaceId={workspaceId}
          conversationId={conversation.id}
          maxLength={MAX_TEXT_LENGTH[conversation.platform]}
        />
      ) : (
        <div className="flex shrink-0 items-center gap-2 border-t p-4 text-sm text-muted-foreground">
          <ClockIcon className="size-4 shrink-0" />
          Janela de 24h encerrada. Só é possível responder depois que o cliente enviar uma nova mensagem.
        </div>
      )}
    </>
  )
}

function MessageBubble({ message }: { message: ConversationView["messages"][number] }) {
  const outbound = message.direction === "outbound"
  const failed = message.status === "failed"
  return (
    <li className={cn("flex max-w-[80%] flex-col gap-1", outbound ? "items-end self-end" : "items-start self-start")}>
      <div
        className={cn(
          "rounded-lg px-3 py-2 text-sm",
          outbound ? "bg-primary text-primary-foreground" : "bg-muted",
          failed && "bg-destructive/10 text-foreground ring-1 ring-destructive/40",
        )}
      >
        {message.type !== "text" && (
          <span className="flex items-center gap-1 text-xs opacity-80">
            <PaperclipIcon className="size-3" />
            {messageTypeLabels[message.type]}
          </span>
        )}
        {message.text && <p className="break-words whitespace-pre-wrap">{message.text}</p>}
      </div>
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {whenFormat.format(message.sentAt)}
        {outbound && <StatusIcon status={message.status} />}
      </span>
      {failed && (
        <span className="text-xs text-destructive">Não enviada{message.error ? `: ${message.error}` : ""}</span>
      )}
    </li>
  )
}

function StatusIcon({ status }: { status: DeliveryStatus | null }) {
  switch (status) {
    case "pending":
      return <ClockIcon className="size-3" aria-label="Enviando" />
    case "sent":
      return <CheckIcon className="size-3" aria-label="Enviada" />
    case "delivered":
      return <CheckCheckIcon className="size-3" aria-label="Entregue" />
    case "read":
      return <CheckCheckIcon className="size-3 text-sky-500" aria-label="Lida" />
    case "failed":
      return <CircleAlertIcon className="size-3 text-destructive" aria-label="Não enviada" />
    default:
      return null
  }
}
