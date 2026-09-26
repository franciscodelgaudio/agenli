import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { connectOnUse } from "@/lib/mongoose";
import { UNIT_PAGES, WORKSPACE_PAGES } from "@/lib/page-access";

// Páginas ocultas para uma função; o proprietário e administradores sempre veem tudo.
const rolePagesSchema = new Schema(
  {
    workspace: { type: [{ type: String, enum: WORKSPACE_PAGES }], default: [] },
    unit: { type: [{ type: String, enum: UNIT_PAGES }], default: [] },
  },
  { _id: false },
);

const workspaceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    avatarUrl: { type: String, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Ausente = tudo liberado.
    hiddenPages: {
      massage_therapist: { type: rolePagesSchema },
      receptionist: { type: rolePagesSchema },
    },
  },
  { collection: "workspaces", timestamps: true },
);

workspaceSchema.plugin(connectOnUse);

export type WorkspaceDoc = InferSchemaType<typeof workspaceSchema>;

export const Workspace: Model<WorkspaceDoc> =
  models.Workspace ?? model<WorkspaceDoc>("Workspace", workspaceSchema);
