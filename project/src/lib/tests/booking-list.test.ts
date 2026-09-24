import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { bookingListPipeline, parseBookingRange } from "@/lib/booking-list";

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
      service: {
        $cond: [
          { $eq: [{ $type: "$service" }, "object"] },
          { serviceId: { $toString: "$service.serviceId" }, serviceName: "$service.serviceName" },
          null,
        ],
      },
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
