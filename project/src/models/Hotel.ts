import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const hotelSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    avatarUrl: { type: String, trim: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
  },
  { collection: "hotels", timestamps: true },
);

export type HotelDoc = InferSchemaType<typeof hotelSchema>;

export const Hotel: Model<HotelDoc> = models.Hotel ?? model<HotelDoc>("Hotel", hotelSchema);
