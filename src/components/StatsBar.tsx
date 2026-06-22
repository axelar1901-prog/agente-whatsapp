"use client";

import { useEffect, useState } from "react";

interface Stats {
  totalConversations: number;
  conversationsToday: number;
  messagesReceived: number;
  needsHuman: number;
}

export default function StatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  async function load() {
    const res = await fetch("/api/stats");
    if (res.ok) setStats(await res.json());
  }

  if (!stats) return null;

  return (
    <div className="grid grid-cols-4 gap-3 px-6 py-3 bg-white border-b border-gray-100">
      <Stat label="Pacientes totales" value={stats.totalConversations} icon="👥" color="text-blue-600 bg-blue-50" />
      <Stat label="Nuevos hoy" value={stats.conversationsToday} icon="🆕" color="text-emerald-600 bg-emerald-50" />
      <Stat label="Mensajes recibidos hoy" value={stats.messagesReceived} icon="💬" color="text-violet-600 bg-violet-50" />
      <Stat label="Esperando atención" value={stats.needsHuman} icon="🔴" color="text-red-600 bg-red-50" />
    </div>
  );
}

function Stat({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-xl ${color.split(" ")[1]}`}>
      <span className="text-2xl">{icon}</span>
      <div>
        <p className={`text-2xl font-bold ${color.split(" ")[0]}`}>{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}
