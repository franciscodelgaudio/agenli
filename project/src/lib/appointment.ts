import { BRT_OFFSET_HOURS, parseDay } from "@/lib/appointment-list";

const MAX_GUEST_NAME_LENGTH = 80;
const MAX_ROOM_LENGTH = 20;
const MAX_ITEMS = 20;

export type CreateAppointmentError =
  | "invalid_input"
  | "invalid_guest_name"
  | "guest_name_too_long"
  | "invalid_room"
  | "room_too_long"
  | "invalid_performed_at"
  | "no_items"
  | "too_many_items"
  | "invalid_item"
  | "service_not_found"
  | "therapist_not_found"
  | "hotel_not_found";

export type CreateAppointmentResult =
  | { ok: true; appointmentId: string }
  | { ok: false; error: CreateAppointmentError };

export type AppointmentData = {
  hotelId: string;
  performedAt: Date;
  guest: { name: string; room: string };
  items: {
    serviceId: string;
    serviceName: string;
    priceCents: number;
    durationMinutes: number;
    therapistId: string;
    therapistName: string;
  }[];
};

type Deps = {
  // Devolvem só os que existem: serviços da unidade e massagistas do workspace.
  findServices: (ids: string[]) => Promise<{ id: string; name: string; priceCents: number; durationMinutes: number }[]>;
  findTherapists: (ids: string[]) => Promise<{ id: string; name: string }[]>;
  insert: (data: AppointmentData) => Promise<{ id: string }>;
};

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

// "2026-09-24T14:30" no horário de Brasília -> Date em UTC; null se inválido.
function parsePerformedAt(value: string) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
  const day = match && parseDay(match[1]);
  if (!day) return null;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (hours > 23 || minutes > 59) return null;
  const [year, month, date] = day;
  return new Date(Date.UTC(year, month - 1, date, hours + BRT_OFFSET_HOURS, minutes));
}

export async function createAppointment(
  input: unknown,
  hotelId: string | null | undefined,
  { findServices, findTherapists, insert }: Deps,
): Promise<CreateAppointmentResult> {
  if (!hotelId) return { ok: false, error: "hotel_not_found" };

  const { guestName, room, performedAt, serviceIds, therapistIds } = (input ?? {}) as Record<string, unknown>;
  if (
    typeof guestName !== "string" ||
    typeof room !== "string" ||
    typeof performedAt !== "string" ||
    !isStringList(serviceIds) ||
    !isStringList(therapistIds)
  ) {
    return { ok: false, error: "invalid_input" };
  }

  const name = guestName.trim();
  if (!name) return { ok: false, error: "invalid_guest_name" };
  if (name.length > MAX_GUEST_NAME_LENGTH) return { ok: false, error: "guest_name_too_long" };

  const normalizedRoom = room.trim();
  if (!normalizedRoom) return { ok: false, error: "invalid_room" };
  if (normalizedRoom.length > MAX_ROOM_LENGTH) return { ok: false, error: "room_too_long" };

  const date = parsePerformedAt(performedAt.trim());
  if (!date) return { ok: false, error: "invalid_performed_at" };

  // Os pares serviço/massagista chegam em duas listas paralelas, na ordem das linhas do formulário.
  if (serviceIds.length !== therapistIds.length) return { ok: false, error: "invalid_item" };
  if (serviceIds.length === 0) return { ok: false, error: "no_items" };
  if (serviceIds.length > MAX_ITEMS) return { ok: false, error: "too_many_items" };
  const pairs = serviceIds.map((serviceId, i) => ({ serviceId: serviceId.trim(), therapistId: therapistIds[i].trim() }));
  if (pairs.some((pair) => !pair.serviceId || !pair.therapistId)) return { ok: false, error: "invalid_item" };

  const [services, therapists] = await Promise.all([
    findServices([...new Set(pairs.map((pair) => pair.serviceId))]),
    findTherapists([...new Set(pairs.map((pair) => pair.therapistId))]),
  ]);
  const servicesById = new Map(services.map((service) => [service.id, service]));
  const therapistsById = new Map(therapists.map((therapist) => [therapist.id, therapist]));
  if (pairs.some((pair) => !servicesById.has(pair.serviceId))) return { ok: false, error: "service_not_found" };
  if (pairs.some((pair) => !therapistsById.has(pair.therapistId))) return { ok: false, error: "therapist_not_found" };

  // Nome, valor e duração são copiados para que mudanças futuras no serviço não alterem o histórico.
  const appointment = await insert({
    hotelId,
    performedAt: date,
    guest: { name, room: normalizedRoom },
    items: pairs.map(({ serviceId, therapistId }) => {
      const service = servicesById.get(serviceId)!;
      return {
        serviceId,
        serviceName: service.name,
        priceCents: service.priceCents,
        durationMinutes: service.durationMinutes,
        therapistId,
        therapistName: therapistsById.get(therapistId)!.name,
      };
    }),
  });
  return { ok: true, appointmentId: appointment.id };
}

export type DeleteAppointmentResult = { ok: true } | { ok: false; error: "appointment_not_found" };

// remove devolve false quando o atendimento não existe (ou não é da unidade).
export async function deleteAppointment(
  appointmentId: string | null | undefined,
  remove: (appointmentId: string) => Promise<boolean>,
): Promise<DeleteAppointmentResult> {
  if (!appointmentId) return { ok: false, error: "appointment_not_found" };

  const found = await remove(appointmentId);
  return found ? { ok: true } : { ok: false, error: "appointment_not_found" };
}
