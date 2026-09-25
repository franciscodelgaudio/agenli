import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { PRODUCT_SEARCH_LIMIT, productSearchPipeline } from "@/lib/product-search";

const UNIT_ID = "64b7f0c2a1b2c3d4e5f60720";

// Busca do seletor de produtos: poucos resultados por vez, para não trazer o estoque inteiro.
// A ordem por nome e o filtro por unidade usam o índice { unitId: 1, name: 1 }.
describe("productSearchPipeline", () => {
  const SORT = { $sort: { name: 1, _id: 1 } };
  const LIMIT = { $limit: PRODUCT_SEARCH_LIMIT };
  const PROJECT = { $project: { _id: 0, id: { $toString: "$_id" }, name: 1 } };

  it("limita a 20 resultados", () => {
    expect(PRODUCT_SEARCH_LIMIT).toBe(20);
  });

  it("sem busca, traz os primeiros da unidade em ordem alfabética", () => {
    expect(productSearchPipeline(UNIT_ID, "")).toEqual([
      { $match: { unitId: new Types.ObjectId(UNIT_ID) } },
      SORT,
      LIMIT,
      PROJECT,
    ]);
  });

  it("com busca, filtra pelo trecho do nome sem diferenciar maiúsculas", () => {
    expect(productSearchPipeline(UNIT_ID, "óleo")).toEqual([
      { $match: { unitId: new Types.ObjectId(UNIT_ID), name: { $regex: "óleo", $options: "i" } } },
      SORT,
      LIMIT,
      PROJECT,
    ]);
  });

  it("ignora espaços nas pontas e busca só com espaços vira sem busca", () => {
    expect(productSearchPipeline(UNIT_ID, "  óleo  ")[0]).toEqual({
      $match: { unitId: new Types.ObjectId(UNIT_ID), name: { $regex: "óleo", $options: "i" } },
    });
    expect(productSearchPipeline(UNIT_ID, "   ")[0]).toEqual({ $match: { unitId: new Types.ObjectId(UNIT_ID) } });
  });

  it("escapa caracteres especiais de regex", () => {
    expect(productSearchPipeline(UNIT_ID, "creme (100ml)+")[0]).toEqual({
      $match: { unitId: new Types.ObjectId(UNIT_ID), name: { $regex: "creme \\(100ml\\)\\+", $options: "i" } },
    });
  });

  it("corta buscas longas em 80 caracteres, o tamanho máximo do nome", () => {
    const match = productSearchPipeline(UNIT_ID, "a".repeat(200))[0] as { $match: { name: { $regex: string } } };
    expect(match.$match.name.$regex).toBe("a".repeat(80));
  });
});
