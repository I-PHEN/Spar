// Spar — Heuristic trigger detection for the agitation engine.
//
// These are REAL-TIME, regex/count-based triggers that run on the live
// interim transcript. They're intentionally simple — no LLM calls, no
// semantic analysis. That comes later (post-turn, in the debrief).
//
// Three trigger types:
//   1. Hedge words → Skeptic agitation
//   2. Word count (talking too long) → Timekeeper agitation
//   3. Vague quantifiers near numbers → Nitpicker agitation
//
// Each trigger type maps to ONE persona archetype. So-What and Ally
// don't have heuristic triggers (they need semantic analysis) — they
// respond in the normal turn-based flow.

import type { ArchetypeKey } from "./types";

// ─── Hedge patterns ────────────────────────────────────────────────────
// Reused from telemetry.ts but duplicated here to keep this module standalone.
// (telemetry.ts is for post-session analysis; this is for real-time detection.)
const HEDGE_REGEX = /\b(i think|i feel|i guess|i believe|i suppose|maybe|perhaps|possibly|probably|sort of|kind of|like|you know|somewhat|rather|quite|fairly|relatively)\b/gi;

// ─── Vague quantifier patterns ──────────────────────────────────────────
// Matches "roughly 50%", "about 200", "around 3 million", "50 or so", "50ish"
const VAGUE_QUANTIFIER_REGEX = /\b(roughly|about|around|approximately|somewhere around)\s+[\d$]/gi;
const VAGUE_SUFFIX_REGEX = /\d+\s*(or so|ish)\b/gi;

// ─── Trigger result ─────────────────────────────────────────────────────

export interface TriggerResult {
  /** Agitation increment for each persona archetype (0 if no trigger) */
  agitation: Partial<Record<ArchetypeKey, number>>;
  /** Human-readable reason for the trigger (for logging/debugging) */
  reason: string;
}

/**
 * Detect heuristic triggers in a chunk of text.
 *
 * Returns the agitation increment for each persona archetype based on
 * what's in the text. The caller accumulates these into each persona's
 * total agitation score.
 *
 * @param text The text to analyze (usually the interim + final transcript)
 * @param wordCount The total word count so far (for the Timekeeper trigger)
 */
export function detectTriggers(
  text: string,
  wordCount: number
): TriggerResult {
  const agitation: Partial<Record<ArchetypeKey, number>> = {};
  const reasons: string[] = [];

  // ─── Skeptic: hedge words ────────────────────────────────────────────
  const hedgeMatches = text.match(HEDGE_REGEX);
  const hedgeCount = hedgeMatches ? hedgeMatches.length : 0;
  if (hedgeCount > 0) {
    agitation.skeptic = hedgeCount * 30;
    reasons.push(`${hedgeCount} hedge${hedgeCount === 1 ? "" : "s"}`);
  }

  // ─── Timekeeper: talking too long ────────────────────────────────────
  // Ramps up after 100 words. +1.5 per word over 100.
  // At 167 words → 100 agitation (threshold).
  if (wordCount > 100) {
    const overage = wordCount - 100;
    agitation.timekeeper = Math.round(overage * 1.5);
    if (overage > 20) {
      reasons.push(`${wordCount} words (overlong)`);
    }
  }

  // ─── Nitpicker: vague quantifiers ────────────────────────────────────
  const vagueMatches = text.match(VAGUE_QUANTIFIER_REGEX);
  const vagueSuffixMatches = text.match(VAGUE_SUFFIX_REGEX);
  const vagueCount =
    (vagueMatches ? vagueMatches.length : 0) +
    (vagueSuffixMatches ? vagueSuffixMatches.length : 0);
  if (vagueCount > 0) {
    agitation.nitpicker = vagueCount * 30;
    reasons.push(`${vagueCount} vague quantifier${vagueCount === 1 ? "" : "s"}`);
  }

  return {
    agitation,
    reason: reasons.join(", "),
  };
}

/**
 * Get the interrupt threshold for a persona, adjusted by coaching mode.
 *
 * In Drill Mode, the persona matching the drill target has a lower threshold
 * (they're hypersensitive to the thing being drilled).
 */
export function getThreshold(
  archetype: ArchetypeKey,
  coachingMode: "pure-spar" | "coach" | "drill",
  drillTarget?: "hedging" | "over-explaining" | "recovery-speed" | "evidence-gaps"
): number {
  const DEFAULT_THRESHOLD = 100;

  if (coachingMode !== "drill" || !drillTarget) {
    return DEFAULT_THRESHOLD;
  }

  // In Drill Mode, lower the threshold for the persona that matches the drill target
  const drillArchetypeMap: Record<string, ArchetypeKey> = {
    hedging: "skeptic",
    "over-explaining": "timekeeper",
    "recovery-speed": "skeptic", // Skeptic probes recovery
    "evidence-gaps": "nitpicker",
  };

  const drillArchetype = drillArchetypeMap[drillTarget];
  if (archetype === drillArchetype) {
    return 50; // Hypersensitive — interrupts after ~2 triggers instead of ~4
  }

  return DEFAULT_THRESHOLD;
}

/**
 * Convert an agitation score (0-100) to interrupt meter dots (0-5).
 */
export function agitationToDots(agitation: number): number {
  return Math.min(5, Math.floor(agitation / 20));
}
