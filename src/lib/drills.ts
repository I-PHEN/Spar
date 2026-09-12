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
