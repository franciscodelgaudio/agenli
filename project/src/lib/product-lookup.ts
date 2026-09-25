import { objectIds } from "@/lib/therapist-lookup"
import { Product } from "@/models/Product"

// Para server actions: dos ids pedidos, os produtos que existem na unidade.
export async function findUnitProducts(unitId: string, ids: string[]) {
  const products = await Product.find({ _id: { $in: objectIds(ids) }, unitId }).select({ name: 1 }).lean()
  return products.map((product) => ({ id: product._id.toString(), name: product.name }))
}
