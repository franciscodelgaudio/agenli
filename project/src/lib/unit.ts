import { parseRevenueShare, type RevenueShare, type RevenueShareError } from "@/lib/revenue-share";

const MAX_NAME_LENGTH = 80;

export type CreateUnitError =
  | "invalid_input"
  | "invalid_name"
  | "name_too_long"
  | "invalid_avatar_url"
  | "invalid_ownership"
  | RevenueShareError
  | "workspace_not_found";

export type CreateUnitResult =
  | { ok: true; unitId: string }
  | { ok: false; error: CreateUnitError };

function isHttpUrl(value: string) {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

type UnitInputError = Exclude<CreateUnitError, "workspace_not_found">;

// revenueShare é null quando a unidade funciona em espaço próprio.
type UnitInput = { name: string; avatarUrl: string | null; revenueShare: RevenueShare | null };

// Valida e normaliza nome, avatarUrl e regra de repasse; avatarUrl vazia vira null.
// A regra só é lida quando a unidade funciona dentro de um estabelecimento parceiro.
function parseUnitInput(input: unknown): ({ ok: true } & UnitInput) | { ok: false; error: UnitInputError } {
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

export async function createUnit(
  input: unknown,
  workspaceId: string | null | undefined,
  insert: (data: {
    name: string;
    avatarUrl?: string;
    revenueShare?: RevenueShare;
    workspaceId: string;
  }) => Promise<{ id: string }>,
): Promise<CreateUnitResult> {
  if (!workspaceId) return { ok: false, error: "workspace_not_found" };

  const parsed = parseUnitInput(input);
  if (!parsed.ok) return parsed;

  const unit = await insert({
    name: parsed.name,
    ...(parsed.avatarUrl && { avatarUrl: parsed.avatarUrl }),
    ...(parsed.revenueShare && { revenueShare: parsed.revenueShare }),
    workspaceId,
  });
  return { ok: true, unitId: unit.id };
}

export type UpdateUnitError = UnitInputError | "unit_not_found";

export type UpdateUnitResult = { ok: true } | { ok: false; error: UpdateUnitError };

// update devolve false quando a unidade não existe (ou não é do workspace).
export async function updateUnit(
  input: unknown,
  unitId: string | null | undefined,
  update: (unitId: string, data: UnitInput) => Promise<boolean>,
): Promise<UpdateUnitResult> {
  if (!unitId) return { ok: false, error: "unit_not_found" };

  const parsed = parseUnitInput(input);
  if (!parsed.ok) return parsed;

  const { name, avatarUrl, revenueShare } = parsed;
  const found = await update(unitId, { name, avatarUrl, revenueShare });
  return found ? { ok: true } : { ok: false, error: "unit_not_found" };
}

export type DeleteUnitResult = { ok: true } | { ok: false; error: "unit_not_found" };

// remove devolve false quando a unidade não existe (ou não é do workspace).
export async function deleteUnit(
  unitId: string | null | undefined,
  remove: (unitId: string) => Promise<boolean>,
): Promise<DeleteUnitResult> {
  if (!unitId) return { ok: false, error: "unit_not_found" };

  const found = await remove(unitId);
  return found ? { ok: true } : { ok: false, error: "unit_not_found" };
}
