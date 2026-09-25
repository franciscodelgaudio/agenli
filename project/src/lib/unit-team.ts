import { canManageMembers, type MemberRole, type WorkspaceRole } from "@/lib/member-role";

// Equipe escolhida no formulário da unidade: massagistas e recepcionistas.
// Só o proprietário vincula massagistas; para o admin elas ficam como estão.

export type PlanUnitTeamError = "workspace_not_found" | "forbidden" | "invalid_input" | "invalid_team";

export type UnitTeamPlan = { ok: true; link: string[]; unlink: string[] } | { ok: false; error: PlanUnitTeamError };

type TeamMember = { id: string; role: MemberRole; linked: boolean };

export function planUnitTeam(selected: unknown, members: TeamMember[], actorRole: WorkspaceRole | null): UnitTeamPlan {
  if (!actorRole) return { ok: false, error: "workspace_not_found" };
  if (!canManageMembers(actorRole)) return { ok: false, error: "forbidden" };
  if (!Array.isArray(selected) || !selected.every((id) => typeof id === "string")) {
    return { ok: false, error: "invalid_input" };
  }

  const ids = new Set<string>(selected);
  const selectable = members.filter((member) => member.role !== "admin");
  const selectableIds = new Set(selectable.map((member) => member.id));
  if ([...ids].some((id) => !selectableIds.has(id))) return { ok: false, error: "invalid_team" };

  const editable = selectable.filter((member) => actorRole === "owner" || member.role !== "massage_therapist");
  return {
    ok: true,
    link: editable.filter((member) => !member.linked && ids.has(member.id)).map((member) => member.id),
    unlink: editable.filter((member) => member.linked && !ids.has(member.id)).map((member) => member.id),
  };
}
