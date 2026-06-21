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

export default db;
