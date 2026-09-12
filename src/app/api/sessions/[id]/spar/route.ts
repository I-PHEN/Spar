// Spar — sparring turn
//
// Receives a user message (or a "continue" signal), generates the next
// persona's response, returns it. The frontend calls this repeatedly until
// `isUserTurn` is true.
//
// Rules:
//   - After a user submits, up to 2 personas respond (round-robin).
//   - For 1-persona panels, only 1 persona responds per user turn.
//   - The next persona to speak is the one after the last persona who spoke.
//   - All persona responses see the full transcript (so they don't repeat).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  generatePersonaResponse,
  buildPatternMemoryContext,
} from "@/lib/llm";
import { SCENARIOS } from "@/lib/scenarios";
import type { ArchetypeKey, ExtractedClaim } from "@/lib/types";

interface SparBody {
  userMessage?: string;
  /** Latency (ms) between the last persona message arriving and the user submitting. */
  responseMs?: number;
}

const PERSONAS_PER_USER_TURN = 2;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as SparBody;

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
            include: { summary: true, personas: true },
          },
        },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.status !== "active") {
    return NextResponse.json(
      { error: `Session is not active (status: ${session.status})` },
      { status: 400 }
    );
  }

  // If user message provided, persist it.
  let lastUserMessageContent: string | null = null;
  if (body.userMessage && body.userMessage.trim().length > 0) {
    const trimmed = body.userMessage.trim().slice(0, 5000);
    await db.sessionMessage.create({
      data: {
        sessionId: session.id,
        role: "user",
        content: trimmed,
        type: "normal",
      },
    });
    lastUserMessageContent = trimmed;
    // Refresh messages list
    session.messages = await db.sessionMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "asc" },
    });
  }

  // Count persona messages since the last user message.
  const messagesSinceLastUser: typeof session.messages = [];
  for (let i = session.messages.length - 1; i >= 0; i--) {
    if (session.messages[i].role === "user") break;
    messagesSinceLastUser.unshift(session.messages[i]);
  }

  const personasCount = session.personas.length;
  const responsesThisTurn = messagesSinceLastUser.filter(
    (m) => m.role === "persona"
  ).length;

  // If we've already hit the cap for this turn, hand control back to the user.
  if (responsesThisTurn >= Math.min(PERSONAS_PER_USER_TURN, personasCount)) {
    return NextResponse.json({
      isUserTurn: true,
      nextPersonaId: null,
      personaResponse: null,
    });
  }

  // Determine next persona (round-robin after the last persona to speak).
  const lastPersonaMsg = [...messagesSinceLastUser].reverse().find((m) => m.role === "persona");
  let nextPersonaOrder = 0;
  if (lastPersonaMsg) {
    const lastPersona = session.personas.find(
      (p) => p.id === lastPersonaMsg.personaId
    );
    if (lastPersona) {
      const lastOrder = lastPersona.seatOrder;
      nextPersonaOrder = (lastOrder + 1) % personasCount;
    }
  }
  const nextPersona = session.personas.find(
    (p) => p.seatOrder === nextPersonaOrder
  );
  if (!nextPersona) {
    return NextResponse.json({ error: "No persona available" }, { status: 500 });
  }

  // Build the transcript string for the LLM.
  const transcriptStr = session.messages
    .map((m) => {
      if (m.role === "user") return `User: ${m.content}`;
      if (m.role === "persona") {
        const p = session.personas.find((pp) => pp.id === m.personaId);
        return `${p?.name || "Panelist"}: ${m.content}`;
      }
      return null;
    })
    .filter(Boolean)
    .join("\n");

  const claims: ExtractedClaim[] = session.extractedClaims
    ? safeParse(session.extractedClaims, [])
    : [];

  const scenario = SCENARIOS[session.scenario as keyof typeof SCENARIOS];

  const otherPersonas = session.personas
    .filter((p) => p.id !== nextPersona.id)
    .map((p) => ({
      name: p.name,
      archetype: p.archetype as ArchetypeKey,
    }));

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

  // The "user message" the LLM should respond to: the most recent user message,
  // or — if this is a continuation — the latest user message in the transcript.
  let userMessageForLlm = lastUserMessageContent;
  if (!userMessageForLlm) {
    const lastUserMsg = [...session.messages].reverse().find((m) => m.role === "user");
    userMessageForLlm = lastUserMsg?.content || "(User has not yet spoken.)";
  }

  const response = await generatePersonaResponse({
    archetype: nextPersona.archetype as ArchetypeKey,
    behaviorStyle: nextPersona.behaviorStyle as "gentle" | "moderate" | "aggressive",
    personaName: nextPersona.name,
    scenarioLabel: scenario?.label || session.scenario,
    claims,
    patternMemory,
    otherPersonas,
    transcript: transcriptStr,
    userMessage: userMessageForLlm,
  });

  // Persist persona response.
  const message = await db.sessionMessage.create({
    data: {
      sessionId: session.id,
      personaId: nextPersona.id,
      role: "persona",
      content: response.content,
      type: response.type,
      claimRef: response.claimRef ?? null,
    },
  });

  // Determine if this was the last response for this turn.
  const newResponsesThisTurn = responsesThisTurn + 1;
  const isUserTurn =
    newResponsesThisTurn >= Math.min(PERSONAS_PER_USER_TURN, personasCount);

  return NextResponse.json({
    isUserTurn,
    nextPersonaId: isUserTurn ? null : nextPersona.id,
    personaResponse: {
      id: message.id,
      personaId: nextPersona.id,
      personaName: nextPersona.name,
      archetype: nextPersona.archetype,
      behaviorStyle: nextPersona.behaviorStyle,
      seatOrder: nextPersona.seatOrder,
      content: response.content,
      type: response.type,
      claimRef: response.claimRef ?? null,
      mood: response.mood,
      createdAt: message.createdAt,
    },
  });
}

function safeParse<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
