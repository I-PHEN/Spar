// Spar — Text-derived telemetry
//
// In voice mode (v2), we'd capture WPM, filler words, pause time, etc. from audio.
// In text mode (v1), we derive equivalent signals from the text itself.
// These map directly to the 5 skill dimensions the brief defines:
// Clarity, Recovery, Concision, Presence, Evidence.

import type { TelemetrySnapshot, TurnTelemetry } from "./types";

// Hedge / qualifier words. Matched case-insensitively as whole words.
// Sourced from the brief's example: "I think", "maybe", "sort of", "I guess",
// and extended with common patterns.
export const HEDGE_PATTERNS: RegExp[] = [
  /\bi think\b/gi,
  /\bi feel\b/gi,
  /\bi guess\b/gi,
  /\bi believe\b/gi,
  /\bi suppose\b/gi,
  /\bmaybe\b/gi,
  /\bperhaps\b/gi,
  /\bpossibly\b/gi,
  /\bprobably\b/gi,
  /\bsort of\b/gi,
  /\bkind of\b/gi,
  /\blike\b/gi, // filler "like" — heuristic, may overcount
  /\byou know\b/gi,
  /\bsomewhat\b/gi,
  /\brather\b/gi,
  /\bquite\b/gi,
  /\bfairly\b/gi,
  /\brelatively\b/gi,
];

// Question-deflection markers — words that signal the user is pivoting
// rather than answering.
export const DEFLECTION_PATTERNS: RegExp[] = [
  /\bthat[''']s a (great|good|fair) question\b/gi,
  /\bwhat i[''']d say is\b/gi,
  /\bthe real question is\b/gi,
  /\bit depends\b/gi,
  /\blet me reframe\b/gi,
  /\bwhat we should be asking\b/gi,
];

// Evidence citation — numbers, percentages, dates, named studies.
export const EVIDENCE_PATTERNS: RegExp[] = [
  /\b\d+(\.\d+)?%\b/g, // percentages
  /\b\d{1,3}(,\d{3})+\b/g, // comma-formatted numbers (e.g., 1,000,000)
  /\b\$?\d+(\.\d+)?\s?(million|billion|thousand|m|b|k)\b/gi, // $1.2M, 3 billion
  /\b\d{4}\b/g, // years
  /\bstudy\b/gi,
  /\bdata\b/gi,
  /\bsurvey\b/gi,
  /\bcohort\b/gi,
  /\bpaper\b/gi,
  /\bmeta-analysis\b/gi,
];

export interface TurnInput {
  userText: string;
  /** Latency in ms between the persona's last message and the user sending this one */
  responseMs: number;
  /** Did the persona's preceding message ask a direct question? */
  personaAskedDirectQuestion: boolean;
  turnIndex: number;
}

export function computeTurnTelemetry(input: TurnInput): TurnTelemetry {
  const text = input.userText;
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  let hedgeCount = 0;
  for (const p of HEDGE_PATTERNS) {
    const matches = text.match(p);
    if (matches) hedgeCount += matches.length;
  }

  let deflectionSignals = 0;
  for (const p of DEFLECTION_PATTERNS) {
    const matches = text.match(p);
    if (matches) deflectionSignals += matches.length;
  }

  let evidenceHits = 0;
  for (const p of EVIDENCE_PATTERNS) {
    const matches = text.match(p);
    if (matches) evidenceHits += matches.length;
  }

  // Heuristic: did the user answer directly?
  // If the persona asked a direct question AND the user's response contains
  // no deflection markers AND the response is non-trivial (>5 words), we say yes.
  const answeredDirectly =
    input.personaAskedDirectQuestion &&
    deflectionSignals === 0 &&
    wordCount > 5;

  return {
    turnIndex: input.turnIndex,
    wordCount,
    hedgeCount,
    responseMs: input.responseMs,
    answeredDirectly,
    citedEvidence: evidenceHits > 0,
  };
}

export function aggregateTelemetry(turns: TurnTelemetry[]): TelemetrySnapshot {
  if (turns.length === 0) {
    return {
      userTurns: 0,
      totalWords: 0,
      avgWordsPerResponse: 0,
      hedgeCount: 0,
      hedgesPerResponse: 0,
      avgResponseMs: 0,
      deflections: 0,
      evidenceCitations: 0,
      turns: [],
    };
  }

  const totalWords = turns.reduce((s, t) => s + t.wordCount, 0);
  const hedgeCount = turns.reduce((s, t) => s + t.hedgeCount, 0);
  const totalResponseMs = turns.reduce((s, t) => s + t.responseMs, 0);
  const deflections = turns.filter(
    (t) => t.wordCount > 5 && !t.answeredDirectly
  ).length;
  const evidenceCitations = turns.filter((t) => t.citedEvidence).length;

  return {
    userTurns: turns.length,
    totalWords,
    avgWordsPerResponse: Math.round(totalWords / turns.length),
    hedgeCount,
    hedgesPerResponse: Number((hedgeCount / turns.length).toFixed(1)),
    avgResponseMs: Math.round(totalResponseMs / turns.length),
    deflections,
    evidenceCitations,
    turns,
  };
}

/** Quick live-update for a single new message (used during session, for the
 * subtle telemetry bar in the Sparring Room). */
export function quickStats(text: string): {
  words: number;
  hedges: number;
  hasEvidence: boolean;
} {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  let hedges = 0;
  for (const p of HEDGE_PATTERNS) {
    const m = text.match(p);
    if (m) hedges += m.length;
  }
  let evidenceHits = 0;
  for (const p of EVIDENCE_PATTERNS) {
    const m = text.match(p);
    if (m) evidenceHits += m.length;
  }
  return { words, hedges, hasEvidence: evidenceHits > 0 };
}
