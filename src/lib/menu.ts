import { CLINIC_INFO } from "./system-prompt";
import { setMode, markGreeted } from "./db";

export const WELCOME_MENU = `👋 ¡Bienvenido al consultorio del *${CLINIC_INFO.doctor}*, ${CLINIC_INFO.specialty}!

¿En qué le puedo ayudar hoy?

1️⃣ Agendar una cita
2️⃣ Cancelar o cambiar una cita
3️⃣ Información del consultorio
4️⃣ Hablar con la recepcionista
5️⃣ Otra pregunta

Responda con el *número* de su opción.`;

export const MENU_TRIGGERS = [
  "menu", "menú", "opciones", "inicio", "hola", "buenas", "buenos días",
  "buenas tardes", "buenas noches", "start", "hi", "hey",
];

export function isMenuTrigger(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return MENU_TRIGGERS.some((t) => lower === t || lower.startsWith(t + " "));
}

export function handleMenuSelection(
  selection: string,
  conversationId: number
): { response: string; action?: "booking" | "cancel" | "human" | "ai_reply" } | null {
  const num = selection.trim();

  if (num === "1") {
    return { response: "Con gusto agendo su cita. Por favor escriba *quiero una cita* para iniciar el proceso.", action: "ai_reply" };
  }
  if (num === "2") {
    return { response: "Para cancelar o cambiar su cita, escriba *cancelar mi cita* o *cambiar mi cita*.", action: "ai_reply" };
  }
  if (num === "3") {
    return {
      response: `📍 *${CLINIC_INFO.doctor}*\n🏥 ${CLINIC_INFO.specialty}\n\n📌 *Dirección:*\n${CLINIC_INFO.address}\n\n🕐 *Horarios:*\n${CLINIC_INFO.hours}\n\n💰 *Precios:*\n${CLINIC_INFO.prices}\n\n📞 *Teléfono:*\n${CLINIC_INFO.phone}\n\n🏥 *Seguros aceptados:*\n${CLINIC_INFO.insurance}\n\n¿Desea agendar una cita? Escriba *quiero una cita*.`,
      action: "ai_reply",
    };
  }
  if (num === "4") {
    setMode(conversationId, "HUMAN");
    return { response: "Con gusto le comunico con nuestra recepcionista. Un momento por favor, alguien le atenderá en breve. 🙏", action: "human" };
  }
  if (num === "5") {
    return { response: null as unknown as string, action: "ai_reply" };
  }

  return null;
}
