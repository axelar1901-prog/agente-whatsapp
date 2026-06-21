"use client";

import { useEffect, useState } from "react";

interface Appointment {
  id: string;
  title: string;
  start: string;
  end: string;
  patient: string | null;
  phone: string | null;
  reason: string | null;
}

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function formatTime(iso: string) {
  const d = new Date(iso);
  const h = d.getHours();
  const min = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${min} ${ampm}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function isTomorrow(iso: string) {
  const d = new Date(iso);
  const tom = new Date();
  tom.setDate(tom.getDate() + 1);
  return d.toDateString() === tom.toDateString();
}

function dayLabel(iso: string) {
  if (isToday(iso)) return "Hoy";
  if (isTomorrow(iso)) return "Mañana";
  return formatDate(iso);
}

export default function AppointmentsView({ onClose }: { onClose: () => void }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/appointments")
      .then((r) => r.json())
      .then((data) => { setAppointments(data); setLoading(false); });
  }, []);

  // Agrupar por día
  const groups: Record<string, Appointment[]> = {};
  for (const a of appointments) {
    const key = dayLabel(a.start);
    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-10">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">Próximas citas</h2>
            <p className="text-xs text-gray-400">Próximos 14 días</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && <p className="text-sm text-gray-400 text-center py-8">Cargando citas...</p>}
          {!loading && appointments.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No hay citas en los próximos 14 días.</p>
          )}
          {!loading && Object.entries(groups).map(([day, items]) => (
            <div key={day} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                  day === "Hoy" ? "bg-emerald-100 text-emerald-700" :
                  day === "Mañana" ? "bg-blue-100 text-blue-700" :
                  "bg-gray-100 text-gray-600"
                }`}>{day}</span>
                <span className="text-xs text-gray-400">{items.length} {items.length === 1 ? "cita" : "citas"}</span>
              </div>
              <div className="space-y-2">
                {items.map((a) => (
                  <div key={a.id} className="flex gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
                    <div className="text-center shrink-0 w-16">
                      <p className="text-sm font-bold text-emerald-600">{formatTime(a.start)}</p>
                      <p className="text-xs text-gray-400">{formatTime(a.end)}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-800">{a.patient ?? a.title}</p>
                      {a.phone && <p className="text-xs text-gray-400">📱 {a.phone}</p>}
                      {a.reason && <p className="text-xs text-gray-500 truncate">📋 {a.reason}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
