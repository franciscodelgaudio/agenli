import { describe, it, expect, vi } from "vitest";
import { createProduct, deleteProduct, depleteProduct, updateProduct } from "@/lib/product";

const UNIT_ID = "64b7f0c2a1b2c3d4e5f60720";
const PRODUCT_ID = "64b7f0c2a1b2c3d4e5f60740";

// Como chega do FormData: campos opcionais vazios chegam como "".
const validInput = {
  name: "Óleo de amêndoas",
  quantity: "12",
  cost: "45.9",
  notes: "",
  rating: "",
  avatarUrl: "",
};

const validData = {
  name: "Óleo de amêndoas",
  quantity: 12,
  costCents: 4590,
  notes: null,
  rating: null,
  avatarUrl: null,
};

describe("createProduct", () => {
  function makeInsert() {
    return vi.fn().mockResolvedValue({ id: PRODUCT_ID });
  }

  it("cria o produto na unidade com o custo em centavos e opcionais vazios como null", async () => {
    const insert = makeInsert();

    const result = await createProduct(validInput, UNIT_ID, insert);

    expect(result).toEqual({ ok: true, productId: PRODUCT_ID });
    expect(insert).toHaveBeenCalledWith({ ...validData, unitId: UNIT_ID });
  });

  it("salva observações, avaliação e avatarUrl quando informados, sem espaços nas pontas", async () => {
    const insert = makeInsert();

    await createProduct(
      {
        name: "  Óleo de amêndoas  ",
        quantity: " 12 ",
        cost: " 45.9 ",
        notes: "  Fornecedor X  ",
        rating: " 4 ",
        avatarUrl: "  https://cdn.example.com/oleo.png  ",
      },
      UNIT_ID,
      insert,
    );

    expect(insert).toHaveBeenCalledWith({
      ...validData,
      notes: "Fornecedor X",
      rating: 4,
      avatarUrl: "https://cdn.example.com/oleo.png",
      unitId: UNIT_ID,
    });
  });

  it("trata opcionais ausentes (null do FormData) e só com espaços como null", async () => {
    const insert = makeInsert();

    await createProduct(
      { name: "Óleo de amêndoas", quantity: "12", cost: "45.9", notes: "   ", rating: null, avatarUrl: null },
      UNIT_ID,
      insert,
    );

    expect(insert).toHaveBeenCalledWith({ ...validData, unitId: UNIT_ID });
  });

  it.each([
    ["45.9", 4590],
    ["45.90", 4590],
    ["0.1", 10],
    ["0", 0],
    ["1000000", 100000000],
  ])("converte o custo %j em %d centavos", async (cost, costCents) => {
    const insert = makeInsert();

    await createProduct({ ...validInput, cost }, UNIT_ID, insert);

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ costCents }));
  });

  it.each([
    ["0", 0],
    ["1000000", 1000000],
  ])("aceita quantidade %s (limites)", async (quantity, expected) => {
    const insert = makeInsert();

    await createProduct({ ...validInput, quantity }, UNIT_ID, insert);

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ quantity: expected }));
  });

  it.each(["1", "2", "3", "4", "5"])("aceita avaliação %s", async (rating) => {
    const insert = makeInsert();

    await createProduct({ ...validInput, rating }, UNIT_ID, insert);

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ rating: Number(rating) }));
  });

  it("aceita nome com 80 e observações com 500 caracteres", async () => {
    const result = await createProduct(
      { ...validInput, name: "a".repeat(80), notes: "a".repeat(500) },
      UNIT_ID,
      makeInsert(),
    );

    expect(result).toEqual({ ok: true, productId: PRODUCT_ID });
  });

  it.each([
    ["input nulo", null, "invalid_input"],
    ["nome ausente", { quantity: "12", cost: "45.9" }, "invalid_input"],
    ["quantidade ausente (null do FormData)", { ...validInput, quantity: null }, "invalid_input"],
    ["custo ausente (null do FormData)", { ...validInput, cost: null }, "invalid_input"],
    ["observações não são string", { ...validInput, notes: 123 }, "invalid_input"],
    ["avaliação não é string", { ...validInput, rating: 4 }, "invalid_input"],
    ["avatarUrl não é string", { ...validInput, avatarUrl: 123 }, "invalid_input"],
    ["nome vazio", { ...validInput, name: "" }, "invalid_name"],
    ["nome só com espaços", { ...validInput, name: "   " }, "invalid_name"],
    ["nome com mais de 80 caracteres", { ...validInput, name: "a".repeat(81) }, "name_too_long"],
    ["quantidade vazia", { ...validInput, quantity: "" }, "invalid_quantity"],
    ["quantidade negativa", { ...validInput, quantity: "-1" }, "invalid_quantity"],
    ["quantidade fracionada", { ...validInput, quantity: "1.5" }, "invalid_quantity"],
    ["quantidade não numérica", { ...validInput, quantity: "abc" }, "invalid_quantity"],
    ["quantidade acima de 1.000.000", { ...validInput, quantity: "1000001" }, "invalid_quantity"],
    ["custo vazio", { ...validInput, cost: "" }, "invalid_cost"],
    ["custo negativo", { ...validInput, cost: "-10" }, "invalid_cost"],
    ["custo com mais de 2 casas decimais", { ...validInput, cost: "45.999" }, "invalid_cost"],
    ["custo com vírgula", { ...validInput, cost: "45,90" }, "invalid_cost"],
    ["custo acima de 1.000.000,00", { ...validInput, cost: "1000000.01" }, "invalid_cost"],
    ["observações com mais de 500 caracteres", { ...validInput, notes: "a".repeat(501) }, "notes_too_long"],
    ["avaliação zero", { ...validInput, rating: "0" }, "invalid_rating"],
    ["avaliação acima de 5", { ...validInput, rating: "6" }, "invalid_rating"],
    ["avaliação fracionada", { ...validInput, rating: "4.5" }, "invalid_rating"],
    ["avaliação não numérica", { ...validInput, rating: "abc" }, "invalid_rating"],
  ])("retorna erro sem salvar quando %s", async (_label, input, error) => {
    const insert = makeInsert();

    const result = await createProduct(input, UNIT_ID, insert);

    expect(result).toEqual({ ok: false, error });
    expect(insert).not.toHaveBeenCalled();
  });

  it.each([undefined, null, ""])(
    "retorna unit_not_found sem salvar quando não há unitId (%j)",
    async (unitId) => {
      const insert = makeInsert();

      const result = await createProduct(validInput, unitId, insert);

      expect(result).toEqual({ ok: false, error: "unit_not_found" });
      expect(insert).not.toHaveBeenCalled();
    },
  );
});

describe("updateProduct", () => {
  function makeUpdate(found = true) {
    return vi.fn().mockResolvedValue(found);
  }

  it("atualiza o produto com os dados normalizados", async () => {
    const update = makeUpdate();

    const result = await updateProduct(
      { ...validInput, name: "  Toalha  ", quantity: "30", cost: "12.5", rating: "5" },
      PRODUCT_ID,
      update,
    );

    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith(PRODUCT_ID, {
      ...validData,
      name: "Toalha",
      quantity: 30,
      costCents: 1250,
      rating: 5,
    });
  });

  // Limpar um opcional no formulário precisa apagar o valor salvo, então ele vai como null.
  it("envia null para limpar observações, avaliação e avatarUrl", async () => {
    const update = makeUpdate();

    await updateProduct(validInput, PRODUCT_ID, update);

    expect(update).toHaveBeenCalledWith(
      PRODUCT_ID,
      expect.objectContaining({ notes: null, rating: null, avatarUrl: null }),
    );
  });

  it.each([
    ["input nulo", null, "invalid_input"],
    ["nome só com espaços", { ...validInput, name: "   " }, "invalid_name"],
    ["quantidade negativa", { ...validInput, quantity: "-1" }, "invalid_quantity"],
    ["custo negativo", { ...validInput, cost: "-10" }, "invalid_cost"],
    ["observações com mais de 500 caracteres", { ...validInput, notes: "a".repeat(501) }, "notes_too_long"],
    ["avaliação acima de 5", { ...validInput, rating: "6" }, "invalid_rating"],
  ])("retorna erro sem salvar quando %s", async (_label, input, error) => {
    const update = makeUpdate();

    const result = await updateProduct(input, PRODUCT_ID, update);

    expect(result).toEqual({ ok: false, error });
    expect(update).not.toHaveBeenCalled();
  });

  it.each([undefined, null, ""])(
    "retorna product_not_found sem salvar quando não há productId (%j)",
    async (productId) => {
      const update = makeUpdate();

      const result = await updateProduct(validInput, productId, update);

      expect(result).toEqual({ ok: false, error: "product_not_found" });
      expect(update).not.toHaveBeenCalled();
    },
  );

  it("retorna product_not_found quando o produto não existe (ou não é da unidade)", async () => {
    const result = await updateProduct(validInput, PRODUCT_ID, makeUpdate(false));

    expect(result).toEqual({ ok: false, error: "product_not_found" });
  });
});

describe("deleteProduct", () => {
  it("exclui o produto pelo id", async () => {
    const remove = vi.fn().mockResolvedValue(true);

    const result = await deleteProduct(PRODUCT_ID, remove);

    expect(result).toEqual({ ok: true });
    expect(remove).toHaveBeenCalledWith(PRODUCT_ID);
  });

  it.each([undefined, null, ""])(
    "retorna product_not_found sem excluir quando não há productId (%j)",
    async (productId) => {
      const remove = vi.fn().mockResolvedValue(true);

      const result = await deleteProduct(productId, remove);

      expect(result).toEqual({ ok: false, error: "product_not_found" });
      expect(remove).not.toHaveBeenCalled();
    },
  );

  it("retorna product_not_found quando o produto não existe (ou não é da unidade)", async () => {
    const result = await deleteProduct(PRODUCT_ID, vi.fn().mockResolvedValue(false));

    expect(result).toEqual({ ok: false, error: "product_not_found" });
  });
});

describe("depleteProduct", () => {
  // deplete registra o "acabou" e tira 1 da quantidade numa só escrita.
  it("registra que o produto acabou", async () => {
    const deplete = vi.fn().mockResolvedValue("depleted");

    const result = await depleteProduct(PRODUCT_ID, deplete);

    expect(result).toEqual({ ok: true });
    expect(deplete).toHaveBeenCalledWith(PRODUCT_ID);
  });

  it("retorna out_of_stock quando a quantidade já é zero", async () => {
    const result = await depleteProduct(PRODUCT_ID, vi.fn().mockResolvedValue("out_of_stock"));

    expect(result).toEqual({ ok: false, error: "out_of_stock" });
  });

  it("retorna product_not_found quando o produto não existe (ou não é da unidade)", async () => {
    const result = await depleteProduct(PRODUCT_ID, vi.fn().mockResolvedValue("not_found"));

    expect(result).toEqual({ ok: false, error: "product_not_found" });
  });

  it.each([undefined, null, ""])(
    "retorna product_not_found sem registrar quando não há productId (%j)",
    async (productId) => {
      const deplete = vi.fn();

      const result = await depleteProduct(productId, deplete);

      expect(result).toEqual({ ok: false, error: "product_not_found" });
      expect(deplete).not.toHaveBeenCalled();
    },
  );
});
