import { parseRevenueShare, type RevenueShare, type RevenueShareError } from "@/lib/revenue-share";

const MAX_NAME_LENGTH = 80;

export type CreateHotelError =
  | "invalid_input"
  | "invalid_name"
  | "name_too_long"
  | "invalid_avatar_url"
  | "invalid_ownership"
  | RevenueShareError
  | "workspace_not_found";

export type CreateHotelResult =
  | { ok: true; hotelId: string }
  | { ok: false; error: CreateHotelError };

function isHttpUrl(value: string) {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

type HotelInputError = Exclude<CreateHotelError, "workspace_not_found">;

// revenueShare é null quando a unidade funciona em espaço próprio.
type HotelInput = { name: string; avatarUrl: string | null; revenueShare: RevenueShare | null };

// Valida e normaliza nome, avatarUrl e regra de repasse; avatarUrl vazia vira null.
// A regra só é lida quando a unidade funciona dentro de um estabelecimento parceiro.
function parseHotelInput(input: unknown): ({ ok: true } & HotelInput) | { ok: false; error: HotelInputError } {
  const { name, avatarUrl, ownership, revenueShare } = (input ?? {}) as Record<string, unknown>;
  if (typeof name !== "string") return { ok: false, error: "invalid_input" };
  if (avatarUrl != null && typeof avatarUrl !== "string") return { ok: false, error: "invalid_input" };

  const normalizedName = name.trim();
  if (!normalizedName) return { ok: false, error: "invalid_name" };
  if (normalizedName.length > MAX_NAME_LENGTH) return { ok: false, error: "name_too_long" };

  const normalizedAvatarUrl = avatarUrl?.trim() || null;
  if (normalizedAvatarUrl && !isHttpUrl(normalizedAvatarUrl)) {
    return { ok: false, error: "invalid_avatar_url" };
  }

  if (ownership === "own") {
    return { ok: true, name: normalizedName, avatarUrl: normalizedAvatarUrl, revenueShare: null };
  }
  if (ownership !== "partner") return { ok: false, error: "invalid_ownership" };

  const share = parseRevenueShare(revenueShare);
  if (!share.ok) return share;

  return { ok: true, name: normalizedName, avatarUrl: normalizedAvatarUrl, revenueShare: share.value };
}

export async function createHotel(
  input: unknown,
  workspaceId: string | null | undefined,
  insert: (data: {
    name: string;
    avatarUrl?: string;
    revenueShare?: RevenueShare;
    workspaceId: string;
  }) => Promise<{ id: string }>,
): Promise<CreateHotelResult> {
  if (!workspaceId) return { ok: false, error: "workspace_not_found" };

  const parsed = parseHotelInput(input);
  if (!parsed.ok) return parsed;

  const hotel = await insert({
    name: parsed.name,
    ...(parsed.avatarUrl && { avatarUrl: parsed.avatarUrl }),
    ...(parsed.revenueShare && { revenueShare: parsed.revenueShare }),
    workspaceId,
  });
  return { ok: true, hotelId: hotel.id };
}

export type UpdateHotelError = HotelInputError | "hotel_not_found";

export type UpdateHotelResult = { ok: true } | { ok: false; error: UpdateHotelError };

// update devolve false quando o hotel não existe (ou não é do workspace).
export async function updateHotel(
  input: unknown,
  hotelId: string | null | undefined,
  update: (hotelId: string, data: HotelInput) => Promise<boolean>,
): Promise<UpdateHotelResult> {
  if (!hotelId) return { ok: false, error: "hotel_not_found" };

  const parsed = parseHotelInput(input);
  if (!parsed.ok) return parsed;

  const { name, avatarUrl, revenueShare } = parsed;
  const found = await update(hotelId, { name, avatarUrl, revenueShare });
  return found ? { ok: true } : { ok: false, error: "hotel_not_found" };
}

export type DeleteHotelResult = { ok: true } | { ok: false; error: "hotel_not_found" };

// remove devolve false quando o hotel não existe (ou não é do workspace).
export async function deleteHotel(
  hotelId: string | null | undefined,
  remove: (hotelId: string) => Promise<boolean>,
): Promise<DeleteHotelResult> {
  if (!hotelId) return { ok: false, error: "hotel_not_found" };

  const found = await remove(hotelId);
  return found ? { ok: true } : { ok: false, error: "hotel_not_found" };
}
