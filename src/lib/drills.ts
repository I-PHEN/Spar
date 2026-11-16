// Spar — Drill Mode mechanics
//
// Each drill target maps to:
//   1. A detection pattern (what to watch for in the live transcript)
//   2. A correction phrase (what the persona says when the target is detected)
//   3. A success criterion (what constitutes a "clean" answer)
//   4. A scoring guide (points per attempt)
//
// The drill loop:
//   1. Persona asks a question
//   2. User answers (possibly with the target behavior)
//   3. If detected → immediate interrupt with the correction phrase
//   4. User tries again
//   5. If still detected → another immediate interrupt
//   6. If clean → persona acknowledges ("Good. Next.") and asks the next question
//   7. Score: attempt 1 clean = 3 pts, attempt 2 = 2 pts, attempt 3 = 1 pt, 3+ = 0 pts

import type { DrillTarget } from "./types";

export interface DrillDefinition {
  target: DrillTarget;
  label: string;
  description: string;
  /** What the persona says when interrupting to correct the behavior */
  correctionPhrase: string;
  /** What the persona says when the user finally answers cleanly */
  acknowledgmentPhrase: string;
  /** The archetype that leads this drill */
  leadArchetype: string;
  /** Scoring: points per attempt number (1-indexed) */
  scoring: Record<number, number>;
}

export const DRILL_DEFINITIONS: Record<DrillTarget, DrillDefinition> = {
  hedging: {
    target: "hedging",
    label: "Hedging",
    description: "Stop using qualifiers like 'I think', 'maybe', 'sort of'",
    correctionPhrase:
      "Drop the qualifier. Say it directly. No 'I think,' no 'maybe.' Make the claim.",
    acknowledgmentPhrase: "Good. That was declarative. Next.",
    leadArchetype: "skeptic",
    scoring: { 1: 3, 2: 2, 3: 1 },
  },
  "over-explaining": {
    target: "over-explaining",
    label: "Over-explaining",
    description: "Answer in 15 words or less. Cut the setup.",
    correctionPhrase:
      "Too long. Answer in 15 words or less. Cut the setup, give me the point.",
    acknowledgmentPhrase: "Good. Concise. Next.",
    leadArchetype: "timekeeper",
    scoring: { 1: 3, 2: 2, 3: 1 },
  },
  "recovery-speed": {
    target: "recovery-speed",
    label: "Recovery Speed",
    description: "Respond within 2 seconds. No pausing to think.",
    correctionPhrase:
      "Too slow. Answer now. Don't pause to think — respond immediately.",
    acknowledgmentPhrase: "Good. Fast. Next.",
    leadArchetype: "skeptic",
    scoring: { 1: 3, 2: 2, 3: 1 },
  },
  "evidence-gaps": {
    target: "evidence-gaps",
    label: "Evidence Gaps",
    description: "Back every claim with specific data or a source.",
    correctionPhrase:
      "What's your source? Cite specific evidence. No unsourced claims.",
    acknowledgmentPhrase: "Good. Grounded. Next.",
    leadArchetype: "nitpicker",
    scoring: { 1: 3, 2: 2, 3: 1 },
  },
};

export function getDrillDefinition(target: DrillTarget): DrillDefinition {
  return DRILL_DEFINITIONS[target] || DRILL_DEFINITIONS.hedging;
}

const DRILL_HEDGE_REGEX =
  /\b(i think|i feel|i guess|i believe|i suppose|maybe|perhaps|possibly|probably|sort of|kind of|like|you know|somewhat|rather|quite|fairly|relatively|hopefully|might be)\b/i;

const DRILL_VAGUE_QUANTIFIER_REGEX =
  /\b(roughly|about|around|approximately|somewhere around)\s+[\d$]/i;

const DRILL_VAGUE_SUFFIX_REGEX = /\d+\s*(or so|ish)\b/i;

const DRILL_EVIDENCE_MARKER_REGEX =
  /(\d|\b(percent|million|billion|thousand|days|weeks|months|years|quarters|hours|minutes|seconds|ms|bps|study|benchmark|cohort|audit|dataset|report|experiment|log|metric|trial|theorem|proof|bound|convergence|hessian|gradient|matrix|equation|law)\b)/i;

const DRILL_STALL_OPENER_REGEX =
  /^[\s,.!?"'“”‘’]*(um|uh|er|ah|hmm|well\b|so basically|that's a great question|that is a great question|good question|let me think|give me a second)/i;

export interface DrillTurnEvaluation {
  clean: boolean;
  reason?: string;
}

/**
 * Deterministic post-turn evaluator for Drill Mode.
 * Ensures that even short responses (or responses missing required evidence
 * or starting with a stall) are caught when the user finishes speaking.
 */
export function evaluateDrillTurn(
  text: string,
  target: DrillTarget,
  onsetMs?: number
): DrillTurnEvaluation {
  const cleaned = text.trim();
  const words = cleaned ? cleaned.split(/\s+/) : [];
  const wordCount = words.length;

  if (wordCount === 0) {
    return { clean: false, reason: "Empty response" };
  }

  switch (target) {
    case "hedging": {
      const match = cleaned.match(DRILL_HEDGE_REGEX);
      if (match) {
        return {
          clean: false,
          reason: `Used qualifier "${match[0]}"`,
        };
      }
      return { clean: true };
    }
    case "over-explaining": {
      if (wordCount > 18) {
        return {
          clean: false,
          reason: `${wordCount} words exceeds the 15-word drill ceiling`,
        };
      }
      return { clean: true };
    }
    case "evidence-gaps": {
      if (
        DRILL_VAGUE_QUANTIFIER_REGEX.test(cleaned) ||
        DRILL_VAGUE_SUFFIX_REGEX.test(cleaned)
      ) {
        return {
          clean: false,
          reason: "Used a vague quantifier instead of exact evidence",
        };
      }
      if (!DRILL_EVIDENCE_MARKER_REGEX.test(cleaned)) {
        return {
          clean: false,
          reason: "No specific number, metric, or verifiable source cited",
        };
      }
      return { clean: true };
    }
    case "recovery-speed": {
      if (DRILL_STALL_OPENER_REGEX.test(cleaned)) {
        return {
          clean: false,
          reason: "Opened with a stalling filler instead of a direct point",
        };
      }
      if (typeof onsetMs === "number" && onsetMs > 2500) {
        return {
          clean: false,
          reason: `Vocal onset took ${(onsetMs / 1000).toFixed(1)}s (2.0s limit)`,
        };
      }
      return { clean: true };
    }
    default:
      return { clean: true };
  }
}

const EVASIVE_DEFLECTION_REGEX =
  /\b(that['’]s a (great|good|fair) question|what i['’]d say is|the real question is|it depends|let me reframe|what we should be asking)\b/i;

const UNBACKED_ABSOLUTE_REGEX =
  /\b(obviously|clearly|undeniably|everyone knows|always|never|impossible|guaranteed)\b/i;

const CAUSAL_PROOF_REGEX =
  /\b(because|since|by|through|due to|therefore|first|specifically|for example|data|study|percent|\d)\b/i;

const STOP_WORDS = new Set([
  "about", "after", "again", "against", "because", "before", "between",
  "could", "during", "first", "found", "great", "their", "there", "these",
  "think", "those", "through", "under", "using", "where", "which", "while",
  "would", "should", "actually", "answer", "claim", "explain", "people",
  "point", "question", "really", "simply", "things", "something", "around",
]);

function extractContentKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 5 && !STOP_WORDS.has(w));
  return [...new Set(words)];
}

export interface LiveDrillViolationState {
  wordCount: number;
  hedgeMatch: string | null;
  violated: boolean;
  label: string | null;
}

/**
 * Real-time interim speech constraint detector for the Drill HUD strip.
 * Gives the speaker immediate visual feedback on word ceiling and hedge buzzers.
 */
export function detectLiveDrillViolation(
  interimText: string,
  target: DrillTarget
): LiveDrillViolationState {
  const cleaned = interimText.trim();
  const words = cleaned ? cleaned.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;
  const hedge = cleaned.match(DRILL_HEDGE_REGEX)?.[0] ?? null;

  if (target === "over-explaining") {
    const violated = wordCount > 15;
    return {
      wordCount,
      hedgeMatch: hedge,
      violated,
      label: violated ? `${wordCount}/15 words — Ceiling exceeded!` : `${wordCount}/15 words`,
    };
  }

  if (target === "hedging") {
    return {
      wordCount,
      hedgeMatch: hedge,
      violated: Boolean(hedge),
      label: hedge ? `Buzzer: "${hedge}" detected` : null,
    };
  }

  if (target === "recovery-speed") {
    const stalled = DRILL_STALL_OPENER_REGEX.test(cleaned);
    return {
      wordCount,
      hedgeMatch: null,
      violated: stalled,
      label: stalled ? "Buzzer: Stalling opener detected" : null,
    };
  }

  if (target === "evidence-gaps") {
    const vague =
      DRILL_VAGUE_QUANTIFIER_REGEX.test(cleaned) ||
      DRILL_VAGUE_SUFFIX_REGEX.test(cleaned);
    return {
      wordCount,
      hedgeMatch: null,
      violated: vague,
      label: vague ? "Buzzer: Vague quantifier detected" : null,
    };
  }

  return { wordCount, hedgeMatch: null, violated: false, label: null };
}

/**
 * Detects whether a user turn in Q&A dodged the question, relied on heavy
 * hedging, gave an unbacked absolute assertion, or dropped the core premise
 * of the panelist's last question.
 */
export function detectEvasiveUserTurn(
  text?: string | null,
  lastPanelQuestion?: string | null
): {
  evasive: boolean;
  reason?: string;
} {
  const cleaned = text?.trim() || "";
  if (!cleaned) return { evasive: false };

  if (EVASIVE_DEFLECTION_REGEX.test(cleaned)) {
    return {
      evasive: true,
      reason: "User pivoted or used a deflection phrase instead of answering directly",
    };
  }

  const globalHedge = new RegExp(DRILL_HEDGE_REGEX.source, "gi");
  const hedges = cleaned.match(globalHedge) || [];
  if (hedges.length >= 2) {
    return {
      evasive: true,
      reason: `User hedged repeatedly (${hedges.slice(0, 2).join(", ")})`,
    };
  }

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (
    UNBACKED_ABSOLUTE_REGEX.test(cleaned) &&
    words.length < 18 &&
    !CAUSAL_PROOF_REGEX.test(cleaned)
  ) {
    return {
      evasive: true,
      reason: "User made an unbacked sweeping assertion without proving the mechanism",
    };
  }

  if (lastPanelQuestion && words.length >= 8) {
    const qKeywords = extractContentKeywords(lastPanelQuestion);
    const aKeywords = extractContentKeywords(cleaned);
    if (qKeywords.length >= 2) {
      const hasOverlap = qKeywords.some((qk) => {
        const stem = qk.slice(0, 4);
        return aKeywords.some((ak) => ak.startsWith(stem) || qk.startsWith(ak.slice(0, 4)));
      });
      const hasDirectAnswerCue =
        /\b(because|since|specifically|first|yes\b|no\b)\b/i.test(cleaned);
      if (!hasOverlap && !hasDirectAnswerCue) {
        return {
          evasive: true,
          reason: "User dodged the specific premise of the question asked",
        };
      }
    }
  }

  return { evasive: false };
}

/**
 * Builds the 2-turn depth follow-up instruction when a panelist holds the floor
 * after an evasive or hedged user response.
 */
export function buildFollowUpPressureInstruction(reason: string): string {
  return `\n# FOLLOW-UP PRESSURE (2-TURN DEPTH)
The user's response was evasive (${reason}). You are holding the floor for a direct follow-up.
Do NOT let them pivot to a new topic. Explicitly call out that they hedged or didn't answer your core question, and press one level deeper on the exact same seam.`;
}

/**
 * Selects the next panelist to speak in a session.
 * - If `forcedPersonaId` is provided (e.g., an agitation interrupt from a specific
 *   panelist), returns that panelist.
 * - If the latest user message in `messages` is evasive (deflection or 2+ hedges)
 *   and the previous panelist has only spoken once on this thread, keeps that
 *   same panelist on the mic for a 2-turn follow-up chain.
 * - Otherwise rotates round-robin based on the most recent panelist message
 *   in the full conversation history (ordered by `seatOrder` ascending).
 */
export function selectNextPersona<T extends { id: string; seatOrder: number }>(
  personas: readonly T[],
  messages: ReadonlyArray<{
    role: string;
    personaId?: string | null;
    type?: string | null;
    content?: string | null;
  }>,
  forcedPersonaId?: string | null
): T | undefined {
  const ordered = [...personas].sort((a, b) => a.seatOrder - b.seatOrder);
  if (ordered.length === 0) return undefined;

  if (forcedPersonaId) {
    const forced = ordered.find((p) => p.id === forcedPersonaId);
    if (forced) return forced;
  }

  const personaMessages: Array<{ personaId: string; content?: string | null }> = [];
  for (const msg of messages) {
    if (
      (msg.role === "persona" || msg.role === "assistant") &&
      msg.type !== "coach_whisper" &&
      msg.personaId
    ) {
      personaMessages.push({ personaId: msg.personaId, content: msg.content });
    }
  }

  if (personaMessages.length > 0) {
    const lastPersonaMsg = personaMessages[personaMessages.length - 1];
    const lastPersonaId = lastPersonaMsg.personaId;
    const prevPersonaId =
      personaMessages.length >= 2
        ? personaMessages[personaMessages.length - 2].personaId
        : null;

    // Check if the latest user turn was evasive and lastPersona hasn't already
    // taken 2 consecutive turns
    const lastUserMsg = [...messages]
      .reverse()
      .find((m) => m.role === "user" && typeof m.content === "string");
    if (
      lastUserMsg?.content &&
      prevPersonaId !== lastPersonaId &&
      detectEvasiveUserTurn(lastUserMsg.content, lastPersonaMsg.content).evasive
    ) {
      const held = ordered.find((p) => p.id === lastPersonaId);
      if (held) return held;
    }

    const lastIdx = ordered.findIndex((p) => p.id === lastPersonaId);
    if (lastIdx >= 0) {
      return ordered[(lastIdx + 1) % ordered.length];
    }
  }

  return ordered[0];
}

export function buildOpenSparPrompt(): string {
  return `# EXPERIENCE: OPEN SPAR (HIGH-RIGOR Q&A)
Run high-pressure adversarial Q&A. Strictly honor the Stance and Attack Angles in ROOM CONTEXT.
On every turn, pick ONE sharp clash move instead of generic questioning:
1. Missing Mechanism: "You claim X leads to Y — what stops actors from doing Z?"
2. Comparative Trade-Off: Force them to weigh their claim against the status quo or alternative.
3. Principle / Edge-Case Trap: Push an absolute claim to its hardest logical boundary.
4. Dropped-Premise Callout: If they avoided part of your last question, call it out and press the exact seam.
Keep challenges tight (1-2 sentences, pin down their exact words).`;
}

/**
 * Build the drill-specific system prompt instruction for a persona.
 * This is appended to the persona's system prompt when the session is a drill.
 */
export function buildDrillPrompt(target: DrillTarget): string {
  const def = getDrillDefinition(target);
  return `\n## DRILL MODE: ${def.label}
This is a targeted drill session. Your SOLE PURPOSE is to force the user to stop: ${def.description}

When you detect this behavior in the user's response:
1. INTERRUPT IMMEDIATELY
2. Say exactly: "${def.correctionPhrase}"
3. Do NOT ask a new question. Force them to restate their answer without the weakness.
4. If they correct it, say: "${def.acknowledgmentPhrase}" and then ask your next question.
5. If they DON'T correct it (the behavior persists), interrupt AGAIN with the same correction.
6. Be relentless. You do not move on until they give you a clean answer.

This is NOT a normal conversation. You are a drill instructor targeting one specific weakness.`;
}

/**
 * Build the drill-specific interrupt instruction for the user prompt.
 *
 * NOTE: This is now only used as a fallback path. The primary drill-interrupt
 * path is deterministic (see getDrillCorrection) — it bypasses the LLM entirely
 * and returns the fixed correctionPhrase. This instruction is kept for the
 * non-streaming /spar fallback endpoint.
 */
export function buildDrillInterruptInstruction(target: DrillTarget): string {
  const def = getDrillDefinition(target);
  return `\n# DRILL INTERRUPT
The user just exhibited the behavior being drilled: ${def.label}.
${def.description}

Your response MUST be a coaching correction, NOT a question. Say:
"${def.correctionPhrase}"

Do NOT ask a question. Do NOT probe a claim. Just deliver the correction and wait for them to try again.
Set "type": "interruption" in your JSON response.`;
}

/**
 * The deterministic correction for a drill target.
 *
 * SINGLE SOURCE OF TRUTH for what the persona says when the user exhibits the
 * drilled weakness. Returned directly — no LLM call — so corrections are
 * instant (~1.7s TTS only) and never paraphrased.
 */
export function getDrillCorrection(target: DrillTarget): string {
  return getDrillDefinition(target).correctionPhrase;
}

/**
 * The deterministic acknowledgment for a drill target.
 *
 * Spoken when the user FINALLY answers cleanly after one or more corrections.
 * The LLM generates the NEXT question, and this acknowledgment is prepended
 * so the user hears "Good. Next." consistently.
 */
export function getDrillAcknowledgment(target: DrillTarget): string {
  return getDrillDefinition(target).acknowledgmentPhrase;
}

/**
 * Build the drill-specific opening prompt for the lead persona.
 *
 * The lead persona opens by stating the drill target + rules, then asks
 * the first question. This frames the drill so the user knows what's happening.
 */
export function buildDrillOpeningInstruction(target: DrillTarget): string {
  const def = getDrillDefinition(target);
  return `# DRILL MODE OPENING
This is a targeted drill session. Your SOLE PURPOSE is to force the user to stop: ${def.description}

Open with a SHORT framing (1 sentence) that states what's being drilled and the rule, then immediately ask your first question. Example shape: "We're drilling ${def.label.toLowerCase()}. ${def.description} Let's go." Then your question.

Do NOT explain the drill at length. Do NOT introduce yourself. State the target, state the rule, ask the question. Keep the framing under 20 words.`;
}

/**
 * Build the instruction for generating the NEXT question after a clean answer.
 *
 * The LLM generates ONLY the question. The deterministic acknowledgment is
 * prepended by the streaming endpoint.
 */
export function buildDrillNextQuestionInstruction(target: DrillTarget): string {
  const def = getDrillDefinition(target);
  return `# DRILL: CLEAN ANSWER
The user just answered cleanly after your correction — they fixed the weakness (${def.label}). Do NOT acknowledge the correction (handled separately). Do NOT repeat "${def.acknowledgmentPhrase}".

Your job: ask your NEXT question. A fresh, challenging question about the material or topic. Keep it sharp and probing. 1-2 sentences max.

Respond with your JSON object. The "content" field should be ONLY your next question (no acknowledgment, no preamble). Set "type": "normal".`;
}

/**
 * Build the boardroom-specific interrupt instruction.
 *
 * Boardroom interrupts must feel SHARP and cut-you-off — like a hostile
 * executive who can't wait for you to finish. Not polite questions.
 */
export function buildBoardroomInterruptInstruction(): string {
  return `\n# BOARDROOM INTERRUPT
You are cutting the user off MID-SENTENCE in a hostile boardroom. This is not a polite question — it's an interruption.

Your response MUST:
- Open with a sharp cutting phrase: "Hold on—" / "Wait—" / "Stop right there—" / "That's not good enough—"
- Be AGGRESSIVE and direct. No hedging, no "I was wondering."
- Attack the SPECIFIC weakness you just heard (the vague number, the hedge, the unsupported claim).
- Be SHORT. 1-2 sentences max. Cut them off, challenge, done.

Examples of the tone:
- "Hold on—where did that number come from? You can't just make up figures in this room."
- "Wait—'I think'? Either you know or you don't. Which is it?"
- "Stop. That's a hand-wave, not an answer. What's the actual mechanism?"

Set "type": "interruption" in your JSON response. Be relentless.`;
}

/**
 * Track a drill challenge during the session.
 * Each challenge = one instance of the drill target being detected.
 */
export interface DrillChallenge {
  /** What question was being asked when the challenge fired */
  questionIndex: number;
  /** How many attempts the user took to answer cleanly (0 = still not clean) */
  attempts: number;
  /** Whether the user eventually answered cleanly */
  resolved: boolean;
  /** Seconds between the correction and the clean answer (0 if unresolved) */
  recoveryTime: number;
  /** Points scored (3/2/1/0 based on attempts) */
  score: number;
}

export interface DrillSessionStats {
  target: DrillTarget;
  totalChallenges: number;
  resolvedChallenges: number;
  unresolvedChallenges: number;
  attempt1Clean: number;
  attempt2Clean: number;
  attempt3Plus: number;
  fastestRecovery: number;
  slowestRecovery: number;
  avgRecovery: number;
  totalScore: number;
  maxScore: number;
}

export function emptyDrillStats(target: DrillTarget): DrillSessionStats {
  return {
    target,
    totalChallenges: 0,
    resolvedChallenges: 0,
    unresolvedChallenges: 0,
    attempt1Clean: 0,
    attempt2Clean: 0,
    attempt3Plus: 0,
    fastestRecovery: 0,
    slowestRecovery: 0,
    avgRecovery: 0,
    totalScore: 0,
    maxScore: 0,
  };
}

export function scoreAttempt(attempts: number): number {
  if (attempts === 1) return 3;
  if (attempts === 2) return 2;
  if (attempts === 3) return 1;
  return 0;
}
