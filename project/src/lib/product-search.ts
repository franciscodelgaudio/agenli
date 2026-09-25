import { Types, type PipelineStage } from "mongoose";
import { escapeRegex } from "@/lib/unit-list";

export const PRODUCT_SEARCH_LIMIT = 20;
// Tamanho máximo do nome do produto; buscar além disso não encontraria nada.
const MAX_QUERY_LENGTH = 80;

// Busca do seletor de produtos: poucos por vez, só id e nome. A unidade e a ordem por nome
// usam o índice { unitId: 1, name: 1 }; o trecho do nome é conferido nas chaves do índice.
export function productSearchPipeline(unitId: string, q: string): PipelineStage[] {
  const match: Record<string, unknown> = { unitId: new Types.ObjectId(unitId) };
  const term = q.trim().slice(0, MAX_QUERY_LENGTH);
  if (term) match.name = { $regex: escapeRegex(term), $options: "i" };
  return [
    { $match: match },
    { $sort: { name: 1, _id: 1 } },
    { $limit: PRODUCT_SEARCH_LIMIT },
    { $project: { _id: 0, id: { $toString: "$_id" }, name: 1 } },
  ];
}
