import { describe, it, expect } from "vitest";
import { appointmentListPipeline, parseAppointmentListQuery, shiftDay } from "@/lib/appointment-list";

// 24/09/2026 às 23:30 em Brasília (já é dia 25 em UTC).
const NOW = new Date("2026-09-25T02:30:00.000Z");

describe("parseAppointmentListQuery", () => {
  it("sem parâmetros, usa o dia de hoje em Brasília, busca vazia e ordem por horário crescente", () => {
    expect(parseAppointmentListQuery({}, NOW)).toEqual({ date: "2026-09-24", q: "", sort: "performedAt", dir: "asc" });
  });

  it("lê data, busca, campo e direção válidos", () => {
    expect(
      parseAppointmentListQuery({ date: "2026-09-20", q: "joão", sort: "totalCents", dir: "desc" }, NOW),
    ).toEqual({ date: "2026-09-20", q: "joão", sort: "totalCents", dir: "desc" });
  });

  it("aceita ordenação por guestName", () => {
    expect(parseAppointmentListQuery({ sort: "guestName" }, NOW).sort).toBe("guestName");
  });

  it("remove espaços das pontas da busca", () => {
    expect(parseAppointmentListQuery({ q: "  204  " }, NOW).q).toBe("204");
  });

  it("usa o primeiro valor quando o parâmetro vem repetido", () => {
    expect(
      parseAppointmentListQuery(
        { date: ["2026-09-20", "2026-09-21"], q: ["a", "b"], sort: ["guestName", "totalCents"], dir: ["desc", "asc"] },
        NOW,
      ),
    ).toEqual({ date: "2026-09-20", q: "a", sort: "guestName", dir: "desc" });
  });

  it.each([
    ["formato errado", "24/09/2026"],
    ["dia que não existe", "2026-02-30"],
    ["texto", "hoje"],
    ["com hora", "2026-09-20T10:00"],
  ])("volta para hoje quando a data tem %s", (_label, date) => {
    expect(parseAppointmentListQuery({ date }, NOW).date).toBe("2026-09-24");
  });

  it.each([
    ["campo fora da lista", { sort: "hotelId" }],
    ["caminho do banco em vez da chave", { sort: "guest.name" }],
    ["campo com operador", { sort: "$where" }],
  ])("volta para horário quando o sort é %s", (_label, params) => {
    expect(parseAppointmentListQuery(params, NOW).sort).toBe("performedAt");
  });

  it("volta para crescente quando a direção é inválida", () => {
    expect(parseAppointmentListQuery({ dir: "sideways" }, NOW).dir).toBe("asc");
  });
});

describe("shiftDay", () => {
  it.each([
    ["2026-09-24", 1, "2026-09-25"],
    ["2026-09-24", -1, "2026-09-23"],
    ["2026-09-30", 1, "2026-10-01"],
    ["2026-03-01", -1, "2026-02-28"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2028-02-28", 1, "2028-02-29"],
  ])("%s %+d dia = %s", (date, days, expected) => {
    expect(shiftDay(date, days)).toBe(expected);
  });
});

describe("appointmentListPipeline", () => {
  const BASE = { date: "2026-09-24", q: "", sort: "performedAt", dir: "asc" } as const;

  // O dia 24/09 em Brasília vai de 03:00 UTC do dia 24 até 03:00 UTC do dia 25.
  const DAY_MATCH = {
    $match: {
      performedAt: { $gte: new Date("2026-09-24T03:00:00.000Z"), $lt: new Date("2026-09-25T03:00:00.000Z") },
    },
  };
  // O total é calculado antes da ordenação para que seja possível ordenar por ele.
  const SET_TOTAL = { $set: { totalCents: { $sum: "$items.priceCents" } } };
  // serviceId e therapistId vão junto para preencher o formulário de edição.
  const PROJECT = {
    $project: {
      _id: 0,
      id: { $toString: "$_id" },
      performedAt: 1,
      guest: 1,
      items: {
        $map: {
          input: "$items",
          as: "item",
          in: {
            serviceId: { $toString: "$$item.serviceId" },
            serviceName: "$$item.serviceName",
            priceCents: "$$item.priceCents",
            durationMinutes: "$$item.durationMinutes",
            therapistId: { $toString: "$$item.therapistId" },
            therapistName: "$$item.therapistName",
          },
        },
      },
      totalCents: 1,
    },
  };

  it("sem busca, filtra o dia em Brasília, calcula o total, ordena por horário (com _id de desempate) e projeta", () => {
    expect(appointmentListPipeline(BASE)).toEqual([
      DAY_MATCH,
      SET_TOTAL,
      { $sort: { performedAt: 1, _id: 1 } },
      PROJECT,
    ]);
  });

  it.each([
    ["performedAt", "desc", { performedAt: -1, _id: 1 }],
    ["guestName", "asc", { "guest.name": 1, _id: 1 }],
    ["guestName", "desc", { "guest.name": -1, _id: 1 }],
    ["totalCents", "desc", { totalCents: -1, _id: 1 }],
  ] as const)("ordena por %s %s usando o campo do banco", (sort, dir, $sort) => {
    expect(appointmentListPipeline({ ...BASE, sort, dir })).toEqual([DAY_MATCH, SET_TOTAL, { $sort }, PROJECT]);
  });

  it("com busca, filtra nome do hóspede ou quarto sem diferenciar maiúsculas antes de ordenar", () => {
    expect(appointmentListPipeline({ ...BASE, q: "joão" })).toEqual([
      DAY_MATCH,
      {
        $match: {
          $or: [
            { "guest.name": { $regex: "joão", $options: "i" } },
            { "guest.room": { $regex: "joão", $options: "i" } },
          ],
        },
      },
      SET_TOTAL,
      { $sort: { performedAt: 1, _id: 1 } },
      PROJECT,
    ]);
  });

  it("escapa caracteres especiais de regex da busca", () => {
    const [, match] = appointmentListPipeline({ ...BASE, q: "a.b*(c)" });

    expect(match).toEqual({
      $match: {
        $or: [
          { "guest.name": { $regex: "a\\.b\\*\\(c\\)", $options: "i" } },
          { "guest.room": { $regex: "a\\.b\\*\\(c\\)", $options: "i" } },
        ],
      },
    });
  });
});
