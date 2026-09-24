import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { connectOnUse } from "@/lib/mongoose";
import { MEMBER_ROLES } from "@/lib/member-role";

// Membro ou convite pendente de um workspace. Enquanto userId é null, é um
// convite: tokenHash/expiresAt identificam o link enviado por email. Ao aceitar,
// userId é preenchido e o token é removido. O dono não tem documento aqui.
const workspaceMemberSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: MEMBER_ROLES, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    tokenHash: { type: String, unique: true, sparse: true },
    expiresAt: Date,
    acceptedAt: Date,
  },
  { collection: "workspace_members", timestamps: true },
);

// Um email só pode ser convidado/membro uma vez por workspace.
workspaceMemberSchema.index({ workspaceId: 1, email: 1 }, { unique: true });

workspaceMemberSchema.plugin(connectOnUse);

export type WorkspaceMemberDoc = InferSchemaType<typeof workspaceMemberSchema>;

export const WorkspaceMember: Model<WorkspaceMemberDoc> =
  models.WorkspaceMember ?? model<WorkspaceMemberDoc>("WorkspaceMember", workspaceMemberSchema);
