import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { connectOnUse } from "@/lib/mongoose";

// Produto em estoque numa unidade. O custo fica em centavos para evitar erro de arredondamento.
const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    costCents: { type: Number, required: true, min: 0 },
    notes: { type: String, default: null, trim: true },
    // Avaliação em estrelas (1 a 5); null = sem avaliação.
    rating: { type: Number, default: null, min: 1, max: 5 },
    // Imagem do produto (futuramente enviada para uma CDN).
    avatarUrl: { type: String, default: null, trim: true },
    // Cada vez que uma unidade do produto acabou; fecha um ciclo de uso.
    depletedAt: { type: [Date], default: [] },
    unitId: { type: Schema.Types.ObjectId, ref: "Unit", required: true },
  },
  { collection: "products", timestamps: true },
);

// Lista e busca do seletor: produtos da unidade em ordem de nome, com o trecho do nome
// conferido nas chaves do índice, sem ler os documentos.
productSchema.index({ unitId: 1, name: 1 });

productSchema.plugin(connectOnUse);

export type ProductDoc = InferSchemaType<typeof productSchema>;

export const Product: Model<ProductDoc> = models.Product ?? model<ProductDoc>("Product", productSchema);
