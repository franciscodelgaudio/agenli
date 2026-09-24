import { describe, it, expect, vi } from "vitest";
import { createHotel, listWorkspaceHotels } from "@/lib/hotel";

const WORKSPACE_ID = "64b7f0c2a1b2c3d4e5f60718";
const HOTEL_ID = "64b7f0c2a1b2c3d4e5f60720";

describe("listWorkspaceHotels", () => {
  it("retorna os hotéis do workspace com id em string e avatarUrl null quando ausente", async () => {
    const find = vi.fn().mockResolvedValue([
      { _id: { toString: () => HOTEL_ID }, name: "Hotel Central", avatarUrl: "https://example.com/a.png" },
      { _id: "64b7f0c2a1b2c3d4e5f60721", name: "Pousada Mar" },
    ]);

    const result = await listWorkspaceHotels(WORKSPACE_ID, find);

    expect(find).toHaveBeenCalledWith(WORKSPACE_ID);
    expect(result).toEqual([
      { id: HOTEL_ID, name: "Hotel Central", avatarUrl: "https://example.com/a.png" },
      { id: "64b7f0c2a1b2c3d4e5f60721", name: "Pousada Mar", avatarUrl: null },
    ]);
  });

  it("retorna lista vazia quando o workspace não tem hotéis", async () => {
    const find = vi.fn().mockResolvedValue([]);

    const result = await listWorkspaceHotels(WORKSPACE_ID, find);

    expect(result).toEqual([]);
  });
});

describe("createHotel", () => {
  function makeInsert() {
    return vi.fn().mockResolvedValue({ id: HOTEL_ID });
  }

  it("cria o hotel no workspace e retorna o id", async () => {
    const insert = makeInsert();

    const result = await createHotel({ name: "Hotel Central" }, WORKSPACE_ID, insert);

    expect(result).toEqual({ ok: true, hotelId: HOTEL_ID });
    expect(insert).toHaveBeenCalledWith({ name: "Hotel Central", workspaceId: WORKSPACE_ID });
  });

  it("remove espaços das pontas do nome e da avatarUrl antes de salvar", async () => {
    const insert = makeInsert();

    await createHotel(
      { name: "  Hotel Central  ", avatarUrl: "  https://example.com/a.png  " },
      WORKSPACE_ID,
      insert,
    );

    expect(insert).toHaveBeenCalledWith({
      name: "Hotel Central",
      avatarUrl: "https://example.com/a.png",
      workspaceId: WORKSPACE_ID,
    });
  });

  it.each([
    ["avatarUrl vazia", ""],
    ["avatarUrl só com espaços", "   "],
    ["avatarUrl ausente (null do FormData)", null],
  ])("ignora a avatarUrl quando %s", async (_label, avatarUrl) => {
    const insert = makeInsert();

    const result = await createHotel({ name: "Hotel Central", avatarUrl }, WORKSPACE_ID, insert);

    expect(result).toEqual({ ok: true, hotelId: HOTEL_ID });
    expect(insert).toHaveBeenCalledWith({ name: "Hotel Central", workspaceId: WORKSPACE_ID });
  });

  it("aceita nome com exatamente 80 caracteres", async () => {
    const insert = makeInsert();

    const result = await createHotel({ name: "a".repeat(80) }, WORKSPACE_ID, insert);

    expect(result).toEqual({ ok: true, hotelId: HOTEL_ID });
  });

  it.each([
    ["nome ausente", {}, "invalid_input"],
    ["nome não é string", { name: 123 }, "invalid_input"],
    ["input nulo", null, "invalid_input"],
    ["avatarUrl não é string", { name: "Hotel Central", avatarUrl: 123 }, "invalid_input"],
    ["nome vazio", { name: "" }, "invalid_name"],
    ["nome só com espaços", { name: "   " }, "invalid_name"],
    ["nome com mais de 80 caracteres", { name: "a".repeat(81) }, "name_too_long"],
    ["avatarUrl que não é URL", { name: "Hotel Central", avatarUrl: "logo.png" }, "invalid_avatar_url"],
    ["avatarUrl sem http(s)", { name: "Hotel Central", avatarUrl: "javascript:alert(1)" }, "invalid_avatar_url"],
  ])("retorna erro sem salvar quando %s", async (_label, input, error) => {
    const insert = makeInsert();

    const result = await createHotel(input, WORKSPACE_ID, insert);

    expect(result).toEqual({ ok: false, error });
    expect(insert).not.toHaveBeenCalled();
  });

  it.each([undefined, null, ""])(
    "retorna workspace_not_found sem salvar quando não há workspaceId (%j)",
    async (workspaceId) => {
      const insert = makeInsert();

      const result = await createHotel({ name: "Hotel Central" }, workspaceId, insert);

      expect(result).toEqual({ ok: false, error: "workspace_not_found" });
      expect(insert).not.toHaveBeenCalled();
    },
  );
});
