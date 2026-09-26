import { messagingEnv } from "@/lib/messaging-config"
import { ingestWebhookEvents } from "@/lib/messaging-inbox"
import {
  findChannelByExternalId,
  insertMessage,
  touchConversation,
  updateOutboundStatus,
  upsertConversation,
} from "@/lib/messaging-store"
import { isValidWebhookSignature, parseMetaWebhook, verifyWebhookSubscription } from "@/lib/meta-webhook"

// Webhook único da Meta para WhatsApp Cloud API e Instagram. Fica fora do login
// (proxy.ts); a autenticidade vem do token de verificação (GET) e da assinatura (POST).

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams)
  const challenge = verifyWebhookSubscription(params, messagingEnv.verifyToken())
  return challenge ? new Response(challenge, { status: 200 }) : new Response("Forbidden", { status: 403 })
}

export async function POST(request: Request) {
  // A assinatura é sobre o corpo cru, então ele é lido como texto antes do JSON.
  const rawBody = await request.text()
  const signature = request.headers.get("x-hub-signature-256")
  if (!isValidWebhookSignature(rawBody, signature, messagingEnv.appSecrets())) {
    return new Response("Invalid signature", { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new Response("Invalid JSON", { status: 400 })
  }

  // Workspace de cada canal encontrado, para limitar a atualização de status a ele.
  const channelWorkspaces = new Map<string, string>()
  await ingestWebhookEvents(parseMetaWebhook(payload), {
    findChannel: async (platform, externalId) => {
      const channel = await findChannelByExternalId(platform, externalId)
      if (channel) channelWorkspaces.set(channel.id, channel.workspaceId)
      return channel
    },
    upsertConversation,
    insertMessage: async (data) => (await insertMessage(data)) !== null,
    touchConversation,
    updateMessageStatus: ({ channelId, ...data }) => updateOutboundStatus(channelWorkspaces.get(channelId)!, data),
  })

  // Erro ao gravar sobe como 500 e a Meta reenvia; mensagens repetidas são ignoradas.
  return new Response("EVENT_RECEIVED", { status: 200 })
}
