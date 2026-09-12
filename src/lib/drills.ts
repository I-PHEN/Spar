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
 * This is added to the user prompt when isInterrupt=true AND the session is a drill.
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
