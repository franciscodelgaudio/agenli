import { describe, it, expect, vi } from "vitest";
import { Types } from "mongoose";

// session.ts importa o Auth.js, que não roda fora do Next; só o pipeline importa aqui.
vi.mock("@/auth", () => ({ auth: vi.fn() }));

const { workspaceAccessStages } = await import("@/lib/session");

const WORKSPACE_ID = "64b7f0c2a1b2c3d4e5f60718";
const USER_ID = "64b7f0c2a1b2c3d4e5f60719";

describe("workspaceAccessStages", () => {
  it("encontra o workspace pelo id e calcula o papel do usuário (dono ou membro que aceitou)", () => {
    const workspaceId = new Types.ObjectId(WORKSPACE_ID);
    const userId = new Types.ObjectId(USER_ID);

    expect(workspaceAccessStages(WORKSPACE_ID, USER_ID)).toEqual([
      { $match: { _id: workspaceId } },
      {
        $lookup: {
          from: "workspace_members",
          localField: "_id",
          foreignField: "workspaceId",
          as: "membership",
          pipeline: [{ $match: { userId } }, { $limit: 1 }, { $project: { _id: 0, role: 1 } }],
        },
      },
      {
        $set: {
          role: {
            $cond: [{ $eq: ["$userId", userId] }, "owner", { $ifNull: [{ $first: "$membership.role" }, null] }],
          },
        },
      },
      { $match: { role: { $ne: null } } },
      { $unset: "membership" },
    ]);
  });

  it.each(["", "abc", "not-an-object-id"])(
    "retorna null quando o workspaceId é inválido (%j), para a página responder 404 sem ir ao banco",
    (workspaceId) => {
      expect(workspaceAccessStages(workspaceId, USER_ID)).toBeNull();
    },
  );
});
