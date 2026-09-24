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
