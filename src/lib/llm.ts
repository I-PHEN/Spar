// Spar — LLM orchestration (SERVER-SIDE ONLY)
//
// This module wraps z-ai-web-dev-sdk and provides three core capabilities:
//   1. extractClaims — pull 3-5 key claims from uploaded/pasted material
//   2. generatePersonaResponse — one persona's in-character dialogue (JSON)
//   3. generateDebrief — the 6-section coaching debrief (the hero artifact)
//   4. generateOpening — the panel's opening line when the session starts
//
// IMPORTANT: z-ai-web-dev-sdk MUST be used in backend code only. This module
// is imported exclusively by Next.js API routes (server-side by default in
// App Router), so it never reaches the client bundle.

import ZAI from "z-ai-web-dev-sdk";
import type {
  BehaviorStyle,
  DebriefPayload,
  ExtractedClaim,
  PersonaMood,
  PersonaResponse,
} from "./types";
import { ARCHETYPES, buildPersonaSystemPrompt } from "./personas";
import type { ArchetypeKey } from "./types";

// Reuse a single ZAI instance across calls (per the skill's best practices).
let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZai() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

/** Robustly extract a JSON object from an LLM response that may be wrapped
 * in markdown fences or contain stray prose. */
function extractJson<T = unknown>(raw: string): T | null {
  if (!raw) return null;
  let text = raw.trim();

  // Strip markdown code fences if present.
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  // Find the first { ... } block (greedy across newlines).
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  const slice = text.slice(start, end + 1);

  try {
    return JSON.parse(slice) as T;
  } catch {
    // Last resort: try to fix trailing commas.
    try {
      const cleaned = slice.replace(/,\s*([}\]])/g, "$1");
      return JSON.parse(cleaned) as T;
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// 1. EXTRACT CLAIMS
// ---------------------------------------------------------------------------

interface RawClaim {
  label: string;
  claim: string;
  evidence?: string;
}

/**
 * Extract 3-5 key claims from uploaded/pasted material.
 * These become the foundation the personas challenge.
 */
export async function extractClaims(material: string): Promise<ExtractedClaim[]> {
  const trimmed = material.trim();
  if (trimmed.length < 10) return [];

  const zai = await getZai();

  const systemPrompt = `You are an analytical reader for Spar, a sparring platform that helps people defend their ideas under pressure.

Given a piece of material (a thesis abstract, a pitch deck transcript, a strategy memo, a proposal, etc.), extract the 3-5 KEY CLAIMS the author is making — the claims they would have to defend if challenged.

A good key claim is:
- A specific assertion the author stakes a position on
- Something a skeptical panelist would probe
- Not background context or methodology description (unless the methodology IS the claim)

Respond with JSON ONLY, no markdown, no prose:
{
  "claims": [
    { "label": "<short 2-4 word label>", "claim": "<the full claim statement>", "evidence": "<any evidence the author cites, or null>" }
  ]
}

Extract between 3 and 5 claims. Order by importance (most central first).`;

  const completion = await zai.chat.completions.create({
    messages: [
      { role: "assistant", content: systemPrompt },
      {
        role: "user",
        content: `Material to analyze:\n\n---\n${trimmed.slice(0, 8000)}\n---\n\nExtract the 3-5 key claims as JSON.`,
      },
    ],
    thinking: { type: "disabled" },
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const parsed = extractJson<{ claims?: RawClaim[] }>(raw);

  if (!parsed?.claims || !Array.isArray(parsed.claims)) return [];

  return parsed.claims.slice(0, 5).map((c, i) => ({
    id: i + 1,
    label: c.label?.slice(0, 60) || `Claim ${i + 1}`,
    claim: c.claim?.slice(0, 500) || "",
    evidence: c.evidence && c.evidence !== "null" ? c.evidence.slice(0, 300) : undefined,
  }));
}

// ---------------------------------------------------------------------------
// 2. GENERATE PERSONA RESPONSE
// ---------------------------------------------------------------------------

interface GeneratePersonaParams {
  archetype: ArchetypeKey;
  behaviorStyle: BehaviorStyle;
  personaName: string;
  scenarioLabel: string;
  claims: ExtractedClaim[];
  patternMemory: string;
  otherPersonas: Array<{ name: string; archetype: ArchetypeKey }>;
  /** Full conversation history (oldest first), formatted as "Name: text" */
  transcript: string;
  /** What the user just said in their latest message */
  userMessage: string;
  /** When true, the persona is interrupting the user mid-speech. The response should open with a sharp cutting-in phrase. */
  isInterrupt?: boolean;
  /** Additional interrupt instruction (e.g., drill-specific correction phrase) */
  extraInterruptInstruction?: string;
}

interface RawPersonaResponse {
  content: string;
  type: "normal" | "interruption";
  claimRef?: number | null;
  mood: PersonaMood;
}

/**
 * Generate a single persona's in-character response.
 * Returns structured JSON the UI can render (with interruption flags, claim refs, mood).
 */
export async function generatePersonaResponse(
  params: GeneratePersonaParams
): Promise<RawPersonaResponse> {
  const zai = await getZai();

  const systemPrompt = buildPersonaSystemPrompt({
    archetype: params.archetype,
    behaviorStyle: params.behaviorStyle,
    scenarioLabel: params.scenarioLabel,
    claims: params.claims,
    patternMemory: params.patternMemory,
    otherPersonas: params.otherPersonas,
  });

  const userPrompt = `# CONVERSATION SO FAR
${params.transcript || "(Session just started.)"}

# WHAT THE USER JUST SAID
${params.userMessage}
${
    params.isInterrupt
      ? `
# IMPORTANT: YOU ARE INTERRUPTING
The user was still speaking when you cut in. You interrupted because they triggered your agitation threshold (${ARCHETYPES[params.archetype].defaultName} detected a pattern they can't ignore).

Open your response with a sharp cutting-in phrase — "Hold on—", "Let me stop you there—", "Wait—" or similar. Then deliver your challenge directly. Make it feel like you couldn't wait for them to finish.

Set "type": "interruption" in your JSON response.`
      : ""
}

${params.extraInterruptInstruction || ""}

Respond now with your JSON object. Remember: 1-3 sentences max, in-character, strict JSON.`;

  const completion = await zai.chat.completions.create({
    messages: [
      { role: "assistant", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    thinking: { type: "disabled" },
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const parsed = extractJson<RawPersonaResponse>(raw);

  if (!parsed?.content) {
    // Fallback — should rarely happen.
    const a = ARCHETYPES[params.archetype];
    return {
      content: a.questionTemplates[0].replace(
        /\[(.+?)\]/g,
        "your central claim"
      ),
      type: "normal",
      claimRef: null,
      mood: "skeptical",
    };
  }

  return {
    content: parsed.content.slice(0, 800),
    type: parsed.type === "interruption" ? "interruption" : "normal",
    claimRef:
      typeof parsed.claimRef === "number" && parsed.claimRef > 0
        ? parsed.claimRef
        : null,
    mood: parsed.mood || "neutral",
  };
}

/**
 * Generate the panel's opening challenge — what they say when the user enters the room.
 * One persona speaks first, framed as the opening of the session.
 */
export async function generateOpening(params: {
  archetype: ArchetypeKey;
  behaviorStyle: BehaviorStyle;
  scenarioLabel: string;
  claims: ExtractedClaim[];
  patternMemory: string;
  otherPersonas: Array<{ name: string; archetype: ArchetypeKey }>;
  /** Optional extra instruction appended to the opening prompt (e.g., drill framing). */
  extraOpeningInstruction?: string;
}): Promise<RawPersonaResponse> {
  const zai = await getZai();

  const systemPrompt = buildPersonaSystemPrompt({
    archetype: params.archetype,
    behaviorStyle: params.behaviorStyle,
    scenarioLabel: params.scenarioLabel,
    claims: params.claims,
    patternMemory: params.patternMemory,
    otherPersonas: params.otherPersonas,
  });

  const drillBlock = params.extraOpeningInstruction
    ? `\n\n${params.extraOpeningInstruction}`
    : "";

  const userPrompt = `# SESSION STARTING
The user has just entered the sparring room. They have NOT yet spoken. As the first panelist to speak, deliver your OPENING CHALLENGE — a single, pointed question or provocation that sets the tone and probes the user's central claim.

Do NOT introduce yourself. Do NOT say "welcome." Go straight at their argument.

Respond with your JSON object. The "type" should be "normal" (this is the opening, not an interruption).${drillBlock}`;

  const completion = await zai.chat.completions.create({
    messages: [
      { role: "assistant", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    thinking: { type: "disabled" },
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const parsed = extractJson<RawPersonaResponse>(raw);

  if (!parsed?.content) {
    const a = ARCHETYPES[params.archetype];
    return {
      content: a.questionTemplates[0].replace(/\[(.+?)\]/g, "your central claim"),
      type: "normal",
      claimRef: null,
      mood: "pressing",
    };
  }

  return {
    content: parsed.content.slice(0, 800),
    type: "normal",
    claimRef:
      typeof parsed.claimRef === "number" && parsed.claimRef > 0
        ? parsed.claimRef
        : null,
    mood: parsed.mood || "pressing",
  };
}

// ---------------------------------------------------------------------------
// 3. GENERATE DEBRIEF
// ---------------------------------------------------------------------------

interface GenerateDebriefParams {
  scenarioLabel: string;
  claims: ExtractedClaim[];
  transcript: string;
  personaArchetypes: Array<{ name: string; archetype: ArchetypeKey }>;
  telemetry: {
    userTurns: number;
    avgWordsPerResponse: number;
    hedgeCount: number;
    hedgesPerResponse: number;
    avgResponseMs: number;
    deflections: number;
    evidenceCitations: number;
    turns: Array<{
      turnIndex: number;
      wordCount: number;
      hedgeCount: number;
      responseMs: number;
      answeredDirectly: boolean;
      citedEvidence: boolean;
    }>;
  };
  patternMemory: string;
  /** Optional: the presentation section (Defense/Boardroom only).
   * When provided, the debrief includes a "Your Presentation" section
   * that evaluates HOW the user presented, not just what they said. */
  presentationSection?: {
    transcript: string;
    analysis: {
      strengths: string[];
      weakness: string;
      anticipatedAttack: string;
      coachRead: string;
    } | null;
  };
  /** Optional: drill data (Drill Mode only).
   * When provided, the debrief is a focused report on the drill target. */
  drillSection?: {
    target: string;
    label: string;
    totalChallenges: number;
    resolvedChallenges: number;
    attempt1Clean: number;
    attempt2Clean: number;
    attempt3Plus: number;
    fastestRecovery: number;
    slowestRecovery: number;
    avgRecovery: number;
    totalScore: number;
    maxScore: number;
  };
}

interface RawDebrief {
  momentDescription: string;
  presentationEvaluation?: string; // Only for Defense/Boardroom
  whatWentWell: string[];
  thePattern: string;
  oneThingToPractice: string;
  telemetryInsights: {
    pace: string;
    fillers: string;
    recovery: string;
    evidence: string;
  };
  shareableSummary: string;
}

/**
 * Generate the coaching debrief — the hero artifact of Spar.
 * This is what differentiates us from Yoodli's per-session feedback: we
 * write a *narrative*, not a scorecard.
 *
 * For Defense/Boardroom experiences, the debrief has 7 sections (adds
 * "Your Presentation" between "The Moment" and "What You Did Well").
 * For other experiences, 6 sections.
 */
export async function generateDebrief(
  params: GenerateDebriefParams
): Promise<DebriefPayload> {
  const zai = await getZai();

  const hasPresentation = !!params.presentationSection;
  const hasDrill = !!params.drillSection;

  // Build the system prompt in parts to avoid nested template literal complexity
  const basePrompt = `You are Spar's coaching engine. After every sparring session, you write a debrief for the user.

Your voice:
- Honest, specific, forward-looking. Like a coach who has just watched the tape with you.
- NEVER score. NEVER grade. Use coaching language: "focus," "pattern," "baseline," "next."
- Ground every observation in a SPECIFIC moment from the transcript (cite what was said, when).
- Be direct about weaknesses. Don't soften. The user came here to get better, not to feel good.
- Be specific about strengths. Generic praise ("you communicated well") is forbidden. Reference what they actually did.`;

  const drillPrompt = hasDrill
    ? `\n\n# THIS IS A DRILL SESSION\nThis was a targeted drill session focused on: ${params.drillSection!.label}\n\nThe debrief should be FOCUSED on the drill target. The main sections evaluate the drill performance specifically — how many times the behavior was detected, how quickly the user corrected it, and what the pattern is.\n\nThe telemetry below includes the drill challenge statistics. Interpret them in the debrief.`
    : "";

  const presentationPrompt = hasPresentation
    ? `\n\n# THIS SESSION HAS A PRESENTATION PHASE\nThis was a Defense or Boardroom session. The user presented their material first, then faced Q&A.\n\nThe debrief has 7 sections. You produce the first 6; section 7 (shareableSummary) is a markdown summary.\n\nSection 2 ("Your Presentation") is the NEW section. It evaluates HOW the user presented — delivery, not content:\n- Opening strength: Did they state their thesis early, or bury it in setup?\n- Structure: Did they signpost? Clear beginning, middle, end?\n- Pace: Was it consistent? Rushed setup vs. slow substance?\n- Confidence: Did they hedge their central claim? "I think the results suggest..." vs "The results show..."\n- Clarity: Was the core message understandable?\n\nYou have the presentation transcript AND the coach's initial pre-Q&A read. Build on the coach's observations — go deeper. The coach gave a quick heads-up; you give the full evaluation.\n\n# YOUR OUTPUT — STRICT JSON\n{\n  "momentDescription": "<Section 1: The Moment. The single most challenging Q&A exchange. 2-4 sentences.>",\n  "presentationEvaluation": "<Section 2: Your Presentation. Evaluate HOW they presented — structure, pace, confidence, clarity. 3-5 sentences. Reference specific moments from the presentation transcript. Build on the coach's pre-Q&A read.>",\n  "whatWentWell": ["<Section 3: 2-3 observations. Can draw from both presentation and Q&A.>"],\n  "thePattern": "<Section 4: ONE recurring behavior across the session.>",\n  "oneThingToPractice": "<Section 5: SINGLE actionable focus for next session.>",\n  "telemetryInsights": {\n    "pace": "<Section 6a: Pace interpretation.>",\n    "fillers": "<Section 6b: Filler/hedge interpretation.>",\n    "recovery": "<Section 6c: Recovery interpretation.>",\n    "evidence": "<Section 6d: Evidence interpretation.>"\n  },\n  "shareableSummary": "<Section 7: Markdown summary weaving all sections together.>"\n}`
    : `\n\nThe debrief has 6 sections. You produce the first 5; section 6 (shareableSummary) is a markdown summary of all of them.\n\n# YOUR OUTPUT — STRICT JSON\n{\n  "momentDescription": "<Section 1: The Moment. Pick the single most challenging exchange — when the user was pushed hardest. Describe what was asked, what they did, and the recovery. 2-4 sentences. Reference the specific claim/topic.>",\n  "whatWentWell": [\n    "<Section 2: What You Did Well. 2-3 specific, evidence-based observations. Each one references a specific moment from the transcript.>"\n  ],\n  "thePattern": "<Section 3: The Pattern. Identify ONE recurring behavior across the session. E.g., 'You over-explain when questioned on methodology.' Frame it as a pattern, not a one-off. 2-3 sentences. If there's a pattern from previous sessions (provided below), connect this session's pattern to it.>",\n  "oneThingToPractice": "<Section 4: One Thing to Practice. A SINGLE, actionable focus for the next session. Not a list. One sentence of the focus, then 1-2 sentences on how to practice it.>",\n  "telemetryInsights": {\n    "pace": "<Section 5a: Pace — interpret avgWordsPerResponse and avgResponseMs. Compare to a target (15-25 words/response, <5s response time). Frame as insight, not number.>",\n    "fillers": "<Section 5b: Fillers — interpret hedgeCount and hedgesPerResponse. Target: <1 per response. Note if it got worse under pressure.>",\n    "recovery": "<Section 5c: Recovery — interpret deflections vs answeredDirectly. Target: answer directly >80% of the time.>",\n    "evidence": "<Section 5d: Evidence — interpret evidenceCitations / userTurns. Target: cite evidence in >50% of responses.>"\n  },\n  "shareableSummary": "<Section 6: A markdown summary the user could send to a mentor. Should weave together sections 1-5 into a tight 1-paragraph narrative + the one thing to practice.>"\n}`;

  const rulesPrompt = `\n\n# RULES\n- Reference SPECIFIC moments from the transcript. "At one point you said X" — not "you tended to X."\n- Do not invent. If you can't find evidence for an observation, don't make it.\n- The Pattern must connect to the user's previous patterns (if provided) — this is what makes Spar feel like it KNOWS them.\n- One Thing to Practice must be CONCRETE and doable in the next session.` +
    (hasPresentation ? "\n- The presentation evaluation must reference SPECIFIC moments from the presentation transcript, not generalize." : "") +
    (hasDrill ? "\n- In a drill session, the Pattern section should specifically reference when the user struggled most with the drill target (e.g., 'You hedged most when challenged on numbers'). The One Thing to Practice should be about the drill target." : "");

  const systemPrompt = basePrompt + drillPrompt + presentationPrompt + rulesPrompt;

  const telemetrySummary = `# TELEMETRY
- User turns: ${params.telemetry.userTurns}
- Avg words per response: ${params.telemetry.avgWordsPerResponse}
- Total hedge words: ${params.telemetry.hedgeCount} (${params.telemetry.hedgesPerResponse}/response)
- Avg response latency: ${params.telemetry.avgResponseMs}ms
- Direct answers vs deflections: ${params.telemetry.userTurns - params.telemetry.deflections} direct, ${params.telemetry.deflections} deflections
- Responses citing evidence: ${params.telemetry.evidenceCitations}/${params.telemetry.userTurns}
- Per-turn breakdown:
${params.telemetry.turns
  .map(
    (t) =>
      `  Turn ${t.turnIndex}: ${t.wordCount} words, ${t.hedgeCount} hedges, ${t.responseMs}ms, ${
        t.answeredDirectly ? "direct" : "deflected"
      }, ${t.citedEvidence ? "cited evidence" : "no evidence"}`
  )
  .join("\n")}`;

  const patternBlock =
    params.patternMemory.trim().length > 0
      ? `\n# PATTERNS FROM PREVIOUS SESSIONS\n${params.patternMemory}\n\nConnect this session's pattern to these if relevant.`
      : "";

  // Presentation section — only for Defense/Boardroom sessions.
  // Includes the full presentation transcript + the coach's pre-Q&A analysis.
  const presentationBlock = params.presentationSection
    ? `\n# PRESENTATION TRANSCRIPT (Phase 1 — before Q&A)
${params.presentationSection.transcript || "(Presentation was empty.)"}

# COACH'S PRE-Q&A READ
${params.presentationSection.analysis ? JSON.stringify(params.presentationSection.analysis, null, 2) : "(No coach analysis was performed.)"}

NOTE: The "FULL TRANSCRIPT" below is the Q&A phase. The presentation transcript above is Phase 1. Evaluate them separately in the debrief.`
    : "";

  // Drill stats block — only for Drill Mode sessions
  const drillBlock = params.drillSection
    ? `\n# DRILL STATISTICS
- Drill target: ${params.drillSection.label}
- Total challenges: ${params.drillSection.totalChallenges}
- Resolved (user eventually answered cleanly): ${params.drillSection.resolvedChallenges}
- Unresolved: ${params.drillSection.unresolvedChallenges}
- Clean on attempt 1: ${params.drillSection.attempt1Clean}
- Clean on attempt 2: ${params.drillSection.attempt2Clean}
- Took 3+ attempts: ${params.drillSection.attempt3Plus}
- Fastest recovery: ${params.drillSection.fastestRecovery}s
- Slowest recovery: ${params.drillSection.slowestRecovery}s
- Average recovery: ${params.drillSection.avgRecovery}s
- Score: ${params.drillSection.totalScore}/${params.drillSection.maxScore}

Interpret these numbers in the debrief. Focus on the drill target.`
    : "";

  const userPrompt = `# SCENARIO
${params.scenarioLabel}
${presentationBlock}
${drillBlock}

# THE CLAIMS THE USER WAS DEFENDING
${params.claims.length > 0 ? params.claims.map((c) => `${c.id}. ${c.label}: ${c.claim}`).join("\n") : "(User defended from memory — no material uploaded.)"}

# THE PANEL
${params.personaArchetypes.map((p) => `- ${p.name} (${p.archetype})`).join("\n")}
${patternBlock}

# FULL Q&A TRANSCRIPT
${params.transcript || "(Empty session — user did not engage.)"}

${telemetrySummary}

Produce the JSON debrief now.`;

  const completion = await zai.chat.completions.create({
    messages: [
      { role: "assistant", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    thinking: { type: "disabled" },
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const parsed = extractJson<RawDebrief>(raw);

  if (!parsed) {
    // Fallback debrief — should rarely happen.
    return {
      momentDescription:
        "We couldn't generate a detailed debrief for this session. Review the transcript and note your own patterns.",
      whatWentWell: ["You showed up and sparred. That's the work."],
      thePattern:
        "Unable to analyze — try another session and we'll connect the patterns.",
      oneThingToPractice: "Run another session and focus on one specific moment to improve.",
      telemetryInsights: {
        pace: `${params.telemetry.avgWordsPerResponse} avg words per response.`,
        fillers: `${params.telemetry.hedgeCount} hedges across ${params.telemetry.userTurns} responses.`,
        recovery: `${params.telemetry.deflections} deflections out of ${params.telemetry.userTurns} turns.`,
        evidence: `Cited evidence in ${params.telemetry.evidenceCitations}/${params.telemetry.userTurns} responses.`,
      },
      shareableSummary:
        "Session completed. Full debrief generation failed — see transcript.",
    };
  }

  return {
    momentDescription: parsed.momentDescription?.slice(0, 1200) || "",
    presentationEvaluation: parsed.presentationEvaluation?.slice(0, 1200) || null,
    whatWentWell: Array.isArray(parsed.whatWentWell)
      ? parsed.whatWentWell.slice(0, 3).map((s) => s.slice(0, 500))
      : [],
    thePattern: parsed.thePattern?.slice(0, 1000) || "",
    oneThingToPractice: parsed.oneThingToPractice?.slice(0, 600) || "",
    telemetryInsights: {
      pace: parsed.telemetryInsights?.pace?.slice(0, 300) || "",
      fillers: parsed.telemetryInsights?.fillers?.slice(0, 300) || "",
      recovery: parsed.telemetryInsights?.recovery?.slice(0, 300) || "",
      evidence: parsed.telemetryInsights?.evidence?.slice(0, 300) || "",
    },
    shareableSummary: parsed.shareableSummary?.slice(0, 2000) || "",
  };
}

// ---------------------------------------------------------------------------
// 4. PATTERN MEMORY HELPERS
// ---------------------------------------------------------------------------

/**
 * Build the pattern-memory context string fed into persona system prompts.
 * Reads the user's accumulated PatternMemory rows + last 3 session summaries.
 */
export function buildPatternMemoryContext(params: {
  patterns: Array<{ tag: string; description: string; occurrences: number }>;
  recentSummaries: Array<{
    scenarioLabel: string;
    thePattern: string;
    oneThingToPractice: string;
    createdAt: Date;
  }>;
}): string {
  const parts: string[] = [];

  if (params.patterns.length > 0) {
    parts.push(
      "Known behavioral patterns (observed across multiple sessions):",
      ...params.patterns.map(
        (p) => `- [${p.tag}] ${p.description} (seen ${p.occurrences}x)`
      )
    );
  }

  if (params.recentSummaries.length > 0) {
    parts.push(
      "",
      "Most recent session summaries (newest first):",
      ...params.recentSummaries.map(
        (s, i) =>
          `Session ${i + 1} (${s.scenarioLabel}, ${s.createdAt.toLocaleDateString()}):\n` +
          `  Pattern: ${s.thePattern}\n` +
          `  Focus was: ${s.oneThingToPractice}`
      )
    );
  }

  return parts.join("\n");
}

/**
 * After a debrief is generated, decide which patterns to upsert into PatternMemory.
 * For v1: we extract the pattern from the debrief's "thePattern" field and upsert it
 * with a tag derived from a simple keyword classifier. This is intentionally simple —
 * v2 will use a dedicated LLM call to tag patterns.
 */
export function classifyPatternTag(patternText: string): string {
  const t = patternText.toLowerCase();
  if (/hedge|qualif|"i think"|maybe|sort of/.test(t)) return "hedges_under_pressure";
  if (/method|sample size|data|measure/.test(t)) return "weak_on_methodology";
  if (/long|rambl|wordy|verbose|concis/.test(t)) return "over-explains";
  if (/deflect|pivot|reframe/.test(t)) return "deflects_on_challenge";
  if (/financ|revenue|number|projection/.test(t)) return "weak_on_financials";
  if (/evidence|support|proof|back up/.test(t)) return "unsupported_claims";
  if (/impact|so what|matter|consequence/.test(t)) return "weak_on_impact";
  return "general_pattern";
}

// Re-export for API routes
export type { PersonaResponse, DebriefPayload, ExtractedClaim };
export type { GenerateDebriefParams };
export { ARCHETYPES };
