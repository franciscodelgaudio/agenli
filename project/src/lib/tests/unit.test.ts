import { describe, it, expect, vi } from "vitest";
import { createUnit, deleteUnit, updateUnit } from "@/lib/unit";

const WORKSPACE_ID = "64b7f0c2a1b2c3d4e5f60718";
const UNIT_ID = "64b7f0c2a1b2c3d4e5f60720";

// Unidade dentro de um estabelecimento parceiro: regra de repasse como chega do
// formulário e como é salva.
const SHARE_INPUT = { period: "monthly", limits: [], percents: ["15"] };
const SHARE = { period: "monthly", tiers: [{ upToCents: null, percent: 15 }] };
const PARTNER = { ownership: "partner", revenueShare: SHARE_INPUT };
const OWN = { ownership: "own" };

describe("createUnit", () => {
  function makeInsert() {
    return vi.fn().mockResolvedValue({ id: UNIT_ID });
  }

  it("cria a unidade no workspace e retorna o id", async () => {
    const insert = makeInsert();

    const result = await createUnit({ name: "Spa Central", ...OWN }, WORKSPACE_ID, insert);

    expect(result).toEqual({ ok: true, unitId: UNIT_ID });
    expect(insert).toHaveBeenCalledWith({ name: "Spa Central", workspaceId: WORKSPACE_ID });
  });

  it("remove espaços das pontas do nome e da avatarUrl antes de salvar", async () => {
    const insert = makeInsert();

    await createUnit(
      { name: "  Spa Central  ", avatarUrl: "  https://example.com/a.png  ", ...OWN },
      WORKSPACE_ID,
      insert,
    );

    expect(insert).toHaveBeenCalledWith({
      name: "Spa Central",
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

    const result = await createUnit({ name: "Spa Central", avatarUrl, ...OWN }, WORKSPACE_ID, insert);

    expect(result).toEqual({ ok: true, unitId: UNIT_ID });
    expect(insert).toHaveBeenCalledWith({ name: "Spa Central", workspaceId: WORKSPACE_ID });
  });

  it("unidade dentro de estabelecimento parceiro salva a regra de repasse", async () => {
    const insert = makeInsert();

    const result = await createUnit({ name: "Spa Resort", ...PARTNER }, WORKSPACE_ID, insert);

    expect(result).toEqual({ ok: true, unitId: UNIT_ID });
    expect(insert).toHaveBeenCalledWith({ name: "Spa Resort", revenueShare: SHARE, workspaceId: WORKSPACE_ID });
  });

  it("unidade em espaço próprio ignora regra de repasse enviada", async () => {
    const insert = makeInsert();

    await createUnit({ name: "Spa Centro", ownership: "own", revenueShare: SHARE_INPUT }, WORKSPACE_ID, insert);

    expect(insert).toHaveBeenCalledWith({ name: "Spa Centro", workspaceId: WORKSPACE_ID });
  });

  it("aceita nome com exatamente 80 caracteres", async () => {
    const insert = makeInsert();

    const result = await createUnit({ name: "a".repeat(80), ...OWN }, WORKSPACE_ID, insert);

    expect(result).toEqual({ ok: true, unitId: UNIT_ID });
  });

  it.each([
    ["nome ausente", {}, "invalid_input"],
    ["nome não é string", { name: 123 }, "invalid_input"],
    ["input nulo", null, "invalid_input"],
    ["avatarUrl não é string", { name: "Spa Central", avatarUrl: 123 }, "invalid_input"],
    ["nome vazio", { name: "" }, "invalid_name"],
    ["nome só com espaços", { name: "   " }, "invalid_name"],
    ["nome com mais de 80 caracteres", { name: "a".repeat(81) }, "name_too_long"],
    ["avatarUrl que não é URL", { name: "Spa Central", avatarUrl: "logo.png" }, "invalid_avatar_url"],
    ["avatarUrl sem http(s)", { name: "Spa Central", avatarUrl: "javascript:alert(1)" }, "invalid_avatar_url"],
    ["tipo de unidade ausente", { name: "Spa Central" }, "invalid_ownership"],
    ["tipo de unidade desconhecido", { name: "Spa Central", ownership: "franchise" }, "invalid_ownership"],
    ["parceiro sem regra de repasse", { name: "Spa Central", ownership: "partner" }, "invalid_input"],
    ["parceiro com período inválido", { name: "Spa Central", ...PARTNER, revenueShare: { ...SHARE_INPUT, period: "yearly" } }, "invalid_period"],
    ["parceiro com percentual inválido", { name: "Spa Central", ...PARTNER, revenueShare: { ...SHARE_INPUT, percents: ["101"] } }, "invalid_tier_percent"],
  ])("retorna erro sem salvar quando %s", async (_label, input, error) => {
    const insert = makeInsert();

    const result = await createUnit(input, WORKSPACE_ID, insert);

    expect(result).toEqual({ ok: false, error });
    expect(insert).not.toHaveBeenCalled();
  });

  it.each([undefined, null, ""])(
    "retorna workspace_not_found sem salvar quando não há workspaceId (%j)",
    async (workspaceId) => {
      const insert = makeInsert();

      const result = await createUnit({ name: "Spa Central", ...OWN }, workspaceId, insert);

      expect(result).toEqual({ ok: false, error: "workspace_not_found" });
      expect(insert).not.toHaveBeenCalled();
    },
  );
});

describe("updateUnit", () => {
  function makeUpdate(found = true) {
    return vi.fn().mockResolvedValue(found);
  }

  it("atualiza a unidade com nome e avatarUrl sem espaços nas pontas", async () => {
    const update = makeUpdate();

    const result = await updateUnit(
      { name: "  Spa Central  ", avatarUrl: "  https://example.com/a.png  ", ...OWN },
      UNIT_ID,
      update,
    );

    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith(UNIT_ID, {
      name: "Spa Central",
      avatarUrl: "https://example.com/a.png",
      revenueShare: null,
    });
  });

  it("salva a regra de repasse quando a unidade é de estabelecimento parceiro", async () => {
    const update = makeUpdate();

    const result = await updateUnit({ name: "Spa Resort", ...PARTNER }, UNIT_ID, update);

    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith(UNIT_ID, { name: "Spa Resort", avatarUrl: null, revenueShare: SHARE });
  });

  it("remove a regra de repasse (revenueShare null) quando a unidade passa a ser própria", async () => {
    const update = makeUpdate();

    await updateUnit({ name: "Spa Centro", ownership: "own", revenueShare: SHARE_INPUT }, UNIT_ID, update);

    expect(update).toHaveBeenCalledWith(UNIT_ID, { name: "Spa Centro", avatarUrl: null, revenueShare: null });
  });

  it.each([
    ["avatarUrl vazia", ""],
    ["avatarUrl só com espaços", "   "],
    ["avatarUrl ausente (null do FormData)", null],
  ])("remove o avatar (avatarUrl null) quando %s", async (_label, avatarUrl) => {
    const update = makeUpdate();

    const result = await updateUnit({ name: "Spa Central", avatarUrl, ...OWN }, UNIT_ID, update);

    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith(UNIT_ID, { name: "Spa Central", avatarUrl: null, revenueShare: null });
  });

  it.each([
    ["nome ausente", {}, "invalid_input"],
    ["input nulo", null, "invalid_input"],
    ["avatarUrl não é string", { name: "Spa Central", avatarUrl: 123 }, "invalid_input"],
    ["nome só com espaços", { name: "   " }, "invalid_name"],
    ["nome com mais de 80 caracteres", { name: "a".repeat(81) }, "name_too_long"],
    ["avatarUrl sem http(s)", { name: "Spa Central", avatarUrl: "javascript:alert(1)" }, "invalid_avatar_url"],
    ["tipo de unidade ausente", { name: "Spa Central" }, "invalid_ownership"],
    ["parceiro com limite inválido", { name: "Spa Central", ...PARTNER, revenueShare: { ...SHARE_INPUT, limits: ["0"], percents: ["30", "35"] } }, "invalid_tier_limit"],
  ])("retorna erro sem salvar quando %s", async (_label, input, error) => {
    const update = makeUpdate();

    const result = await updateUnit(input, UNIT_ID, update);

    expect(result).toEqual({ ok: false, error });
    expect(update).not.toHaveBeenCalled();
  });

  it.each([undefined, null, ""])(
    "retorna unit_not_found sem salvar quando não há unitId (%j)",
    async (unitId) => {
      const update = makeUpdate();

      const result = await updateUnit({ name: "Spa Central", ...OWN }, unitId, update);

      expect(result).toEqual({ ok: false, error: "unit_not_found" });
      expect(update).not.toHaveBeenCalled();
    },
  );

  it("retorna unit_not_found quando a unidade não existe (ou não é do workspace)", async () => {
    const result = await updateUnit({ name: "Spa Central", ...OWN }, UNIT_ID, makeUpdate(false));

    expect(result).toEqual({ ok: false, error: "unit_not_found" });
  });
});

describe("deleteUnit", () => {
  it("exclui a unidade pelo id", async () => {
    const remove = vi.fn().mockResolvedValue(true);

    const result = await deleteUnit(UNIT_ID, remove);

    expect(result).toEqual({ ok: true });
    expect(remove).toHaveBeenCalledWith(UNIT_ID);
  });

  it.each([undefined, null, ""])(
    "retorna unit_not_found sem excluir quando não há unitId (%j)",
    async (unitId) => {
      const remove = vi.fn().mockResolvedValue(true);

      const result = await deleteUnit(unitId, remove);

      expect(result).toEqual({ ok: false, error: "unit_not_found" });
      expect(remove).not.toHaveBeenCalled();
    },
  );

  it("retorna unit_not_found quando a unidade não existe (ou não é do workspace)", async () => {
    const result = await deleteUnit(UNIT_ID, vi.fn().mockResolvedValue(false));

    expect(result).toEqual({ ok: false, error: "unit_not_found" });
  });
});
