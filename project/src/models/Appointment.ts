import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { connectOnUse } from "@/lib/mongoose";

// Nome, valor e duração do serviço e o nome da massagista são cópias do momento
// do registro, para que mudanças futuras não alterem o histórico.
const appointmentItemSchema = new Schema(
  {
    serviceId: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    serviceName: { type: String, required: true },
    priceCents: { type: Number, required: true, min: 0 },
    durationMinutes: { type: Number, required: true, min: 1 },
    // _id do WorkspaceMember com função de massagista.
    therapistId: { type: Schema.Types.ObjectId, ref: "WorkspaceMember", required: true },
    therapistName: { type: String, required: true },
  },
  { _id: false },
);

// Atendimento de um hóspede numa unidade, com um ou mais serviços.
const appointmentSchema = new Schema(
  {
    hotelId: { type: Schema.Types.ObjectId, ref: "Hotel", required: true },
    performedAt: { type: Date, required: true },
    guest: {
      name: { type: String, required: true, trim: true },
      room: { type: String, required: true, trim: true },
    },
    items: { type: [appointmentItemSchema], required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { collection: "appointments", timestamps: true },
);

// A listagem sempre filtra por unidade e dia.
appointmentSchema.index({ hotelId: 1, performedAt: 1 });

appointmentSchema.plugin(connectOnUse);

export type AppointmentDoc = InferSchemaType<typeof appointmentSchema>;

export const Appointment: Model<AppointmentDoc> =
  models.Appointment ?? model<AppointmentDoc>("Appointment", appointmentSchema);
