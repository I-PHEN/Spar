// Spar — current user endpoint (v1: single hardcoded user)

import { NextRequest, NextResponse } from "next/server";
import { getDefaultUserId } from "@/lib/user";
import { db } from "@/lib/db";

export async function GET() {
  const userId = await getDefaultUserId();
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
  });
}

export async function POST(req: NextRequest) {
  const userId = await getDefaultUserId();
  const body = await req.json().catch(() => ({}));
  const { name } = body as { name?: string };

  if (!name || name.trim().length < 2) {
    return NextResponse.json(
      { error: "Name must be at least 2 characters" },
      { status: 400 }
    );
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: { name: name.trim().slice(0, 60) },
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
  });
}
