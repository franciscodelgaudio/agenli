import { describe, it, expect, vi } from "vitest";
import { createWorkspace } from "@/lib/workspace";

const WORKSPACE_ID = "64b7f0c2a1b2c3d4e5f60718";
const USER_ID = "64b7f0c2a1b2c3d4e5f60719";

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
