import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agente WhatsApp — Dr. Alvarado",
  description: "Dashboard de mensajes WhatsApp con IA",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
