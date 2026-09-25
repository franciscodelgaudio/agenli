import { describe, it, expect, vi } from "vitest";
import { updateUnitMember } from "@/lib/unit-member";
import type { MemberRole } from "@/lib/member-role";

const MEMBER_ID = "64b7f0c2a1b2c3d4e5f60721";

describe("updateUnitMember", () => {
  function makeDeps(member: { id: string; role: MemberRole } | null = { id: MEMBER_ID, role: "massage_therapist" }) {
    return {
      findMember: vi.fn().mockResolvedValue(member),
      update: vi.fn().mockResolvedValue(undefined),
    };
  }

  it("dono vincula uma massagista à unidade com a comissão", async () => {
    const deps = makeDeps();

    const result = await updateUnitMember(
      { linked: true, commissionPercent: " 40.25 " },
      MEMBER_ID,
      { actorRole: "owner" },
      deps,
    );

    expect(result).toEqual({ ok: true });
    expect(deps.findMember).toHaveBeenCalledWith(MEMBER_ID);
    expect(deps.update).toHaveBeenCalledWith(MEMBER_ID, { linked: true, commissionPercent: 40.25 });
  });

  it.each(["0", "100", "35.5"])("aceita comissão %s", async (commissionPercent) => {
    const deps = makeDeps();

    const result = await updateUnitMember({ linked: true, commissionPercent }, MEMBER_ID, { actorRole: "owner" }, deps);

    expect(result).toEqual({ ok: true });
    expect(deps.update).toHaveBeenCalledWith(MEMBER_ID, { linked: true, commissionPercent: Number(commissionPercent) });
  });

  it.each([null, "", "abc", "100.01", "-5", "10.123"])(
    "massagista com comissão %j → invalid_commission",
    async (commissionPercent) => {
      const deps = makeDeps();

      const result = await updateUnitMember({ linked: true, commissionPercent }, MEMBER_ID, { actorRole: "owner" }, deps);

      expect(result).toEqual({ ok: false, error: "invalid_commission" });
      expect(deps.update).not.toHaveBeenCalled();
    },
  );

  it("dono desvincula uma massagista sem precisar de comissão", async () => {
    const deps = makeDeps();

    const result = await updateUnitMember({ linked: false }, MEMBER_ID, { actorRole: "owner" }, deps);

    expect(result).toEqual({ ok: true });
    expect(deps.update).toHaveBeenCalledWith(MEMBER_ID, { linked: false });
  });

  it.each(["admin", "receptionist"] as const)("admin vincula %s sem comissão (a enviada é ignorada)", async (role) => {
    const deps = makeDeps({ id: MEMBER_ID, role });

    const result = await updateUnitMember(
      { linked: true, commissionPercent: "30" },
      MEMBER_ID,
      { actorRole: "admin" },
      deps,
    );

    expect(result).toEqual({ ok: true });
    expect(deps.update).toHaveBeenCalledWith(MEMBER_ID, { linked: true, commissionPercent: null });
  });

  it("admin não pode vincular nem desvincular massagista", async () => {
    for (const linked of [true, false]) {
      const deps = makeDeps();

      const result = await updateUnitMember(
        { linked, commissionPercent: "30" },
        MEMBER_ID,
        { actorRole: "admin" },
        deps,
      );

      expect(result).toEqual({ ok: false, error: "forbidden" });
      expect(deps.update).not.toHaveBeenCalled();
    }
  });

  it("retorna workspace_not_found sem buscar quando o usuário não tem acesso", async () => {
    const deps = makeDeps();

    const result = await updateUnitMember({ linked: true }, MEMBER_ID, { actorRole: null }, deps);

    expect(result).toEqual({ ok: false, error: "workspace_not_found" });
    expect(deps.findMember).not.toHaveBeenCalled();
  });

  it.each(["massage_therapist", "receptionist"] as const)("%s não gerencia a equipe → forbidden", async (actorRole) => {
    const deps = makeDeps({ id: MEMBER_ID, role: "receptionist" });

    const result = await updateUnitMember({ linked: true }, MEMBER_ID, { actorRole }, deps);

    expect(result).toEqual({ ok: false, error: "forbidden" });
    expect(deps.findMember).not.toHaveBeenCalled();
  });

  it.each([null, undefined, ""])("memberId %j → member_not_found sem buscar", async (memberId) => {
    const deps = makeDeps();

    const result = await updateUnitMember({ linked: true }, memberId, { actorRole: "owner" }, deps);

    expect(result).toEqual({ ok: false, error: "member_not_found" });
    expect(deps.findMember).not.toHaveBeenCalled();
  });

  it("membro inexistente → member_not_found", async () => {
    const deps = makeDeps(null);

    const result = await updateUnitMember({ linked: false }, MEMBER_ID, { actorRole: "owner" }, deps);

    expect(result).toEqual({ ok: false, error: "member_not_found" });
    expect(deps.update).not.toHaveBeenCalled();
  });

  it.each([null, "texto", { linked: "on" }, { linked: 1 }])("entrada %j → invalid_input", async (input) => {
    const deps = makeDeps();

    const result = await updateUnitMember(input, MEMBER_ID, { actorRole: "owner" }, deps);

    expect(result).toEqual({ ok: false, error: "invalid_input" });
    expect(deps.findMember).not.toHaveBeenCalled();
  });
});
