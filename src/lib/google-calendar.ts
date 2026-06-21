import fs from "node:fs";
import path from "node:path";
import { google, calendar_v3 } from "googleapis";

const CREDENTIALS_PATH = path.resolve(process.cwd(), "google-credentials.json");
const TOKEN_PATH = path.resolve(process.cwd(), "google-token.json");

function getAuth() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8"));
  const { client_id, client_secret, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
  oAuth2Client.setCredentials(token);
  return oAuth2Client;
}

export function isCalendarReady(): boolean {
  return fs.existsSync(TOKEN_PATH) && fs.existsSync(CREDENTIALS_PATH);
}

// Horarios de consulta del doctor (lunes a viernes, 9am-2pm y 4pm-7pm)
const WORK_HOURS = [
  { start: 9, end: 14 },
  { start: 16, end: 19 },
];
const SLOT_DURATION = 30; // minutos por cita

export interface TimeSlot {
  start: Date;
  end: Date;
  label: string;
}

export interface DaySlots {
  dayLabel: string; // "Lunes 23 jun"
  slots: TimeSlot[];
}

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_NAMES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function formatDayLabel(d: Date): string {
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

async function fetchBusy(timeMin: Date, timeMax: Date) {
  const auth = getAuth();
  const calendar = google.calendar({ version: "v3", auth });
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: [{ id: "primary" }],
    },
  });
  return res.data.calendars?.primary?.busy ?? [];
}

export async function getSlotsByDay(daysAhead = 7): Promise<DaySlots[]> {
  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setMinutes(now.getMinutes() + 30);

  const timeMax = new Date(now);
  timeMax.setDate(now.getDate() + daysAhead);

  const busy = await fetchBusy(timeMin, timeMax);

  const days: DaySlots[] = [];
  const cursor = new Date(timeMin);
  cursor.setMinutes(0, 0, 0);

  while (cursor < timeMax) {
    const dayOfWeek = cursor.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }

    const dayLabel = formatDayLabel(cursor);
    const slotsForDay: TimeSlot[] = [];

    for (const { start: startH, end: endH } of WORK_HOURS) {
      const slotCursor = new Date(cursor);
      slotCursor.setHours(startH, 0, 0, 0);

      while (slotCursor.getHours() < endH) {
        if (slotCursor > timeMin) {
          const slotEnd = new Date(slotCursor.getTime() + SLOT_DURATION * 60000);
          const isBusy = busy.some((b) => {
            const bs = new Date(b.start!);
            const be = new Date(b.end!);
            return slotCursor < be && slotEnd > bs;
          });
          if (!isBusy) {
            slotsForDay.push({ start: new Date(slotCursor), end: slotEnd, label: formatSlot(slotCursor) });
          }
        }
        slotCursor.setMinutes(slotCursor.getMinutes() + SLOT_DURATION);
      }
    }

    if (slotsForDay.length > 0) {
      days.push({ dayLabel, slots: slotsForDay });
    }

    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }

  return days;
}

// Compatibilidad: versión plana para reagendar
export async function getAvailableSlots(daysAhead = 7): Promise<TimeSlot[]> {
  const days = await getSlotsByDay(daysAhead);
  return days.flatMap((d) => d.slots);
}

export async function createAppointment(
  patientName: string,
  patientPhone: string,
  slot: { start: Date; end: Date },
  reason?: string,
  remoteJid?: string
): Promise<string> {
  const auth = getAuth();
  const calendar = google.calendar({ version: "v3", auth });

  const displayPhone = patientPhone.length > 15 ? "(WhatsApp)" : patientPhone;
  const jidLine = remoteJid ? `\nJID: ${remoteJid}` : "";

  const event: calendar_v3.Schema$Event = {
    summary: `Cita: ${patientName}`,
    description: `Paciente: ${patientName}\nWhatsApp: ${displayPhone}${jidLine}${reason ? `\nMotivo: ${reason}` : ""}`,
    start: { dateTime: slot.start.toISOString(), timeZone: "America/Mexico_City" },
    end: { dateTime: slot.end.toISOString(), timeZone: "America/Mexico_City" },
    reminders: {
      useDefault: false,
      overrides: [{ method: "popup", minutes: 60 }, { method: "email", minutes: 1440 }],
    },
  };

  const res = await calendar.events.insert({ calendarId: "primary", requestBody: event });
  return res.data.id ?? "";
}

export async function cancelAppointment(eventId: string): Promise<void> {
  const auth = getAuth();
  const calendar = google.calendar({ version: "v3", auth });
  await calendar.events.delete({ calendarId: "primary", eventId });
}

export async function getUpcomingAppointments(daysAhead = 7): Promise<calendar_v3.Schema$Event[]> {
  const auth = getAuth();
  const calendar = google.calendar({ version: "v3", auth });

  const now = new Date();
  const timeMax = new Date(now);
  timeMax.setDate(now.getDate() + daysAhead);

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: now.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });

  return res.data.items ?? [];
}

const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function formatSlot(date: Date): string {
  const day = DAYS[date.getDay()];
  const d = date.getDate();
  const m = MONTHS[date.getMonth()];
  const h = date.getHours();
  const min = date.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${day} ${d} ${m}, ${h12}:${min} ${ampm}`;
}
