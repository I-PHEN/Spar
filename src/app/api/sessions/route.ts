// SharkPit — sessions list + create

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDefaultUserId } from "@/lib/user";
import { extractClaims } from "@/lib/llm";
import { SCENARIOS } from "@/lib/scenarios";
import { ARCHETYPES } from "@/lib/personas";
import type {
  ArchetypeKey,
  BehaviorStyle,
  PersonaConfig,
  ScenarioKey,
  SessionMode,
} from "@/lib/types";

interface CreateSessionBody {
  scenario: ScenarioKey;
  mode: SessionMode;
  rawMaterial?: string;
  materialTitle?: string;
  personas: PersonaConfig[];
}

export async function GET() {
  const userId = await getDefaultUserId();
  const sessions = await db.session.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      personas: { orderBy: { seatOrder: "asc" } },
      summary: true,
    },
  });
  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  const userId = await getDefaultUserId();
  const body = (await req.json().catch(() => ({}))) as CreateSessionBody;

  if (!body.scenario || !SCENARIOS[body.scenario]) {
    return NextResponse.json({ error: "Invalid scenario" }, { status: 400 });
  }

  if (
    !Array.isArray(body.personas) ||
    body.personas.length < 1 ||
    body.personas.length > 3
  ) {
    return NextResponse.json(
      { error: "Panel must have 1-3 personas" },
      { status: 400 }
    );
  }

  for (const p of body.personas) {
    if (!ARCHETYPES[p.archetype]) {
      return NextResponse.json(
        { error: `Invalid archetype: ${p.archetype}` },
        { status: 400 }
      );
    }
    if (!["gentle", "moderate", "aggressive"].includes(p.behaviorStyle)) {
      return NextResponse.json(
        { error: `Invalid behavior style: ${p.behaviorStyle}` },
        { status: 400 }
      );
    }
  }

  // Extract claims if material was provided.
  let extractedClaims: string | null = null;
  const rawMaterial = body.rawMaterial?.trim() || null;
  if (body.mode === "with_material" && rawMaterial && rawMaterial.length > 30) {
    try {
      const claims = await extractClaims(rawMaterial);
      if (claims.length > 0) {
        extractedClaims = JSON.stringify(claims);
      }
    } catch (err) {
      console.error("[sessions/create] claim extraction failed:", err);
    }
  }

  const session = await db.session.create({
    data: {
      userId,
      scenario: body.scenario,
      mode: body.mode,
      rawMaterial,
      materialTitle: body.materialTitle?.slice(0, 200) || null,
      extractedClaims,
      status: "configured",
      personas: {
        create: body.personas.map((p, i) => {
          const def = ARCHETYPES[p.archetype as ArchetypeKey];
          return {
            archetype: p.archetype,
            name: (p.name?.trim() || def.defaultName).slice(0, 60),
            behaviorStyle: p.behaviorStyle as BehaviorStyle,
            seatOrder: i,
          };
        }),
      },
    },
    include: {
      personas: { orderBy: { seatOrder: "asc" } },
    },
  });

  return NextResponse.json({ session });
}
