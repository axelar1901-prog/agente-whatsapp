export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBaileyClient } = await import("./lib/baileys/client");
    startBaileyClient().catch((err) => {
      console.error("[instrumentation] Error iniciando bot:", err);
    });
  }
}
