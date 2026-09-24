import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { connectOnUse } from "@/lib/mongoose";

// Agendamento de um hóspede com uma massagista numa unidade, exibido no calendário.
// Os nomes da massagista e do serviço são cópias do momento do agendamento.
const bookingSchema = new Schema(
  {
    unitId: { type: Schema.Types.ObjectId, ref: "Unit", required: true },
    // Usuário que vai atender: o proprietário ou um membro com função de massagista.
    therapistId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    therapistName: { type: String, required: true },
    guest: {
      name: { type: String, required: true, trim: true },
      room: { type: String, required: true, trim: true },
    },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    service: {
      type: new Schema(
        {
          serviceId: { type: Schema.Types.ObjectId, ref: "Service", required: true },
          serviceName: { type: String, required: true },
        },
        { _id: false },
      ),
      required: true,
    },
    // Atendimento registrado a partir deste agendamento; enquanto null, ainda pode ser editado.
    appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment", default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { collection: "bookings", timestamps: true },
);

// O calendário filtra por unidades e intervalo; a checagem de conflito, por massagista e intervalo.
bookingSchema.index({ unitId: 1, startsAt: 1 });
bookingSchema.index({ therapistId: 1, startsAt: 1 });

bookingSchema.plugin(connectOnUse);

export type BookingDoc = InferSchemaType<typeof bookingSchema>;

export const Booking: Model<BookingDoc> = models.Booking ?? model<BookingDoc>("Booking", bookingSchema);
