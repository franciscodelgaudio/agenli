const MAX_NAME_LENGTH = 80;

export type CreateHotelError =
  | "invalid_input"
  | "invalid_name"
  | "name_too_long"
  | "invalid_avatar_url"
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

// Valida e normaliza nome e avatarUrl; avatarUrl vazia vira null.
function parseHotelInput(
  input: unknown,
): { ok: true; name: string; avatarUrl: string | null } | { ok: false; error: HotelInputError } {
  const { name, avatarUrl } = (input ?? {}) as Record<string, unknown>;
  if (typeof name !== "string") return { ok: false, error: "invalid_input" };
  if (avatarUrl != null && typeof avatarUrl !== "string") return { ok: false, error: "invalid_input" };

  const normalizedName = name.trim();
  if (!normalizedName) return { ok: false, error: "invalid_name" };
  if (normalizedName.length > MAX_NAME_LENGTH) return { ok: false, error: "name_too_long" };

  const normalizedAvatarUrl = avatarUrl?.trim() || null;
  if (normalizedAvatarUrl && !isHttpUrl(normalizedAvatarUrl)) {
    return { ok: false, error: "invalid_avatar_url" };
  }

  return { ok: true, name: normalizedName, avatarUrl: normalizedAvatarUrl };
}

export async function createHotel(
  input: unknown,
  workspaceId: string | null | undefined,
  insert: (data: { name: string; avatarUrl?: string; workspaceId: string }) => Promise<{ id: string }>,
): Promise<CreateHotelResult> {
  if (!workspaceId) return { ok: false, error: "workspace_not_found" };

  const parsed = parseHotelInput(input);
  if (!parsed.ok) return parsed;

  const hotel = await insert({
    name: parsed.name,
    ...(parsed.avatarUrl && { avatarUrl: parsed.avatarUrl }),
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
  update: (hotelId: string, data: { name: string; avatarUrl: string | null }) => Promise<boolean>,
): Promise<UpdateHotelResult> {
  if (!hotelId) return { ok: false, error: "hotel_not_found" };

  const parsed = parseHotelInput(input);
  if (!parsed.ok) return parsed;

  const found = await update(hotelId, { name: parsed.name, avatarUrl: parsed.avatarUrl });
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
