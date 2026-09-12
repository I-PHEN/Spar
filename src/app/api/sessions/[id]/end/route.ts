// Spar — end session + generate debrief + update pattern memory
//
// This is the most important endpoint in v1. It:
//   1. Marks the session as ended
//   2. Computes telemetry from the full transcript
//   3. Generates the 6-section coaching debrief (the hero artifact)
//   4. Saves SessionSummary
//   5. Updates PatternMemory (upserts the observed pattern)
//   6. Creates a SkillSnapshot (5-dimension scoring)
//   7. Returns the debrief

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  generateDebrief,
  buildPatternMemoryContext,
  classifyPatternTag,
} from "@/lib/llm";
import { SCENARIOS } from "@/lib/scenarios";
import {
  aggregateTelemetry,
  computeTurnTelemetry,
} from "@/lib/telemetry";
import type { ArchetypeKey, ExtractedClaim } from "@/lib/types";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await db.session.findUnique({
    where: { id },
    include: {
      personas: { orderBy: { seatOrder: "asc" } },
      messages: { orderBy: { createdAt: "asc" } },
      user: {
        include: {
          patternMemories: { orderBy: { lastSeen: "desc" }, take: 10 },
          sessions: {
            where: { status: "debriefed" },
            orderBy: { endedAt: "desc" },
            take: 3,
            include: { summary: true },
          },
        },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.status === "debriefed" && session.summary) {
    // Already debriefed — return existing.
    return NextResponse.json({
      debrief: session.summary,
      alreadyDebriefed: true,
    });
  }

  // Mark as ended.
  await db.session.update({
    where: { id },
    data: {
      status: "ended",
      endedAt: new Date(),
    },
  });

  // Compute telemetry from the transcript.
  const messages = session.messages;
  const userMessages = messages.filter((m) => m.role === "user");
  const personaMessages = messages.filter((m) => m.role === "persona");

  // Build per-turn telemetry.
  const turns: ReturnType<typeof computeTurnTelemetry>[] = [];
  for (let i = 0; i < userMessages.length; i++) {
    const userMsg = userMessages[i];
    // Find the persona message that preceded this user message.
    const userMsgIdx = messages.indexOf(userMsg);
    let precedingPersonaMsg = null;
    for (let j = userMsgIdx - 1; j >= 0; j--) {
      if (messages[j].role === "persona") {
        precedingPersonaMsg = messages[j];
        break;
      }
    }
    // Did the preceding persona message ask a direct question?
    const personaAskedDirectQuestion = precedingPersonaMsg
      ? /\?/.test(precedingPersonaMsg.content)
      : false;
    // Response latency: approximate from createdAt timestamps.
    const responseMs = precedingPersonaMsg
      ? Math.min(
          120000,
          Math.max(
            0,
            userMsg.createdAt.getTime() - precedingPersonaMsg.createdAt.getTime()
          )
        )
      : 0;
    turns.push(
      computeTurnTelemetry({
        userText: userMsg.content,
        responseMs,
        personaAskedDirectQuestion,
        turnIndex: i,
      })
    );
  }

  const telemetry = aggregateTelemetry(turns);

  // Build the transcript string for the debrief LLM.
  const transcriptStr = messages
    .map((m) => {
      if (m.role === "user") return `User: ${m.content}`;
      if (m.role === "persona") {
        const p = session.personas.find((pp) => pp.id === m.personaId);
        const tag = m.type === "interruption" ? " (interrupting)" : m.type === "opening" ? " (opening)" : "";
        return `${p?.name || "Panelist"}${tag}: ${m.content}`;
      }
      return null;
    })
    .filter(Boolean)
    .join("\n");

  const claims: ExtractedClaim[] = session.extractedClaims
    ? safeParse(session.extractedClaims, [])
    : [];

  const scenario = SCENARIOS[session.scenario as keyof typeof SCENARIOS];
  const scenarioLabel = scenario?.label || "Custom Session";

  const patternMemory = buildPatternMemoryContext({
    patterns: session.user.patternMemories.map((p) => ({
      tag: p.tag,
      description: p.description,
      occurrences: p.occurrences,
    })),
    recentSummaries: session.user.sessions
      .filter((s) => s.summary)
      .map((s) => ({
        scenarioLabel: SCENARIOS[s.scenario as keyof typeof SCENARIOS]?.label || s.scenario,
        thePattern: s.summary!.thePattern,
        oneThingToPractice: s.summary!.oneThingToPractice,
        createdAt: s.endedAt || s.createdAt,
      })),
  });

  // Generate the debrief.
  const debrief = await generateDebrief({
    scenarioLabel,
    claims,
    transcript: transcriptStr,
    personaArchetypes: session.personas.map((p) => ({
      name: p.name,
      archetype: p.archetype as ArchetypeKey,
    })),
    telemetry,
    patternMemory,
  });

  // Persist the summary.
  const summary = await db.sessionSummary.create({
    data: {
      sessionId: session.id,
      momentDescription: debrief.momentDescription,
      whatWentWell: JSON.stringify(debrief.whatWentWell),
      thePattern: debrief.thePattern,
      oneThingToPractice: debrief.oneThingToPractice,
      telemetryInsights: JSON.stringify(debrief.telemetryInsights),
      shareableSummary: debrief.shareableSummary,
    },
  });

  // Persist telemetry on the session.
  await db.session.update({
    where: { id },
    data: {
      status: "debriefed",
      telemetry: JSON.stringify(telemetry),
    },
  });

  // Update PatternMemory: upsert the pattern tagged from the debrief.
  if (debrief.thePattern && debrief.thePattern.trim().length > 0) {
    const tag = classifyPatternTag(debrief.thePattern);
    const existing = await db.patternMemory.findUnique({
      where: {
        userId_tag: { userId: session.userId, tag },
      },
    });
    if (existing) {
      await db.patternMemory.update({
        where: { id: existing.id },
        data: {
          description: debrief.thePattern.slice(0, 500),
          occurrences: { increment: 1 },
          lastSeen: new Date(),
        },
      });
    } else {
      await db.patternMemory.create({
        data: {
          userId: session.userId,
          tag,
          description: debrief.thePattern.slice(0, 500),
          occurrences: 1,
          lastSeen: new Date(),
        },
      });
    }
  }

  // Compute a simple SkillSnapshot from telemetry.
  // Heuristic scoring: 0-100 per dimension, mapped from telemetry.
  const clarityScore = clampScore(100 - telemetry.hedgesPerResponse * 20);
  const recoveryScore = clampScore(
    telemetry.userTurns > 0
      ? ((telemetry.userTurns - telemetry.deflections) / telemetry.userTurns) * 100
      : 50
  );
  const concisionScore = clampScore(
    telemetry.avgWordsPerResponse > 0
      ? // Target: 15-25 words. Penalize long-windedness heavily, short slightly.
        100 - Math.abs(telemetry.avgWordsPerResponse - 20) * 2.5
      : 50
  );
  const presenceScore = clampScore(
    telemetry.avgResponseMs > 0
      ? 100 - Math.min(50, Math.max(0, (telemetry.avgResponseMs - 3000) / 100))
      : 50
  );
  const evidenceScore = clampScore(
    telemetry.userTurns > 0
      ? (telemetry.evidenceCitations / telemetry.userTurns) * 100
      : 50
  );

  await db.skillSnapshot.create({
    data: {
      userId: session.userId,
      sessionId: session.id,
      clarity: clarityScore,
      recovery: recoveryScore,
      concision: concisionScore,
      presence: presenceScore,
      evidence: evidenceScore,
    },
  });

  return NextResponse.json({
    debrief: {
      momentDescription: summary.momentDescription,
      whatWentWell: safeParse<string[]>(summary.whatWentWell, []),
      thePattern: summary.thePattern,
      oneThingToPractice: summary.oneThingToPractice,
      telemetryInsights: safeParse(summary.telemetryInsights, {
        pace: "",
        fillers: "",
        recovery: "",
        evidence: "",
      }),
      shareableSummary: summary.shareableSummary,
    },
    telemetry,
    skillSnapshot: {
      clarity: clarityScore,
      recovery: recoveryScore,
      concision: concisionScore,
      presence: presenceScore,
      evidence: evidenceScore,
    },
  });
}

function clampScore(n: number): number {
  return Math.round(Math.min(100, Math.max(0, n)));
}

function safeParse<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
