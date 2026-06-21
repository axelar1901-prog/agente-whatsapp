import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode-terminal";
import path from "node:path";
import fs from "node:fs";
import { setConnectionState } from "../db";
import { handleIncomingMessages } from "./handler";

const AUTH_DIR = path.resolve(process.cwd(), "auth");

const logger = pino({ level: "silent" });

export interface BaileysHandle {
  sock: ReturnType<typeof makeWASocket>;
  shutdown: () => Promise<void>;
}

let handle: BaileysHandle | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export async function startBaileyClient(): Promise<void> {
  await start();
}

async function start(): Promise<void> {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  let version: [number, number, number] | undefined;
  try {
    const fetched = await fetchLatestBaileysVersion();
    version = fetched.version;
    console.log(`[bot] Usando Baileys version ${version.join(".")}`);
  } catch (err) {
    console.warn("[bot] No se pudo obtener última versión de Baileys:", err);
  }

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    browser: Browsers.macOS("Desktop"),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  handle = {
    sock,
    shutdown: async () => {
      try { sock.end(undefined); } catch {}
    },
  };

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("[bot] QR generado — escanea desde el dashboard en localhost:3000");
      QRCode.generate(qr, { small: true });
      setConnectionState({ status: "qr", qr_string: qr, phone: null });
    }

    if (connection === "connecting") {
      const current = (await import("../db")).getConnectionState();
      if (current.status === "disconnected") {
        setConnectionState({ status: "connecting" });
      }
    }

    if (connection === "open") {
      const rawId = sock.user?.id ?? "";
      const phone = rawId.split(":")[0];
      console.log(`[bot] Conectado como ${phone}`);
      setConnectionState({ status: "connected", qr_string: null, phone });
    }

    if (connection === "close") {
      const code = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
      console.log(`[bot] Conexión cerrada. Código: ${code}`);

      if (code === DisconnectReason.loggedOut) {
        console.log("[bot] Sesión cerrada (logout). Borrando auth...");
        setConnectionState({ status: "disconnected", qr_string: null, phone: null });
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        return;
      }

      scheduleReconnect(code);
    }
  });

  sock.ev.on("messages.upsert", (upsert) => {
    handleIncomingMessages(sock, upsert);
  });
}

function scheduleReconnect(code: number | undefined): void {
  if (reconnectTimer) return;
  const delay = code === 440 ? 15000 : 5000;
  console.log(`[bot] Reconectando en ${delay / 1000}s...`);
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (handle) {
      try { handle.sock.end(undefined); } catch {}
      handle = null;
    }
    await start();
  }, delay);
}
