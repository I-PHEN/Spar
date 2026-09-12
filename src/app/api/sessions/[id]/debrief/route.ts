// Spar — fetch the debrief for a session

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
      summary: true,
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
  let presentationEvaluation: string | null = null;
  let coachRead: string | null = null;
  if (session.presentationAnalysis) {
    try {
      const analysis = JSON.parse(session.presentationAnalysis);
      coachRead = analysis.coachRead || null;
    } catch {
      // malformed
    }
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
    personas: session.personas,
  });
}

function safeParse<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
