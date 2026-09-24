import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import {
  bookingDayListPipeline,
  bookingListPipeline,
  parseBookingListQuery,
  parseBookingRange,
} from "@/lib/booking-list";

const UNIT_ID = "64b7f0c2a1b2c3d4e5f60720";
const ANA_ID = "64b7f0c2a1b2c3d4e5f60751";

// O calendário pede os dias visíveis: início incluído, fim excluído (dias de Brasília).
describe("parseBookingRange", () => {
  it("lê o intervalo sem filtros", () => {
    expect(parseBookingRange({ start: "2026-09-20", end: "2026-09-27" })).toEqual({
      start: "2026-09-20",
      end: "2026-09-27",
      unit: "",
      therapist: "",
    });
  });

  it("lê os filtros de unidade e massagista", () => {
    expect(parseBookingRange({ start: "2026-09-20", end: "2026-09-27", unit: UNIT_ID, therapist: ANA_ID })).toEqual({
      start: "2026-09-20",
      end: "2026-09-27",
      unit: UNIT_ID,
      therapist: ANA_ID,
    });
  });

  it("aceita um dia só e 42 dias (grade do mês, limite)", () => {
    expect(parseBookingRange({ start: "2026-09-24", end: "2026-09-25" })).not.toBeNull();
    expect(parseBookingRange({ start: "2026-08-30", end: "2026-10-11" })).not.toBeNull();
  });

  it.each([
    ["input nulo", null],
    ["início ausente", { end: "2026-09-27" }],
    ["fim não é string", { start: "2026-09-20", end: 20260927 }],
    ["início com formato errado", { start: "20/09/2026", end: "2026-09-27" }],
    ["fim que não existe", { start: "2026-02-01", end: "2026-02-30" }],
    ["fim igual ao início", { start: "2026-09-20", end: "2026-09-20" }],
    ["fim antes do início", { start: "2026-09-27", end: "2026-09-20" }],
    ["mais de 42 dias", { start: "2026-08-30", end: "2026-10-12" }],
  ])("retorna null quando %s", (_label, input) => {
    expect(parseBookingRange(input)).toBeNull();
  });

  it.each([
    ["texto", "centro"],
    ["id curto", "64b7f0c2a1b2"],
    ["não é string", 42],
    ["objeto de operador", { $ne: null }],
  ])("ignora filtros inválidos (%s)", (_label, value) => {
    expect(parseBookingRange({ start: "2026-09-20", end: "2026-09-27", unit: value, therapist: value })).toEqual(
      expect.objectContaining({ unit: "", therapist: "" }),
    );
  });
});

describe("bookingListPipeline", () => {
  const BASE = { start: "2026-09-20", end: "2026-09-27", unit: "", therapist: "" };

  // Entram os que se sobrepõem ao intervalo: 20/09 00:00 até 27/09 00:00 em Brasília.
  const OVERLAP = {
    startsAt: { $lt: new Date("2026-09-27T03:00:00.000Z") },
    endsAt: { $gt: new Date("2026-09-20T03:00:00.000Z") },
  };
  // Datas saem no horário de Brasília, no formato do formulário e do calendário.
  const PROJECT = {
    $project: {
      _id: 0,
      id: { $toString: "$_id" },
      unitId: { $toString: "$unitId" },
      therapistId: { $toString: "$therapistId" },
      therapistName: 1,
      guest: 1,
      startsAt: { $dateToString: { date: "$startsAt", format: "%Y-%m-%dT%H:%M", timezone: "-03:00" } },
      endsAt: { $dateToString: { date: "$endsAt", format: "%Y-%m-%dT%H:%M", timezone: "-03:00" } },
      durationMinutes: { $dateDiff: { startDate: "$startsAt", endDate: "$endsAt", unit: "minute" } },
      service: { serviceId: { $toString: "$service.serviceId" }, serviceName: "$service.serviceName" },
      // Atendimento criado a partir do agendamento; null (ou ausente nos antigos) se ainda não virou.
      appointmentId: { $ifNull: [{ $toString: "$appointmentId" }, null] },
    },
  };
  const SORT = { $sort: { startsAt: 1, _id: 1 } };

  it("sem filtros, pega os que se sobrepõem ao intervalo, ordena por início e projeta", () => {
    expect(bookingListPipeline(BASE)).toEqual([{ $match: OVERLAP }, SORT, PROJECT]);
  });

  it("com filtros, restringe por unidade e massagista no mesmo $match", () => {
    expect(bookingListPipeline({ ...BASE, unit: UNIT_ID, therapist: ANA_ID })).toEqual([
      {
        $match: {
          ...OVERLAP,
          unitId: new Types.ObjectId(UNIT_ID),
          therapistId: new Types.ObjectId(ANA_ID),
        },
      },
      SORT,
      PROJECT,
    ]);
  });
});

// 24/09/2026 às 23:30 em Brasília (já é dia 25 em UTC).
const NOW = new Date("2026-09-25T02:30:00.000Z");

// Lista de agendamentos do dia: busca, ordenação e filtros vêm da URL.
describe("parseBookingListQuery", () => {
  it("sem parâmetros, usa o dia de hoje em Brasília, sem busca nem filtros e ordem por início crescente", () => {
    expect(parseBookingListQuery({}, NOW)).toEqual({
      date: "2026-09-24",
      q: "",
      sort: "startsAt",
      dir: "asc",
      unit: "",
      therapist: "",
    });
  });

  it("lê data, busca, ordenação, direção e filtros válidos", () => {
    expect(
      parseBookingListQuery(
        { date: "2026-09-20", q: "joão", sort: "therapistName", dir: "desc", unit: UNIT_ID, therapist: ANA_ID },
        NOW,
      ),
    ).toEqual({ date: "2026-09-20", q: "joão", sort: "therapistName", dir: "desc", unit: UNIT_ID, therapist: ANA_ID });
  });

  it("aceita ordenação por guestName", () => {
    expect(parseBookingListQuery({ sort: "guestName" }, NOW).sort).toBe("guestName");
  });

  it("remove espaços das pontas da busca", () => {
    expect(parseBookingListQuery({ q: "  204  " }, NOW).q).toBe("204");
  });

  it("usa o primeiro valor quando o parâmetro vem repetido", () => {
    expect(
      parseBookingListQuery(
        {
          date: ["2026-09-20", "2026-09-21"],
          q: ["a", "b"],
          sort: ["guestName", "startsAt"],
          dir: ["desc", "asc"],
          unit: [UNIT_ID, ANA_ID],
          therapist: [ANA_ID, UNIT_ID],
        },
        NOW,
      ),
    ).toEqual({ date: "2026-09-20", q: "a", sort: "guestName", dir: "desc", unit: UNIT_ID, therapist: ANA_ID });
  });

  it.each([
    ["formato errado", "24/09/2026"],
    ["dia que não existe", "2026-02-30"],
    ["com hora", "2026-09-20T10:00"],
  ])("volta para hoje quando a data tem %s", (_label, date) => {
    expect(parseBookingListQuery({ date }, NOW).date).toBe("2026-09-24");
  });

  it.each([
    ["campo fora da lista", "unitId"],
    ["caminho do banco em vez da chave", "guest.name"],
    ["campo com operador", "$where"],
  ])("volta para início quando o sort é %s", (_label, sort) => {
    expect(parseBookingListQuery({ sort }, NOW).sort).toBe("startsAt");
  });

  it("volta para crescente quando a direção é inválida", () => {
    expect(parseBookingListQuery({ dir: "sideways" }, NOW).dir).toBe("asc");
  });

  it.each([
    ["texto", "centro"],
    ["id curto", "64b7f0c2a1b2"],
  ])("ignora filtros inválidos (%s)", (_label, value) => {
    expect(parseBookingListQuery({ unit: value, therapist: value }, NOW)).toEqual(
      expect.objectContaining({ unit: "", therapist: "" }),
    );
  });
});

describe("bookingDayListPipeline", () => {
  const BASE = { date: "2026-09-24", q: "", sort: "startsAt", dir: "asc", unit: "", therapist: "" } as const;

  // Entram os que começam no dia 24/09 em Brasília: de 03:00 UTC do dia 24 até 03:00 UTC do dia 25.
  const DAY = { startsAt: { $gte: new Date("2026-09-24T03:00:00.000Z"), $lt: new Date("2026-09-25T03:00:00.000Z") } };
  // Mesmo formato de linha do calendário, para reaproveitar o formulário de edição.
  const PROJECT = bookingListPipeline({ start: "2026-09-24", end: "2026-09-25", unit: "", therapist: "" }).at(-1);

  it("sem busca nem filtros, pega os que começam no dia, ordena por início (com _id de desempate) e projeta", () => {
    expect(bookingDayListPipeline(BASE)).toEqual([{ $match: DAY }, { $sort: { startsAt: 1, _id: 1 } }, PROJECT]);
  });

  it.each([
    ["startsAt", "desc", { startsAt: -1, _id: 1 }],
    ["guestName", "asc", { "guest.name": 1, _id: 1 }],
    ["guestName", "desc", { "guest.name": -1, _id: 1 }],
    ["therapistName", "asc", { therapistName: 1, _id: 1 }],
  ] as const)("ordena por %s %s usando o campo do banco", (sort, dir, $sort) => {
    expect(bookingDayListPipeline({ ...BASE, sort, dir })).toEqual([{ $match: DAY }, { $sort }, PROJECT]);
  });

  it("com filtros, restringe por unidade e massagista no mesmo $match do dia", () => {
    expect(bookingDayListPipeline({ ...BASE, unit: UNIT_ID, therapist: ANA_ID })).toEqual([
      { $match: { ...DAY, unitId: new Types.ObjectId(UNIT_ID), therapistId: new Types.ObjectId(ANA_ID) } },
      { $sort: { startsAt: 1, _id: 1 } },
      PROJECT,
    ]);
  });

  it("com busca, filtra nome do hóspede ou quarto sem diferenciar maiúsculas antes de ordenar", () => {
    expect(bookingDayListPipeline({ ...BASE, q: "joão" })).toEqual([
      { $match: DAY },
      {
        $match: {
          $or: [
            { "guest.name": { $regex: "joão", $options: "i" } },
            { "guest.room": { $regex: "joão", $options: "i" } },
          ],
        },
      },
      { $sort: { startsAt: 1, _id: 1 } },
      PROJECT,
    ]);
  });

  it("escapa caracteres especiais de regex da busca", () => {
    const [, match] = bookingDayListPipeline({ ...BASE, q: "a.b*(c)" });

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
