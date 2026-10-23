// Spar — sessions list + create

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDefaultUserId } from "@/lib/user";
import { extractClaims } from "@/lib/llm";
import { ARCHETYPES } from "@/lib/personas";
import { EXPERIENCES, type ExperienceKey, type DrillTarget } from "@/lib/experiences";
import type {
  ArchetypeKey,
  BehaviorStyle,
  PersonaConfig,
  SessionMode,
} from "@/lib/types";

interface CreateSessionBody {
  experience: ExperienceKey;
  drillTarget?: DrillTarget | null;
  coachingEnabled?: boolean;
  coachingFocus?: string | null;
  mode: SessionMode;
  rawMaterial?: string;
  materialTitle?: string;
  roomContext?: string;
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
      skills: true,
    },
  });
  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  const userId = await getDefaultUserId();
  const body = (await req.json().catch(() => ({}))) as CreateSessionBody;

  // Validate experience
  if (!body.experience || !EXPERIENCES[body.experience]) {
    return NextResponse.json(
      { error: "Invalid experience" },
      { status: 400 }
    );
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

  // Get the experience definition (for the default room context)
  const exp = EXPERIENCES[body.experience];
  // Use custom room context if provided, otherwise the experience default
  const roomContext =
    body.roomContext?.trim().slice(0, 1000) || exp.roomContext;

  // Extract claims if material was provided.
  let extractedClaims: string | null = null;
  const rawMaterial = body.rawMaterial?.trim() || null;
  if (body.mode === "with_material" && rawMaterial && rawMaterial.length >= 10) {
    try {
      const claims = await extractClaims(rawMaterial);
      if (claims.length > 0) {
        extractedClaims = JSON.stringify(claims);
      }
    } catch (err) {
      console.error("[sessions/create] claim extraction failed:", err);
    }
  }

  // For Defense experience, the session starts in "presenting" status
  // (user presents first, then Q&A begins). For others, "configured" → "active".
  const initialStatus = exp.userPresentsFirst ? "presenting" : "configured";

  const session = await db.session.create({
    data: {
      userId,
      experience: body.experience,
      drillTarget: body.experience === "drill" ? (body.drillTarget || "hedging") : null,
      coachingEnabled: body.coachingEnabled ?? true,
      coachingFocus: body.coachingFocus?.trim().slice(0, 500) || null,
      scenario: body.experience, // legacy field, kept for backward compat
      mode: body.mode,
      rawMaterial,
      materialTitle: body.materialTitle?.slice(0, 200) || null,
      roomContext,
      extractedClaims,
      status: initialStatus,
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
