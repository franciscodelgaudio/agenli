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

export async function createHotel(
  input: unknown,
  workspaceId: string | null | undefined,
  insert: (data: { name: string; avatarUrl?: string; workspaceId: string }) => Promise<{ id: string }>,
): Promise<CreateHotelResult> {
  if (!workspaceId) return { ok: false, error: "workspace_not_found" };

  const { name, avatarUrl } = (input ?? {}) as Record<string, unknown>;
  if (typeof name !== "string") return { ok: false, error: "invalid_input" };
  if (avatarUrl != null && typeof avatarUrl !== "string") return { ok: false, error: "invalid_input" };

  const normalizedName = name.trim();
  if (!normalizedName) return { ok: false, error: "invalid_name" };
  if (normalizedName.length > MAX_NAME_LENGTH) return { ok: false, error: "name_too_long" };

  const normalizedAvatarUrl = avatarUrl?.trim();
  if (normalizedAvatarUrl && !isHttpUrl(normalizedAvatarUrl)) {
    return { ok: false, error: "invalid_avatar_url" };
  }

  const hotel = await insert({
    name: normalizedName,
    ...(normalizedAvatarUrl && { avatarUrl: normalizedAvatarUrl }),
    workspaceId,
  });
  return { ok: true, hotelId: hotel.id };
}
