import { canManageMembers, type MemberRole, type WorkspaceRole } from "@/lib/member-role";
import { parsePercent } from "@/lib/revenue-share";

// Vínculo de um membro com uma unidade. Só massagistas têm comissão, e só o
// proprietário vincula ou define a comissão delas.

export type UpdateUnitMemberError =
  | "workspace_not_found"
  | "forbidden"
  | "member_not_found"
  | "invalid_input"
  | "invalid_commission";

export type UpdateUnitMemberResult = { ok: true } | { ok: false; error: UpdateUnitMemberError };

export type UnitMemberUpdate = { linked: false } | { linked: true; commissionPercent: number | null };

type UpdateUnitMemberDeps = {
  // null quando o membro não existe (ou não é do workspace).
  findMember: (memberId: string) => Promise<{ id: string; role: MemberRole } | null>;
  update: (memberId: string, data: UnitMemberUpdate) => Promise<void>;
};

export async function updateUnitMember(
  input: unknown,
  memberId: string | null | undefined,
  ctx: { actorRole: WorkspaceRole | null },
  deps: UpdateUnitMemberDeps,
): Promise<UpdateUnitMemberResult> {
  if (!ctx.actorRole) return { ok: false, error: "workspace_not_found" };
  if (!canManageMembers(ctx.actorRole)) return { ok: false, error: "forbidden" };
  if (!memberId) return { ok: false, error: "member_not_found" };

  if (input == null || typeof input !== "object") return { ok: false, error: "invalid_input" };
  const { linked, commissionPercent } = input as Record<string, unknown>;
  if (typeof linked !== "boolean") return { ok: false, error: "invalid_input" };

  const member = await deps.findMember(memberId);
  if (!member) return { ok: false, error: "member_not_found" };

  const isTherapist = member.role === "massage_therapist";
  if (isTherapist && ctx.actorRole !== "owner") return { ok: false, error: "forbidden" };

  if (!linked) {
    await deps.update(memberId, { linked: false });
    return { ok: true };
  }
  if (!isTherapist) {
    await deps.update(memberId, { linked: true, commissionPercent: null });
    return { ok: true };
  }

  const percent = typeof commissionPercent === "string" ? parsePercent(commissionPercent.trim()) : null;
  if (percent === null) return { ok: false, error: "invalid_commission" };

  await deps.update(memberId, { linked: true, commissionPercent: percent });
  return { ok: true };
}
