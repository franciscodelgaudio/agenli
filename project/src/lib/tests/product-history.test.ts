import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import {
  PRODUCT_HISTORY_PAGE_SIZE,
  parseProductHistoryQuery,
  productHistoryPipeline,
} from "@/lib/product-history";

const PRODUCT_ID = "64b7f0c2a1b2c3d4e5f60761";
const OID = new Types.ObjectId(PRODUCT_ID);

describe("parseProductHistoryQuery", () => {
  it("usa busca vazia, todos os tipos, todo o período, mais recentes primeiro e página 1 sem parâmetros", () => {
    expect(parseProductHistoryQuery({})).toEqual({
      q: "",
      kind: "",
      from: "",
      to: "",
      sort: "at",
      dir: "desc",
      page: 1,
    });
  });

  it("lê busca, tipo, período, ordenação e página válidos", () => {
    expect(
      parseProductHistoryQuery({
        q: "  joão  ",
        kind: "booking",
        from: "2026-09-01",
        to: "2026-09-30",
        sort: "guestName",
        dir: "asc",
        page: "3",
      }),
    ).toEqual({ q: "joão", kind: "booking", from: "2026-09-01", to: "2026-09-30", sort: "guestName", dir: "asc", page: 3 });
  });

  it.each(["appointment", "booking", "depletion"])("aceita o tipo %s", (kind) => {
    expect(parseProductHistoryQuery({ kind }).kind).toBe(kind);
  });

  it("usa o primeiro valor quando o parâmetro vem repetido", () => {
    expect(parseProductHistoryQuery({ kind: ["depletion", "booking"], sort: ["guestName", "at"] })).toEqual(
      expect.objectContaining({ kind: "depletion", sort: "guestName" }),
    );
  });

  it.each([
    ["tipo desconhecido", { kind: "sale" }, { kind: "" }],
    ["ordenação fora da lista", { sort: "$where" }, { sort: "at" }],
    ["direção inválida", { dir: "sideways" }, { dir: "desc" }],
    ["início que não é dia", { from: "ontem" }, { from: "" }],
    ["fim que não existe", { to: "2026-02-30" }, { to: "" }],
    ["página zero", { page: "0" }, { page: 1 }],
    ["página fracionada", { page: "1.5" }, { page: 1 }],
    ["página não numérica", { page: "abc" }, { page: 1 }],
  ])("volta para o padrão quando há %s", (_label, params, expected) => {
    expect(parseProductHistoryQuery(params)).toEqual(expect.objectContaining(expected));
  });
});

describe("productHistoryPipeline", () => {
  const BASE = { q: "", kind: "", from: "", to: "", sort: "at", dir: "desc", page: 1 } as const;

  // Atendimentos com o produto, agendamentos que ainda não viraram atendimento (o que virou
  // já aparece pelo atendimento) e cada vez que o produto acabou, no mesmo formato.
  const SOURCES = [
    { $match: { "products.productId": OID } },
    {
      $project: {
        kind: { $literal: "appointment" },
        at: "$performedAt",
        guest: 1,
        services: "$items.serviceName",
        therapists: "$items.therapistName",
      },
    },
    {
      $unionWith: {
        coll: "bookings",
        pipeline: [
          { $match: { "products.productId": OID, appointmentId: null } },
          {
            $project: {
              kind: { $literal: "booking" },
              at: "$startsAt",
              guest: 1,
              services: ["$service.serviceName"],
              therapists: ["$therapistName"],
            },
          },
        ],
      },
    },
    {
      $unionWith: {
        coll: "products",
        pipeline: [
          { $match: { _id: OID } },
          { $unwind: "$depletedAt" },
          {
            $project: {
              kind: { $literal: "depletion" },
              at: "$depletedAt",
              guest: null,
              services: [],
              therapists: [],
            },
          },
        ],
      },
    },
  ];

  function page(skip: number) {
    return [
      {
        $facet: {
          rows: [
            { $skip: skip },
            { $limit: PRODUCT_HISTORY_PAGE_SIZE },
            {
              $project: {
                _id: 0,
                id: { $toString: "$_id" },
                kind: 1,
                at: 1,
                guest: 1,
                services: 1,
                therapists: 1,
              },
            },
          ],
          total: [{ $count: "n" }],
        },
      },
      { $project: { rows: 1, total: { $ifNull: [{ $first: "$total.n" }, 0] } } },
    ];
  }

  it("sem filtros, junta as três origens, ordena pela data (com desempate) e pagina", () => {
    expect(productHistoryPipeline(PRODUCT_ID, BASE)).toEqual([
      ...SOURCES,
      { $sort: { at: -1, _id: 1, kind: 1 } },
      ...page(0),
    ]);
  });

  it.each([
    ["at", "asc", { at: 1, _id: 1, kind: 1 }],
    ["guestName", "asc", { "guest.name": 1, _id: 1, kind: 1 }],
    ["guestName", "desc", { "guest.name": -1, _id: 1, kind: 1 }],
  ] as const)("ordena por %s %s usando o campo unificado", (sort, dir, $sort) => {
    expect(productHistoryPipeline(PRODUCT_ID, { ...BASE, sort, dir })).toEqual([...SOURCES, { $sort }, ...page(0)]);
  });

  it("pula as páginas anteriores", () => {
    const stages = productHistoryPipeline(PRODUCT_ID, { ...BASE, page: 3 });

    expect(stages.slice(-2)).toEqual(page(2 * PRODUCT_HISTORY_PAGE_SIZE));
  });

  it("filtra o tipo, e o período do início do primeiro dia ao fim do último (Brasília), antes de ordenar", () => {
    expect(
      productHistoryPipeline(PRODUCT_ID, { ...BASE, kind: "appointment", from: "2026-09-01", to: "2026-09-30" }),
    ).toEqual([
      ...SOURCES,
      {
        $match: {
          kind: "appointment",
          at: { $gte: new Date("2026-09-01T03:00:00.000Z"), $lt: new Date("2026-10-01T03:00:00.000Z") },
        },
      },
      { $sort: { at: -1, _id: 1, kind: 1 } },
      ...page(0),
    ]);
  });

  it("aceita período com só início ou só fim", () => {
    const [onlyFrom] = productHistoryPipeline(PRODUCT_ID, { ...BASE, from: "2026-09-01" }).slice(SOURCES.length);
    const [onlyTo] = productHistoryPipeline(PRODUCT_ID, { ...BASE, to: "2026-09-30" }).slice(SOURCES.length);

    expect(onlyFrom).toEqual({ $match: { at: { $gte: new Date("2026-09-01T03:00:00.000Z") } } });
    expect(onlyTo).toEqual({ $match: { at: { $lt: new Date("2026-10-01T03:00:00.000Z") } } });
  });

  it("com busca, filtra hóspede, quarto, serviço ou massagista sem diferenciar maiúsculas, com regex escapada", () => {
    const regex = { $regex: "jo\\.ão", $options: "i" };

    expect(productHistoryPipeline(PRODUCT_ID, { ...BASE, q: "jo.ão" })).toEqual([
      ...SOURCES,
      {
        $match: {
          $or: [{ "guest.name": regex }, { "guest.room": regex }, { services: regex }, { therapists: regex }],
        },
      },
      { $sort: { at: -1, _id: 1, kind: 1 } },
      ...page(0),
    ]);
  });
});
