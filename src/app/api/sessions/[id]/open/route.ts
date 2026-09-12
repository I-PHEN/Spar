// Spar — panel's opening challenge
//
// When the user enters the Sparring Room, the panel speaks first.
// The first persona (seat 0) delivers a sharp opening that goes straight
// at the user's central claim. No "welcome," no pleasantries.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  generateOpening,
  buildPatternMemoryContext,
} from "@/lib/llm";
import { generatePersonaAudio } from "@/lib/voice";
import { SCENARIOS } from "@/lib/scenarios";
import { ARCHETYPES } from "@/lib/personas";
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
            include: { summary: true, personas: true },
          },
        },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // If there are already messages (e.g., user is reopening), don't generate a new opening.
  if (session.messages.length > 0) {
    return NextResponse.json({
      alreadyStarted: true,
      messages: session.messages,
    });
  }

  // Mark session as active.
  await db.session.update({
    where: { id },
    data: {
      status: "active",
      startedAt: new Date(),
    },
  });

  const claims: ExtractedClaim[] = session.extractedClaims
    ? safeParse(session.extractedClaims, [])
    : [];

  const scenario = SCENARIOS[session.scenario as keyof typeof SCENARIOS];
  // For custom scenarios, use the user-provided room context.
  const scenarioLabel = scenario?.label || "Custom Session";
  const roomContext =
    session.scenario === "custom" && session.roomContext
      ? session.roomContext
      : scenario?.roomContext || "";
  const firstPersona = session.personas[0];
  if (!firstPersona) {
    return NextResponse.json({ error: "No personas configured" }, { status: 400 });
  }

  const otherPersonas = session.personas
    .filter((p) => p.id !== firstPersona.id)
    .map((p) => ({
      name: p.name,
      archetype: p.archetype as ArchetypeKey,
    }));

  // Build pattern memory context from previous sessions.
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

  const opening = await generateOpening({
    archetype: firstPersona.archetype as ArchetypeKey,
    behaviorStyle: firstPersona.behaviorStyle as "gentle" | "moderate" | "aggressive",
    scenarioLabel,
    claims,
    patternMemory,
    otherPersonas,
  });

  // Persist the opening as the first message.
  const message = await db.sessionMessage.create({
    data: {
      sessionId: session.id,
      personaId: firstPersona.id,
      role: "persona",
      content: opening.content,
      type: "opening",
      claimRef: opening.claimRef ?? null,
    },
  });

  // Generate TTS audio for the opening challenge.
  const audio = await generatePersonaAudio(
    opening.content,
    firstPersona.archetype as ArchetypeKey,
    firstPersona.behaviorStyle as "gentle" | "moderate" | "aggressive"
  );

  return NextResponse.json({
    alreadyStarted: false,
    message: {
      id: message.id,
      personaId: firstPersona.id,
      personaName: firstPersona.name,
      archetype: firstPersona.archetype,
      behaviorStyle: firstPersona.behaviorStyle,
      seatOrder: firstPersona.seatOrder,
      content: opening.content,
      type: "opening",
      claimRef: opening.claimRef ?? null,
      mood: opening.mood,
      audio,
      createdAt: message.createdAt,
    },
    claims,
    scenarioLabel,
    roomContext,
  });
}

function safeParse<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
