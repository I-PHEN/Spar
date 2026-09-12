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
import { buildDrillOpeningInstruction, getDrillDefinition } from "@/lib/drills";
import type { ArchetypeKey, DrillTarget, ExtractedClaim } from "@/lib/types";

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

  const claims: ExtractedClaim[] = session.extractedClaims
    ? safeParse(session.extractedClaims, [])
    : [];

  const scenario = SCENARIOS[session.scenario as keyof typeof SCENARIOS];
  const scenarioLabel = scenario?.label || "Custom Session";
  const roomContext =
    session.scenario === "custom" && session.roomContext
      ? session.roomContext
      : scenario?.roomContext || "";

  // ─── Defense & Boardroom: user presents first. ─────────────────────────
  // The user presents their material. The session stays in "presenting" status.
  // For Defense: no interruptions during presenting.
  // For Boardroom: the panel interrupts mid-speech (handled by the agitation engine).
  if (session.experience === "defense" || session.experience === "boardroom") {
    await db.session.update({
      where: { id },
      data: {
        status: "presenting",
        startedAt: new Date(),
      },
    });
    const openingPrompt =
      session.experience === "defense"
        ? "The floor is yours. Present your material."
        : "Present. They will interrupt you.";
    return NextResponse.json({
      defenseMode: true,
      openingPrompt,
      claims,
      scenarioLabel,
      roomContext,
    });
  }

  // ─── Other experiences: panel speaks first (existing flow) ────────────
  // Mark session as active.
  await db.session.update({
    where: { id },
    data: {
      status: "active",
      startedAt: new Date(),
    },
  });

  const firstPersona = session.personas[0];
  if (!firstPersona) {
    return NextResponse.json({ error: "No personas configured" }, { status: 400 });
  }

  // ─── Drill Mode: the lead persona matches the drill target. ──────────────
  // The persona whose archetype matches the drill's leadArchetype opens
  // (not necessarily seat 0). Falls back to seat 0 if not on the panel.
  let openingPersona = firstPersona;
  let drillOpeningInstruction: string | undefined;
  if (session.experience === "drill") {
    const drillTarget = (session.drillTarget as DrillTarget) || "hedging";
    const def = getDrillDefinition(drillTarget);
    drillOpeningInstruction = buildDrillOpeningInstruction(drillTarget);
    const lead = session.personas.find(
      (p) => p.archetype === def.leadArchetype
    );
    if (lead) openingPersona = lead;
  }

  const otherPersonas = session.personas
    .filter((p) => p.id !== openingPersona.id)
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
    archetype: openingPersona.archetype as ArchetypeKey,
    behaviorStyle: openingPersona.behaviorStyle as "gentle" | "moderate" | "aggressive",
    scenarioLabel,
    claims,
    patternMemory,
    otherPersonas,
    extraOpeningInstruction: drillOpeningInstruction,
  });

  // Persist the opening as the first message.
  const message = await db.sessionMessage.create({
    data: {
      sessionId: session.id,
      personaId: openingPersona.id,
      role: "persona",
      content: opening.content,
      type: "opening",
      claimRef: opening.claimRef ?? null,
    },
  });

  // Generate TTS audio for the opening challenge.
  const audio = await generatePersonaAudio(
    opening.content,
    openingPersona.archetype as ArchetypeKey,
    openingPersona.behaviorStyle as "gentle" | "moderate" | "aggressive"
  );

  return NextResponse.json({
    alreadyStarted: false,
    message: {
      id: message.id,
      personaId: openingPersona.id,
      personaName: openingPersona.name,
      archetype: openingPersona.archetype,
      behaviorStyle: openingPersona.behaviorStyle,
      seatOrder: openingPersona.seatOrder,
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
