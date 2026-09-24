import { describe, it, expect, vi } from "vitest";
import { createHotel, deleteHotel, updateHotel } from "@/lib/hotel";

const WORKSPACE_ID = "64b7f0c2a1b2c3d4e5f60718";
const HOTEL_ID = "64b7f0c2a1b2c3d4e5f60720";

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

describe("updateHotel", () => {
  function makeUpdate(found = true) {
    return vi.fn().mockResolvedValue(found);
  }

  it("atualiza o hotel com nome e avatarUrl sem espaços nas pontas", async () => {
    const update = makeUpdate();

    const result = await updateHotel(
      { name: "  Hotel Central  ", avatarUrl: "  https://example.com/a.png  " },
      HOTEL_ID,
      update,
    );

    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith(HOTEL_ID, {
      name: "Hotel Central",
      avatarUrl: "https://example.com/a.png",
    });
  });

  it.each([
    ["avatarUrl vazia", ""],
    ["avatarUrl só com espaços", "   "],
    ["avatarUrl ausente (null do FormData)", null],
  ])("remove o avatar (avatarUrl null) quando %s", async (_label, avatarUrl) => {
    const update = makeUpdate();

    const result = await updateHotel({ name: "Hotel Central", avatarUrl }, HOTEL_ID, update);

    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith(HOTEL_ID, { name: "Hotel Central", avatarUrl: null });
  });

  it.each([
    ["nome ausente", {}, "invalid_input"],
    ["input nulo", null, "invalid_input"],
    ["avatarUrl não é string", { name: "Hotel Central", avatarUrl: 123 }, "invalid_input"],
    ["nome só com espaços", { name: "   " }, "invalid_name"],
    ["nome com mais de 80 caracteres", { name: "a".repeat(81) }, "name_too_long"],
    ["avatarUrl sem http(s)", { name: "Hotel Central", avatarUrl: "javascript:alert(1)" }, "invalid_avatar_url"],
  ])("retorna erro sem salvar quando %s", async (_label, input, error) => {
    const update = makeUpdate();

    const result = await updateHotel(input, HOTEL_ID, update);

    expect(result).toEqual({ ok: false, error });
    expect(update).not.toHaveBeenCalled();
  });

  it.each([undefined, null, ""])(
    "retorna hotel_not_found sem salvar quando não há hotelId (%j)",
    async (hotelId) => {
      const update = makeUpdate();

      const result = await updateHotel({ name: "Hotel Central" }, hotelId, update);

      expect(result).toEqual({ ok: false, error: "hotel_not_found" });
      expect(update).not.toHaveBeenCalled();
    },
  );

  it("retorna hotel_not_found quando o hotel não existe (ou não é do workspace)", async () => {
    const result = await updateHotel({ name: "Hotel Central" }, HOTEL_ID, makeUpdate(false));

    expect(result).toEqual({ ok: false, error: "hotel_not_found" });
  });
});

describe("deleteHotel", () => {
  it("exclui o hotel pelo id", async () => {
    const remove = vi.fn().mockResolvedValue(true);

    const result = await deleteHotel(HOTEL_ID, remove);

    expect(result).toEqual({ ok: true });
    expect(remove).toHaveBeenCalledWith(HOTEL_ID);
  });

  it.each([undefined, null, ""])(
    "retorna hotel_not_found sem excluir quando não há hotelId (%j)",
    async (hotelId) => {
      const remove = vi.fn().mockResolvedValue(true);

      const result = await deleteHotel(hotelId, remove);

      expect(result).toEqual({ ok: false, error: "hotel_not_found" });
      expect(remove).not.toHaveBeenCalled();
    },
  );

  it("retorna hotel_not_found quando o hotel não existe (ou não é do workspace)", async () => {
    const result = await deleteHotel(HOTEL_ID, vi.fn().mockResolvedValue(false));

    expect(result).toEqual({ ok: false, error: "hotel_not_found" });
  });
});
