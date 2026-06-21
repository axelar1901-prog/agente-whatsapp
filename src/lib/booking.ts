import { getBookingState, setBookingState, resetBookingState } from "./db";
import { getAvailableSlots, createAppointment, isCalendarReady, TimeSlot } from "./google-calendar";

const BOOKING_TRIGGERS = [
  "cita", "agendar", "consulta", "appointment", "turno", "quiero una cita",
  "necesito cita", "quiero ver al doctor", "quiero ver al médico", "reservar",
];

export function isBookingIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return BOOKING_TRIGGERS.some((t) => lower.includes(t));
}

export async function handleBookingFlow(
  conversationId: number,
  phone: string,
  text: string
): Promise<string | null> {
  if (!isCalendarReady()) return null;

  const state = getBookingState(conversationId);
  const lower = text.toLowerCase().trim();

  // Cancelar en cualquier momento
  if (lower === "cancelar" || lower === "cancel") {
    resetBookingState(conversationId);
    return "De acuerdo, cancelé el proceso de agendamiento. ¿En qué más puedo ayudarte?";
  }

  // Iniciar flujo
  if (state.step === "idle" && isBookingIntent(text)) {
    setBookingState(conversationId, { step: "ask_name" });
    return "Con gusto agendo su cita. ¿Me puede dar su nombre completo, por favor?";
  }

  if (state.step === "ask_name") {
    if (text.length < 3) return "¿Me podría dar su nombre completo?";
    setBookingState(conversationId, { step: "ask_reason", patient_name: text.trim() });
    return `Gracias, ${text.trim().split(" ")[0]}. ¿Cuál es el motivo de su consulta?`;
  }

  if (state.step === "ask_reason") {
    setBookingState(conversationId, { step: "show_slots", reason: text.trim() });

    const slots = await getAvailableSlots(7);
    if (slots.length === 0) {
      resetBookingState(conversationId);
      return "Lo siento, no encontré horarios disponibles en los próximos 7 días. Por favor llame al consultorio para coordinar su cita.";
    }

    setBookingState(conversationId, { slots_json: JSON.stringify(slots.map(s => ({ start: s.start, end: s.end, label: s.label }))) });

    const list = slots.map((s, i) => `${i + 1}. ${s.label}`).join("\n");
    return `Estos son los horarios disponibles:\n\n${list}\n\nResponda con el *número* del horario que prefiera, o escriba *cancelar* para salir.`;
  }

  if (state.step === "show_slots") {
    const num = parseInt(lower);
    const slots: TimeSlot[] = JSON.parse(state.slots_json ?? "[]").map((s: { start: string; end: string; label: string }) => ({
      start: new Date(s.start),
      end: new Date(s.end),
      label: s.label,
    }));

    if (isNaN(num) || num < 1 || num > slots.length) {
      return `Por favor responda con un número del 1 al ${slots.length}, o escriba *cancelar*.`;
    }

    const chosen = slots[num - 1];
    setBookingState(conversationId, { step: "confirm", slots_json: JSON.stringify([{ start: chosen.start, end: chosen.end, label: chosen.label }]) });

    return `Confirme su cita:\n\n📅 *${chosen.label}*\n👤 ${state.patient_name}\n📋 ${state.reason}\n\nResponda *sí* para confirmar o *cancelar* para salir.`;
  }

  if (state.step === "confirm") {
    if (lower === "sí" || lower === "si" || lower === "yes" || lower === "confirmar" || lower === "confirmo") {
      const slots: TimeSlot[] = JSON.parse(state.slots_json ?? "[]").map((s: { start: string; end: string; label: string }) => ({
        start: new Date(s.start),
        end: new Date(s.end),
        label: s.label,
      }));

      const slot = slots[0];
      await createAppointment(state.patient_name!, phone, slot, state.reason ?? undefined);
      resetBookingState(conversationId);

      return `✅ ¡Cita confirmada!\n\n📅 ${slot.label}\n👤 ${state.patient_name}\n\nLe enviaremos un recordatorio. Si necesita cancelar o cambiar, escríbanos con anticipación. ¡Hasta pronto!`;
    }

    return "Responda *sí* para confirmar su cita o *cancelar* para salir.";
  }

  return null;
}
