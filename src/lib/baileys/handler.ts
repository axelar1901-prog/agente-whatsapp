import type makeWASocket from "@whiskeysockets/baileys";
import type { BaileysEventMap } from "@whiskeysockets/baileys";
import {
  getOrCreateConversation,
  getConversationById,
  insertMessage,
  getRecentHistory,
} from "../db";
import { generateReply } from "../openrouter";
import { handleBookingFlow, isBookingIntent } from "../booking";
import { getBookingState } from "../db";
import { assessTriage, getTriageResponse, isHumanRequest } from "../triage";
import { WELCOME_MENU, handleMenuSelection, isMenuTrigger } from "../menu";
import { markGreeted } from "../db";

type WASocket = ReturnType<typeof makeWASocket>;

export async function handleIncomingMessages(
  sock: WASocket,
  upsert: BaileysEventMap["messages.upsert"]
): Promise<void> {
  console.log(`[bot] messages.upsert tipo="${upsert.type}" cantidad=${upsert.messages.length}`);

  if (upsert.type !== "notify") return;

  for (const msg of upsert.messages) {
    try {
      console.log(`[bot] msg jid=${msg.key.remoteJid} fromMe=${msg.key.fromMe} type=${JSON.stringify(Object.keys(msg.message ?? {}))}`);
      if (msg.key.fromMe) continue;

      const remoteJid = msg.key.remoteJid ?? "";
      if (remoteJid.endsWith("@g.us")) continue;
      const isPrivate = remoteJid.endsWith("@s.whatsapp.net") || remoteJid.endsWith("@lid");
      if (!isPrivate) continue;

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text;

      if (!text) continue;

      const phone = remoteJid.replace("@s.whatsapp.net", "").replace("@lid", "");
      const pushName = msg.pushName ?? undefined;

      console.log(`[bot] ← Mensaje de ${phone}: "${text}"`);

      const convo = getOrCreateConversation(phone, pushName);
      insertMessage(convo.id, "user", text);

      const fresh = getConversationById(convo.id);
      if (!fresh || fresh.mode !== "AI") {
        console.log(`[bot] Conversación ${convo.id} en modo HUMAN — sin respuesta automática`);
        continue;
      }

      // Menú de bienvenida (primer mensaje o trigger)
      const bookingStateNow = getBookingState(convo.id);
      const isFirstMessage = !fresh.greeted;
      const shouldShowMenu = (isFirstMessage || isMenuTrigger(text)) && bookingStateNow.step === "idle";

      if (shouldShowMenu) {
        markGreeted(convo.id);
        insertMessage(convo.id, "assistant", WELCOME_MENU);
        await sock.sendMessage(remoteJid, { text: WELCOME_MENU });
        console.log(`[bot] → [MENU] ${phone}`);
        continue;
      }

      // Manejar selección del menú (1-5)
      const menuResult = handleMenuSelection(text, convo.id);
      if (menuResult && menuResult.action !== "ai_reply") {
        insertMessage(convo.id, "assistant", menuResult.response);
        await sock.sendMessage(remoteJid, { text: menuResult.response });
        console.log(`[bot] → [MENU:${menuResult.action}] ${phone}`);
        continue;
      }
      if (menuResult && menuResult.action === "ai_reply" && text !== "5") {
        insertMessage(convo.id, "assistant", menuResult.response);
        await sock.sendMessage(remoteJid, { text: menuResult.response });
        console.log(`[bot] → [MENU:info] ${phone}`);
        continue;
      }

      // Detectar solicitud de atención humana
      if (isHumanRequest(text) && bookingStateNow.step === "idle") {
        const { setMode } = await import("../db");
        setMode(convo.id, "HUMAN");
        const humanReply = "Con gusto le comunico con nuestra recepcionista. Un momento por favor, alguien le atenderá en breve. 🙏";
        insertMessage(convo.id, "assistant", humanReply);
        await sock.sendMessage(remoteJid, { text: humanReply });
        console.log(`[bot] → [HUMANO solicitado] ${phone}`);
        continue;
      }

      // Triaje de urgencias (máxima prioridad)
      const triageLevel = assessTriage(text);
      const triageReply = getTriageResponse(triageLevel);
      if (triageReply) {
        insertMessage(convo.id, "assistant", triageReply);
        await sock.sendMessage(remoteJid, { text: triageReply });
        console.log(`[bot] → [TRIAJE:${triageLevel}] ${phone}`);
        continue;
      }

      // Flujo de agendamiento de citas (tiene prioridad sobre el LLM)
      const bookingState = getBookingState(convo.id);
      const inBookingFlow = bookingState.step !== "idle";
      const bookingReply = await handleBookingFlow(convo.id, phone, text);

      if (bookingReply) {
        insertMessage(convo.id, "assistant", bookingReply);
        await sock.sendMessage(remoteJid, { text: bookingReply });
        console.log(`[bot] → [CITA] ${bookingReply.slice(0, 80)}...`);
        continue;
      }

      // Si no es flujo de citas, usar LLM
      const history = getRecentHistory(convo.id, 20);
      console.log(`[bot] Llamando LLM con ${history.length} mensajes...`);

      const reply = await generateReply(history);
      insertMessage(convo.id, "assistant", reply);

      await sock.sendMessage(remoteJid, { text: reply });
      console.log(`[bot] → Enviado a ${phone}: "${reply.slice(0, 80)}..."`);
    } catch (err) {
      console.error("[bot] Error procesando mensaje:", err);
    }
  }
}
