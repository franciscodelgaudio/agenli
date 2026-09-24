type StoredWorkspace = {
  _id: { toString(): string } | string;
  name: string;
  avatarUrl?: string | null;
};

const OBJECT_ID = /^[a-f\d]{24}$/i;

export async function findUserWorkspace(
  { workspaceId, userId }: { workspaceId: string; userId?: string | null },
  findByIdAndUser: (workspaceId: string, userId: string) => Promise<StoredWorkspace | null>,
) {
  if (!userId || !OBJECT_ID.test(workspaceId)) return null;

  const workspace = await findByIdAndUser(workspaceId, userId);
  if (!workspace) return null;

  return {
    id: workspace._id.toString(),
    name: workspace.name,
    avatarUrl: workspace.avatarUrl ?? null,
  };
}

export async function getHomePath(
  userId: string | null | undefined,
  findFirstWorkspaceId: (userId: string) => Promise<string | null>,
) {
  if (!userId) return "/login";

  const workspaceId = await findFirstWorkspaceId(userId);
  return workspaceId ? `/workspace/${workspaceId}` : "/workspace/new";
}

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
