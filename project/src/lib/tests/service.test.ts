import { describe, it, expect, vi } from "vitest";
import { createService, deleteService, updateService } from "@/lib/service";

const UNIT_ID = "64b7f0c2a1b2c3d4e5f60720";
const SERVICE_ID = "64b7f0c2a1b2c3d4e5f60730";

// Como chega do FormData: o input de preço é type="number", que sempre envia ponto decimal.
const validInput = { name: "Massagem Candle", price: "350", durationMinutes: "60" };

describe("createService", () => {
  function makeInsert() {
    return vi.fn().mockResolvedValue({ id: SERVICE_ID });
  }

  it("cria o serviço na unidade com o preço em centavos e retorna o id", async () => {
    const insert = makeInsert();

    const result = await createService(validInput, UNIT_ID, insert);

    expect(result).toEqual({ ok: true, serviceId: SERVICE_ID });
    expect(insert).toHaveBeenCalledWith({
      name: "Massagem Candle",
      priceCents: 35000,
      durationMinutes: 60,
      unitId: UNIT_ID,
    });
  });

  it("remove espaços das pontas de nome, preço e duração antes de salvar", async () => {
    const insert = makeInsert();

    await createService(
      { name: "  Massagem Candle  ", price: " 350 ", durationMinutes: " 90 " },
      UNIT_ID,
      insert,
    );

    expect(insert).toHaveBeenCalledWith({
      name: "Massagem Candle",
      priceCents: 35000,
      durationMinutes: 90,
      unitId: UNIT_ID,
    });
  });

  it.each([
    ["350.5", 35050],
    ["350.50", 35050],
    ["0.1", 10],
    ["19.99", 1999],
    ["0", 0],
    ["1000000", 100000000],
  ])("converte o preço %j em %d centavos", async (price, priceCents) => {
    const insert = makeInsert();

    await createService({ ...validInput, price }, UNIT_ID, insert);

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ priceCents }));
  });

  it.each([
    ["1", 1],
    ["1440", 1440],
  ])("aceita duração de %s minuto(s) (limites)", async (durationMinutes, expected) => {
    const insert = makeInsert();

    await createService({ ...validInput, durationMinutes }, UNIT_ID, insert);

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ durationMinutes: expected }));
  });

  it("aceita nome com exatamente 80 caracteres", async () => {
    const result = await createService({ ...validInput, name: "a".repeat(80) }, UNIT_ID, makeInsert());

    expect(result).toEqual({ ok: true, serviceId: SERVICE_ID });
  });

  it.each([
    ["input nulo", null, "invalid_input"],
    ["nome ausente", { price: "350", durationMinutes: "60" }, "invalid_input"],
    ["preço ausente (null do FormData)", { ...validInput, price: null }, "invalid_input"],
    ["duração ausente (null do FormData)", { ...validInput, durationMinutes: null }, "invalid_input"],
    ["nome não é string", { ...validInput, name: 123 }, "invalid_input"],
    ["nome vazio", { ...validInput, name: "" }, "invalid_name"],
    ["nome só com espaços", { ...validInput, name: "   " }, "invalid_name"],
    ["nome com mais de 80 caracteres", { ...validInput, name: "a".repeat(81) }, "name_too_long"],
    ["preço vazio", { ...validInput, price: "" }, "invalid_price"],
    ["preço não numérico", { ...validInput, price: "abc" }, "invalid_price"],
    ["preço negativo", { ...validInput, price: "-10" }, "invalid_price"],
    ["preço com mais de 2 casas decimais", { ...validInput, price: "350.555" }, "invalid_price"],
    ["preço com vírgula", { ...validInput, price: "350,50" }, "invalid_price"],
    ["preço acima de 1.000.000,00", { ...validInput, price: "1000000.01" }, "invalid_price"],
    ["duração vazia", { ...validInput, durationMinutes: "" }, "invalid_duration"],
    ["duração zero", { ...validInput, durationMinutes: "0" }, "invalid_duration"],
    ["duração negativa", { ...validInput, durationMinutes: "-5" }, "invalid_duration"],
    ["duração fracionada", { ...validInput, durationMinutes: "1.5" }, "invalid_duration"],
    ["duração não numérica", { ...validInput, durationMinutes: "abc" }, "invalid_duration"],
    ["duração acima de 24h (1440 min)", { ...validInput, durationMinutes: "1441" }, "invalid_duration"],
  ])("retorna erro sem salvar quando %s", async (_label, input, error) => {
    const insert = makeInsert();

    const result = await createService(input, UNIT_ID, insert);

    expect(result).toEqual({ ok: false, error });
    expect(insert).not.toHaveBeenCalled();
  });

  it.each([undefined, null, ""])(
    "retorna unit_not_found sem salvar quando não há unitId (%j)",
    async (unitId) => {
      const insert = makeInsert();

      const result = await createService(validInput, unitId, insert);

      expect(result).toEqual({ ok: false, error: "unit_not_found" });
      expect(insert).not.toHaveBeenCalled();
    },
  );
});

describe("updateService", () => {
  function makeUpdate(found = true) {
    return vi.fn().mockResolvedValue(found);
  }

  it("atualiza o serviço com os dados normalizados", async () => {
    const update = makeUpdate();

    const result = await updateService(
      { name: "  Massagem Candle  ", price: "380.90", durationMinutes: "75" },
      SERVICE_ID,
      update,
    );

    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith(SERVICE_ID, {
      name: "Massagem Candle",
      priceCents: 38090,
      durationMinutes: 75,
    });
  });

  it.each([
    ["input nulo", null, "invalid_input"],
    ["nome só com espaços", { ...validInput, name: "   " }, "invalid_name"],
    ["nome com mais de 80 caracteres", { ...validInput, name: "a".repeat(81) }, "name_too_long"],
    ["preço negativo", { ...validInput, price: "-10" }, "invalid_price"],
    ["duração zero", { ...validInput, durationMinutes: "0" }, "invalid_duration"],
  ])("retorna erro sem salvar quando %s", async (_label, input, error) => {
    const update = makeUpdate();

    const result = await updateService(input, SERVICE_ID, update);

    expect(result).toEqual({ ok: false, error });
    expect(update).not.toHaveBeenCalled();
  });

  it.each([undefined, null, ""])(
    "retorna service_not_found sem salvar quando não há serviceId (%j)",
    async (serviceId) => {
      const update = makeUpdate();

      const result = await updateService(validInput, serviceId, update);

      expect(result).toEqual({ ok: false, error: "service_not_found" });
      expect(update).not.toHaveBeenCalled();
    },
  );

  it("retorna service_not_found quando o serviço não existe (ou não é da unidade)", async () => {
    const result = await updateService(validInput, SERVICE_ID, makeUpdate(false));

    expect(result).toEqual({ ok: false, error: "service_not_found" });
  });
});

describe("deleteService", () => {
  it("exclui o serviço pelo id", async () => {
    const remove = vi.fn().mockResolvedValue(true);

    const result = await deleteService(SERVICE_ID, remove);

    expect(result).toEqual({ ok: true });
    expect(remove).toHaveBeenCalledWith(SERVICE_ID);
  });

  it.each([undefined, null, ""])(
    "retorna service_not_found sem excluir quando não há serviceId (%j)",
    async (serviceId) => {
      const remove = vi.fn().mockResolvedValue(true);

      const result = await deleteService(serviceId, remove);

      expect(result).toEqual({ ok: false, error: "service_not_found" });
      expect(remove).not.toHaveBeenCalled();
    },
  );

  it("retorna service_not_found quando o serviço não existe (ou não é da unidade)", async () => {
    const result = await deleteService(SERVICE_ID, vi.fn().mockResolvedValue(false));

    expect(result).toEqual({ ok: false, error: "service_not_found" });
  });
});
