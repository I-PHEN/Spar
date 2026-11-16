// Spar — fetch or delete a full session (with personas, messages, summary)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDefaultUserId } from "@/lib/user";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await db.session.findUnique({
    where: { id },
    include: {
      personas: { orderBy: { seatOrder: "asc" } },
      messages: { orderBy: { createdAt: "asc" } },
      summary: true,
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({ session });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getDefaultUserId();
  const { id } = await params;
  const existing = await db.session.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });

  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  await db.session.delete({ where: { id } });
  return NextResponse.json({ deleted: true, id });
}
