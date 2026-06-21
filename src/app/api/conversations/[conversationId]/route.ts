import { NextRequest, NextResponse } from "next/server";
import { deleteConversation } from "@/lib/db";

interface Ctx { params: Promise<{ conversationId: string }> }

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;
  deleteConversation(Number(conversationId));
  return NextResponse.json({ ok: true });
}
