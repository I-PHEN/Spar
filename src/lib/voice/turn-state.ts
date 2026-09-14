import type { TurnMetricEvent } from "../observability/turn-metrics";
import type { PhraseChunk } from "./phrase-chunker";

export interface TurnState {
  readonly status:
    | "idle"
    | "listening"
    | "finalizing"
    | "generating"
    | "speaking"
    | "cancelled"
    | "failed";
  readonly sessionId: string;
  readonly turnId: string;
  readonly turnNumber: number;
  readonly transcript: string | null;
  readonly lastPhraseSequence: number;
  readonly lastAudioSequence: number;
  readonly lastPlayedAudioSequence: number;
  readonly generationComplete: boolean;
  readonly phrasesFinalized: boolean;
  readonly audioComplete: boolean;
  readonly orderingFailureCount: number;
  readonly failure: string | null;
}

export type TurnEvent = { readonly turnId: string } & (
  | { type: "StartOfTurn" }
  | { type: "EndOfTurn" }
  | { type: "TranscriptFrozen"; transcript: string }
  | { type: "GenerationDelta"; text: string }
  | { type: "GenerationComplete" }
  | { type: "PhraseReady"; phrase: PhraseChunk }
  | { type: "PhrasesFinalized" }
  | { type: "AudioFrame"; sequence: number; audio: Uint8Array }
  | { type: "AudioComplete" }
  | { type: "PlaybackStarted" }
  | { type: "PlaybackDrained"; sequence: number }
  | { type: "Metric"; metric: TurnMetricEvent }
  | { type: "Cancel" }
  | { type: "Error"; error: string }
);

export type TurnEffect = { readonly turnId: string } & (
  | { type: "begin-listening" }
  | { type: "freeze-transcript" }
  | { type: "start-generation"; transcript: string }
  | { type: "append-text"; text: string }
  | { type: "flush-phrases" }
  | { type: "synthesize-phrase"; phrase: PhraseChunk }
  | { type: "finalize-tts" }
  | { type: "queue-audio"; sequence: number; audio: Uint8Array }
  | { type: "record-metric"; metric: TurnMetricEvent }
  | { type: "abort-generation" }
  | { type: "clear-queued-text" }
  | { type: "stop-playback" }
  | { type: "reset-tts" }
);

export interface TurnReduction {
  state: TurnState;
  effects: TurnEffect[];
}

/** Use a unique sessionId for each controller lifetime. No clocks or UUIDs run here. */
export function initialTurnState(sessionId: string): TurnState {
  return {
    status: "idle",
    sessionId,
    turnId: `${sessionId}:0`,
    turnNumber: 0,
    transcript: null,
    lastPhraseSequence: -1,
    lastAudioSequence: -1,
    lastPlayedAudioSequence: -1,
    generationComplete: false,
    phrasesFinalized: false,
    audioComplete: false,
    orderingFailureCount: 0,
    failure: null,
  };
}

function cleanup(turnId: string): TurnEffect[] {
  return [
    { type: "abort-generation", turnId },
    { type: "clear-queued-text", turnId },
    { type: "stop-playback", turnId },
    { type: "reset-tts", turnId },
  ];
}

function fail(state: TurnState, failure: string): TurnReduction {
  return {
    state: { ...state, status: "failed", failure },
    effects: cleanup(state.turnId),
  };
}

function checkSequence(
  state: TurnState,
  stream: "phrase" | "audio",
  sequence: number,
  previous: number,
): TurnReduction | null {
  if (Number.isSafeInteger(sequence) && sequence >= 0) {
    if (sequence === previous) return { state, effects: [] };
    if (sequence === previous + 1) return null;
  }

  const count = state.orderingFailureCount + 1;
  const result = fail(
    { ...state, orderingFailureCount: count },
    `${stream}-ordering`,
  );
  result.effects.push({
    type: "record-metric",
    turnId: state.turnId,
    metric: {
      type: "ordering-failure",
      turnId: state.turnId,
      sessionId: state.sessionId,
      count,
    },
  });
  return result;
}

function finishIfDrained(state: TurnState): TurnState {
  if (
    state.generationComplete &&
    state.phrasesFinalized &&
    state.audioComplete &&
    state.lastPlayedAudioSequence === state.lastAudioSequence
  ) {
    return { ...state, status: "idle" };
  }
  return state;
}

/**
 * Pure lifecycle policy:
 * - Every event, including StartOfTurn, must carry the currently observed ID.
 *   StartOfTurn allocates the next ID and returns old-turn cleanup effects first.
 * - Invalid transitions and stale events preserve the same state reference and
 *   emit nothing. Idle/cancelled/failed accept only StartOfTurn.
 * - Accepted phrase/audio sequences independently start at zero. Repeating the
 *   latest sequence is idempotent; replay before the latest, gaps, and malformed
 *   numbers fail the turn. A sequence identifies its immutable payload.
 * - GenerationComplete requests chunker.flush(); dispatch its residual chunks
 *   as PhraseReady before PhrasesFinalized when didFinalize is true. isFinal
 *   alone is not a stream-completion signal (the flush may contain no chunks).
 * - AudioComplete follows TTS finalization. PlaybackDrained acknowledges the
 *   latest received audio sequence; a previously drained queue cannot complete
 *   newer audio. Generation, phrase finalization, audio EOF and drain must all
 *   finish before idle. No-audio turns require no synthetic playback event.
 *
 * The controller maps provider text-delta/successful complete to GenerationDelta/
 * GenerationComplete, and provider-error completion to Error. It executes these
 * declarative effects in order; stop-playback clears both queued and active audio,
 * clear-queued-text also cancels the chunker, and reset-tts closes the old stream.
 * Payload ownership stays with the caller; the reducer never mutates payloads.
 */
export function reduceTurn(state: TurnState, event: TurnEvent): TurnReduction {
  const unchanged: TurnReduction = { state, effects: [] };
  if (event.turnId !== state.turnId) return unchanged;

  const active =
    state.status === "listening" ||
    state.status === "finalizing" ||
    state.status === "generating" ||
    state.status === "speaking";

  if (event.type === "StartOfTurn") {
    const turnNumber = state.turnNumber + 1;
    const turnId = `${state.sessionId}:${turnNumber}`;
    return {
      state: {
        ...initialTurnState(state.sessionId),
        status: "listening",
        turnId,
        turnNumber,
      },
      effects: [
        ...(active ? cleanup(state.turnId) : []),
        { type: "begin-listening", turnId },
      ],
    };
  }

  if (!active) return unchanged;
  const { turnId } = state;

  if (event.type === "Cancel") {
    return { state: { ...state, status: "cancelled" }, effects: cleanup(turnId) };
  }
  if (event.type === "Error") return fail(state, event.error);
  if (event.type === "Metric") {
    if (
      event.metric.turnId !== turnId ||
      event.metric.sessionId !== state.sessionId
    ) return unchanged;
    return {
      state,
      effects: [{ type: "record-metric", turnId, metric: event.metric }],
    };
  }
  if (event.type === "EndOfTurn") {
    if (state.status !== "listening") return unchanged;
    return {
      state: { ...state, status: "finalizing" },
      effects: [{ type: "freeze-transcript", turnId }],
    };
  }
  if (event.type === "TranscriptFrozen") {
    if (state.status !== "finalizing") return unchanged;
    if (!event.transcript.trim()) return fail(state, "empty-transcript");
    return {
      state: { ...state, status: "generating", transcript: event.transcript },
      effects: [{ type: "start-generation", turnId, transcript: event.transcript }],
    };
  }

  if (state.status !== "generating" && state.status !== "speaking") return unchanged;

  switch (event.type) {
    case "GenerationDelta":
      if (state.generationComplete) return unchanged;
      return { state, effects: [{ type: "append-text", turnId, text: event.text }] };
    case "GenerationComplete":
      if (state.generationComplete) return unchanged;
      return {
        state: { ...state, generationComplete: true },
        effects: [{ type: "flush-phrases", turnId }],
      };
    case "PhraseReady": {
      if (state.phrasesFinalized) return unchanged;
      const rejected = checkSequence(
        state, "phrase", event.phrase.sequence, state.lastPhraseSequence,
      );
      if (rejected) return rejected;
      return {
        state: { ...state, lastPhraseSequence: event.phrase.sequence },
        effects: [{ type: "synthesize-phrase", turnId, phrase: event.phrase }],
      };
    }
    case "PhrasesFinalized":
      if (!state.generationComplete || state.phrasesFinalized) return unchanged;
      return {
        state: { ...state, phrasesFinalized: true },
        effects: [{ type: "finalize-tts", turnId }],
      };
    case "AudioFrame": {
      if (state.audioComplete) return unchanged;
      const rejected = checkSequence(
        state, "audio", event.sequence, state.lastAudioSequence,
      );
      if (rejected) return rejected;
      return {
        state: { ...state, lastAudioSequence: event.sequence },
        effects: [{ type: "queue-audio", turnId, sequence: event.sequence, audio: event.audio }],
      };
    }
    case "AudioComplete":
      if (!state.phrasesFinalized || state.audioComplete) return unchanged;
      return {
        state: finishIfDrained({ ...state, audioComplete: true }),
        effects: [],
      };
    case "PlaybackStarted":
      if (
        state.status !== "generating" ||
        state.lastAudioSequence === state.lastPlayedAudioSequence
      ) return unchanged;
      return { state: { ...state, status: "speaking" }, effects: [] };
    case "PlaybackDrained":
      if (
        state.status !== "speaking" ||
        event.sequence !== state.lastAudioSequence ||
        event.sequence === state.lastPlayedAudioSequence
      ) return unchanged;
      return {
        state: finishIfDrained({ ...state, lastPlayedAudioSequence: event.sequence }),
        effects: [],
      };
  }
}
