import { cache } from "react";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import { findUserWorkspace, getHomePath } from "@/lib/workspace";
import { Workspace } from "@/models/Workspace";

// cache() deduplica por request: o layout e o slot @sidebar chamam as mesmas
// funções e só uma consulta é feita.
export const getCurrentUser = cache(async () => {
  const session = await auth();
  return session?.user ?? null;
});

export const getCurrentWorkspace = cache(async (workspaceId: string) => {
  const user = await getCurrentUser();
  return findUserWorkspace({ workspaceId, userId: user?.id }, async (id, userId) => {
    await connectDB();
    return Workspace.findOne({ _id: id, userId }).select("name avatarUrl").lean();
  });
});

export async function getHomePathForCurrentUser() {
  const user = await getCurrentUser();
  return getHomePath(user?.id, async (userId) => {
    await connectDB();
    // O workspace mais antigo é o padrão.
    const workspace = await Workspace.findOne({ userId }).sort({ createdAt: 1 }).select("_id").lean();
    return workspace?._id.toString() ?? null;
  });
}
