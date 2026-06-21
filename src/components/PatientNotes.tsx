"use client";

import { useEffect, useState } from "react";

interface Note {
  id: number;
  content: string;
  created_at: number;
}

export default function PatientNotes({ conversationId }: { conversationId: number }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, [conversationId]);

  async function load() {
    const res = await fetch(`/api/notes/${conversationId}`);
    if (res.ok) setNotes(await res.json());
  }

  async function save() {
    if (!text.trim()) return;
    setSaving(true);
    await fetch(`/api/notes/${conversationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text.trim() }),
    });
    setText("");
    setSaving(false);
    load();
  }

  async function remove(id: number) {
    await fetch(`/api/notes/${conversationId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  function formatDate(ts: number) {
    return new Date(ts * 1000).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="border-t border-gray-200 bg-yellow-50 p-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Notas del paciente</h3>

      <div className="space-y-2 mb-3">
        {notes.length === 0 && (
          <p className="text-xs text-gray-400 italic">Sin notas todavía.</p>
        )}
        {notes.map((n) => (
          <div key={n.id} className="flex items-start gap-2 bg-white rounded-lg p-2 shadow-sm">
            <div className="flex-1">
              <p className="text-sm text-gray-700">{n.content}</p>
              <p className="text-xs text-gray-400 mt-1">{formatDate(n.created_at)}</p>
            </div>
            <button
              onClick={() => remove(n.id)}
              className="text-gray-300 hover:text-red-400 text-xs shrink-0 mt-0.5"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="Agregar nota..."
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-300 bg-white"
        />
        <button
          onClick={save}
          disabled={saving || !text.trim()}
          className="px-3 py-2 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg"
        >
          +
        </button>
      </div>
    </div>
  );
}
