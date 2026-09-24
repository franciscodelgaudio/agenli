import { describe, it, expect } from "vitest";
import { appointmentListPipeline, parseAppointmentListQuery, shiftDay } from "@/lib/appointment-list";

// 24/09/2026 às 23:30 em Brasília (já é dia 25 em UTC).
const NOW = new Date("2026-09-25T02:30:00.000Z");

describe("parseAppointmentListQuery", () => {
  it("sem parâmetros, usa o dia de hoje em Brasília e busca vazia", () => {
    expect(parseAppointmentListQuery({}, NOW)).toEqual({ date: "2026-09-24", q: "" });
  });

  it("lê data e busca válidas", () => {
    expect(parseAppointmentListQuery({ date: "2026-09-20", q: "joão" }, NOW)).toEqual({
      date: "2026-09-20",
      q: "joão",
    });
  });

  it("remove espaços das pontas da busca", () => {
    expect(parseAppointmentListQuery({ q: "  204  " }, NOW).q).toBe("204");
  });

  it("usa o primeiro valor quando o parâmetro vem repetido", () => {
    expect(parseAppointmentListQuery({ date: ["2026-09-20", "2026-09-21"], q: ["a", "b"] }, NOW)).toEqual({
      date: "2026-09-20",
      q: "a",
    });
  });

  it.each([
    ["formato errado", "24/09/2026"],
    ["dia que não existe", "2026-02-30"],
    ["texto", "hoje"],
    ["com hora", "2026-09-20T10:00"],
  ])("volta para hoje quando a data tem %s", (_label, date) => {
    expect(parseAppointmentListQuery({ date }, NOW).date).toBe("2026-09-24");
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
  // O dia 24/09 em Brasília vai de 03:00 UTC do dia 24 até 03:00 UTC do dia 25.
  const DAY_MATCH = {
    $match: {
      performedAt: { $gte: new Date("2026-09-24T03:00:00.000Z"), $lt: new Date("2026-09-25T03:00:00.000Z") },
    },
  };
  const SORT = { $sort: { performedAt: 1, _id: 1 } };
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
            serviceName: "$$item.serviceName",
            priceCents: "$$item.priceCents",
            durationMinutes: "$$item.durationMinutes",
            therapistName: "$$item.therapistName",
          },
        },
      },
      totalCents: { $sum: "$items.priceCents" },
    },
  };

  it("sem busca, filtra o dia em Brasília, ordena por horário (com _id de desempate) e projeta", () => {
    expect(appointmentListPipeline({ date: "2026-09-24", q: "" })).toEqual([DAY_MATCH, SORT, PROJECT]);
  });

  it("com busca, filtra nome do hóspede ou quarto sem diferenciar maiúsculas", () => {
    expect(appointmentListPipeline({ date: "2026-09-24", q: "joão" })).toEqual([
      DAY_MATCH,
      {
        $match: {
          $or: [
            { "guest.name": { $regex: "joão", $options: "i" } },
            { "guest.room": { $regex: "joão", $options: "i" } },
          ],
        },
      },
      SORT,
      PROJECT,
    ]);
  });

  it("escapa caracteres especiais de regex da busca", () => {
    const [, match] = appointmentListPipeline({ date: "2026-09-24", q: "a.b*(c)" });

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
