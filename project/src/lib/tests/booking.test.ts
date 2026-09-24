import { describe, it, expect, vi } from "vitest";
import { createBooking, deleteBooking, rescheduleBooking, updateBooking } from "@/lib/booking";

const UNIT_ID = "64b7f0c2a1b2c3d4e5f60720";
const BOOKING_ID = "64b7f0c2a1b2c3d4e5f60740";
const CANDLE_ID = "64b7f0c2a1b2c3d4e5f60731";
const ANA_ID = "64b7f0c2a1b2c3d4e5f60751";

const CANDLE = { id: CANDLE_ID, name: "Massagem Candle" };
const ANA = { id: ANA_ID, name: "Ana" };

// Como chega do FormData: início no horário de Brasília, duração em minutos (texto)
// e serviço opcional ("" quando não escolhido).
const validInput = {
  therapistId: ANA_ID,
  guestName: "João Silva",
  room: "204",
  startsAt: "2026-09-24T14:30",
  durationMinutes: "60",
  serviceId: CANDLE_ID,
};

function makeLookups({ service = CANDLE as typeof CANDLE | null, therapist = ANA as typeof ANA | null, busy = false } = {}) {
  return {
    // Devolvem null quando não existe (serviço da unidade; quem pode atender no workspace).
    findService: vi.fn(async (id: string) => (service?.id === id ? service : null)),
    findTherapist: vi.fn(async (id: string) => (therapist?.id === id ? therapist : null)),
    // true quando a massagista já tem outro agendamento que se sobrepõe ao intervalo.
    hasConflict: vi.fn(async () => busy),
  };
}

describe("createBooking", () => {
  function makeDeps(options?: Parameters<typeof makeLookups>[0]) {
    return { ...makeLookups(options), insert: vi.fn().mockResolvedValue({ id: BOOKING_ID }) };
  }

  it("cria o agendamento com início/fim em UTC, massagista e cópia do nome do serviço", async () => {
    const deps = makeDeps();

    const result = await createBooking(validInput, UNIT_ID, deps);

    expect(result).toEqual({ ok: true, bookingId: BOOKING_ID });
    expect(deps.insert).toHaveBeenCalledWith({
      unitId: UNIT_ID,
      therapistId: ANA_ID,
      therapistName: "Ana",
      guest: { name: "João Silva", room: "204" },
      startsAt: new Date("2026-09-24T17:30:00.000Z"),
      endsAt: new Date("2026-09-24T18:30:00.000Z"),
      service: { serviceId: CANDLE_ID, serviceName: "Massagem Candle" },
    });
  });

  it("verifica conflito da massagista no intervalo do agendamento", async () => {
    const deps = makeDeps();

    await createBooking(validInput, UNIT_ID, deps);

    expect(deps.hasConflict).toHaveBeenCalledWith({
      therapistId: ANA_ID,
      startsAt: new Date("2026-09-24T17:30:00.000Z"),
      endsAt: new Date("2026-09-24T18:30:00.000Z"),
    });
  });

  it.each([
    ["vazio", ""],
    ["só espaços", "   "],
    ["ausente (null do FormData)", null],
  ])("aceita serviço %s: agenda sem serviço e não busca serviço", async (_label, serviceId) => {
    const deps = makeDeps();

    const result = await createBooking({ ...validInput, serviceId }, UNIT_ID, deps);

    expect(result).toEqual({ ok: true, bookingId: BOOKING_ID });
    expect(deps.findService).not.toHaveBeenCalled();
    expect(deps.insert.mock.calls[0][0].service).toBeNull();
  });

  it("remove espaços das pontas de hóspede, quarto, início, duração e ids", async () => {
    const deps = makeDeps();

    await createBooking(
      {
        therapistId: ` ${ANA_ID} `,
        guestName: "  João Silva  ",
        room: " 204 ",
        startsAt: " 2026-09-24T14:30 ",
        durationMinutes: " 60 ",
        serviceId: ` ${CANDLE_ID} `,
      },
      UNIT_ID,
      deps,
    );

    expect(deps.findService).toHaveBeenCalledWith(CANDLE_ID);
    expect(deps.findTherapist).toHaveBeenCalledWith(ANA_ID);
    expect(deps.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        therapistId: ANA_ID,
        guest: { name: "João Silva", room: "204" },
        startsAt: new Date("2026-09-24T17:30:00.000Z"),
      }),
    );
  });

  it("converte de Brasília para UTC e permite terminar no dia seguinte", async () => {
    const deps = makeDeps();

    await createBooking({ ...validInput, startsAt: "2026-12-31T22:15", durationMinutes: "90" }, UNIT_ID, deps);

    expect(deps.insert.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        startsAt: new Date("2027-01-01T01:15:00.000Z"),
        endsAt: new Date("2027-01-01T02:45:00.000Z"),
      }),
    );
  });

  it.each(["5", "720"])("aceita duração de %s minutos (limites)", async (durationMinutes) => {
    const result = await createBooking({ ...validInput, durationMinutes }, UNIT_ID, makeDeps());

    expect(result).toEqual({ ok: true, bookingId: BOOKING_ID });
  });

  it("aceita nome do hóspede com 80 caracteres e quarto com 20 (limites)", async () => {
    const result = await createBooking(
      { ...validInput, guestName: "a".repeat(80), room: "1".repeat(20) },
      UNIT_ID,
      makeDeps(),
    );

    expect(result).toEqual({ ok: true, bookingId: BOOKING_ID });
  });

  it.each([
    ["input nulo", null, "invalid_input"],
    ["massagista não é string", { ...validInput, therapistId: 1 }, "invalid_input"],
    ["hóspede ausente (null do FormData)", { ...validInput, guestName: null }, "invalid_input"],
    ["quarto ausente", { ...validInput, room: undefined }, "invalid_input"],
    ["início ausente", { ...validInput, startsAt: null }, "invalid_input"],
    ["duração ausente", { ...validInput, durationMinutes: null }, "invalid_input"],
    ["serviço não é string nem null", { ...validInput, serviceId: 123 }, "invalid_input"],
    ["massagista não escolhida", { ...validInput, therapistId: "  " }, "invalid_therapist"],
    ["nome do hóspede vazio", { ...validInput, guestName: "   " }, "invalid_guest_name"],
    ["nome do hóspede com mais de 80 caracteres", { ...validInput, guestName: "a".repeat(81) }, "guest_name_too_long"],
    ["quarto vazio", { ...validInput, room: "  " }, "invalid_room"],
    ["quarto com mais de 20 caracteres", { ...validInput, room: "1".repeat(21) }, "room_too_long"],
    ["início vazio", { ...validInput, startsAt: "" }, "invalid_starts_at"],
    ["início sem hora", { ...validInput, startsAt: "2026-09-24" }, "invalid_starts_at"],
    ["dia que não existe", { ...validInput, startsAt: "2026-02-30T10:00" }, "invalid_starts_at"],
    ["hora que não existe", { ...validInput, startsAt: "2026-09-24T24:00" }, "invalid_starts_at"],
    ["duração vazia", { ...validInput, durationMinutes: "" }, "invalid_duration"],
    ["duração não numérica", { ...validInput, durationMinutes: "uma hora" }, "invalid_duration"],
    ["duração fracionada", { ...validInput, durationMinutes: "30.5" }, "invalid_duration"],
    ["duração negativa", { ...validInput, durationMinutes: "-30" }, "invalid_duration"],
    ["duração abaixo de 5 minutos", { ...validInput, durationMinutes: "4" }, "invalid_duration"],
    ["duração acima de 12 horas", { ...validInput, durationMinutes: "721" }, "invalid_duration"],
  ])("retorna erro sem buscar nem salvar quando %s", async (_label, input, error) => {
    const deps = makeDeps();

    const result = await createBooking(input, UNIT_ID, deps);

    expect(result).toEqual({ ok: false, error });
    expect(deps.findService).not.toHaveBeenCalled();
    expect(deps.findTherapist).not.toHaveBeenCalled();
    expect(deps.hasConflict).not.toHaveBeenCalled();
    expect(deps.insert).not.toHaveBeenCalled();
  });

  it("retorna service_not_found sem salvar quando o serviço não é da unidade", async () => {
    const deps = makeDeps({ service: null });

    const result = await createBooking(validInput, UNIT_ID, deps);

    expect(result).toEqual({ ok: false, error: "service_not_found" });
    expect(deps.insert).not.toHaveBeenCalled();
  });

  it("retorna therapist_not_found sem checar conflito nem salvar quando a massagista não pode atender", async () => {
    const deps = makeDeps({ therapist: null });

    const result = await createBooking(validInput, UNIT_ID, deps);

    expect(result).toEqual({ ok: false, error: "therapist_not_found" });
    expect(deps.hasConflict).not.toHaveBeenCalled();
    expect(deps.insert).not.toHaveBeenCalled();
  });

  it("retorna therapist_busy sem salvar quando a massagista já tem agendamento no horário", async () => {
    const deps = makeDeps({ busy: true });

    const result = await createBooking(validInput, UNIT_ID, deps);

    expect(result).toEqual({ ok: false, error: "therapist_busy" });
    expect(deps.insert).not.toHaveBeenCalled();
  });

  it.each([undefined, null, ""])(
    "retorna unit_not_found sem buscar nem salvar quando não há unitId (%j)",
    async (unitId) => {
      const deps = makeDeps();

      const result = await createBooking(validInput, unitId, deps);

      expect(result).toEqual({ ok: false, error: "unit_not_found" });
      expect(deps.findTherapist).not.toHaveBeenCalled();
      expect(deps.insert).not.toHaveBeenCalled();
    },
  );
});

describe("updateBooking", () => {
  function makeDeps({ found = true, ...options }: Parameters<typeof makeLookups>[0] & { found?: boolean } = {}) {
    // update devolve false quando o agendamento não existe (ou não é da unidade).
    return { ...makeLookups(options), update: vi.fn().mockResolvedValue(found) };
  }

  it("atualiza todos os campos e ignora o próprio agendamento na checagem de conflito", async () => {
    const deps = makeDeps();

    const result = await updateBooking(
      { ...validInput, guestName: "Maria Souza", room: "310", startsAt: "2026-09-24T16:00", durationMinutes: "45", serviceId: "" },
      BOOKING_ID,
      deps,
    );

    expect(result).toEqual({ ok: true });
    expect(deps.hasConflict).toHaveBeenCalledWith({
      therapistId: ANA_ID,
      startsAt: new Date("2026-09-24T19:00:00.000Z"),
      endsAt: new Date("2026-09-24T19:45:00.000Z"),
      excludeId: BOOKING_ID,
    });
    expect(deps.update).toHaveBeenCalledWith(BOOKING_ID, {
      therapistId: ANA_ID,
      therapistName: "Ana",
      guest: { name: "Maria Souza", room: "310" },
      startsAt: new Date("2026-09-24T19:00:00.000Z"),
      endsAt: new Date("2026-09-24T19:45:00.000Z"),
      service: null,
    });
  });

  it.each([
    ["input nulo", null, "invalid_input"],
    ["massagista não escolhida", { ...validInput, therapistId: "" }, "invalid_therapist"],
    ["nome do hóspede vazio", { ...validInput, guestName: "   " }, "invalid_guest_name"],
    ["dia que não existe", { ...validInput, startsAt: "2026-02-30T10:00" }, "invalid_starts_at"],
    ["duração acima de 12 horas", { ...validInput, durationMinutes: "721" }, "invalid_duration"],
  ])("retorna erro sem buscar nem salvar quando %s", async (_label, input, error) => {
    const deps = makeDeps();

    const result = await updateBooking(input, BOOKING_ID, deps);

    expect(result).toEqual({ ok: false, error });
    expect(deps.findTherapist).not.toHaveBeenCalled();
    expect(deps.update).not.toHaveBeenCalled();
  });

  it.each([
    ["service_not_found", { service: null }],
    ["therapist_not_found", { therapist: null }],
    ["therapist_busy", { busy: true }],
  ] as const)("retorna %s sem salvar", async (error, options) => {
    const deps = makeDeps(options);

    const result = await updateBooking(validInput, BOOKING_ID, deps);

    expect(result).toEqual({ ok: false, error });
    expect(deps.update).not.toHaveBeenCalled();
  });

  it.each([undefined, null, ""])(
    "retorna booking_not_found sem buscar nem salvar quando não há bookingId (%j)",
    async (bookingId) => {
      const deps = makeDeps();

      const result = await updateBooking(validInput, bookingId, deps);

      expect(result).toEqual({ ok: false, error: "booking_not_found" });
      expect(deps.findTherapist).not.toHaveBeenCalled();
      expect(deps.update).not.toHaveBeenCalled();
    },
  );

  it("retorna booking_not_found quando o agendamento não existe (ou não é da unidade)", async () => {
    const result = await updateBooking(validInput, BOOKING_ID, makeDeps({ found: false }));

    expect(result).toEqual({ ok: false, error: "booking_not_found" });
  });
});

// Arrastar ou redimensionar no calendário: só início e fim mudam.
describe("rescheduleBooking", () => {
  const validTimes = { startsAt: "2026-09-24T15:00", endsAt: "2026-09-24T16:30" };

  function makeDeps({ booking = { therapistId: ANA_ID } as { therapistId: string } | null, busy = false, found = true } = {}) {
    return {
      // Devolve a massagista do agendamento, ou null se não existe (ou não é do workspace).
      findBooking: vi.fn().mockResolvedValue(booking),
      hasConflict: vi.fn().mockResolvedValue(busy),
      update: vi.fn().mockResolvedValue(found),
    };
  }

  it("atualiza início e fim convertidos para UTC, checando conflito da massagista do agendamento", async () => {
    const deps = makeDeps();

    const result = await rescheduleBooking(validTimes, BOOKING_ID, deps);

    expect(result).toEqual({ ok: true });
    expect(deps.findBooking).toHaveBeenCalledWith(BOOKING_ID);
    expect(deps.hasConflict).toHaveBeenCalledWith({
      therapistId: ANA_ID,
      startsAt: new Date("2026-09-24T18:00:00.000Z"),
      endsAt: new Date("2026-09-24T19:30:00.000Z"),
      excludeId: BOOKING_ID,
    });
    expect(deps.update).toHaveBeenCalledWith(BOOKING_ID, {
      startsAt: new Date("2026-09-24T18:00:00.000Z"),
      endsAt: new Date("2026-09-24T19:30:00.000Z"),
    });
  });

  it("aceita terminar no dia seguinte", async () => {
    const deps = makeDeps();

    const result = await rescheduleBooking({ startsAt: "2026-09-24T23:30", endsAt: "2026-09-25T00:30" }, BOOKING_ID, deps);

    expect(result).toEqual({ ok: true });
  });

  it.each([
    ["input nulo", null, "invalid_input"],
    ["fim ausente", { startsAt: validTimes.startsAt }, "invalid_input"],
    ["início inválido", { ...validTimes, startsAt: "2026-02-30T10:00" }, "invalid_starts_at"],
    ["fim inválido", { ...validTimes, endsAt: "amanhã" }, "invalid_duration"],
    ["fim igual ao início", { ...validTimes, endsAt: validTimes.startsAt }, "invalid_duration"],
    ["fim antes do início", { ...validTimes, endsAt: "2026-09-24T14:00" }, "invalid_duration"],
    ["menos de 5 minutos", { ...validTimes, endsAt: "2026-09-24T15:04" }, "invalid_duration"],
    ["mais de 12 horas", { ...validTimes, endsAt: "2026-09-25T03:01" }, "invalid_duration"],
  ])("retorna erro sem buscar nem salvar quando %s", async (_label, input, error) => {
    const deps = makeDeps();

    const result = await rescheduleBooking(input, BOOKING_ID, deps);

    expect(result).toEqual({ ok: false, error });
    expect(deps.findBooking).not.toHaveBeenCalled();
    expect(deps.update).not.toHaveBeenCalled();
  });

  it.each([undefined, null, ""])(
    "retorna booking_not_found sem buscar nem salvar quando não há bookingId (%j)",
    async (bookingId) => {
      const deps = makeDeps();

      const result = await rescheduleBooking(validTimes, bookingId, deps);

      expect(result).toEqual({ ok: false, error: "booking_not_found" });
      expect(deps.findBooking).not.toHaveBeenCalled();
      expect(deps.update).not.toHaveBeenCalled();
    },
  );

  it("retorna booking_not_found sem checar conflito quando o agendamento não é encontrado", async () => {
    const deps = makeDeps({ booking: null });

    const result = await rescheduleBooking(validTimes, BOOKING_ID, deps);

    expect(result).toEqual({ ok: false, error: "booking_not_found" });
    expect(deps.hasConflict).not.toHaveBeenCalled();
    expect(deps.update).not.toHaveBeenCalled();
  });

  it("retorna therapist_busy sem salvar quando o novo horário conflita", async () => {
    const deps = makeDeps({ busy: true });

    const result = await rescheduleBooking(validTimes, BOOKING_ID, deps);

    expect(result).toEqual({ ok: false, error: "therapist_busy" });
    expect(deps.update).not.toHaveBeenCalled();
  });

  it("retorna booking_not_found quando o agendamento some antes de salvar", async () => {
    const result = await rescheduleBooking(validTimes, BOOKING_ID, makeDeps({ found: false }));

    expect(result).toEqual({ ok: false, error: "booking_not_found" });
  });
});

describe("deleteBooking", () => {
  it("exclui o agendamento pelo id", async () => {
    const remove = vi.fn().mockResolvedValue(true);

    const result = await deleteBooking(BOOKING_ID, remove);

    expect(result).toEqual({ ok: true });
    expect(remove).toHaveBeenCalledWith(BOOKING_ID);
  });

  it.each([undefined, null, ""])(
    "retorna booking_not_found sem excluir quando não há bookingId (%j)",
    async (bookingId) => {
      const remove = vi.fn().mockResolvedValue(true);

      const result = await deleteBooking(bookingId, remove);

      expect(result).toEqual({ ok: false, error: "booking_not_found" });
      expect(remove).not.toHaveBeenCalled();
    },
  );

  it("retorna booking_not_found quando o agendamento não existe (ou não é do workspace)", async () => {
    const result = await deleteBooking(BOOKING_ID, vi.fn().mockResolvedValue(false));

    expect(result).toEqual({ ok: false, error: "booking_not_found" });
  });
});
