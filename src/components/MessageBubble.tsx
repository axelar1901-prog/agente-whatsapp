interface Props {
  role: "user" | "assistant" | "human";
  content: string;
  createdAt: number;
}

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

export default function MessageBubble({ role, content, createdAt }: Props) {
  if (role === "user") {
    return (
      <div className="flex justify-start mb-2">
        <div className="max-w-xs lg:max-w-md bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-2 shadow-sm">
          <p className="text-sm text-gray-800">{content}</p>
          <p className="text-xs text-gray-400 mt-1">{formatTime(createdAt)}</p>
        </div>
      </div>
    );
  }

  if (role === "assistant") {
    return (
      <div className="flex justify-end mb-2">
        <div className="max-w-xs lg:max-w-md bg-emerald-500 text-white rounded-2xl rounded-tr-sm px-4 py-2 shadow-sm">
          <p className="text-sm">{content}</p>
          <p className="text-xs text-emerald-200 mt-1 text-right">{formatTime(createdAt)} · IA</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end mb-2">
      <div className="max-w-xs lg:max-w-md bg-amber-400 text-white rounded-2xl rounded-tr-sm px-4 py-2 shadow-sm">
        <p className="text-sm">{content}</p>
        <p className="text-xs text-amber-100 mt-1 text-right">{formatTime(createdAt)} · Humano</p>
      </div>
    </div>
  );
}
