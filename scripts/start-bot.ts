import "./env-loader";
import fs from "node:fs";
import { startBaileyClient } from "../src/lib/baileys/client";

async function main() {
  console.log("[bot] Iniciando agente WhatsApp...");
  await startBaileyClient();

  setInterval(() => {
    if (fs.existsSync("./data/.restart")) {
      console.log("[bot] Señal de reinicio detectada. Reiniciando...");
      fs.unlinkSync("./data/.restart");
      process.exit(0);
    }
  }, 1000);
}

main().catch((err) => {
  console.error("[bot] Error fatal:", err);
  process.exit(1);
});
