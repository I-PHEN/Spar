// Spar — Home screen quick stats

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDefaultUserId } from "@/lib/user";

export async function GET() {
  const userId = await getDefaultUserId();

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const sessionsThisWeek = await db.session.count({
    where: {
      userId,
      createdAt: { gte: weekAgo },
    },
  });

  // Current streak: consecutive days with at least one session.
  const recentSessions = await db.session.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { createdAt: true },
  });
  const daySet = new Set(
    recentSessions.map((s) => s.createdAt.toISOString().slice(0, 10))
  );
  let streak = 0;
  const cursor = new Date();
  // Walk back day by day until we find a day with no session.
  // (Today counts if there's a session today; otherwise start from yesterday.)
  for (let i = 0; i < 60; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (daySet.has(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else if (i === 0) {
      // No session today — that's fine, streak counts up to yesterday.
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  // Top skill: from the latest SkillSnapshot, the highest-scoring dimension.
  const latestSnapshot = await db.skillSnapshot.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  let topSkill: { name: string; score: number } | null = null;
  if (latestSnapshot) {
    const dims: Array<[string, number]> = [
      ["Clarity", latestSnapshot.clarity],
      ["Recovery", latestSnapshot.recovery],
      ["Concision", latestSnapshot.concision],
      ["Presence", latestSnapshot.presence],
      ["Evidence", latestSnapshot.evidence],
    ];
    dims.sort((a, b) => b[1] - a[1]);
    topSkill = { name: dims[0][0], score: Math.round(dims[0][1]) };
  }

  // Total sessions + total sparring time
  const totalSessions = await db.session.count({
    where: { userId, status: "debriefed" },
  });

  // Today's Focus: latest pattern memory entry
  const latestPattern = await db.patternMemory.findFirst({
    where: { userId },
    orderBy: { lastSeen: "desc" },
  });
  const todaysFocus = latestPattern
    ? {
        tag: latestPattern.tag,
        description: latestPattern.description,
      }
    : null;

  return NextResponse.json({
    sessionsThisWeek,
    streak,
    topSkill,
    totalSessions,
    todaysFocus,
  });
}
