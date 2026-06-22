"use client";

import { useEffect, useState } from "react";
import QRScreen from "./QRScreen";
import DashboardHeader from "./DashboardHeader";
import StatsBar from "./StatsBar";
import ConversationList from "./ConversationList";
import ConversationPanel from "./ConversationPanel";

interface Conversation {
  id: number;
  phone: string;
  name: string | null;
  mode: "AI" | "HUMAN";
  last_message_at: number | null;
  last_message_preview: string | null;
}

export default function ConnectionGate() {
  const [connected, setConnected] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  useEffect(() => {
    if (!connected) return;
    loadConversations();
    const interval = setInterval(loadConversations, 2000);
    return () => clearInterval(interval);
  }, [connected]);

  async function checkStatus() {
    try {
      const res = await fetch("/api/connection/status");
      const data = await res.json();
      if (data.status === "connected") {
        setConnected(true);
        setPhone(data.phone);
      }
    } catch {}
  }

  async function loadConversations() {
    const res = await fetch("/api/conversations", { cache: "no-store" });
    if (res.ok) setConversations(await res.json());
  }

  function handleConnected(p: string) {
    setConnected(true);
    setPhone(p);
  }

  function handleDisconnect() {
    setConnected(false);
    setPhone(null);
    setSelectedId(null);
    setConversations([]);
  }

  function handleModeChange(id: number, mode: "AI" | "HUMAN") {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, mode } : c))
    );
  }

  function handleDelete() {
    setSelectedId(null);
    loadConversations();
  }

  if (!connected) return <QRScreen onConnected={handleConnected} />;

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <DashboardHeader phone={phone} onDisconnect={handleDisconnect} />
      <StatsBar />
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 bg-white border-r border-gray-200 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Conversaciones</h2>
          </div>
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </aside>
        <main className="flex-1 flex flex-col">
          {selected ? (
            <ConversationPanel
              conversation={selected}
              onModeChange={(mode) => handleModeChange(selected.id, mode)}
              onDelete={handleDelete}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <p>Selecciona una conversación</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
