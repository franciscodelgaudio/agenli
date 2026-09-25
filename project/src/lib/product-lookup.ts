import { Types } from "mongoose"
import { summarizeProductUsage, type ProductUsageSummary } from "@/lib/product-usage"
import { objectIds } from "@/lib/therapist-lookup"
import { Product } from "@/models/Product"

// Para server actions: dos ids pedidos, os produtos que existem na unidade.
export async function findUnitProducts(unitId: string, ids: string[]) {
  const products = await Product.find({ _id: { $in: objectIds(ids) }, unitId }).select({ name: 1 }).lean()
  return products.map((product) => ({ id: product._id.toString(), name: product.name }))
}

// Resumo de uso dos produtos da unidade (ou de um só): atendimentos e agendamentos que os
// listaram. Agendamento que virou atendimento já conta pelo atendimento, então só entram os
// que ainda não viraram. Quem chama já conferiu o acesso à unidade.
export async function findProductUsage(unitId: string, productId?: string) {
  const usage = await Product.aggregate<{ id: string; depletedAt: Date[]; uses: Date[] }>([
    {
      $match: {
        unitId: new Types.ObjectId(unitId),
        ...(productId && { _id: new Types.ObjectId(productId) }),
      },
    },
    {
      $lookup: {
        from: "appointments",
        localField: "_id",
        foreignField: "products.productId",
        as: "appointments",
        pipeline: [{ $project: { _id: 0, at: "$performedAt" } }],
      },
    },
    {
      $lookup: {
        from: "bookings",
        localField: "_id",
        foreignField: "products.productId",
        as: "bookings",
        pipeline: [{ $match: { appointmentId: null } }, { $project: { _id: 0, at: "$startsAt" } }],
      },
    },
    {
      $project: {
        _id: 0,
        id: { $toString: "$_id" },
        depletedAt: { $ifNull: ["$depletedAt", []] },
        uses: { $concatArrays: ["$appointments.at", "$bookings.at"] },
      },
    },
  ])
  const now = new Date()
  const empty = summarizeProductUsage([], [], now)
  const byId = new Map(usage.map((u) => [u.id, summarizeProductUsage(u.uses, u.depletedAt, now)]))
  return (id: string): ProductUsageSummary => byId.get(id) ?? empty
}
