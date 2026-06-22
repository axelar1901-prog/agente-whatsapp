"use client";

import { useEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import ModeToggle from "./ModeToggle";
import PatientNotes from "./PatientNotes";

interface Message {
  id: number;
  conversation_id: number;
  role: "user" | "assistant" | "human";
  content: string;
  created_at: number;
}

interface Conversation {
  id: number;
  phone: string;
  name: string | null;
  mode: "AI" | "HUMAN";
}

interface Props {
  conversation: Conversation;
  lastMessageAt: number | null;
  onModeChange: (mode: "AI" | "HUMAN") => void;
  onDelete: () => void;
}

export default function ConversationPanel({ conversation, lastMessageAt, onModeChange, onDelete }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [mode, setMode] = useState<"AI" | "HUMAN">(conversation.mode);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMode(conversation.mode);
    loadMessages();
  }, [conversation.id]);

  useEffect(() => {
    if (lastMessageAt) loadMessages();
  }, [lastMessageAt]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadMessages() {
    const res = await fetch(`/api/messages/${conversation.id}`);
    if (res.ok) setMessages(await res.json());
  }

  async function sendMessage() {
    if (!input.trim() || sending) return;
    setSending(true);
    await fetch(`/api/messages/${conversation.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: input.trim() }),
    });
    setInput("");
    setSending(false);
    await loadMessages();
  }

  async function handleDelete() {
    await fetch(`/api/conversations/${conversation.id}`, { method: "DELETE" });
    onDelete();
  }

  function handleModeChange(m: "AI" | "HUMAN") {
    setMode(m);
    onModeChange(m);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <div>
          <p className="font-semibold text-gray-800">{conversation.name ?? conversation.phone}</p>
          <p className="text-xs text-gray-400">{conversation.phone}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadMessages}
            className="text-xs text-gray-400 hover:text-emerald-600 px-2 py-1 rounded hover:bg-emerald-50 transition-colors"
            title="Actualizar mensajes"
          >
            🔄
          </button>
          <ModeToggle conversationId={conversation.id} mode={mode} onChange={handleModeChange} />
          {confirmDelete ? (
            <div className="flex gap-1">
              <button onClick={handleDelete} className="text-xs bg-red-500 text-white px-2 py-1 rounded">Confirmar</button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs bg-gray-200 px-2 py-1 rounded">Cancelar</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="text-xs text-red-400 hover:text-red-600">Borrar</button>
          )}
        </div>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role} content={m.content} createdAt={m.created_at} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Notas del paciente */}
      <PatientNotes conversationId={conversation.id} />

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-200 bg-white">
        {mode === "AI" ? (
          <p className="text-sm text-center text-gray-400">El bot responde automáticamente en modo IA</p>
        ) : (
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Escribe un mensaje..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <button
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              className="bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-50"
            >
              Enviar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
