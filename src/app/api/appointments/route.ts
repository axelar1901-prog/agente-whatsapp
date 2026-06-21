export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getUpcomingAppointments, isCalendarReady } from "@/lib/google-calendar";

export async function GET() {
  if (!isCalendarReady()) return NextResponse.json([]);
  try {
    const events = await getUpcomingAppointments(14);
    const parsed = events.map((e) => {
      const desc = e.description ?? "";
      const nameMatch = desc.match(/Paciente:\s*(.+)/);
      const phoneMatch = desc.match(/WhatsApp:\s*(\d+)/);
      const reasonMatch = desc.match(/Motivo:\s*(.+)/);
      return {
        id: e.id,
        title: e.summary,
        start: e.start?.dateTime ?? e.start?.date,
        end: e.end?.dateTime ?? e.end?.date,
        patient: nameMatch?.[1]?.trim() ?? null,
        phone: phoneMatch?.[1]?.trim() ?? null,
        reason: reasonMatch?.[1]?.trim() ?? null,
      };
    });
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json([]);
  }
}
