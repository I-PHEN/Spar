// Spar — End presentation, analyze, return coach read
//
// Called when the user clicks "Done presenting" in a Defense experience.
// This endpoint:
//   1. Saves the presentation transcript as a user message
//   2. Marks the session status as "active" (Q&A can begin)
//   3. Analyzes the presentation via the coach LLM
//   4. Returns the coach's read (strengths, weakness, anticipated attack)
//
// The coach read is shown to the user before Q&A begins. The panel's first
// question can reference the presentation because the transcript is saved.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analyzePresentation } from "@/lib/coach";
import type { ExtractedClaim } from "@/lib/types";

function safeParse<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const presentationTranscript = (body.transcript as string)?.trim() || "";

  if (!presentationTranscript || presentationTranscript.length < 5) {
    return NextResponse.json(
      { error: "Presentation transcript is too short" },
      { status: 400 }
    );
  }

  const session = await db.session.findUnique({
    where: { id },
    include: {
      personas: { orderBy: { seatOrder: "asc" } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.status !== "presenting") {
    return NextResponse.json(
      { error: `Session is not in presenting state (status: ${session.status})` },
      { status: 400 }
    );
  }

  // Save the presentation as a user message (so the panel can reference it)
  await db.sessionMessage.create({
    data: {
      sessionId: session.id,
      role: "user",
      content: presentationTranscript.slice(0, 10000),
      type: "normal",
    },
  });

  // Mark session as active (Q&A can begin)
  await db.session.update({
    where: { id },
    data: {
      status: "active",
      startedAt: new Date(),
    },
  });

  // Analyze the presentation (only if coaching is enabled)
  let coachRead = null;
  if (session.coachingEnabled) {
    const claims: ExtractedClaim[] = session.extractedClaims
      ? safeParse(session.extractedClaims, [])
      : [];

    try {
      coachRead = await analyzePresentation({
        presentationTranscript,
        claims,
        coachingFocus: session.coachingFocus,
      });

      // PERSIST the analysis so the debrief can use it later.
      // This is the key architectural decision: the pre-Q&A read flows
      // into the final debrief as context for the presentation evaluation.
      await db.session.update({
        where: { id: session.id },
        data: {
          presentationAnalysis: JSON.stringify(coachRead),
        },
      });
    } catch (err) {
      console.error("[present] coach analysis failed:", err);
      // Continue without coach read — the Q&A can still proceed
    }
  }

  return NextResponse.json({
    coachRead,
    status: "active",
  });
}
