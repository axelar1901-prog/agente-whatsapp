import type makeWASocket from "@whiskeysockets/baileys";
import type { BaileysEventMap } from "@whiskeysockets/baileys";
import {
  getOrCreateConversation,
  getConversationById,
  insertMessage,
  getRecentHistory,
} from "../db";
import { generateReply } from "../openrouter";

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
