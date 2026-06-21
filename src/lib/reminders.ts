import type makeWASocket from "@whiskeysockets/baileys";
import { getUpcomingAppointments, isCalendarReady } from "./google-calendar";
import { wasReminderSent, markReminderSent } from "./db";

type WASocket = ReturnType<typeof makeWASocket>;

function parseJid(description: string): string | null {
  const jidMatch = description.match(/JID:\s*(\S+)/);
  if (jidMatch) return jidMatch[1];
  const phoneMatch = description.match(/WhatsApp:\s*(\d+)/);
  return phoneMatch ? `${phoneMatch[1]}@s.whatsapp.net` : null;
}

function parseName(description: string): string | null {
  const match = description.match(/Paciente:\s*(.+)/);
  return match ? match[1].trim() : null;
}

function formatDateTime(date: Date): string {
  const days = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const day = days[date.getDay()];
  const d = date.getDate();
  const m = months[date.getMonth()];
  const h = date.getHours();
  const min = date.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${day} ${d} ${m} a las ${h12}:${min} ${ampm}`;
}

export async function checkAndSendReminders(sock: WASocket): Promise<void> {
  if (!isCalendarReady()) return;

  try {
    const events = await getUpcomingAppointments(2);
    const now = Date.now();

    for (const event of events) {
      const eventId = event.id;
      if (!eventId || !event.start?.dateTime || !event.description) continue;

      const jid = parseJid(event.description);
      const name = parseName(event.description);
      if (!jid || !name) continue;

      const startTime = new Date(event.start.dateTime).getTime();
      const msUntil = startTime - now;
      const hoursUntil = msUntil / (1000 * 60 * 60);
      const appointmentStr = formatDateTime(new Date(event.start.dateTime));

      // Recordatorio 24 horas antes (entre 23h y 25h)
      if (hoursUntil >= 23 && hoursUntil <= 25 && !wasReminderSent(eventId, "24h")) {
        const msg = `👋 Hola ${name.split(" ")[0]}, le recordamos que tiene una cita con el *Dr. Alvarado* mañana *${appointmentStr}*.\n\nSi necesita cancelar o cambiar, escríbanos con anticipación. ¡Hasta mañana!`;
        await sock.sendMessage(jid, { text: msg });
        markReminderSent(eventId, "24h");
        console.log(`[reminders] 24h → ${jid}`);
      }

      // Recordatorio 1 hora antes (entre 50min y 70min)
      if (hoursUntil >= 0.83 && hoursUntil <= 1.17 && !wasReminderSent(eventId, "1h")) {
        const msg = `⏰ ${name.split(" ")[0]}, su cita con el *Dr. Alvarado* es *en aproximadamente 1 hora* (${appointmentStr}).\n\n¡Le esperamos!`;
        await sock.sendMessage(jid, { text: msg });
        markReminderSent(eventId, "1h");
        console.log(`[reminders] 1h → ${jid}`);
      }
    }
  } catch (err) {
    console.error("[reminders] Error:", err);
  }
}
