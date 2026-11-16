// Spar — sessions list + create

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDefaultUserId } from "@/lib/user";
import { syncToSupabaseTable } from "@/lib/supabase";
import { buildFallbackClaims, extractClaims } from "@/lib/llm";
import { ARCHETYPES } from "@/lib/personas";
import {
  formatSessionRoomContext,
  inferDomainFromText,
  type AttackAngleKey,
  type AttackHotspot,
  type DomainKey,
  type DrillStrictnessKey,
  type StanceKey,
} from "@/lib/domains";
import { EXPERIENCES, type ExperienceKey, type DrillTarget } from "@/lib/experiences";
import {
  formatVoiceProfileTags,
  isAccentKey,
  isVoiceToneKey,
  type AccentKey,
  type VoiceToneKey,
} from "@/lib/voice-accents";
import type {
  ArchetypeKey,
  BehaviorStyle,
  ExtractedClaim,
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
  domain?: DomainKey | null;
  stance?: StanceKey | null;
  attackAngles?: AttackAngleKey[];
  drillStrictness?: DrillStrictnessKey | null;
  voiceAccent?: AccentKey | null;
  voiceTone?: VoiceToneKey | null;
  hotspots?: AttackHotspot[];
  claims?: ExtractedClaim[];
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

export async function DELETE() {
  const userId = await getDefaultUserId();
  const result = await db.session.deleteMany({
    where: { userId },
  });
  return NextResponse.json({ deletedCount: result.count });
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
  const rawMaterial = body.rawMaterial?.trim() || null;
  const activeDomain: DomainKey =
    body.domain ||
    inferDomainFromText(rawMaterial, body.materialTitle);

  const voiceAccent = isAccentKey(body.voiceAccent) ? body.voiceAccent : null;
  const voiceTone = isVoiceToneKey(body.voiceTone) ? body.voiceTone : null;
  const seatAccents: Record<number, AccentKey> = {};
  body.personas.forEach((p, idx) => {
    if (isAccentKey(p.accent) && p.accent !== "mixed") {
      seatAccents[idx] = p.accent;
    }
  });
  const coachVoiceTags = formatVoiceProfileTags({
    accent: voiceAccent,
    voiceTone,
    seatAccents,
  });

  // Format room context with domain preset anchor, custom room notes, and priority hotspots
  const roomContext = rawMaterial?.startsWith("Course:")
    ? [body.roomContext?.trim().slice(0, 1000) || exp.roomContext, coachVoiceTags]
        .filter(Boolean)
        .join("\n")
    : formatSessionRoomContext({
        domain: activeDomain,
        stance: body.stance,
        attackAngles: Array.isArray(body.attackAngles) ? body.attackAngles : undefined,
        drillStrictness: body.experience === "drill" ? body.drillStrictness : null,
        voiceAccent,
        voiceTone,
        seatAccents,
        customRoom: body.roomContext,
        defaultRoomContext: exp.roomContext,
        hotspots: Array.isArray(body.hotspots) ? body.hotspots : undefined,
      });

  // Seed immediate heuristic claims synchronously so room entry never stalls
  // on an LLM call; refine via background extractClaims when material is substantial.
  let extractedClaims: string | null = null;
  let shouldEnrichClaimsInBackground = false;
  if (Array.isArray(body.claims) && body.claims.length > 0) {
    extractedClaims = JSON.stringify(body.claims.slice(0, 5));
  } else if (rawMaterial && rawMaterial.length >= 10 && !rawMaterial.startsWith("Course:")) {
    const immediateClaims = buildFallbackClaims(rawMaterial);
    if (immediateClaims.length > 0) {
      extractedClaims = JSON.stringify(immediateClaims);
    }
    shouldEnrichClaimsInBackground =
      process.env.NODE_ENV !== "test" && rawMaterial.length >= 80;
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

  if (shouldEnrichClaimsInBackground && rawMaterial) {
    void extractClaims(rawMaterial)
      .then((claims) => {
        if (claims.length === 0) return;
        return db.session.update({
          where: { id: session.id },
          data: { extractedClaims: JSON.stringify(claims) },
        });
      })
      .catch((err) => {
        console.error("[sessions/create] background claim extraction failed:", err);
      });
  }

  void syncToSupabaseTable("Session", {
    id: session.id,
    userId: session.userId,
    experience: session.experience,
    drillTarget: session.drillTarget,
    scenario: session.scenario,
    mode: session.mode,
    rawMaterial: session.rawMaterial,
    materialTitle: session.materialTitle,
    roomContext: session.roomContext,
    status: session.status,
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ session });
}
