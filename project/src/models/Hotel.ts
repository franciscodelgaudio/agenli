import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { connectOnUse } from "@/lib/mongoose";
import { REVENUE_SHARE_MODES, REVENUE_SHARE_PERIODS } from "@/lib/revenue-share";

// upToCents é inclusivo; a última faixa fica sem limite (null).
const revenueShareTierSchema = new Schema(
  {
    upToCents: { type: Number, default: null, min: 1 },
    percent: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false },
);

// Parte do faturamento que fica com o estabelecimento parceiro onde a unidade funciona.
const revenueShareSchema = new Schema(
  {
    period: { type: String, enum: REVENUE_SHARE_PERIODS, required: true },
    mode: { type: String, enum: REVENUE_SHARE_MODES, required: true },
    tiers: { type: [revenueShareTierSchema], required: true },
  },
  { _id: false },
);

const hotelSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    avatarUrl: { type: String, trim: true },
    // Ausente quando a unidade funciona em espaço próprio.
    revenueShare: { type: revenueShareSchema },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
  },
  { collection: "hotels", timestamps: true },
);

hotelSchema.plugin(connectOnUse);

export type HotelDoc = InferSchemaType<typeof hotelSchema>;

export const Hotel: Model<HotelDoc> = models.Hotel ?? model<HotelDoc>("Hotel", hotelSchema);
