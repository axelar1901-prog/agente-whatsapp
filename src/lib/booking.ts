import { getBookingState, setBookingState, resetBookingState } from "./db";
import { getAvailableSlots, createAppointment, cancelAppointment, getUpcomingAppointments, isCalendarReady, TimeSlot } from "./google-calendar";
import type { calendar_v3 } from "googleapis";

const BOOKING_TRIGGERS = [
  "quiero una cita", "necesito cita", "agendar cita", "reservar cita",
  "hacer una cita", "pedir cita", "solicitar cita", "quiero agendar",
];

const CANCEL_TRIGGERS = [
  "cancelar mi cita", "cancelar cita", "quiero cancelar", "necesito cancelar",
  "borrar mi cita", "eliminar mi cita",
];

const RESCHEDULE_TRIGGERS = [
  "cambiar mi cita", "reagendar", "mover mi cita", "cambiar fecha",
  "otra fecha", "cambiar horario",
];

export function isBookingIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return BOOKING_TRIGGERS.some((t) => lower.includes(t));
}

export function isCancelIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return CANCEL_TRIGGERS.some((t) => lower.includes(t));
}

export function isRescheduleIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return RESCHEDULE_TRIGGERS.some((t) => lower.includes(t));
}

async function getPatientAppointments(phone: string): Promise<calendar_v3.Schema$Event[]> {
  const events = await getUpcomingAppointments(30);
  return events.filter((e) => e.description?.includes(`WhatsApp: ${phone}`));
}

function formatEvent(event: calendar_v3.Schema$Event, index: number): string {
  const start = event.start?.dateTime ? new Date(event.start.dateTime) : null;
  if (!start) return "";
  const days = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const h = start.getHours();
  const min = start.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${index + 1}. ${days[start.getDay()]} ${start.getDate()} ${months[start.getMonth()]}, ${h12}:${min} ${ampm}`;
}

export async function handleBookingFlow(
  conversationId: number,
  phone: string,
  text: string,
  remoteJid?: string
): Promise<string | null> {
  if (!isCalendarReady()) return null;

  const state = getBookingState(conversationId);
  const lower = text.toLowerCase().trim();

  // Salir del flujo en cualquier momento
  if ((lower === "cancelar" || lower === "salir") && state.step !== "idle") {
    resetBookingState(conversationId);
    return "De acuerdo. ¿En qué más puedo ayudarte?";
  }

  // ── FLUJO: CANCELAR CITA ──────────────────────────────────────────

  if (state.step === "idle" && isCancelIntent(text)) {
    const appointments = await getPatientAppointments(phone);
    if (appointments.length === 0) {
      return "No encontré citas próximas registradas con su número. ¿Le puedo ayudar con algo más?";
    }
    const list = appointments.map((e, i) => formatEvent(e, i)).join("\n");
    setBookingState(conversationId, {
      step: "cancel_select",
      slots_json: JSON.stringify(appointments.map((e) => ({ id: e.id, label: formatEvent(e, 0) }))),
    });
    return `Estas son sus citas próximas:\n\n${list}\n\nEscriba el *número* de la cita que desea cancelar, o *salir* para no hacer cambios.`;
  }

  if (state.step === "cancel_select") {
    const num = parseInt(lower);
    const items: { id: string; label: string }[] = JSON.parse(state.slots_json ?? "[]");
    if (isNaN(num) || num < 1 || num > items.length) {
      return `Por favor responda con un número del 1 al ${items.length}, o escriba *salir*.`;
    }
    const chosen = items[num - 1];
    setBookingState(conversationId, { step: "cancel_confirm", slots_json: JSON.stringify([chosen]) });
    return `¿Confirma que desea cancelar la cita del *${chosen.label.replace(/^\d+\. /, "")}*?\n\nResponda *sí* para cancelar o *salir* para conservarla.`;
  }

  if (state.step === "cancel_confirm") {
    if (lower === "sí" || lower === "si" || lower === "yes") {
      const items: { id: string; label: string }[] = JSON.parse(state.slots_json ?? "[]");
      await cancelAppointment(items[0].id);
      resetBookingState(conversationId);
      return "✅ Su cita ha sido cancelada. Si desea reagendar en otro momento, con gusto le ayudamos.";
    }
    return "Responda *sí* para cancelar la cita o *salir* para conservarla.";
  }

  // ── FLUJO: REAGENDAR CITA ─────────────────────────────────────────

  if (state.step === "idle" && isRescheduleIntent(text)) {
    const appointments = await getPatientAppointments(phone);
    if (appointments.length === 0) {
      return "No encontré citas próximas registradas con su número. ¿Le puedo ayudar con algo más?";
    }
    const list = appointments.map((e, i) => formatEvent(e, i)).join("\n");
    setBookingState(conversationId, {
      step: "reschedule_select",
      slots_json: JSON.stringify(appointments.map((e) => ({ id: e.id, label: formatEvent(e, 0), description: e.description }))),
    });
    return `Estas son sus citas próximas:\n\n${list}\n\nEscriba el *número* de la cita que desea cambiar, o *salir* para no hacer cambios.`;
  }

  if (state.step === "reschedule_select") {
    const num = parseInt(lower);
    const items: { id: string; label: string; description: string }[] = JSON.parse(state.slots_json ?? "[]");
    if (isNaN(num) || num < 1 || num > items.length) {
      return `Por favor responda con un número del 1 al ${items.length}, o escriba *salir*.`;
    }
    const chosen = items[num - 1];
    const slots = await getAvailableSlots(7);
    if (slots.length === 0) {
      resetBookingState(conversationId);
      return "Lo siento, no encontré horarios disponibles en los próximos 7 días. Por favor llame al consultorio.";
    }
    const slotList = slots.map((s, i) => `${i + 1}. ${s.label}`).join("\n");
    setBookingState(conversationId, {
      step: "reschedule_pick",
      slots_json: JSON.stringify({
        old: { id: chosen.id, description: chosen.description },
        new: slots.map((s) => ({ start: s.start, end: s.end, label: s.label })),
      }),
    });
    return `Estos son los horarios disponibles:\n\n${slotList}\n\nResponda con el *número* del nuevo horario que prefiera.`;
  }

  if (state.step === "reschedule_pick") {
    const num = parseInt(lower);
    const data: { old: { id: string; description: string }; new: { start: string; end: string; label: string }[] } = JSON.parse(state.slots_json ?? "{}");
    if (isNaN(num) || num < 1 || num > data.new.length) {
      return `Por favor responda con un número del 1 al ${data.new.length}, o escriba *salir*.`;
    }
    const chosen = data.new[num - 1];
    setBookingState(conversationId, {
      step: "reschedule_confirm",
      slots_json: JSON.stringify({ old: data.old, chosen }),
    });
    return `¿Confirma cambiar su cita al *${chosen.label}*?\n\nResponda *sí* para confirmar o *salir* para cancelar.`;
  }

  if (state.step === "reschedule_confirm") {
    if (lower === "sí" || lower === "si" || lower === "yes") {
      const data: { old: { id: string; description: string }; chosen: { start: string; end: string; label: string } } = JSON.parse(state.slots_json ?? "{}");
      const nameMatch = data.old.description?.match(/Paciente:\s*(.+)/);
      const reasonMatch = data.old.description?.match(/Motivo:\s*(.+)/);
      const patientName = nameMatch ? nameMatch[1].trim() : "Paciente";
      const reason = reasonMatch ? reasonMatch[1].trim() : undefined;
      await cancelAppointment(data.old.id);
      await createAppointment(patientName, phone, { start: new Date(data.chosen.start), end: new Date(data.chosen.end) }, reason);
      resetBookingState(conversationId);
      return `✅ ¡Cita reagendada!\n\n📅 *${data.chosen.label}*\n\nLe enviaremos un recordatorio. ¡Hasta pronto!`;
    }
    return "Responda *sí* para confirmar el cambio o *salir* para cancelar.";
  }

  // ── FLUJO: AGENDAR CITA ───────────────────────────────────────────

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
      return "Lo siento, no encontré horarios disponibles en los próximos 7 días. Por favor llame al consultorio.";
    }
    setBookingState(conversationId, { slots_json: JSON.stringify(slots.map((s) => ({ start: s.start, end: s.end, label: s.label }))) });
    const list = slots.map((s, i) => `${i + 1}. ${s.label}`).join("\n");
    return `Estos son los horarios disponibles:\n\n${list}\n\nResponda con el *número* del horario que prefiera, o escriba *salir* para cancelar.`;
  }

  if (state.step === "show_slots") {
    const num = parseInt(lower);
    const slots: TimeSlot[] = JSON.parse(state.slots_json ?? "[]").map((s: { start: string; end: string; label: string }) => ({
      start: new Date(s.start), end: new Date(s.end), label: s.label,
    }));
    if (isNaN(num) || num < 1 || num > slots.length) {
      return `Por favor responda con un número del 1 al ${slots.length}, o escriba *salir*.`;
    }
    const chosen = slots[num - 1];
    setBookingState(conversationId, { step: "confirm", slots_json: JSON.stringify([{ start: chosen.start, end: chosen.end, label: chosen.label }]) });
    return `Confirme su cita:\n\n📅 *${chosen.label}*\n👤 ${state.patient_name}\n📋 ${state.reason}\n\nResponda *sí* para confirmar o *salir* para cancelar.`;
  }

  if (state.step === "confirm") {
    if (lower === "sí" || lower === "si" || lower === "yes") {
      const slots: TimeSlot[] = JSON.parse(state.slots_json ?? "[]").map((s: { start: string; end: string; label: string }) => ({
        start: new Date(s.start), end: new Date(s.end), label: s.label,
      }));
      const slot = slots[0];
      await createAppointment(state.patient_name!, phone, slot, state.reason ?? undefined, remoteJid);
      resetBookingState(conversationId);
      return `✅ ¡Cita confirmada!\n\n📅 ${slot.label}\n👤 ${state.patient_name}\n\nLe enviaremos un recordatorio. Si necesita cancelar o cambiar, escríbanos. ¡Hasta pronto!`;
    }
    return "Responda *sí* para confirmar su cita o *salir* para cancelar.";
  }

  return null;
}
