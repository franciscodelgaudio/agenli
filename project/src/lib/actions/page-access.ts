"use server"

import { refresh } from "next/cache"
import { RESTRICTED_ROLES, updatePageAccess, type UpdatePageAccessError } from "@/lib/page-access"
import { getSessionUserId } from "@/lib/session"
import { findWorkspaceAccess } from "@/lib/workspace-access"
import { Workspace } from "@/models/Workspace"

const errorMessages: Record<UpdatePageAccessError | "unauthenticated", string> = {
  workspace_not_found: "Workspace não encontrado ou sem permissão.",
  forbidden: "Só o proprietário e administradores podem definir permissões.",
  invalid_input: "Permissões inválidas. Recarregue a página e tente novamente.",
  no_workspace_page: "Deixe ao menos uma página do sistema liberada para cada função.",
  unauthenticated: "Sua sessão expirou. Entre novamente.",
}

export type PageAccessFormState = { error: string | null }

// Cada checkbox marcado chega como "<função>.<escopo>" = página.
export async function updatePageAccessAction(
  workspaceId: string,
  _prev: PageAccessFormState,
  formData: FormData,
): Promise<PageAccessFormState> {
  const userId = await getSessionUserId()
  if (!userId) return { error: errorMessages.unauthenticated }
  const access = await findWorkspaceAccess(workspaceId, userId)

  const input = Object.fromEntries(
    RESTRICTED_ROLES.map((role) => [
      role,
      { workspace: formData.getAll(`${role}.workspace`), unit: formData.getAll(`${role}.unit`) },
    ]),
  )
  const result = await updatePageAccess(input, { actorRole: access?.role ?? null }, async (hiddenPages) => {
    await Workspace.updateOne({ _id: access!.id }, { $set: { hiddenPages } })
  })

  if (!result.ok) return { error: errorMessages[result.error] }

  refresh()
  return { error: null }
}
