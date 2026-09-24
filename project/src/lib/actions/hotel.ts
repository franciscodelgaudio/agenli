"use server"

import { refresh } from "next/cache"
import { getSessionUserId, matchOwnedWorkspace } from "@/lib/session"
import { createHotel, type CreateHotelError } from "@/lib/hotel"
import { Hotel } from "@/models/Hotel"
import { Workspace } from "@/models/Workspace"

const errorMessages: Record<CreateHotelError | "unauthenticated", string> = {
  invalid_input: "Informe o nome da unidade.",
  invalid_name: "Informe o nome da unidade.",
  name_too_long: "O nome pode ter no máximo 80 caracteres.",
  invalid_avatar_url: "Informe uma URL válida começando com http:// ou https://.",
  workspace_not_found: "Workspace não encontrado ou sem permissão.",
  unauthenticated: "Sua sessão expirou. Entre novamente.",
}

export type CreateHotelState = { error: string | null }

// workspaceId vem via argumento do cliente; a posse é conferida aqui, no servidor.
export async function createHotelAction(
  workspaceId: string,
  _prev: CreateHotelState,
  formData: FormData,
): Promise<CreateHotelState> {
  const userId = await getSessionUserId()
  if (!userId) return { error: errorMessages.unauthenticated }

  const match = matchOwnedWorkspace(workspaceId, userId)
  const [owned] = match
    ? await Workspace.aggregate<{ id: string }>([
        match,
        { $limit: 1 },
        { $project: { _id: 0, id: { $toString: "$_id" } } },
      ])
    : []

  const result = await createHotel(
    { name: formData.get("name"), avatarUrl: formData.get("avatarUrl") },
    owned?.id,
    async (data) => {
      const hotel = await Hotel.create(data)
      return { id: hotel._id.toString() }
    },
  )

  if (!result.ok) return { error: errorMessages[result.error] }

  refresh()
  return { error: null }
}
