import { canManageMembers, type MemberRole, type WorkspaceRole } from "@/lib/member-role";
import { parsePercent } from "@/lib/revenue-share";
import { parsePriceCents } from "@/lib/service";

// Remuneração de quem trabalha na unidade: comissão (%) ou salário mensal, nunca os dois.
// Só o proprietário define a de massagistas.

export type UpdateUnitMemberPayError =
  | "workspace_not_found"
  | "forbidden"
  | "member_not_found"
  | "invalid_input"
  | "invalid_commission"
  | "invalid_salary";

export type UpdateUnitMemberPayResult = { ok: true } | { ok: false; error: UpdateUnitMemberPayError };

export type UnitMemberPay = { commissionPercent: number | null; salaryCents: number | null };

type UpdateUnitMemberPayDeps = {
  // null quando o membro não existe, não é do workspace ou não está vinculado à unidade.
  findMember: (memberId: string) => Promise<{ id: string; role: MemberRole } | null>;
  update: (memberId: string, data: UnitMemberPay) => Promise<void>;
};

function parse(value: unknown, parser: (value: string) => number | null) {
  return typeof value === "string" ? parser(value.trim()) : null;
}

export async function updateUnitMemberPay(
  input: unknown,
  memberId: string | null | undefined,
  ctx: { actorRole: WorkspaceRole | null },
  deps: UpdateUnitMemberPayDeps,
): Promise<UpdateUnitMemberPayResult> {
  if (!ctx.actorRole) return { ok: false, error: "workspace_not_found" };
  if (!canManageMembers(ctx.actorRole)) return { ok: false, error: "forbidden" };
  if (!memberId) return { ok: false, error: "member_not_found" };

  if (input == null || typeof input !== "object") return { ok: false, error: "invalid_input" };
  const { pay, commissionPercent, salary } = input as Record<string, unknown>;
  if (pay !== "commission" && pay !== "salary") return { ok: false, error: "invalid_input" };

  const member = await deps.findMember(memberId);
  if (!member) return { ok: false, error: "member_not_found" };
  if (member.role === "massage_therapist" && ctx.actorRole !== "owner") return { ok: false, error: "forbidden" };

  if (pay === "commission") {
    const percent = parse(commissionPercent, parsePercent);
    if (percent === null) return { ok: false, error: "invalid_commission" };
    await deps.update(memberId, { commissionPercent: percent, salaryCents: null });
    return { ok: true };
  }

  const salaryCents = parse(salary, parsePriceCents);
  if (!salaryCents) return { ok: false, error: "invalid_salary" };
  await deps.update(memberId, { commissionPercent: null, salaryCents });
  return { ok: true };
}
