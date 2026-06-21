"use client";

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
  return (
    <div className="h-full overflow-y-auto">
      {conversations.length === 0 && (
        <p className="text-sm text-gray-400 text-center mt-8">Sin conversaciones aún</p>
      )}
      {conversations.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
            selectedId === c.id ? "bg-emerald-50 border-l-2 border-l-emerald-500" : ""
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-sm text-gray-800 truncate">
              {c.name ?? c.phone}
            </span>
            <span className="text-xs text-gray-400 ml-2 shrink-0">{relativeTime(c.last_message_at)}</span>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 truncate">{c.last_message_preview ?? "Sin mensajes"}</p>
            <span className={`ml-2 shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
              c.mode === "AI" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            }`}>
              {c.mode === "AI" ? "IA" : "HUM"}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
