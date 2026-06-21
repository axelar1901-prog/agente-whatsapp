"use client";

import { useEffect, useRef } from "react";

interface Conversation {
  id: number;
  phone: string;
  name: string | null;
  mode: "AI" | "HUMAN";
  last_message_at: number | null;
  last_message_preview: string | null;
}

interface Props {
  conversations: Conversation[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

function relativeTime(ts: number | null): string {
  if (!ts) return "";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}

export default function ConversationList({ conversations, selectedId, onSelect }: Props) {
  const prevModesRef = useRef<Record<number, string>>({});

  // Alerta sonora cuando una conversación cambia a HUMAN
  useEffect(() => {
    const prev = prevModesRef.current;
    for (const c of conversations) {
      if (prev[c.id] === "AI" && c.mode === "HUMAN") {
        try {
          const ctx = new AudioContext();
          const oscillator = ctx.createOscillator();
          const gain = ctx.createGain();
          oscillator.connect(gain);
          gain.connect(ctx.destination);
          oscillator.frequency.value = 880;
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.5);
        } catch {}
      }
    }
    prevModesRef.current = Object.fromEntries(conversations.map((c) => [c.id, c.mode]));
  }, [conversations]);

  const needsHuman = conversations.filter((c) => c.mode === "HUMAN");
  const rest = conversations.filter((c) => c.mode === "AI");
  const sorted = [...needsHuman, ...rest];

  return (
    <div className="h-full overflow-y-auto">
      {needsHuman.length > 0 && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-semibold text-red-600">
            {needsHuman.length} {needsHuman.length === 1 ? "paciente necesita atención" : "pacientes necesitan atención"}
          </span>
        </div>
      )}

      {sorted.length === 0 && (
        <p className="text-sm text-gray-400 text-center mt-8">Sin conversaciones aún</p>
      )}

      {sorted.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={`w-full text-left px-4 py-3 border-b transition-colors ${
            c.mode === "HUMAN"
              ? "bg-red-50 border-red-100 hover:bg-red-100 border-l-4 border-l-red-400"
              : selectedId === c.id
              ? "bg-emerald-50 border-gray-100 border-l-2 border-l-emerald-500"
              : "border-gray-100 hover:bg-gray-50"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              {c.mode === "HUMAN" && (
                <span className="text-red-500 shrink-0">🔴</span>
              )}
              <span className="font-medium text-sm text-gray-800 truncate">
                {c.name ?? c.phone}
              </span>
            </div>
            <span className="text-xs text-gray-400 ml-2 shrink-0">{relativeTime(c.last_message_at)}</span>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 truncate">{c.last_message_preview ?? "Sin mensajes"}</p>
            <span className={`ml-2 shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
              c.mode === "AI" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
            }`}>
              {c.mode === "AI" ? "IA" : "⚠️ Humano"}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
