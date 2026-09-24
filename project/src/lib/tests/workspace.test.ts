import { describe, it, expect, vi } from "vitest";
import { createWorkspace, findUserWorkspace, getHomePath } from "@/lib/workspace";

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

describe("getHomePath", () => {
  it("leva para o workspace do usuário quando ele tem um", async () => {
    const findFirst = vi.fn().mockResolvedValue(WORKSPACE_ID);

    const result = await getHomePath(USER_ID, findFirst);

    expect(findFirst).toHaveBeenCalledWith(USER_ID);
    expect(result).toBe(`/workspace/${WORKSPACE_ID}`);
  });

  it("leva para a criação de workspace quando o usuário não tem nenhum", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);

    const result = await getHomePath(USER_ID, findFirst);

    expect(result).toBe("/workspace/new");
  });

  it.each([undefined, null, ""])(
    "leva para o login sem consultar quando não há userId (%j)",
    async (userId) => {
      const findFirst = vi.fn();

      const result = await getHomePath(userId, findFirst);

      expect(result).toBe("/login");
      expect(findFirst).not.toHaveBeenCalled();
    },
  );
});

describe("createWorkspace", () => {
  function makeInsert() {
    return vi.fn().mockResolvedValue({ id: WORKSPACE_ID });
  }

  it("cria o workspace do usuário e retorna o id", async () => {
    const insert = makeInsert();

    const result = await createWorkspace({ name: "Hotel Central" }, USER_ID, insert);

    expect(result).toEqual({ ok: true, workspaceId: WORKSPACE_ID });
    expect(insert).toHaveBeenCalledWith({ name: "Hotel Central", userId: USER_ID });
  });

  it("remove espaços das pontas do nome antes de salvar", async () => {
    const insert = makeInsert();

    await createWorkspace({ name: "  Hotel Central  " }, USER_ID, insert);

    expect(insert).toHaveBeenCalledWith({ name: "Hotel Central", userId: USER_ID });
  });

  it("aceita nome com exatamente 80 caracteres", async () => {
    const insert = makeInsert();
    const name = "a".repeat(80);

    const result = await createWorkspace({ name }, USER_ID, insert);

    expect(result).toEqual({ ok: true, workspaceId: WORKSPACE_ID });
  });

  it.each([
    ["nome ausente", {}, "invalid_input"],
    ["nome não é string", { name: 123 }, "invalid_input"],
    ["input nulo", null, "invalid_input"],
    ["nome vazio", { name: "" }, "invalid_name"],
    ["nome só com espaços", { name: "   " }, "invalid_name"],
    ["nome com mais de 80 caracteres", { name: "a".repeat(81) }, "name_too_long"],
  ])("retorna erro sem salvar quando %s", async (_label, input, error) => {
    const insert = makeInsert();

    const result = await createWorkspace(input, USER_ID, insert);

    expect(result).toEqual({ ok: false, error });
    expect(insert).not.toHaveBeenCalled();
  });

  it.each([undefined, null, ""])(
    "retorna unauthenticated sem salvar quando não há userId (%j)",
    async (userId) => {
      const insert = makeInsert();

      const result = await createWorkspace({ name: "Hotel Central" }, userId, insert);

      expect(result).toEqual({ ok: false, error: "unauthenticated" });
      expect(insert).not.toHaveBeenCalled();
    },
  );
});
