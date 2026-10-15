// Spar — Quick Spar endpoint
//
// Minimal-friction session creation. The user gives us a topic (one line or
// a paragraph), we create a session with sensible defaults and drop them
// straight into the Sparring Room.
//
// Default panel: Skeptic (moderate) + So-What (moderate). This is the
// "explore a topic" default — probes assumptions + challenges relevance.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDefaultUserId } from "@/lib/user";
import { extractClaims } from "@/lib/llm";
import { ARCHETYPES } from "@/lib/personas";
import type { ArchetypeKey, BehaviorStyle, ScenarioKey } from "@/lib/types";

interface QuickSparBody {
  /** The topic / opening statement. Can be one line or a paragraph. */
  topic: string;
  /** Optional scenario — defaults to "custom". */
  scenario?: ScenarioKey;
  /** Optional room context (only used if scenario is "custom"). */
  roomContext?: string;
}

// Default "explore a topic" panel — two balanced challengers.
const DEFAULT_QUICK_PANEL: Array<{
  archetype: ArchetypeKey;
  name: string;
  behaviorStyle: BehaviorStyle;
}> = [
  { archetype: "skeptic", name: ARCHETYPES.skeptic.defaultName, behaviorStyle: "moderate" },
  { archetype: "so_what", name: ARCHETYPES.so_what.defaultName, behaviorStyle: "moderate" },
];

export async function POST(req: NextRequest) {
  const userId = await getDefaultUserId();
  const body = (await req.json().catch(() => ({}))) as QuickSparBody;

  const topic = body.topic?.trim();
  if (!topic || topic.length < 5) {
    return NextResponse.json(
      { error: "Topic must be at least 5 characters" },
      { status: 400 }
    );
  }

  const scenario: ScenarioKey = body.scenario || "custom";
  const roomContext =
    scenario === "custom"
      ? body.roomContext?.trim().slice(0, 1000) ||
          "An open sparring session. The user wants to explore and defend a topic under pressure."
      : null;

  // Extract claims if the topic is substantial enough.
  let extractedClaims: string | null = null;
  if (topic.length >= 10) {
    try {
      const claims = await extractClaims(topic);
      if (claims.length > 0) {
        extractedClaims = JSON.stringify(claims);
      }
    } catch (err) {
      console.error("[quick-spar] claim extraction failed:", err);
    }
  }

  const session = await db.session.create({
    data: {
      userId,
      scenario,
      mode: "without_material",
      rawMaterial: topic,
      materialTitle: topic.slice(0, 120),
      roomContext,
      extractedClaims,
      status: "configured",
      personas: {
        create: DEFAULT_QUICK_PANEL.map((p, i) => ({
          archetype: p.archetype,
          name: p.name,
          behaviorStyle: p.behaviorStyle,
          seatOrder: i,
        })),
      },
    },
    include: {
      personas: { orderBy: { seatOrder: "asc" } },
    },
  });

  return NextResponse.json({ session });
}
