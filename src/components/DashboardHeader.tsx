"use client";

import { useState } from "react";
import AppointmentsView from "./AppointmentsView";

interface Props {
  phone: string | null;
  onDisconnect: () => void;
}

export default function DashboardHeader({ phone, onDisconnect }: Props) {
  const [showAppointments, setShowAppointments] = useState(false);

  async function disconnect() {
    await fetch("/api/connection/disconnect", { method: "POST" });
    onDisconnect();
  }

  return (
    <>
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-gray-800">Consultorio Dr. Alvarado</span>
          {phone && <span className="text-sm text-gray-400">· {phone}</span>}
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowAppointments(true)}
            className="flex items-center gap-2 text-sm bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-lg font-medium transition-colors"
          >
            📅 Ver citas
          </button>
          <button
            onClick={disconnect}
            className="text-sm text-gray-500 hover:text-red-500 transition-colors"
          >
            Desconectar
          </button>
        </div>
      </header>

      {showAppointments && <AppointmentsView onClose={() => setShowAppointments(false)} />}
    </>
  );
}
