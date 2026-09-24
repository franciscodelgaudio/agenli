import { cache } from "react";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import { findUserWorkspace } from "@/lib/workspace";
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
