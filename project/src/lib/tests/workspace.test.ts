import { describe, it, expect, vi } from "vitest";
import { findUserWorkspace } from "@/lib/workspace";

const WORKSPACE_ID = "64b7f0c2a1b2c3d4e5f60718";
const USER_ID = "64b7f0c2a1b2c3d4e5f60719";

describe("findUserWorkspace", () => {
  it("retorna o workspace quando ele pertence ao usuário", async () => {
    const find = vi.fn().mockResolvedValue({
      _id: WORKSPACE_ID,
      name: "Hotel Central",
      avatarUrl: "https://example.com/logo.png",
    });

    const result = await findUserWorkspace({ workspaceId: WORKSPACE_ID, userId: USER_ID }, find);

    expect(find).toHaveBeenCalledWith(WORKSPACE_ID, USER_ID);
    expect(result).toEqual({
      id: WORKSPACE_ID,
      name: "Hotel Central",
      avatarUrl: "https://example.com/logo.png",
    });
  });

  it("converte _id para string e usa null quando não há avatarUrl", async () => {
    const find = vi.fn().mockResolvedValue({
      _id: { toString: () => WORKSPACE_ID },
      name: "Hotel Central",
    });

    const result = await findUserWorkspace({ workspaceId: WORKSPACE_ID, userId: USER_ID }, find);

    expect(result).toEqual({ id: WORKSPACE_ID, name: "Hotel Central", avatarUrl: null });
  });

  it("retorna null quando o workspace não existe ou é de outro usuário", async () => {
    const find = vi.fn().mockResolvedValue(null);

    const result = await findUserWorkspace({ workspaceId: WORKSPACE_ID, userId: USER_ID }, find);

    expect(result).toBeNull();
  });

  it.each(["abc", "", "64b7f0c2a1b2c3d4e5f6071z", "64b7f0c2a1b2c3d4e5f607181"])(
    "retorna null sem consultar quando o workspaceId é inválido (%j)",
    async (workspaceId) => {
      const find = vi.fn();

      const result = await findUserWorkspace({ workspaceId, userId: USER_ID }, find);

      expect(result).toBeNull();
      expect(find).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, null, ""])(
    "retorna null sem consultar quando não há userId (%j)",
    async (userId) => {
      const find = vi.fn();

      const result = await findUserWorkspace({ workspaceId: WORKSPACE_ID, userId }, find);

      expect(result).toBeNull();
      expect(find).not.toHaveBeenCalled();
    },
  );
});
