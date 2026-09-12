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
  type GenerateDebriefParams,
} from "@/lib/llm";
import { getDrillDefinition } from "@/lib/drills";
import type { DrillTarget } from "@/lib/types";
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

  // ─── Presentation section (Defense/Boardroom only) ─────────────────────
  // For Defense/Boardroom, the FIRST user message is the presentation.
  // Everything after is Q&A. We split the transcript and pass the
  // presentation + the coach's pre-Q&A analysis to the debrief LLM.
  const isDefenseOrBoardroom =
    session.experience === "defense" || session.experience === "boardroom";

  let presentationSection: GenerateDebriefParams["presentationSection"] | undefined;
  let qaTranscriptStr = transcriptStr;

  if (isDefenseOrBoardroom) {
    // Find the first user message (the presentation)
    const firstUserMsg = messages.find((m) => m.role === "user");
    if (firstUserMsg) {
      const presentationTranscript = firstUserMsg.content;

      // Build the Q&A transcript (everything AFTER the presentation)
      const firstUserIdx = messages.indexOf(firstUserMsg);
      const qaMessages = messages.slice(firstUserIdx + 1);
      qaTranscriptStr = qaMessages
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

      // Load the stored presentation analysis
      let presentationAnalysis = null;
      if (session.presentationAnalysis) {
        try {
          presentationAnalysis = JSON.parse(session.presentationAnalysis);
        } catch {
          // Malformed — continue without
        }
      }

      presentationSection = {
        transcript: presentationTranscript,
        analysis: presentationAnalysis,
      };
    }
  }

  // ─── Drill stats (Drill Mode only) ─────────────────────────────────────
  // Count drill challenges from the transcript. Each "interruption" type
  // message from a persona = one drill challenge. Each subsequent user
  // message before the next non-interruption persona message = an attempt.
  let drillSection: GenerateDebriefParams["drillSection"] | undefined;
  if (session.experience === "drill") {
    const drillTarget = (session.drillTarget as DrillTarget) || "hedging";
    const def = getDrillDefinition(drillTarget);

    // Count interruptions (drill challenges) in the transcript
    const interruptions = messages.filter(
      (m) => m.role === "persona" && m.type === "interruption"
    );
    const totalChallenges = interruptions.length;

    // Count user messages between interruptions to estimate attempts
    // (each user message after an interruption = one attempt)
    let attempt1Clean = 0;
    let attempt2Clean = 0;
    let attempt3Plus = 0;
    let resolved = 0;

    for (let i = 0; i < interruptions.length; i++) {
      const interruptIdx = messages.indexOf(interruptions[i]);
      // Count user messages until the next non-interruption persona message
      // (that's the acknowledgment "Good. Next.")
      let attempts = 0;
      for (let j = interruptIdx + 1; j < messages.length; j++) {
        if (messages[j].role === "user") {
          attempts++;
        } else if (
          messages[j].role === "persona" &&
          messages[j].type !== "interruption"
        ) {
          // This is the acknowledgment — resolved
          break;
        }
      }
      if (attempts === 1) attempt1Clean++;
      else if (attempts === 2) attempt2Clean++;
      else if (attempts >= 3) attempt3Plus++;
      if (attempts > 0) resolved++;
    }

    const totalScore =
      attempt1Clean * 3 + attempt2Clean * 2 + attempt3Plus * 1;
    const maxScore = totalChallenges * 3;

    drillSection = {
      target: drillTarget,
      label: def.label,
      totalChallenges,
      resolvedChallenges: resolved,
      unresolvedChallenges: totalChallenges - resolved,
      attempt1Clean,
      attempt2Clean,
      attempt3Plus,
      fastestRecovery: 0, // Would need timestamp tracking — future enhancement
      slowestRecovery: 0,
      avgRecovery: 0,
      totalScore,
      maxScore,
    };
  }

  // Generate the debrief.
  const debrief = await generateDebrief({
    scenarioLabel,
    claims,
    transcript: qaTranscriptStr,
    personaArchetypes: session.personas.map((p) => ({
      name: p.name,
      archetype: p.archetype as ArchetypeKey,
    })),
    telemetry,
    patternMemory,
    presentationSection,
    drillSection,
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
      presentationEvaluation: debrief.presentationEvaluation || null,
      coachRead: presentationSection?.analysis?.coachRead || null,
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
