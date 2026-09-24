import { Types, type PipelineStage } from "mongoose";
import { parseDay } from "@/lib/appointment-list";
import { BRT_OFFSET_HOURS } from "@/lib/timezone";

const DAY_MS = 24 * 60 * 60 * 1000;
// A grade do mês mostra 6 semanas.
const MAX_RANGE_DAYS = 42;
const BRT_TIMEZONE = `-${String(BRT_OFFSET_HOURS).padStart(2, "0")}:00`;

// Dias de Brasília: start incluído, end excluído. unit/therapist vazios = todos.
export type BookingRange = { start: string; end: string; unit: string; therapist: string };

// Como sai de bookingListPipeline: datas no horário de Brasília ("2026-09-24T14:30").
export type BookingRow = {
  id: string;
  hotelId: string;
  therapistId: string;
  therapistName: string;
  guest: { name: string; room: string };
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  service: { serviceId: string; serviceName: string } | null;
};

function objectIdOrEmpty(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{24}$/i.test(value) ? value : "";
}

// Início do dia de Brasília em UTC; null se o dia for inválido.
function dayStart(value: unknown) {
  const day = typeof value === "string" && parseDay(value);
  if (!day) return null;
  const [year, month, date] = day;
  return new Date(Date.UTC(year, month - 1, date, BRT_OFFSET_HOURS));
}

// Intervalo pedido pelo calendário; null se inválido, vazio ou maior que a grade do mês.
export function parseBookingRange(input: unknown): BookingRange | null {
  const { start, end, unit, therapist } = (input ?? {}) as Record<string, unknown>;
  const startDate = dayStart(start);
  const endDate = dayStart(end);
  if (!startDate || !endDate) return null;
  const days = (endDate.getTime() - startDate.getTime()) / DAY_MS;
  if (days <= 0 || days > MAX_RANGE_DAYS) return null;
  return { start: start as string, end: end as string, unit: objectIdOrEmpty(unit), therapist: objectIdOrEmpty(therapist) };
}

function brtDateTime(path: string) {
  return { $dateToString: { date: path, format: "%Y-%m-%dT%H:%M", timezone: BRT_TIMEZONE } };
}

// Etapas para o $lookup de bookings a partir das unidades do workspace; os filtros só
// estreitam o resultado, a restrição ao workspace vem do $lookup.
export function bookingListPipeline({ start, end, unit, therapist }: BookingRange) {
  const match: Record<string, unknown> = {
    startsAt: { $lt: dayStart(end) },
    endsAt: { $gt: dayStart(start) },
  };
  if (unit) match.hotelId = new Types.ObjectId(unit);
  if (therapist) match.therapistId = new Types.ObjectId(therapist);
  const stages: PipelineStage.FacetPipelineStage[] = [
    { $match: match },
    { $sort: { startsAt: 1, _id: 1 } },
    {
      $project: {
        _id: 0,
        id: { $toString: "$_id" },
        hotelId: { $toString: "$hotelId" },
        therapistId: { $toString: "$therapistId" },
        therapistName: 1,
        guest: 1,
        startsAt: brtDateTime("$startsAt"),
        endsAt: brtDateTime("$endsAt"),
        durationMinutes: { $dateDiff: { startDate: "$startsAt", endDate: "$endsAt", unit: "minute" } },
        service: {
          $cond: [
            { $eq: [{ $type: "$service" }, "object"] },
            { serviceId: { $toString: "$service.serviceId" }, serviceName: "$service.serviceName" },
            null,
          ],
        },
      },
    },
  ];
  return stages;
}
