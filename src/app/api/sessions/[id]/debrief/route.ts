// Spar — fetch the debrief for a session

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDrillDefinition } from "@/lib/drills";
import type { DrillTarget } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await db.session.findUnique({
    where: { id },
    include: {
      summary: true,
      skills: true,
      personas: { orderBy: { seatOrder: "asc" } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (!session.summary) {
    return NextResponse.json({ error: "No debrief yet" }, { status: 404 });
  }

  // Load presentation analysis if it exists (Defense/Boardroom)
  const presentationEvaluation: string | null = null;
  let coachRead: string | null = null;
  if (session.presentationAnalysis) {
    try {
      const analysis = JSON.parse(session.presentationAnalysis);
      coachRead = analysis.coachRead || null;
    } catch {
      // malformed
    }
  }

  // Build the transcript for the debrief (for the collapsible transcript section)
  const transcript = session.messages.map((m) => {
    const persona = m.personaId
      ? session.personas.find((p) => p.id === m.personaId)
      : null;
    return {
      role: m.role,
      personaName: persona?.name || null,
      content: m.content,
      type: m.type,
      createdAt: m.createdAt.toISOString(),
    };
  });

  // Build drill stats if this was a drill session (re-compute from the transcript)
  let drillStats: {
    target: string;
    label: string;
    totalChallenges: number;
    resolvedChallenges: number;
    unresolvedChallenges: number;
    attempt1Clean: number;
    attempt2Clean: number;
    attempt3Plus: number;
    fastestRecovery: number;
    slowestRecovery: number;
    avgRecovery: number;
    totalScore: number;
    maxScore: number;
  } | null = null;

  if (session.experience === "drill") {
    const drillTarget = (session.drillTarget as DrillTarget) || "hedging";
    const def = getDrillDefinition(drillTarget);
    const messages = session.messages;

    interface ChallengeGroup {
      firstInterruptTime: number;
      ackTime: number | null;
      attempts: number;
    }
    const challenges: ChallengeGroup[] = [];
    let i = 0;
    while (i < messages.length) {
      if (messages[i].role === "persona" && messages[i].type === "interruption") {
        const firstInterruptTime = messages[i].createdAt.getTime();
        let attempts = 0;
        let ackTime: number | null = null;
        let j = i + 1;
        while (j < messages.length) {
          if (messages[j].role === "user") {
            attempts++;
          } else if (messages[j].role === "persona") {
            if (messages[j].type === "interruption") {
              // same challenge
            } else {
              ackTime = messages[j].createdAt.getTime();
              break;
            }
          }
          j++;
        }
        challenges.push({ firstInterruptTime, ackTime, attempts });
        i = ackTime !== null ? j + 1 : messages.length;
      } else {
        i++;
      }
    }

    const totalChallenges = challenges.length;
    const resolvedChallenges = challenges.filter((c) => c.ackTime !== null).length;
    let attempt1Clean = 0, attempt2Clean = 0, attempt3Plus = 0;
    const recoveryTimes: number[] = [];
    for (const c of challenges) {
      if (c.ackTime === null) continue;
      if (c.attempts === 1) attempt1Clean++;
      else if (c.attempts === 2) attempt2Clean++;
      else if (c.attempts >= 3) attempt3Plus++;
      recoveryTimes.push(Math.max(0, (c.ackTime - c.firstInterruptTime) / 1000));
    }

    drillStats = {
      target: drillTarget,
      label: def.label,
      totalChallenges,
      resolvedChallenges,
      unresolvedChallenges: totalChallenges - resolvedChallenges,
      attempt1Clean,
      attempt2Clean,
      attempt3Plus,
      fastestRecovery: recoveryTimes.length > 0 ? Math.round(Math.min(...recoveryTimes)) : 0,
      slowestRecovery: recoveryTimes.length > 0 ? Math.round(Math.max(...recoveryTimes)) : 0,
      avgRecovery: recoveryTimes.length > 0 ? Math.round(recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length) : 0,
      totalScore: attempt1Clean * 3 + attempt2Clean * 2 + attempt3Plus * 1,
      maxScore: totalChallenges * 3,
    };
  }

  return NextResponse.json({
    debrief: {
      momentDescription: session.summary.momentDescription,
      presentationEvaluation,
      coachRead,
      whatWentWell: safeParse<string[]>(session.summary.whatWentWell, []),
      thePattern: session.summary.thePattern,
      oneThingToPractice: session.summary.oneThingToPractice,
      telemetryInsights: safeParse(session.summary.telemetryInsights, {
        pace: "",
        fillers: "",
        recovery: "",
        evidence: "",
      }),
      shareableSummary: session.summary.shareableSummary,
    },
    telemetry: session.telemetry ? safeParse(session.telemetry, null) : null,
    skillSnapshot: session.skills
      ? {
          clarity: session.skills.clarity,
          recovery: session.skills.recovery,
          concision: session.skills.concision,
          presence: session.skills.presence,
          evidence: session.skills.evidence,
        }
      : undefined,
    coachingFocus: session.coachingFocus ?? null,
    materialTitle: session.materialTitle ?? null,
    personas: session.personas,
    transcript,
    drillStats,
  });
}

function safeParse<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
