import type { PipelineStage } from "mongoose";
import { escapeRegex, first, type SearchParams } from "@/lib/hotel-list";

// Horário de Brasília: UTC-3 fixo (sem horário de verão desde 2019).
export const BRT_OFFSET_HOURS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AppointmentListQuery = { date: string; q: string };

// "2026-09-24" -> [2026, 9, 24]; null se o formato for outro ou o dia não existir.
export function parseDay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return [year, month, day] as const;
}

function toDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function parseAppointmentListQuery(params: SearchParams, now = new Date()): AppointmentListQuery {
  const date = first(params.date);
  const today = toDay(new Date(now.getTime() - BRT_OFFSET_HOURS * 60 * 60 * 1000));
  return {
    date: date && parseDay(date) ? date : today,
    q: first(params.q)?.trim() ?? "",
  };
}

// Espera uma data já validada por parseAppointmentListQuery.
export function shiftDay(date: string, days: number) {
  const [year, month, day] = parseDay(date)!;
  return toDay(new Date(Date.UTC(year, month - 1, day + days)));
}

// Etapas para a pipeline do $lookup de appointments da unidade.
export function appointmentListPipeline({ date, q }: AppointmentListQuery) {
  const [year, month, day] = parseDay(date)!;
  const start = new Date(Date.UTC(year, month - 1, day, BRT_OFFSET_HOURS));
  const stages: PipelineStage.FacetPipelineStage[] = [
    { $match: { performedAt: { $gte: start, $lt: new Date(start.getTime() + DAY_MS) } } },
  ];
  if (q) {
    const regex = { $regex: escapeRegex(q), $options: "i" };
    stages.push({ $match: { $or: [{ "guest.name": regex }, { "guest.room": regex }] } });
  }
  stages.push(
    { $sort: { performedAt: 1, _id: 1 } },
    {
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
    },
  );
  return stages;
}
