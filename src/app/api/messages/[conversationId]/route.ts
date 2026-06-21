export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getMessages, insertMessage, enqueueOutbox, getConversationById } from "@/lib/db";

interface Ctx { params: Promise<{ conversationId: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;
  const messages = getMessages(Number(conversationId));
  return NextResponse.json(messages);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;
  const { content } = await req.json();
  const id = Number(conversationId);

  const convo = getConversationById(id);
  if (!convo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const msg = insertMessage(id, "human", content);
  enqueueOutbox(id, convo.phone, content);

  return NextResponse.json({ ok: true, messageId: msg.id });
}
