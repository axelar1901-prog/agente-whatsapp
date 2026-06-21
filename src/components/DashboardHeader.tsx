"use client";

interface Props {
  phone: string | null;
  onDisconnect: () => void;
}

export default function DashboardHeader({ phone, onDisconnect }: Props) {
  async function disconnect() {
    await fetch("/api/connection/disconnect", { method: "POST" });
    onDisconnect();
  }

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="font-semibold text-gray-800">Consultorio Dr. Alvarado</span>
        {phone && <span className="text-sm text-gray-400">· {phone}</span>}
      </div>
      <button
        onClick={disconnect}
        className="text-sm text-gray-500 hover:text-red-500 transition-colors"
      >
        Desconectar
      </button>
    </header>
  );
}
