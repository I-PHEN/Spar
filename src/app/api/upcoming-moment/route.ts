// SharkPit — upcoming moment (drives the Home countdown)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDefaultUserId } from "@/lib/user";

export async function GET() {
  const userId = await getDefaultUserId();
  const moments = await db.upcomingMoment.findMany({
    where: { userId },
    orderBy: { date: "asc" },
  });
  const now = new Date();
  const upcoming = moments.find((m) => m.date > now) ?? null;
  return NextResponse.json({ upcoming, all: moments });
}

export async function POST(req: NextRequest) {
  const userId = await getDefaultUserId();
  const body = await req.json().catch(() => ({}));
  const { title, detail, date } = body as {
    title?: string;
    detail?: string;
    date?: string;
  };

  if (!title || !date) {
    return NextResponse.json(
      { error: "title and date are required" },
      { status: 400 }
    );
  }

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: "invalid date" }, { status: 400 });
  }

  // v1: only one upcoming moment at a time.
  await db.upcomingMoment.deleteMany({ where: { userId } });
  const moment = await db.upcomingMoment.create({
    data: {
      userId,
      title: String(title).slice(0, 120),
      detail: detail ? String(detail).slice(0, 500) : null,
      date: parsedDate,
    },
  });

  return NextResponse.json(moment);
}

export async function DELETE() {
  const userId = await getDefaultUserId();
  await db.upcomingMoment.deleteMany({ where: { userId } });
  return NextResponse.json({ ok: true });
}
