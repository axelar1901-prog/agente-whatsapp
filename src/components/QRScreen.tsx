"use client";

import { useEffect, useState } from "react";

interface Props {
  onConnected: (phone: string) => void;
}

export default function QRScreen({ onConnected }: Props) {
  const [qrPng, setQrPng] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("disconnected");
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(poll, 2000);
    poll();
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  async function poll() {
    try {
      const res = await fetch("/api/connection/status");
      const data = await res.json();
      setStatus(data.status);
      if (data.status === "qr" && data.qrPng) {
        setQrPng(data.qrPng);
      }
      if (data.status === "connected") {
        onConnected(data.phone ?? "");
      }
    } catch {}
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <h1 className="text-xl font-bold text-gray-800 mb-2">Conectar WhatsApp</h1>
        <p className="text-sm text-gray-500 mb-6">
          Escanea el código QR con el WhatsApp del consultorio
        </p>

        {qrPng ? (
          <>
            <img src={qrPng} alt="QR" className="mx-auto mb-4 rounded-lg" />
            <div className="flex items-center justify-center gap-2 text-sm text-amber-600">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Esperando escaneo...
            </div>
          </>
        ) : status === "connecting" ? (
          <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            Conectando...
          </div>
        ) : elapsed > 10 ? (
          <div className="text-sm text-red-500">
            No se pudo obtener el QR. Verifica que el bot esté corriendo con <code className="bg-gray-100 px-1 rounded">npm run start:bot</code>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Iniciando...
          </div>
        )}
      </div>
    </div>
  );
}
