import { parsePriceCents } from "@/lib/service";

const MAX_NAME_LENGTH = 80;
const MAX_NOTES_LENGTH = 500;
const MAX_QUANTITY = 1_000_000;

export type ProductInputError =
  | "invalid_input"
  | "invalid_name"
  | "name_too_long"
  | "invalid_quantity"
  | "invalid_cost"
  | "notes_too_long"
  | "invalid_rating";

// Opcionais vazios ficam null para que editar consiga apagar o valor salvo.
export type ProductData = {
  name: string;
  quantity: number;
  costCents: number;
  notes: string | null;
  rating: number | null;
  avatarUrl: string | null;
};

function parseQuantity(value: string) {
  if (!/^\d+$/.test(value)) return null;
  const quantity = Number(value);
  return quantity <= MAX_QUANTITY ? quantity : null;
}

// Avaliação em estrelas, de 1 a 5.
function parseRating(value: string) {
  return /^[1-5]$/.test(value) ? Number(value) : null;
}

function isOptionalString(value: unknown): value is string | null | undefined {
  return value == null || typeof value === "string";
}

// Valida e normaliza os campos como chegam do FormData (strings).
function parseProductInput(
  input: unknown,
): ({ ok: true } & ProductData) | { ok: false; error: ProductInputError } {
  const { name, quantity, cost, notes, rating, avatarUrl } = (input ?? {}) as Record<string, unknown>;
  if (typeof name !== "string" || typeof quantity !== "string" || typeof cost !== "string") {
    return { ok: false, error: "invalid_input" };
  }
  if (!isOptionalString(notes) || !isOptionalString(rating) || !isOptionalString(avatarUrl)) {
    return { ok: false, error: "invalid_input" };
  }

  const normalizedName = name.trim();
  if (!normalizedName) return { ok: false, error: "invalid_name" };
  if (normalizedName.length > MAX_NAME_LENGTH) return { ok: false, error: "name_too_long" };

  const parsedQuantity = parseQuantity(quantity.trim());
  if (parsedQuantity === null) return { ok: false, error: "invalid_quantity" };

  const costCents = parsePriceCents(cost.trim());
  if (costCents === null) return { ok: false, error: "invalid_cost" };

  const normalizedNotes = notes?.trim() || null;
  if (normalizedNotes && normalizedNotes.length > MAX_NOTES_LENGTH) return { ok: false, error: "notes_too_long" };

  const trimmedRating = rating?.trim();
  const parsedRating = trimmedRating ? parseRating(trimmedRating) : null;
  if (trimmedRating && parsedRating === null) return { ok: false, error: "invalid_rating" };

  return {
    ok: true,
    name: normalizedName,
    quantity: parsedQuantity,
    costCents,
    notes: normalizedNotes,
    rating: parsedRating,
    avatarUrl: avatarUrl?.trim() || null,
  };
}

export type CreateProductError = ProductInputError | "unit_not_found";

export type CreateProductResult =
  | { ok: true; productId: string }
  | { ok: false; error: CreateProductError };

export async function createProduct(
  input: unknown,
  unitId: string | null | undefined,
  insert: (data: ProductData & { unitId: string }) => Promise<{ id: string }>,
): Promise<CreateProductResult> {
  if (!unitId) return { ok: false, error: "unit_not_found" };

  const parsed = parseProductInput(input);
  if (!parsed.ok) return parsed;

  const { name, quantity, costCents, notes, rating, avatarUrl } = parsed;
  const product = await insert({ name, quantity, costCents, notes, rating, avatarUrl, unitId });
  return { ok: true, productId: product.id };
}

export type UpdateProductError = ProductInputError | "product_not_found";

export type UpdateProductResult = { ok: true } | { ok: false; error: UpdateProductError };

// update devolve false quando o produto não existe (ou não é da unidade).
export async function updateProduct(
  input: unknown,
  productId: string | null | undefined,
  update: (productId: string, data: ProductData) => Promise<boolean>,
): Promise<UpdateProductResult> {
  if (!productId) return { ok: false, error: "product_not_found" };

  const parsed = parseProductInput(input);
  if (!parsed.ok) return parsed;

  const { name, quantity, costCents, notes, rating, avatarUrl } = parsed;
  const found = await update(productId, { name, quantity, costCents, notes, rating, avatarUrl });
  return found ? { ok: true } : { ok: false, error: "product_not_found" };
}

export type DeleteProductResult = { ok: true } | { ok: false; error: "product_not_found" };

// remove devolve false quando o produto não existe (ou não é da unidade).
export async function deleteProduct(
  productId: string | null | undefined,
  remove: (productId: string) => Promise<boolean>,
): Promise<DeleteProductResult> {
  if (!productId) return { ok: false, error: "product_not_found" };

  const found = await remove(productId);
  return found ? { ok: true } : { ok: false, error: "product_not_found" };
}

export type DepleteProductResult = { ok: true } | { ok: false; error: "product_not_found" | "out_of_stock" };

// deplete registra o "acabou" e tira 1 da quantidade numa só escrita; out_of_stock quando já é zero.
export async function depleteProduct(
  productId: string | null | undefined,
  deplete: (productId: string) => Promise<"depleted" | "not_found" | "out_of_stock">,
): Promise<DepleteProductResult> {
  if (!productId) return { ok: false, error: "product_not_found" };

  const outcome = await deplete(productId);
  if (outcome === "not_found") return { ok: false, error: "product_not_found" };
  if (outcome === "out_of_stock") return { ok: false, error: "out_of_stock" };
  return { ok: true };
}
