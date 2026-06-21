export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getNotes, addNote, deleteNote } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  return NextResponse.json(getNotes(Number(conversationId)));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "empty" }, { status: 400 });
  return NextResponse.json(addNote(Number(conversationId), content.trim()));
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const { id } = await req.json();
  deleteNote(Number(id));
  return NextResponse.json({ ok: true });
}
