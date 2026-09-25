import { describe, it, expect, vi } from "vitest";
import { updateUnitMemberPay } from "@/lib/unit-member";
import type { MemberRole } from "@/lib/member-role";

const MEMBER_ID = "64b7f0c2a1b2c3d4e5f60721";

describe("updateUnitMemberPay", () => {
  // findMember só encontra quem está vinculada à unidade.
  function makeDeps(member: { id: string; role: MemberRole } | null = { id: MEMBER_ID, role: "massage_therapist" }) {
    return {
      findMember: vi.fn().mockResolvedValue(member),
      update: vi.fn().mockResolvedValue(undefined),
    };
  }

  it("dono define comissão para uma massagista; o salário é limpo", async () => {
    const deps = makeDeps();

    const result = await updateUnitMemberPay(
      { pay: "commission", commissionPercent: " 40.25 ", salary: "1500.00" },
      MEMBER_ID,
      { actorRole: "owner" },
      deps,
    );

    expect(result).toEqual({ ok: true });
    expect(deps.findMember).toHaveBeenCalledWith(MEMBER_ID);
    expect(deps.update).toHaveBeenCalledWith(MEMBER_ID, { commissionPercent: 40.25, salaryCents: null });
  });

  it("dono define salário mensal para uma massagista; a comissão é limpa", async () => {
    const deps = makeDeps();

    const result = await updateUnitMemberPay(
      { pay: "salary", commissionPercent: "30", salary: " 2500.50 " },
      MEMBER_ID,
      { actorRole: "owner" },
      deps,
    );

    expect(result).toEqual({ ok: true });
    expect(deps.update).toHaveBeenCalledWith(MEMBER_ID, { commissionPercent: null, salaryCents: 250_050 });
  });

  it.each(["commission", "salary"] as const)("admin define %s para uma recepcionista", async (pay) => {
    const deps = makeDeps({ id: MEMBER_ID, role: "receptionist" });

    const result = await updateUnitMemberPay(
      { pay, commissionPercent: "5", salary: "1800" },
      MEMBER_ID,
      { actorRole: "admin" },
      deps,
    );

    expect(result).toEqual({ ok: true });
    expect(deps.update).toHaveBeenCalledWith(
      MEMBER_ID,
      pay === "commission" ? { commissionPercent: 5, salaryCents: null } : { commissionPercent: null, salaryCents: 180_000 },
    );
  });

  it.each(["0", "100", "35.5"])("aceita comissão %s", async (commissionPercent) => {
    const deps = makeDeps();

    const result = await updateUnitMemberPay({ pay: "commission", commissionPercent }, MEMBER_ID, { actorRole: "owner" }, deps);

    expect(result).toEqual({ ok: true });
    expect(deps.update).toHaveBeenCalledWith(MEMBER_ID, { commissionPercent: Number(commissionPercent), salaryCents: null });
  });

  it.each([null, "", "abc", "100.01", "-5", "10.123"])("comissão %j → invalid_commission", async (commissionPercent) => {
    const deps = makeDeps();

    const result = await updateUnitMemberPay({ pay: "commission", commissionPercent }, MEMBER_ID, { actorRole: "owner" }, deps);

    expect(result).toEqual({ ok: false, error: "invalid_commission" });
    expect(deps.update).not.toHaveBeenCalled();
  });

  it.each([null, "", "abc", "0", "0.00", "-100", "10.123"])("salário %j → invalid_salary", async (salary) => {
    const deps = makeDeps();

    const result = await updateUnitMemberPay({ pay: "salary", salary }, MEMBER_ID, { actorRole: "owner" }, deps);

    expect(result).toEqual({ ok: false, error: "invalid_salary" });
    expect(deps.update).not.toHaveBeenCalled();
  });

  it("admin não define a remuneração de massagista", async () => {
    const deps = makeDeps();

    const result = await updateUnitMemberPay({ pay: "salary", salary: "2000" }, MEMBER_ID, { actorRole: "admin" }, deps);

    expect(result).toEqual({ ok: false, error: "forbidden" });
    expect(deps.update).not.toHaveBeenCalled();
  });

  it("retorna workspace_not_found sem buscar quando o usuário não tem acesso", async () => {
    const deps = makeDeps();

    const result = await updateUnitMemberPay({ pay: "commission", commissionPercent: "10" }, MEMBER_ID, { actorRole: null }, deps);

    expect(result).toEqual({ ok: false, error: "workspace_not_found" });
    expect(deps.findMember).not.toHaveBeenCalled();
  });

  it.each(["massage_therapist", "receptionist"] as const)("%s não gerencia a equipe → forbidden", async (actorRole) => {
    const deps = makeDeps({ id: MEMBER_ID, role: "receptionist" });

    const result = await updateUnitMemberPay({ pay: "commission", commissionPercent: "10" }, MEMBER_ID, { actorRole }, deps);

    expect(result).toEqual({ ok: false, error: "forbidden" });
    expect(deps.findMember).not.toHaveBeenCalled();
  });

  it.each([null, undefined, ""])("memberId %j → member_not_found sem buscar", async (memberId) => {
    const deps = makeDeps();

    const result = await updateUnitMemberPay({ pay: "commission", commissionPercent: "10" }, memberId, { actorRole: "owner" }, deps);

    expect(result).toEqual({ ok: false, error: "member_not_found" });
    expect(deps.findMember).not.toHaveBeenCalled();
  });

  it("membro inexistente ou não vinculado à unidade → member_not_found", async () => {
    const deps = makeDeps(null);

    const result = await updateUnitMemberPay({ pay: "commission", commissionPercent: "10" }, MEMBER_ID, { actorRole: "owner" }, deps);

    expect(result).toEqual({ ok: false, error: "member_not_found" });
    expect(deps.update).not.toHaveBeenCalled();
  });

  it.each([null, "texto", {}, { pay: "bonus" }, { pay: 1 }])("entrada %j → invalid_input", async (input) => {
    const deps = makeDeps();

    const result = await updateUnitMemberPay(input, MEMBER_ID, { actorRole: "owner" }, deps);

    expect(result).toEqual({ ok: false, error: "invalid_input" });
    expect(deps.findMember).not.toHaveBeenCalled();
  });
});
