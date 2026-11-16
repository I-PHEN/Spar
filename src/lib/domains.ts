// Spar — Domain Presets & Positive Persona Role Anchors
//
// Solves "domain drift" (e.g., panelists asking VC/revenue questions during an
// educational, scientific, or interview session) by replacing weak negative
// instructions with explicit, positive role anchors and automatic domain
// inference.

import {
  formatVoiceProfileTags,
  stripVoiceProfileTags,
  type AccentKey,
  type VoiceToneKey,
} from "./voice-accents";

export type DomainKey = "academic" | "interview" | "commercial" | "sparring";

export type StanceKey = "defending" | "opposing" | "stress_test";

export type AttackAngleKey =
  | "causal_links"
  | "counterfactuals"
  | "evidence_audit"
  | "hostile_poi"
  | "incentives"
  | "first_principles";

export type DrillStrictnessKey = "standard" | "blitz" | "warmup";

export interface StancePreset {
  key: StanceKey;
  label: string;
  shortLabel: string;
  directive: string;
}

export interface AttackAnglePreset {
  key: AttackAngleKey;
  label: string;
  tagline: string;
  directive: string;
}

export const STANCE_PRESETS: Record<StanceKey, StancePreset> = {
  defending: {
    key: "defending",
    label: "Defending / Proposition",
    shortLabel: "Defending (Prop)",
    directive:
      "STANCE [DEFENDING / PROPOSITION]: The user is defending the core thesis/motion. You are on the Opposition bench: attack their premises, causal links, and evidence.",
  },
  opposing: {
    key: "opposing",
    label: "Opposing / Opposition",
    shortLabel: "Opposing (Opp)",
    directive:
      "STANCE [OPPOSING / OPPOSITION]: The user is opposing/rebutting the motion or proposal. Steelman the proposition and challenge the user's counter-arguments and alternative.",
  },
  stress_test: {
    key: "stress_test",
    label: "360° Stress-Test",
    shortLabel: "360° Stress-Test",
    directive:
      "STANCE [360_STRESS_TEST]: Dynamically flip to whichever side, counterfactual, or trade-off the user leaves exposed.",
  },
};

export const STANCE_PRESET_LIST: StancePreset[] = [
  STANCE_PRESETS.defending,
  STANCE_PRESETS.opposing,
  STANCE_PRESETS.stress_test,
];

export const ATTACK_ANGLE_PRESETS: Record<AttackAngleKey, AttackAnglePreset> = {
  causal_links: {
    key: "causal_links",
    label: "Causal Links & Logic",
    tagline: "Demand step-by-step mechanisms",
    directive:
      "Demand the step-by-step causal mechanism behind every 'X leads to Y' claim; reject correlation or assertion.",
  },
  counterfactuals: {
    key: "counterfactuals",
    label: "Counterfactuals & Weighing",
    tagline: "Compare harms against alternatives",
    directive:
      "Force comparative weighing: challenge why their world is better than the status quo or mutually exclusive alternative.",
  },
  evidence_audit: {
    key: "evidence_audit",
    label: "Data & Proof Audit",
    tagline: "Interrogate stats and baselines",
    directive:
      "Interrogate every statistic, baseline, sample size, or empirical claim; reject vague quantifiers.",
  },
  hostile_poi: {
    key: "hostile_poi",
    label: "Rapid POI / Cross-Ex",
    tagline: "1-sentence pin-down traps",
    directive:
      "Deliver sharp, 1-sentence Points of Information that pin the speaker down and expose contradictions.",
  },
  incentives: {
    key: "incentives",
    label: "Actors & Incentives",
    tagline: "Test bad actors & real-world friction",
    directive:
      "Probe how real-world stakeholders, bad actors, or institutional friction break the proposal in practice.",
  },
  first_principles: {
    key: "first_principles",
    label: "First-Principles & Edge Cases",
    tagline: "Extreme cases & foundational axioms",
    directive:
      "Test foundational definitions, edge-case boundaries, and extreme logical consequences.",
  },
};

export const ATTACK_ANGLE_LIST: AttackAnglePreset[] = [
  ATTACK_ANGLE_PRESETS.causal_links,
  ATTACK_ANGLE_PRESETS.counterfactuals,
  ATTACK_ANGLE_PRESETS.evidence_audit,
  ATTACK_ANGLE_PRESETS.hostile_poi,
  ATTACK_ANGLE_PRESETS.incentives,
  ATTACK_ANGLE_PRESETS.first_principles,
];

export interface AttackHotspot {
  id: string;
  target: string;
  reason: string;
  suggestedChallenge: string;
}

export interface DomainPreset {
  key: DomainKey;
  label: string;
  shortLabel: string;
  tagline: string;
  roleTitle: string;
  focusAreas: string[];
  forbiddenFraming: string[];
  positiveDirective: string;
}

export const DOMAIN_PRESETS: Record<DomainKey, DomainPreset> = {
  academic: {
    key: "academic",
    label: "Academic / Educational",
    shortLabel: "Academic",
    tagline: "Pedagogy, thesis defense, science, or lesson mastery",
    roleTitle: "Academic Committee & Senior Pedagogical Reviewer",
    focusAreas: [
      "Conceptual clarity, first-principles accuracy, and definitions",
      "Pedagogical scaffolding, student comprehension, and learning outcomes",
      "Methodological rigor, empirical proof, and theoretical boundaries",
    ],
    forbiddenFraming: [
      "Never ask about commercial monetization, revenue, pricing, or profit margins",
      "Never frame students or learners as 'customers' or 'buyers'",
      "Never mention venture capital, CAC/LTV, ARR, or startup scaling",
    ],
    positiveDirective:
      "ROLE ANCHOR [ACADEMIC_EDUCATIONAL]: You are an Academic Examiner, Subject-Matter Scholar, and Senior Pedagogical Reviewer. Evaluate conceptual accuracy, instructional clarity, empirical evidence, and learning outcomes strictly within the educational or scientific domain of the topic. When probing impact ('So what?'), ask about student mastery, scholarly significance, or real-world understanding—NEVER ask corporate, revenue, investor, or commercial market questions.",
  },
  interview: {
    key: "interview",
    label: "Job Interview",
    shortLabel: "Interview",
    tagline: "Resume grill, behavioral depth, and technical bar-raiser",
    roleTitle: "Hiring Manager & Technical Bar-Raiser",
    focusAreas: [
      "Individual ownership ('What did YOU specifically decide and execute?')",
      "Verification of metrics, scope, and claims listed on the resume or bio",
      "Decision trade-offs, failure modes, conflict resolution, and role fit",
    ],
    forbiddenFraming: [
      "Never accept vague 'we' statements without isolating the candidate's personal contribution",
      "Never let inflated percentages pass without asking for the baseline and measurement method",
    ],
    positiveDirective:
      "ROLE ANCHOR [JOB_INTERVIEW]: You are a Senior Hiring Manager and Bar-Raiser conducting a high-stakes interview. Interrogate the candidate's actual ownership ('I' vs 'we'), verify specific claims and metrics from their resume or background, and press on trade-offs, timeline gaps, and real-world execution under pressure.",
  },
  commercial: {
    key: "commercial",
    label: "Pitch & Commercial",
    shortLabel: "Commercial",
    tagline: "Investor pitch, strategy memo, or executive boardroom",
    roleTitle: "Venture Partner & Executive Board Evaluator",
    focusAreas: [
      "Unit economics, payback periods, margins, and capital efficiency",
      "Competitive defensibility, distribution moats, and switching costs",
      "Execution bottlenecks, customer retention, and downside risk",
    ],
    forbiddenFraming: [
      "Never accept top-down TAM citations without bottom-up capture proof",
      "Never let visionary buzzwords substitute for concrete numbers",
    ],
    positiveDirective:
      "ROLE ANCHOR [PITCH_COMMERCIAL]: You are a skeptical Venture Partner and Executive Board Member. Stress-test unit economics, go-to-market assumptions, competitive defensibility, and operational execution.",
  },
  sparring: {
    key: "sparring",
    label: "Intellectual Sparring",
    shortLabel: "Debate",
    tagline: "Pure thesis stress-test, policy debate, or devil's advocate",
    roleTitle: "Dialectical Sparring Partner & Devil's Advocate",
    focusAreas: [
      "Internal logical consistency and unstated foundational assumptions",
      "Strongest counter-arguments, edge cases, and falsifiability",
      "Precision of causal mechanisms and empirical grounding",
    ],
    forbiddenFraming: [
      "Never inject corporate or startup jargon unless the topic itself is explicitly commercial",
      "Never attack the speaker personally—only dismantle weak reasoning",
    ],
    positiveDirective:
      "ROLE ANCHOR [INTELLECTUAL_SPARRING]: You are a sharp Dialectical Sparring Partner and Devil's Advocate. Challenge hidden premises, logical leaps, and counter-examples strictly inside the native intellectual domain of the user's topic. Never introduce corporate, startup, or revenue framing unless the user's thesis is explicitly about business.",
  },
};

export const DOMAIN_PRESET_LIST: DomainPreset[] = [
  DOMAIN_PRESETS.academic,
  DOMAIN_PRESETS.interview,
  DOMAIN_PRESETS.commercial,
  DOMAIN_PRESETS.sparring,
];

const INTERVIEW_REGEX =
  /\b(resume|curriculum vitae|\bcv\b|job interview|hiring manager|bar raiser|candidate|work experience|employment|internship|software engineer|product manager|data scientist|role at|tenure at|promoted to|bachelor of|master of|b\.s\.|m\.s\.|gpa|linkedin|portfolio|recruiter|interviewing for)\b/i;

const ACADEMIC_REGEX =
  /\b(teach|teaching|teacher|lesson|curriculum|syllabus|classroom|student|students|pedagogy|pedagogical|lecture|coursework|homework|exam|quiz|grade|school|university|college|dissertation|thesis|chapter|theorem|proof|lemma|equation|calculus|algebra|geometry|fraction|fractions|newton|optimization|hessian|gradient|matrix|distillation|chemical|chemistry|biology|physics|photosynthesis|thermodynamics|literature|history|philosophy|sociology|psychology|empirical|hypothesis|meta-analysis|peer-reviewed|scholarly)\b/i;

const COMMERCIAL_REGEX =
  /\b(startup|investor|vc|venture capital|seed round|series a|series b|pitch deck|go-to-market|\bgtm\b|saas|b2b|b2c|\barr\b|\bmrr\b|\bcac\b|\bltv\b|churn|runway|burn rate|gross margin|ebitda|monetization|revenue|pricing tier|enterprise sales|board meeting|quarterly review|market share|value proposition|customer acquisition)\b/i;

/**
 * Deterministically infers the most appropriate domain preset from a topic,
 * document text, or filename.
 */
export function inferDomainFromText(
  text?: string | null,
  titleOrFilename?: string | null
): DomainKey {
  const combined = `${titleOrFilename ?? ""} ${text ?? ""}`.trim();
  if (!combined) return "sparring";

  // Count keyword hits across domains so mixed documents resolve accurately
  const countMatches = (regex: RegExp): number => {
    const globalRegex = new RegExp(regex.source, "gi");
    return (combined.match(globalRegex) || []).length;
  };

  const interviewHits = countMatches(INTERVIEW_REGEX);
  const academicHits = countMatches(ACADEMIC_REGEX);
  const commercialHits = countMatches(COMMERCIAL_REGEX);

  if (interviewHits === 0 && academicHits === 0 && commercialHits === 0) {
    return "sparring";
  }

  if (interviewHits >= academicHits && interviewHits >= commercialHits && interviewHits > 0) {
    return "interview";
  }
  if (academicHits >= commercialHits && academicHits > 0) {
    return "academic";
  }
  if (commercialHits > 0) {
    return "commercial";
  }
  return "sparring";
}

const DOMAIN_TAG_REGEX = /\[Domain:\s*(academic|interview|commercial|sparring)\]/i;

/**
 * Extracts an explicit DomainKey tag from a roomContext string if present.
 */
export function extractDomainFromRoomContext(
  roomContext?: string | null
): DomainKey | null {
  if (!roomContext) return null;
  const match = roomContext.match(DOMAIN_TAG_REGEX);
  if (!match?.[1]) return null;
  const key = match[1].toLowerCase() as DomainKey;
  return DOMAIN_PRESETS[key] ? key : null;
}

/**
 * Resolves the active DomainKey from explicit parameter, roomContext tag, or
 * automatic inference on the material/topic.
 */
export function resolveActiveDomain(params: {
  domain?: DomainKey | null;
  roomContext?: string | null;
  materialTitle?: string | null;
  rawMaterial?: string | null;
}): DomainKey {
  if (params.domain && DOMAIN_PRESETS[params.domain]) {
    return params.domain;
  }
  const fromRoom = extractDomainFromRoomContext(params.roomContext);
  if (fromRoom) return fromRoom;

  return inferDomainFromText(params.rawMaterial, params.materialTitle);
}

const STANCE_TAG_REGEX = /\[Stance:\s*(defending|opposing|stress_test)\]/i;
const ATTACK_ANGLES_TAG_REGEX = /\[AttackAngles:\s*([a-z0-9_,]+)\]/i;
const DRILL_STRICTNESS_TAG_REGEX = /\[DrillStrictness:\s*(standard|blitz|warmup)\]/i;

/**
 * Extracts stance, attack angles, and drill strictness from a roomContext string.
 */
export function extractRoomBlueprintFromContext(roomContext?: string | null): {
  stance: StanceKey | null;
  attackAngles: AttackAngleKey[];
  drillStrictness: DrillStrictnessKey | null;
} {
  if (!roomContext) {
    return { stance: null, attackAngles: [], drillStrictness: null };
  }
  const stanceMatch = roomContext.match(STANCE_TAG_REGEX);
  const stanceKey = stanceMatch?.[1]?.toLowerCase() as StanceKey | undefined;
  const stance = stanceKey && STANCE_PRESETS[stanceKey] ? stanceKey : null;

  const anglesMatch = roomContext.match(ATTACK_ANGLES_TAG_REGEX);
  const attackAngles: AttackAngleKey[] = [];
  if (anglesMatch?.[1]) {
    for (const part of anglesMatch[1].split(",")) {
      const k = part.trim().toLowerCase() as AttackAngleKey;
      if (ATTACK_ANGLE_PRESETS[k] && !attackAngles.includes(k)) {
        attackAngles.push(k);
      }
    }
  }

  const strictMatch = roomContext.match(DRILL_STRICTNESS_TAG_REGEX);
  const strictKey = strictMatch?.[1]?.toLowerCase() as DrillStrictnessKey | undefined;
  const drillStrictness =
    strictKey && (strictKey === "standard" || strictKey === "blitz" || strictKey === "warmup")
      ? strictKey
      : null;

  return { stance, attackAngles, drillStrictness };
}

const CUSTOM_ROOM_REGEX =
  /(?:^|\n)Custom Room Instructions:\s*([\s\S]*?)(?=\n(?:Priority Attack Hotspots:|\[(?:Domain|Stance|AttackAngles|DrillStrictness|VoiceAccent|VoiceTone|SeatAccents):)|$)/;

/**
 * Extracts user-supplied custom room instructions from a formatted roomContext
 * string, supporting multi-line descriptions cleanly.
 */
export function extractCustomRoomFromContext(
  roomContext?: string | null
): string | null {
  if (!roomContext) return null;
  const match = roomContext.match(CUSTOM_ROOM_REGEX);
  const text = match?.[1]?.trim();
  return text && text.length > 0 ? text : null;
}

/**
 * Strips the raw Custom Room Instructions section from roomContext so
 * prompts can render it once inside a dedicated high-priority directive block.
 */
export function stripCustomRoomFromContext(roomContext?: string | null): string {
  if (!roomContext) return "";
  return roomContext.replace(CUSTOM_ROOM_REGEX, "").trim();
}

/**
 * Formats the session's `roomContext` string so it carries the selected domain
 * tag, stance, attack angles, priority hotspots, and preserved custom room rules.
 */
export function formatSessionRoomContext(params: {
  domain?: DomainKey | null;
  stance?: StanceKey | null;
  attackAngles?: AttackAngleKey[];
  drillStrictness?: DrillStrictnessKey | null;
  voiceAccent?: AccentKey | null;
  voiceTone?: VoiceToneKey | null;
  seatAccents?: Record<number, AccentKey>;
  customRoom?: string | null;
  defaultRoomContext?: string;
  hotspots?: AttackHotspot[];
}): string {
  const parts: string[] = [];

  if (params.domain && DOMAIN_PRESETS[params.domain]) {
    const preset = DOMAIN_PRESETS[params.domain];
    parts.push(`[Domain: ${preset.key}] ${preset.roleTitle}.`);
  }

  if (params.stance && STANCE_PRESETS[params.stance]) {
    const stance = STANCE_PRESETS[params.stance];
    parts.push(`[Stance: ${stance.key}] ${stance.directive}`);
  }

  const validAngles = (params.attackAngles ?? []).filter(
    (k) => Boolean(ATTACK_ANGLE_PRESETS[k])
  );
  if (validAngles.length > 0) {
    parts.push(
      `[AttackAngles: ${validAngles.join(",")}] ${validAngles
        .map((k) => `${ATTACK_ANGLE_PRESETS[k].label}: ${ATTACK_ANGLE_PRESETS[k].directive}`)
        .join(" | ")}`
    );
  }

  if (params.drillStrictness) {
    parts.push(`[DrillStrictness: ${params.drillStrictness}]`);
  }

  if (params.hotspots && params.hotspots.length > 0) {
    const hotspotLines = params.hotspots
      .slice(0, 4)
      .map(
        (h, idx) =>
          `Hotspot ${idx + 1} (${h.target}): ${h.reason} -> Probe: "${h.suggestedChallenge}"`
      )
      .join(" | ")
      .slice(0, 650);
    parts.push(`Priority Attack Hotspots: ${hotspotLines}`);
  }

  const voiceTags = formatVoiceProfileTags({
    accent: params.voiceAccent,
    voiceTone: params.voiceTone,
    seatAccents: params.seatAccents,
  });
  if (voiceTags) {
    parts.push(voiceTags);
  }

  const customText = params.customRoom?.trim().slice(0, 1000);
  if (customText && customText.length > 0) {
    // Keep custom room instructions last and never clipped by hotspot volume.
    parts.push(`Custom Room Instructions: ${customText}`);
  } else if (params.defaultRoomContext && params.defaultRoomContext.trim().length > 0) {
    parts.push(params.defaultRoomContext.trim().slice(0, 800));
  }

  return parts.join("\n");
}

/**
 * Formats the blended/additive Custom Room Instructions block so domain rules
 * and persona archetypes stay active while every user room constraint is obeyed.
 */
export function buildCustomRoomBlock(roomContext?: string | null): string {
  const custom = extractCustomRoomFromContext(roomContext);
  if (!custom) return "";
  return [
    "# CUSTOM ROOM INSTRUCTIONS (MUST FOLLOW)",
    "The user added the room description below. Follow every role, rule, tone, and topic constraint specified here alongside your domain anchor and panelist persona:",
    custom,
  ].join("\n");
}

/**
 * Builds the positive persona role anchor block injected into system prompts
 * for both the streaming cascade and Gemini Live.
 */
export function buildDomainRoleBlock(params: {
  domain?: DomainKey | null;
  roomContext?: string | null;
  materialTitle?: string | null;
  rawMaterial?: string | null;
}): string {
  const activeDomain = resolveActiveDomain(params);
  const preset = DOMAIN_PRESETS[activeDomain];
  const blueprint = extractRoomBlueprintFromContext(params.roomContext);

  const lines = [
    `# DOMAIN & ROLE ANCHOR (${preset.label.toUpperCase()})`,
    preset.positiveDirective,
    `Focus areas:`,
    ...preset.focusAreas.map((f) => `- ${f}`),
    `Strict boundaries:`,
    ...preset.forbiddenFraming.map((b) => `- ${b}`),
  ];

  if (blueprint.stance || blueprint.attackAngles.length > 0) {
    lines.push("", "# CUSTOM ROOM BLUEPRINT (MANDATORY)");
    if (blueprint.stance) {
      lines.push(`- ${STANCE_PRESETS[blueprint.stance].directive}`);
    }
    for (const angleKey of blueprint.attackAngles) {
      const angle = ATTACK_ANGLE_PRESETS[angleKey];
      lines.push(`- [${angle.label}] ${angle.directive}`);
    }
  }

  const customBlock = buildCustomRoomBlock(params.roomContext);
  if (customBlock) {
    lines.push("", customBlock);
  }

  return lines.join("\n");
}

/**
 * Formats an uncluttered human-readable subtitle for the Sparring Room header
 * without leaking internal prompt tags like `[Domain: ...]` or `[Stance: ...]`.
 */
export function formatRoomDisplaySubtitle(
  roomContext?: string | null,
): string {
  if (!roomContext) return "";
  const custom = extractCustomRoomFromContext(roomContext);
  if (custom) return custom;

  const domainKey = extractDomainFromRoomContext(roomContext);
  const blueprint = extractRoomBlueprintFromContext(roomContext);
  const parts: string[] = [];
  if (domainKey && DOMAIN_PRESETS[domainKey]) {
    parts.push(DOMAIN_PRESETS[domainKey].roleTitle);
  }
  if (blueprint.stance && STANCE_PRESETS[blueprint.stance]) {
    parts.push(STANCE_PRESETS[blueprint.stance].shortLabel);
  }
  if (parts.length > 0) {
    return parts.join(" · ");
  }

  return stripVoiceProfileTags(roomContext)
    .replace(/\[(?:Domain|Stance|AttackAngles|DrillStrictness):[^\]]*\]/gi, "")
    .replace(/(?:^|\n)Priority Attack Hotspots:[\s\S]*/i, "")
    .trim();
}
