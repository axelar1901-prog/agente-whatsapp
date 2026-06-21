export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { setMode } from "@/lib/db";

interface Ctx { params: Promise<{ conversationId: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;
  const { mode } = await req.json();
  if (mode !== "AI" && mode !== "HUMAN") {
    return NextResponse.json({ error: "mode must be AI or HUMAN" }, { status: 400 });
  }
  setMode(Number(conversationId), mode);
  return NextResponse.json({ ok: true });
}
