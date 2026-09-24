const MAX_NAME_LENGTH = 80;

export type CreateWorkspaceError =
  | "invalid_input"
  | "invalid_name"
  | "name_too_long"
  | "unauthenticated";

export type CreateWorkspaceResult =
  | { ok: true; workspaceId: string }
  | { ok: false; error: CreateWorkspaceError };

export async function createWorkspace(
  input: unknown,
  userId: string | null | undefined,
  insert: (data: { name: string; userId: string }) => Promise<{ id: string }>,
): Promise<CreateWorkspaceResult> {
  if (!userId) return { ok: false, error: "unauthenticated" };

  const { name } = (input ?? {}) as Record<string, unknown>;
  if (typeof name !== "string") return { ok: false, error: "invalid_input" };

  const normalizedName = name.trim();
  if (!normalizedName) return { ok: false, error: "invalid_name" };
  if (normalizedName.length > MAX_NAME_LENGTH) return { ok: false, error: "name_too_long" };

  const workspace = await insert({ name: normalizedName, userId });
  return { ok: true, workspaceId: workspace.id };
}
