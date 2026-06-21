import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const dataDir = path.resolve(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "messages.db"));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    name TEXT,
    mode TEXT CHECK(mode IN ('AI','HUMAN')) NOT NULL DEFAULT 'AI',
    last_message_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id),
    role TEXT CHECK(role IN ('user','assistant','human')) NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_messages_conv
    ON messages(conversation_id, created_at);

  CREATE TABLE IF NOT EXISTS connection_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    status TEXT CHECK(status IN ('disconnected','qr','connecting','connected'))
      NOT NULL DEFAULT 'disconnected',
    qr_string TEXT,
    phone TEXT,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  INSERT OR IGNORE INTO connection_state (id, status) VALUES (1, 'disconnected');

  CREATE TABLE IF NOT EXISTS outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    phone TEXT NOT NULL,
    content TEXT NOT NULL,
    sent INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_outbox_pending
    ON outbox(sent, created_at);

  CREATE TABLE IF NOT EXISTS patient_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id),
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_notes_conv ON patient_notes(conversation_id, created_at);

  CREATE TABLE IF NOT EXISTS reminders_sent (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL,
    reminder_type TEXT CHECK(reminder_type IN ('24h','1h')) NOT NULL,
    sent_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(event_id, reminder_type)
  );

  CREATE TABLE IF NOT EXISTS booking_state (
    conversation_id INTEGER PRIMARY KEY REFERENCES conversations(id),
    step TEXT NOT NULL DEFAULT 'idle',
    patient_name TEXT,
    reason TEXT,
    slots_json TEXT,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

export interface Conversation {
  id: number;
  phone: string;
  name: string | null;
  mode: "AI" | "HUMAN";
  last_message_at: number | null;
  created_at: number;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: "user" | "assistant" | "human";
  content: string;
  created_at: number;
}

export interface ConnectionState {
  id: number;
  status: "disconnected" | "qr" | "connecting" | "connected";
  qr_string: string | null;
  phone: string | null;
  updated_at: number;
}

export function getOrCreateConversation(phone: string, name?: string): Conversation {
  const existing = db.prepare("SELECT * FROM conversations WHERE phone = ?").get(phone) as Conversation | undefined;
  if (existing) {
    if (name && name !== existing.name) {
      db.prepare("UPDATE conversations SET name = ? WHERE id = ?").run(name, existing.id);
      existing.name = name;
    }
    return existing;
  }
  const result = db.prepare("INSERT INTO conversations (phone, name) VALUES (?, ?) RETURNING *").get(phone, name ?? null) as Conversation;
  return result;
}

export function getConversationById(id: number): Conversation | null {
  return (db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as Conversation | undefined) ?? null;
}

export const insertMessage = db.transaction((conversationId: number, role: "user" | "assistant" | "human", content: string): Message => {
  const msg = db.prepare(
    "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?) RETURNING *"
  ).get(conversationId, role, content) as Message;
  db.prepare("UPDATE conversations SET last_message_at = unixepoch() WHERE id = ?").run(conversationId);
  return msg;
});

export function getMessages(conversationId: number, limit = 50): Message[] {
  return db.prepare(
    "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?"
  ).all(conversationId, limit) as Message[];
}

export function getRecentHistory(conversationId: number, limit = 20): Message[] {
  const rows = db.prepare(
    "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?"
  ).all(conversationId, limit) as Message[];
  return rows.reverse();
}

export function setMode(conversationId: number, mode: "AI" | "HUMAN"): void {
  db.prepare("UPDATE conversations SET mode = ? WHERE id = ?").run(mode, conversationId);
}

export function listConversations(): (Conversation & { last_message_preview: string | null })[] {
  return db.prepare(`
    SELECT c.*,
      (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_preview
    FROM conversations c
    ORDER BY c.last_message_at DESC NULLS LAST
  `).all() as (Conversation & { last_message_preview: string | null })[];
}

export function getConnectionState(): ConnectionState {
  return db.prepare("SELECT * FROM connection_state WHERE id = 1").get() as ConnectionState;
}

export function setConnectionState(update: { status?: string; qr_string?: string | null; phone?: string | null }): void {
  const current = getConnectionState();
  const status = update.status ?? current.status;
  const qr_string = update.qr_string !== undefined ? update.qr_string : current.qr_string;
  const phone = update.phone !== undefined ? update.phone : current.phone;
  db.prepare(
    "UPDATE connection_state SET status = ?, qr_string = ?, phone = ?, updated_at = unixepoch() WHERE id = 1"
  ).run(status, qr_string, phone);
}

export function enqueueOutbox(conversationId: number, phone: string, content: string): void {
  db.prepare("INSERT INTO outbox (conversation_id, phone, content) VALUES (?, ?, ?)").run(conversationId, phone, content);
}

export function getPendingOutbox(limit = 20): { id: number; conversation_id: number; phone: string; content: string }[] {
  return db.prepare("SELECT * FROM outbox WHERE sent = 0 ORDER BY created_at ASC LIMIT ?").all(limit) as { id: number; conversation_id: number; phone: string; content: string }[];
}

export function markOutboxSent(id: number): void {
  db.prepare("UPDATE outbox SET sent = 1 WHERE id = ?").run(id);
}

export const deleteConversation = db.transaction((id: number): void => {
  db.prepare("DELETE FROM outbox WHERE conversation_id = ? AND sent = 0").run(id);
  db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(id);
  db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
});

export interface PatientNote {
  id: number;
  conversation_id: number;
  content: string;
  created_at: number;
}

export function getNotes(conversationId: number): PatientNote[] {
  return db.prepare("SELECT * FROM patient_notes WHERE conversation_id = ? ORDER BY created_at ASC").all(conversationId) as PatientNote[];
}

export function addNote(conversationId: number, content: string): PatientNote {
  return db.prepare("INSERT INTO patient_notes (conversation_id, content) VALUES (?, ?) RETURNING *").get(conversationId, content) as PatientNote;
}

export function deleteNote(id: number): void {
  db.prepare("DELETE FROM patient_notes WHERE id = ?").run(id);
}

export function wasReminderSent(eventId: string, type: "24h" | "1h"): boolean {
  return !!db.prepare("SELECT 1 FROM reminders_sent WHERE event_id = ? AND reminder_type = ?").get(eventId, type);
}

export function markReminderSent(eventId: string, type: "24h" | "1h"): void {
  db.prepare("INSERT OR IGNORE INTO reminders_sent (event_id, reminder_type) VALUES (?, ?)").run(eventId, type);
}

export interface BookingState {
  conversation_id: number;
  step: "idle" | "ask_name" | "ask_reason" | "show_slots" | "confirm";
  patient_name: string | null;
  reason: string | null;
  slots_json: string | null;
}

export function getBookingState(conversationId: number): BookingState {
  const row = db.prepare("SELECT * FROM booking_state WHERE conversation_id = ?").get(conversationId) as BookingState | undefined;
  return row ?? { conversation_id: conversationId, step: "idle", patient_name: null, reason: null, slots_json: null };
}

export function setBookingState(conversationId: number, update: Partial<Omit<BookingState, "conversation_id">>): void {
  const current = getBookingState(conversationId);
  db.prepare(`
    INSERT INTO booking_state (conversation_id, step, patient_name, reason, slots_json, updated_at)
    VALUES (?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(conversation_id) DO UPDATE SET
      step = excluded.step,
      patient_name = excluded.patient_name,
      reason = excluded.reason,
      slots_json = excluded.slots_json,
      updated_at = unixepoch()
  `).run(
    conversationId,
    update.step ?? current.step,
    update.patient_name !== undefined ? update.patient_name : current.patient_name,
    update.reason !== undefined ? update.reason : current.reason,
    update.slots_json !== undefined ? update.slots_json : current.slots_json,
  );
}

export function resetBookingState(conversationId: number): void {
  db.prepare("DELETE FROM booking_state WHERE conversation_id = ?").run(conversationId);
}

export default db;
