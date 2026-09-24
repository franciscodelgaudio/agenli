import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { connectOnUse } from "@/lib/mongoose";

// Serviço prestado numa unidade. O preço fica em centavos para evitar erro de arredondamento.
const serviceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    priceCents: { type: Number, required: true, min: 0 },
    durationMinutes: { type: Number, required: true, min: 1 },
    hotelId: { type: Schema.Types.ObjectId, ref: "Hotel", required: true, index: true },
  },
  { collection: "services", timestamps: true },
);

serviceSchema.plugin(connectOnUse);

export type ServiceDoc = InferSchemaType<typeof serviceSchema>;

export const Service: Model<ServiceDoc> = models.Service ?? model<ServiceDoc>("Service", serviceSchema);
