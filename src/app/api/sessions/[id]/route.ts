// Spar — fetch a full session (with personas, messages, summary)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
