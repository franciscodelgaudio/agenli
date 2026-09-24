import { Types, type PipelineStage } from "mongoose";
import { escapeRegex, first, type SearchParams, type SortDir } from "@/lib/hotel-list";

// Horário de Brasília: UTC-3 fixo (sem horário de verão desde 2019).
export const BRT_OFFSET_HOURS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

// Chaves aceitas na URL e o campo correspondente no banco.
const SORT_PATHS = { performedAt: "performedAt", guestName: "guest.name", totalCents: "totalCents" } as const;

export type AppointmentSortField = keyof typeof SORT_PATHS;
export type AppointmentListQuery = { date: string; q: string; sort: AppointmentSortField; dir: SortDir };

function isSortField(value: string | undefined): value is AppointmentSortField {
  return value !== undefined && Object.hasOwn(SORT_PATHS, value);
}

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
  const sort = first(params.sort);
  const today = toDay(new Date(now.getTime() - BRT_OFFSET_HOURS * 60 * 60 * 1000));
  return {
    date: date && parseDay(date) ? date : today,
    q: first(params.q)?.trim() ?? "",
    sort: isSortField(sort) ? sort : "performedAt",
    dir: first(params.dir) === "desc" ? "desc" : "asc",
  };
}

// Espera uma data já validada por parseAppointmentListQuery.
export function shiftDay(date: string, days: number) {
  const [year, month, day] = parseDay(date)!;
  return toDay(new Date(Date.UTC(year, month - 1, day + days)));
}

// Etapas para a pipeline do $lookup de appointments da unidade.
export function appointmentListPipeline({ date, q, sort, dir }: AppointmentListQuery) {
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
    // O total vem antes da ordenação para que seja possível ordenar por ele.
    { $set: { totalCents: { $sum: "$items.priceCents" } } },
    { $sort: { [SORT_PATHS[sort]]: dir === "desc" ? -1 : 1, _id: 1 } },
    {
      $project: {
        _id: 0,
        id: { $toString: "$_id" },
        hotelId: { $toString: "$hotelId" },
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
    },
  );
  return stages;
}

// Visão do workspace: os mesmos parâmetros da unidade mais o filtro de unidade ("" = todas).
export type WorkspaceAppointmentListQuery = AppointmentListQuery & { unit: string };

export function parseWorkspaceAppointmentListQuery(
  params: SearchParams,
  now = new Date(),
): WorkspaceAppointmentListQuery {
  const unit = first(params.unit);
  return {
    ...parseAppointmentListQuery(params, now),
    unit: unit && /^[0-9a-f]{24}$/i.test(unit) ? unit : "",
  };
}

// Etapas para o $lookup de appointments a partir das unidades do workspace; o filtro de
// unidade só estreita o resultado, a restrição ao workspace vem do $lookup.
export function workspaceAppointmentListPipeline({ unit, ...query }: WorkspaceAppointmentListQuery) {
  const stages = appointmentListPipeline(query);
  return unit ? [{ $match: { hotelId: new Types.ObjectId(unit) } }, ...stages] : stages;
}
