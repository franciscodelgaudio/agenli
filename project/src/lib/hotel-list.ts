import type { PipelineStage } from "mongoose";

export const HOTEL_SORT_FIELDS = ["name", "createdAt", "updatedAt"] as const;

export type HotelSortField = (typeof HOTEL_SORT_FIELDS)[number];
export type SortDir = "asc" | "desc";
export type HotelListQuery = { q: string; sort: HotelSortField; dir: SortDir };

export type SearchParams = Record<string, string | string[] | undefined>;

export function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isSortField(value: string | undefined): value is HotelSortField {
  return HOTEL_SORT_FIELDS.includes(value as HotelSortField);
}

export function parseHotelListQuery(params: SearchParams): HotelListQuery {
  const sort = first(params.sort);
  return {
    q: first(params.q)?.trim() ?? "",
    sort: isSortField(sort) ? sort : "name",
    dir: first(params.dir) === "desc" ? "desc" : "asc",
  };
}

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Etapas para a pipeline do $lookup de hotels do workspace.
export function hotelListPipeline({ q, sort, dir }: HotelListQuery) {
  const stages: PipelineStage.FacetPipelineStage[] = [];
  if (q) stages.push({ $match: { name: { $regex: escapeRegex(q), $options: "i" } } });
  stages.push(
    { $sort: { [sort]: dir === "desc" ? -1 : 1, _id: 1 } },
    {
      $project: {
        _id: 0,
        id: { $toString: "$_id" },
        name: 1,
        avatarUrl: { $ifNull: ["$avatarUrl", null] },
        // Unidades em espaço próprio não têm regra de repasse.
        revenueShare: { $ifNull: ["$revenueShare", null] },
        createdAt: 1,
        updatedAt: 1,
      },
    },
  );
  return stages;
}
