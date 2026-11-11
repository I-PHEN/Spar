// Spar — sparring turn
//
// Receives a user message (or a "continue" signal), generates the next
// persona's response, returns it. The frontend calls this repeatedly until
// `isUserTurn` is true.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  generatePersonaResponse,
  buildPatternMemoryContext,
} from "@/lib/llm";
import { generatePersonaAudio } from "@/lib/voice";
import { buildDrillPrompt, buildDrillInterruptInstruction } from "@/lib/drills";
import type { DrillTarget } from "@/lib/types";
import { SCENARIOS } from "@/lib/scenarios";
import type { ArchetypeKey, ExtractedClaim } from "@/lib/types";

interface SparBody {
  userMessage?: string;
  /** Latency (ms) between the last persona message arriving and the user submitting. */
  responseMs?: number;
  /** When true, the persona is interrupting the user mid-speech (agitation threshold hit). */
  isInterrupt?: boolean;
  /** When provided, this persona speaks instead of the round-robin next. Used for interrupts. */
  forcedPersonaId?: string;
}

const PERSONAS_PER_USER_TURN = 1;

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
    session.messages = await db.sessionMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "asc" },
    });
  }

  const messagesSinceLastUser: typeof session.messages = [];
  for (let i = session.messages.length - 1; i >= 0; i--) {
    if (session.messages[i].role === "user") break;
    messagesSinceLastUser.unshift(session.messages[i]);
  }

  const personasCount = session.personas.length;
  const responsesThisTurn = messagesSinceLastUser.filter(
    (m) => m.role === "persona"
  ).length;

  if (responsesThisTurn >= Math.min(PERSONAS_PER_USER_TURN, personasCount)) {
    return NextResponse.json({
      isUserTurn: true,
      nextPersonaId: null,
      personaResponse: null,
    });
  }

  let nextPersona;
  if (body.forcedPersonaId) {
    nextPersona = session.personas.find((p) => p.id === body.forcedPersonaId);
  } else {
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
    nextPersona = session.personas.find(
      (p) => p.seatOrder === nextPersonaOrder
    );
  }
  if (!nextPersona) {
    return NextResponse.json({ error: "No persona available" }, { status: 500 });
  }

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
  const scenarioLabel = scenario?.label || "Custom Session";

  const experienceContext =
    session.experience === "defense"
      ? "\n## EXPERIENCE: DEFENSE\nThe user has already presented their material. The transcript above includes their full presentation. Ask questions about what they actually said — reference specific points from their presentation."
      : session.experience === "boardroom"
      ? "\n## EXPERIENCE: BOARDROOM\nYou are in a high-pressure boardroom. The user is presenting and you may interrupt mid-speech when they show weakness."
      : session.experience === "drill"
      ? buildDrillPrompt((session.drillTarget as DrillTarget) || "hedging")
      : "";

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

  let userMessageForLlm = lastUserMessageContent;
  if (!userMessageForLlm) {
    const lastUserMsg = [...session.messages].reverse().find((m) => m.role === "user");
    userMessageForLlm = lastUserMsg?.content || "(User has not yet spoken.)";
  }

  const response = await generatePersonaResponse({
    archetype: nextPersona.archetype as ArchetypeKey,
    behaviorStyle: nextPersona.behaviorStyle as "gentle" | "moderate" | "aggressive",
    personaName: nextPersona.name,
    scenarioLabel,
    claims,
    patternMemory: patternMemory + experienceContext,
    otherPersonas,
    transcript: transcriptStr,
    userMessage: userMessageForLlm,
    isInterrupt: body.isInterrupt || false,
    roomContext: session.roomContext || scenario?.roomContext || "",
    coachingFocus: session.coachingFocus ?? null,
    materialTitle: session.materialTitle ?? null,
    rawMaterial: session.rawMaterial ?? null,
    extraInterruptInstruction:
      body.isInterrupt && session.experience === "drill"
        ? buildDrillInterruptInstruction(
            (session.drillTarget as DrillTarget) || "hedging"
          )
        : undefined,
  });

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

  const audio = await generatePersonaAudio(
    response.content,
    nextPersona.archetype as ArchetypeKey,
    nextPersona.behaviorStyle as "gentle" | "moderate" | "aggressive"
  );

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
      audio,
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
