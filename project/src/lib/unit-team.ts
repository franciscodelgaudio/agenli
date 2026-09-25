import type { PipelineStage } from "mongoose";
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

// Massagista ou recepcionista que pode ser escolhida no formulário da unidade.
export type TeamCandidate = {
  id: string;
  // Nome da conta; sem conta (convite pendente) ou sem nome, o email.
  name: string;
  image: string | null;
  role: "massage_therapist" | "receptionist";
  pending: boolean;
  unitIds: string[];
};

// $lookup a partir do workspace: massagistas e recepcionistas (convites pendentes
// inclusive), com as unidades em que trabalham, ordenadas pelo nome.
export function teamCandidatesLookup(as = "team"): PipelineStage.Lookup {
  return {
    $lookup: {
      from: "workspace_members",
      localField: "_id",
      foreignField: "workspaceId",
      as,
      pipeline: [
        { $match: { role: { $in: ["massage_therapist", "receptionist"] } } },
        { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
        { $set: { user: { $first: "$user" } } },
        {
          $project: {
            _id: 0,
            id: { $toString: "$_id" },
            role: 1,
            name: { $ifNull: ["$user.name", { $ifNull: ["$user.email", "$email"] }] },
            image: { $ifNull: ["$user.image", null] },
            pending: { $eq: [{ $ifNull: ["$userId", null] }, null] },
            unitIds: { $map: { input: { $ifNull: ["$units", []] }, in: { $toString: "$$this.unitId" } } },
          },
        },
        { $sort: { name: 1 } },
      ],
    },
  };
}
