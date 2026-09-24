"use server"

import { redirect } from "next/navigation"
import { getSessionUserId } from "@/lib/session"
import { createWorkspace, type CreateWorkspaceError } from "@/lib/workspace"
import { Workspace } from "@/models/Workspace"

const errorMessages: Record<CreateWorkspaceError, string> = {
  invalid_input: "Informe o nome do workspace.",
  invalid_name: "Informe o nome do workspace.",
  name_too_long: "O nome pode ter no máximo 80 caracteres.",
  unauthenticated: "Sua sessão expirou. Entre novamente.",
}

export type CreateWorkspaceState = { error: string | null }

export async function createWorkspaceAction(
  _prev: CreateWorkspaceState,
  formData: FormData,
): Promise<CreateWorkspaceState> {
  const userId = await getSessionUserId()
  if (!userId) return { error: errorMessages.unauthenticated }

  const result = await createWorkspace({ name: formData.get("name") }, userId, async (data) => {
    const workspace = await Workspace.create(data)
    return { id: workspace._id.toString() }
  })

  if (!result.ok) return { error: errorMessages[result.error] }

  redirect(`/workspace/${result.workspaceId}`)
}
