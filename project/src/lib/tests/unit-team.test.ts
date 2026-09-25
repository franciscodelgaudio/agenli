import { describe, it, expect } from "vitest";
import { planUnitTeam } from "@/lib/unit-team";
import type { MemberRole } from "@/lib/member-role";

const member = (id: string, role: MemberRole, linked = false) => ({ id, role, linked });

// Ana e Bia são massagistas; Rita é recepcionista; Alice é administradora.
const MEMBERS = [
  member("ana", "massage_therapist", true),
  member("bia", "massage_therapist"),
  member("rita", "receptionist", true),
  member("rosa", "receptionist"),
  member("alice", "admin"),
];

describe("planUnitTeam", () => {
  it("dono vincula as selecionadas que ainda não estão e desvincula as que saíram", () => {
    const result = planUnitTeam(["bia", "rita", "rosa"], MEMBERS, "owner");

    expect(result).toEqual({ ok: true, link: ["bia", "rosa"], unlink: ["ana"] });
  });

  it("mantém quem já estava vinculada e continua selecionada (sem vincular de novo)", () => {
    const result = planUnitTeam(["ana", "rita"], MEMBERS, "owner");

    expect(result).toEqual({ ok: true, link: [], unlink: [] });
  });

  it("nenhuma selecionada desvincula todas as massagistas e recepcionistas", () => {
    const result = planUnitTeam([], MEMBERS, "owner");

    expect(result).toEqual({ ok: true, link: [], unlink: ["ana", "rita"] });
  });

  it("ids repetidos contam uma vez só", () => {
    const result = planUnitTeam(["bia", "bia", "ana", "rita"], MEMBERS, "owner");

    expect(result).toEqual({ ok: true, link: ["bia"], unlink: [] });
  });

  it("administradora vinculada antes não é desvinculada (não aparece na seleção)", () => {
    const members = [member("alice", "admin", true), member("rita", "receptionist")];

    const result = planUnitTeam(["rita"], members, "owner");

    expect(result).toEqual({ ok: true, link: ["rita"], unlink: [] });
  });

  it("admin só altera recepcionistas: massagistas enviadas são ignoradas e as vinculadas continuam", () => {
    const result = planUnitTeam(["bia", "rosa"], MEMBERS, "admin");

    expect(result).toEqual({ ok: true, link: ["rosa"], unlink: ["rita"] });
  });

  it.each([["alice"], ["desconhecida"]])("id %j fora das massagistas e recepcionistas → invalid_team", (id) => {
    expect(planUnitTeam(["bia", id], MEMBERS, "owner")).toEqual({ ok: false, error: "invalid_team" });
  });

  it.each([null, undefined, "bia", [1], ["bia", null]])("seleção %j → invalid_input", (selected) => {
    expect(planUnitTeam(selected, MEMBERS, "owner")).toEqual({ ok: false, error: "invalid_input" });
  });

  it("sem acesso ao workspace → workspace_not_found", () => {
    expect(planUnitTeam(["bia"], MEMBERS, null)).toEqual({ ok: false, error: "workspace_not_found" });
  });

  it.each(["massage_therapist", "receptionist"] as const)("%s não gerencia a equipe → forbidden", (actorRole) => {
    expect(planUnitTeam(["rosa"], MEMBERS, actorRole)).toEqual({ ok: false, error: "forbidden" });
  });
});
