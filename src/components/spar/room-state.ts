// Spar — Room state language
//
// The room has one status language, engine-agnostic: at any moment the room
// is in a single phase, the presence shows one of three states, and one
// status line names it. This module owns that mapping as pure functions so
// the state language is testable without React and shared by the presence
// rail, the control deck, and the pinned engine helpers below.
//
// "Voice has no spinner": silence must never read as dead — every moment
// resolves to listening / gathering / speaking, with a line that says so.

import type { UseTurnControllerResult } from "@/hooks/use-turn-controller";

/** The engine ladder status, widened with the deck-level "off" (not activated). */
export type LiveEngineStatus = UseTurnControllerResult["liveEngineStatus"] | "off";

export type RoomPhase =
  | "presenting"
  | "coach-read"
  | "listening"
  | "gathering"
  | "speaking"
  | "drill-retry"
  | "ending";

/** What the panelist presence is doing, regardless of engine. */
export type PresenceState = "listening" | "gathering" | "speaking";

export interface RoomStateInput {
  liveSessionActive: boolean;
  liveStatus: LiveEngineStatus;
  isPresenting: boolean;
  isUserTurn: boolean;
  isListening: boolean;
  isProcessing: boolean;
  audioPlaying: boolean;
  analyzing: boolean;
  coachReadOpen: boolean;
  drillRetry: boolean;
  ending: boolean;
}

export interface RoomState {
  phase: RoomPhase;
  presence: PresenceState;
  statusLine: string;
}

/**
 * Resolve the room's single state. Priority: ending > presenting >
 * coach-read > drill-retry > live-connecting > speaking > gathering >
 * listening. Status lines reuse the deck's pinned strings so the control
 * bar can adopt them verbatim.
 */
export function roomState(input: RoomStateInput): RoomState {
  if (input.ending) {
    return { phase: "ending", presence: "gathering", statusLine: "Ending the session…" };
  }
  if (input.isPresenting) {
    return {
      phase: "presenting",
      presence: "listening",
      statusLine: input.isListening ? "Presenting…" : "The floor is yours",
    };
  }
  if (input.analyzing || input.coachReadOpen) {
    return {
      phase: "coach-read",
      presence: "gathering",
      statusLine: input.coachReadOpen ? "Read the coach's read above" : "Analyzing your presentation…",
    };
  }
  if (input.drillRetry) {
    return {
      phase: "drill-retry",
      presence: "listening",
      statusLine: "Try again — answer without the weakness",
    };
  }
  // The live handshake reads as gathering: one activation, then it owns the room.
  if (input.liveSessionActive && input.liveStatus === "connecting") {
    return { phase: "gathering", presence: "gathering", statusLine: "Connecting the live engine…" };
  }
  if (input.audioPlaying) {
    return { phase: "speaking", presence: "speaking", statusLine: "Panel is speaking" };
  }
  if (input.isProcessing) {
    return { phase: "gathering", presence: "gathering", statusLine: "Panel is responding" };
  }
  // User's floor. Live mode is continuous; classic waits for a click.
  if (input.liveSessionActive && input.liveStatus === "live") {
    return { phase: "listening", presence: "listening", statusLine: "Mic live — just talk" };
  }
  return {
    phase: "listening",
    presence: "listening",
    statusLine: input.isListening ? "Listening…" : "Click to speak",
  };
}

/**
 * Whether caption auto-scroll should stick to the bottom: only while the
 * user is at (or within 80px of) the bottom. Scrolling up to read releases
 * the stick; a fresh caption while stuck scrolls.
 */
export function shouldStickToBottom(distanceFromBottom: number): boolean {
  return distanceFromBottom < 80;
}

/** How far a scroll container's bottom is above the viewport, in px. */
export function distanceFromBottom(el: HTMLElement): number {
  return el.scrollHeight - el.scrollTop - el.clientHeight;
}

// ─── Pinned engine helpers ──────────────────────────────────────────────
// Moved here from sparring-room.tsx (which re-exports them); behavior and
// signatures are pinned by sparring-room.test.tsx and the e2e suite.

export type EngineStatusLabel = "Live" | "Classic" | "Connecting";

/** Quiet chip text naming the engine that owns the room right now. */
export function engineStatusLabel(
  liveSessionActive: boolean,
  status: LiveEngineStatus,
): EngineStatusLabel {
  // Not activated yet, stopped, or laddered down: the cascade owns the room.
  if (!liveSessionActive || status === "fallback") return "Classic";
  return status === "live" ? "Live" : "Connecting";
}

/** Whether the live engine's one-activation mic owns the room controls. */
export function liveOwnsControls(
  liveSessionActive: boolean,
  status: LiveEngineStatus,
): boolean {
  // The connecting window already counts: the user has activated once and
  // must not be handed a second click flow mid-handshake.
  return liveSessionActive && status !== "fallback";
}

/**
 * Whether this mic activation should record a debrief audio clip. The
 * debrief segments per classic turn; a live-engine session is one
 * continuous capture it cannot segment, so those activations are skipped.
 * Presenting (classic recognizer) and post-fallback activations record
 * exactly as before.
 */
export function recordsTurnAudio(
  isPresenting: boolean,
  liveConfigured: boolean,
  status: LiveEngineStatus,
): boolean {
  if (isPresenting || !liveConfigured) return true;
  return status === "fallback";
}

/**
 * Whether the live→cascade fallback transition should start the debrief
 * recorder itself. A live activation clicks while the engine still reads
 * "connecting", so recordsTurnAudio is false at click time; when the engine
 * then ladders down (e.g. a 503 from the token route on a no-key
 * deployment) the cascade mic starts without a click, and the first classic
 * turn's clip would be lost. The transition starts the recorder — exactly
 * once per activation (the alreadyStarted latch), never while the recorder
 * is already running, and only while a live-configured room's activation
 * still governs it. Classic rooms, presenting, and live-owned activations
 * are unchanged: their click-time recordsTurnAudio path already decides.
 */
export function startsRecorderOnFallback(input: {
  liveConfigured: boolean;
  liveSessionActive: boolean;
  status: LiveEngineStatus;
  cascadeListening: boolean;
  recorderReady: boolean;
  alreadyStarted: boolean;
}): boolean {
  if (!input.liveConfigured || !input.liveSessionActive || input.alreadyStarted) return false;
  return input.status === "fallback" && input.cascadeListening && input.recorderReady;
}

/**
 * The interim user speech to show as the live "Speaking…" caption. The live
 * engine publishes it as the controller's transcript preview; classic rooms
 * never read it (their interim caption comes from the recognizer), and a
 * leftover preview must not bleed into a room the cascade owns.
 */
export function liveUserInterimCaption(
  liveSessionActive: boolean,
  status: LiveEngineStatus,
  transcriptPreview: string,
): string {
  return liveOwnsControls(liveSessionActive, status) ? transcriptPreview : "";
}
