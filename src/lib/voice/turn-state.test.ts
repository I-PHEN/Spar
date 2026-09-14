import { describe, expect, test } from "bun:test";
import { createPhraseChunker } from "./phrase-chunker";
import {
  initialTurnState,
  reduceTurn,
  type TurnEffect,
  type TurnEvent,
  type TurnState,
} from "./turn-state";

const audio = new Uint8Array([1, 2, 3, 4]);
const phrase = { text: "A response. ", sequence: 0, isFinal: false };
const cleanup: TurnEffect[] = [
  { type: "abort-generation", turnId: "session:1" },
  { type: "clear-queued-text", turnId: "session:1" },
  { type: "stop-playback", turnId: "session:1" },
  { type: "reset-tts", turnId: "session:1" },
];

function send(state: TurnState, event: Omit<TurnEvent, "turnId">): TurnState;
function send(state: TurnState, event: object): TurnState {
  return reduceTurn(state, { ...event, turnId: state.turnId } as TurnEvent).state;
}

function start(): TurnState {
  return send(initialTurnState("session"), { type: "StartOfTurn" });
}

function generating(): TurnState {
  const listening = start();
  const finalizing = send(listening, { type: "EndOfTurn" });
  return reduceTurn(finalizing, {
    type: "TranscriptFrozen",
    turnId: finalizing.turnId,
    transcript: "My exact words. ",
  }).state;
}

function speaking(): TurnState {
  const queued = reduceTurn(generating(), {
    type: "AudioFrame", turnId: "session:1", sequence: 0, audio,
  }).state;
  return send(queued, { type: "PlaybackStarted" });
}

describe("turn lifecycle", () => {
  test("allocates monotonic session-scoped IDs without starting generation", () => {
    const first = reduceTurn(initialTurnState("session"), {
      type: "StartOfTurn", turnId: "session:0",
    });
    expect(first.state.status).toBe("listening");
    expect(first.state.turnId).toBe("session:1");
    expect(first.effects).toEqual([{ type: "begin-listening", turnId: "session:1" }]);
    const second = reduceTurn(first.state, { type: "StartOfTurn", turnId: "session:1" });
    expect(second.state.turnId).toBe("session:2");
    expect(second.effects.at(-1)).toEqual({ type: "begin-listening", turnId: "session:2" });
  });

  test("EndOfTurn requests finalization and only frozen nonempty text starts generation", () => {
    const result = reduceTurn(start(), { type: "EndOfTurn", turnId: "session:1" });
    expect(result.state.status).toBe("finalizing");
    expect(result.state.transcript).toBeNull();
    expect(result.effects).toEqual([{ type: "freeze-transcript", turnId: "session:1" }]);
    const frozen = reduceTurn(result.state, {
      type: "TranscriptFrozen", turnId: "session:1", transcript: " My exact words.\n",
    });
    expect(frozen.state.status).toBe("generating");
    expect(frozen.state.transcript).toBe(" My exact words.\n");
    expect(frozen.effects).toEqual([
      { type: "start-generation", turnId: "session:1", transcript: " My exact words.\n" },
    ]);
  });

  test("empty frozen text fails without generating a response", () => {
    const state = send(start(), { type: "EndOfTurn" });
    const result = reduceTurn(state, {
      type: "TranscriptFrozen", turnId: "session:1", transcript: " \n\t",
    });
    expect(result.state.status).toBe("failed");
    expect(result.state.failure).toBe("empty-transcript");
    expect(result.effects).toEqual(cleanup);
  });

  test("streams exact text and waits for actual playback before speaking", () => {
    const state = generating();
    const delta = reduceTurn(state, {
      type: "GenerationDelta", turnId: "session:1", text: " A response. ",
    });
    expect(delta.effects).toEqual([
      { type: "append-text", turnId: "session:1", text: " A response. " },
    ]);
    const chunk = reduceTurn(delta.state, { type: "PhraseReady", turnId: "session:1", phrase });
    expect(chunk.effects).toEqual([{ type: "synthesize-phrase", turnId: "session:1", phrase }]);
    const frame = reduceTurn(chunk.state, {
      type: "AudioFrame", turnId: "session:1", sequence: 0, audio,
    });
    expect(frame.state.status).toBe("generating");
    expect(frame.effects).toEqual([{ type: "queue-audio", turnId: "session:1", sequence: 0, audio }]);
    expect(send(frame.state, { type: "PlaybackStarted" }).status).toBe("speaking");
  });

  test("flushes phrases and TTS once, including an empty phrase-chunker flush", () => {
    const chunker = createPhraseChunker();
    let state = generating();
    for (const chunk of chunker.push("Done. ")) {
      state = reduceTurn(state, { type: "PhraseReady", turnId: state.turnId, phrase: chunk }).state;
    }
    const complete = reduceTurn(state, { type: "GenerationComplete", turnId: "session:1" });
    expect(complete.state.status).toBe("generating");
    expect(complete.effects).toEqual([{ type: "flush-phrases", turnId: "session:1" }]);
    expect(reduceTurn(complete.state, { type: "GenerationComplete", turnId: "session:1" }).effects).toEqual([]);
    const flush = chunker.flush();
    expect(flush).toEqual({ chunks: [], didFinalize: true });
    const finalized = reduceTurn(complete.state, { type: "PhrasesFinalized", turnId: "session:1" });
    expect(finalized.effects).toEqual([{ type: "finalize-tts", turnId: "session:1" }]);
    expect(finalized.state.lastPhraseSequence).toBe(0);
    expect(reduceTurn(finalized.state, { type: "PhrasesFinalized", turnId: "session:1" }).effects).toEqual([]);
  });

  test("plays the final residual phrase after generation completes", () => {
    const complete = send(generating(), { type: "GenerationComplete" });
    const result = reduceTurn(complete, {
      type: "PhraseReady", turnId: "session:1",
      phrase: { text: "Residual", sequence: 0, isFinal: true },
    });
    expect(result.effects).toEqual([
      { type: "synthesize-phrase", turnId: "session:1", phrase: { text: "Residual", sequence: 0, isFinal: true } },
    ]);
  });

  test("keeps speaking until generation, TTS, and the last audio playback all finish", () => {
    const complete = send(speaking(), { type: "GenerationComplete" });
    const finalized = send(complete, { type: "PhrasesFinalized" });
    const audioComplete = send(finalized, { type: "AudioComplete" });
    expect(audioComplete.status).toBe("speaking");
    const result = reduceTurn(audioComplete, { type: "PlaybackDrained", turnId: "session:1", sequence: 0 });
    expect(result.state.status).toBe("idle");
    expect(result.effects).toEqual([]);
  });

  test("handles playback draining before the final stream completion", () => {
    const drained = reduceTurn(speaking(), { type: "PlaybackDrained", turnId: "session:1", sequence: 0 }).state;
    expect(drained.status).toBe("speaking");
    const complete = send(drained, { type: "GenerationComplete" });
    const finalized = send(complete, { type: "PhrasesFinalized" });
    expect(send(finalized, { type: "AudioComplete" }).status).toBe("idle");
  });

  test("does not finish when only an earlier audio queue has drained", () => {
    const drained = reduceTurn(speaking(), { type: "PlaybackDrained", turnId: "session:1", sequence: 0 }).state;
    const queued = reduceTurn(drained, { type: "AudioFrame", turnId: "session:1", sequence: 1, audio }).state;
    const complete = send(send(send(queued, { type: "GenerationComplete" }), { type: "PhrasesFinalized" }), { type: "AudioComplete" });
    const staleDrain = reduceTurn(complete, { type: "PlaybackDrained", turnId: "session:1", sequence: 0 });
    expect(staleDrain.state).toBe(complete);
    expect(staleDrain.effects).toEqual([]);
    expect(reduceTurn(complete, { type: "PlaybackDrained", turnId: "session:1", sequence: 1 }).state.status).toBe("idle");
  });

  test("returns to idle for a response with no audio without inventing playback", () => {
    const complete = send(generating(), { type: "GenerationComplete" });
    const finalized = send(complete, { type: "PhrasesFinalized" });
    expect(send(finalized, { type: "AudioComplete" }).status).toBe("idle");
  });
});

// Each entry is an independent, literal transition oracle. Active fixtures have
// queued audio but no completed streams; guard-dependent variants are below.
const cleanupTypes: TurnEffect["type"][] = [
  "abort-generation", "clear-queued-text", "stop-playback", "reset-tts",
];
const restartTypes: TurnEffect["type"][] = [...cleanupTypes, "begin-listening"];
const transitionCases: Array<{
  event: TurnEvent;
  statuses: [TurnState["status"], TurnState["status"], TurnState["status"], TurnState["status"], TurnState["status"], TurnState["status"], TurnState["status"]];
  effects: TurnEffect["type"][][];
}> = [
  {
    event: { type: "StartOfTurn", turnId: "session:1" },
    statuses: ["listening", "listening", "listening", "listening", "listening", "listening", "listening"],
    effects: [["begin-listening"], restartTypes, restartTypes, restartTypes, restartTypes, ["begin-listening"], ["begin-listening"]],
  },
  {
    event: { type: "EndOfTurn", turnId: "session:1" },
    statuses: ["idle", "finalizing", "finalizing", "generating", "speaking", "cancelled", "failed"],
    effects: [[], ["freeze-transcript"], [], [], [], [], []],
  },
  {
    event: { type: "TranscriptFrozen", turnId: "session:1", transcript: "Frozen." },
    statuses: ["idle", "listening", "generating", "generating", "speaking", "cancelled", "failed"],
    effects: [[], [], ["start-generation"], [], [], [], []],
  },
  {
    event: { type: "GenerationDelta", turnId: "session:1", text: "Next" },
    statuses: ["idle", "listening", "finalizing", "generating", "speaking", "cancelled", "failed"],
    effects: [[], [], [], ["append-text"], ["append-text"], [], []],
  },
  {
    event: { type: "GenerationComplete", turnId: "session:1" },
    statuses: ["idle", "listening", "finalizing", "generating", "speaking", "cancelled", "failed"],
    effects: [[], [], [], ["flush-phrases"], ["flush-phrases"], [], []],
  },
  {
    event: { type: "PhraseReady", turnId: "session:1", phrase },
    statuses: ["idle", "listening", "finalizing", "generating", "speaking", "cancelled", "failed"],
    effects: [[], [], [], ["synthesize-phrase"], ["synthesize-phrase"], [], []],
  },
  {
    event: { type: "PhrasesFinalized", turnId: "session:1" },
    statuses: ["idle", "listening", "finalizing", "generating", "speaking", "cancelled", "failed"],
    effects: [[], [], [], [], [], [], []],
  },
  {
    event: { type: "AudioFrame", turnId: "session:1", sequence: 1, audio },
    statuses: ["idle", "listening", "finalizing", "generating", "speaking", "cancelled", "failed"],
    effects: [[], [], [], ["queue-audio"], ["queue-audio"], [], []],
  },
  {
    event: { type: "AudioComplete", turnId: "session:1" },
    statuses: ["idle", "listening", "finalizing", "generating", "speaking", "cancelled", "failed"],
    effects: [[], [], [], [], [], [], []],
  },
  {
    event: { type: "PlaybackStarted", turnId: "session:1" },
    statuses: ["idle", "listening", "finalizing", "speaking", "speaking", "cancelled", "failed"],
    effects: [[], [], [], [], [], [], []],
  },
  {
    event: { type: "PlaybackDrained", turnId: "session:1", sequence: 0 },
    statuses: ["idle", "listening", "finalizing", "generating", "speaking", "cancelled", "failed"],
    effects: [[], [], [], [], [], [], []],
  },
  {
    event: {
      type: "Metric", turnId: "session:1",
      metric: { type: "first-token", turnId: "session:1", sessionId: "session", offsetMs: 100 },
    },
    statuses: ["idle", "listening", "finalizing", "generating", "speaking", "cancelled", "failed"],
    effects: [[], ["record-metric"], ["record-metric"], ["record-metric"], ["record-metric"], [], []],
  },
  {
    event: { type: "Cancel", turnId: "session:1" },
    statuses: ["idle", "cancelled", "cancelled", "cancelled", "cancelled", "cancelled", "failed"],
    effects: [[], cleanupTypes, cleanupTypes, cleanupTypes, cleanupTypes, [], []],
  },
  {
    event: { type: "Error", turnId: "session:1", error: "provider unavailable" },
    statuses: ["idle", "failed", "failed", "failed", "failed", "cancelled", "failed"],
    effects: [[], cleanupTypes, cleanupTypes, cleanupTypes, cleanupTypes, [], []],
  },
];
const statuses: TurnState["status"][] = ["idle", "listening", "finalizing", "generating", "speaking", "cancelled", "failed"];

describe("explicit transition policy", () => {
  for (const [index, status] of statuses.entries()) {
    for (const row of transitionCases) {
      test(`${status} + ${row.event.type} -> ${row.statuses[index]}`, () => {
        const active = status === "generating" || status === "speaking";
        const state: TurnState = {
          ...initialTurnState("session"), status, turnId: "session:1", turnNumber: 1,
          transcript: active ? "Frozen." : null,
          lastAudioSequence: active ? 0 : -1,
        };
        const result = reduceTurn(state, row.event);
        expect(result.state.status).toBe(row.statuses[index]);
        expect(result.effects.map((effect) => effect.type)).toEqual(row.effects[index]);
        // A rejected event must also preserve counters, frozen text, and flags.
        const acceptsPlaybackStart = row.event.type === "PlaybackStarted" && status === "generating";
        const acceptsPlaybackDrain = row.event.type === "PlaybackDrained" && status === "speaking";
        if (row.effects[index].length === 0 && !acceptsPlaybackStart && !acceptsPlaybackDrain) {
          expect(result.state).toBe(state);
        }
      });
    }
  }

  test("ignores playback signals before audio is queued", () => {
    const state = generating();
    expect(reduceTurn(state, { type: "PlaybackStarted", turnId: "session:1" })).toEqual({ state, effects: [] });
    expect(reduceTurn(state, { type: "PlaybackDrained", turnId: "session:1", sequence: -1 })).toEqual({ state, effects: [] });
  });

  test("ignores deltas after generation closes and phrases after finalization", () => {
    const complete = send(generating(), { type: "GenerationComplete" });
    expect(reduceTurn(complete, { type: "GenerationDelta", turnId: "session:1", text: "late" })).toEqual({ state: complete, effects: [] });
    const finalized = send(complete, { type: "PhrasesFinalized" });
    expect(reduceTurn(finalized, { type: "PhraseReady", turnId: "session:1", phrase })).toEqual({ state: finalized, effects: [] });
  });

  test("ignores audio after its stream closes even while playback is active", () => {
    const complete = send(send(send(speaking(), { type: "GenerationComplete" }), { type: "PhrasesFinalized" }), { type: "AudioComplete" });
    expect(complete.status).toBe("speaking");
    expect(reduceTurn(complete, { type: "AudioFrame", turnId: "session:1", sequence: 1, audio })).toEqual({ state: complete, effects: [] });
    expect(reduceTurn(complete, { type: "AudioComplete", turnId: "session:1" })).toEqual({ state: complete, effects: [] });
  });
});

describe("interruption and stale work", () => {
  for (const [status, fixture] of [["generating", generating], ["speaking", speaking]] as const) {
    test(`barge-in during ${status} cleans up the old turn before beginning the new one`, () => {
      const state = fixture();
      const result = reduceTurn(state, { type: "StartOfTurn", turnId: "session:1" });
      expect(result.effects).toEqual([...cleanup, { type: "begin-listening", turnId: "session:2" }]);
      expect(result.state).toMatchObject({
        status: "listening", turnId: "session:2", turnNumber: 2, transcript: null,
        lastPhraseSequence: -1, lastAudioSequence: -1, lastPlayedAudioSequence: -1,
        generationComplete: false, phrasesFinalized: false, audioComplete: false,
        orderingFailureCount: 0, failure: null,
      });
    });
  }

  for (const row of transitionCases) {
    test(`stale ${row.event.type} has no effect after a new turn begins`, () => {
      const listening = send(speaking(), { type: "StartOfTurn" });
      const finalizing = send(listening, { type: "EndOfTurn" });
      const ready = reduceTurn(finalizing, {
        type: "TranscriptFrozen", turnId: "session:2", transcript: "Replacement turn.",
      }).state;
      const queued = reduceTurn(ready, {
        type: "AudioFrame", turnId: "session:2", sequence: 0, audio,
      }).state;
      const playing = send(queued, { type: "PlaybackStarted" });
      for (const current of [listening, finalizing, ready, playing]) {
        const result = reduceTurn(current, row.event);
        expect(result.state).toBe(current);
        expect(result.effects).toEqual([]);
      }
    });
  }

  test("rejects future IDs as well as old IDs", () => {
    const state = generating();
    const result = reduceTurn(state, { type: "Error", turnId: "session:2", error: "wrong turn" });
    expect(result.state).toBe(state);
    expect(result.effects).toEqual([]);
  });

  test("rejects metric payloads from another turn or session", () => {
    const state = generating();
    for (const metric of [
      { type: "first-token" as const, turnId: "session:0", sessionId: "session", offsetMs: 10 },
      { type: "first-token" as const, turnId: "session:1", sessionId: "other", offsetMs: 10 },
    ]) {
      expect(reduceTurn(state, { type: "Metric", turnId: "session:1", metric })).toEqual({ state, effects: [] });
    }
  });

  test("cancellation is terminal for queued work and repeated cancellation", () => {
    const cancelled = reduceTurn(speaking(), { type: "Cancel", turnId: "session:1" });
    expect(cancelled.effects).toEqual(cleanup);
    expect(cancelled.state.status).toBe("cancelled");
    expect(reduceTurn(cancelled.state, { type: "AudioFrame", turnId: "session:1", sequence: 1, audio }).effects).toEqual([]);
    expect(reduceTurn(cancelled.state, { type: "Cancel", turnId: "session:1" }).state).toBe(cancelled.state);
  });

  test("current errors fail and clean up once", () => {
    const result = reduceTurn(generating(), { type: "Error", turnId: "session:1", error: "provider unavailable" });
    expect(result.state.status).toBe("failed");
    expect(result.state.failure).toBe("provider unavailable");
    expect(result.effects).toEqual(cleanup);
    expect(reduceTurn(result.state, { type: "Error", turnId: "session:1", error: "late error" })).toEqual({ state: result.state, effects: [] });
  });
});

describe("phrase and audio ordering", () => {
  for (const stream of ["phrase", "audio"] as const) {
    function event(sequence: number): TurnEvent {
      return stream === "phrase"
        ? { type: "PhraseReady", turnId: "session:1", phrase: { ...phrase, sequence } }
        : { type: "AudioFrame", turnId: "session:1", sequence, audio };
    }

    test(`${stream} accepts zero-based contiguous events and ignores duplicate tail sequences`, () => {
      const first = reduceTurn(generating(), event(0));
      expect(first.effects).toHaveLength(1);
      const duplicate = reduceTurn(first.state, event(0));
      expect(duplicate.state).toBe(first.state);
      expect(duplicate.effects).toEqual([]);
      const second = reduceTurn(first.state, event(1));
      expect(second.effects).toHaveLength(1);
      expect(second.state.orderingFailureCount).toBe(0);
      expect(second.state[stream === "phrase" ? "lastPhraseSequence" : "lastAudioSequence"]).toBe(1);
    });

    for (const sequence of [-1, 1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      test(`${stream} fails on invalid initial sequence ${sequence}`, () => {
        const result = reduceTurn(generating(), event(sequence));
        expect(result.state.status).toBe("failed");
        expect(result.state.orderingFailureCount).toBe(1);
        expect(result.state.failure).toBe(`${stream}-ordering`);
        expect(result.effects).toEqual([
          ...cleanup,
          { type: "record-metric", turnId: "session:1", metric: { type: "ordering-failure", turnId: "session:1", sessionId: "session", count: 1 } },
        ]);
        expect(reduceTurn(result.state, event(sequence))).toEqual({ state: result.state, effects: [] });
      });
    }

    test(`${stream} fails a gap without emitting scrambled data`, () => {
      const state = reduceTurn(generating(), event(0)).state;
      const result = reduceTurn(state, event(2));
      expect(result.state.status).toBe("failed");
      expect(result.state.orderingFailureCount).toBe(1);
      expect(result.effects.map((effect) => effect.type)).toEqual(["abort-generation", "clear-queued-text", "stop-playback", "reset-tts", "record-metric"]);
    });

    test(`${stream} fails backwards replay after the sequence has advanced`, () => {
      const first = reduceTurn(generating(), event(0)).state;
      const second = reduceTurn(first, event(1)).state;
      const result = reduceTurn(second, event(0));
      expect(result.state.status).toBe("failed");
      expect(result.state.orderingFailureCount).toBe(1);
      expect(result.effects.map((effect) => effect.type)).toEqual(["abort-generation", "clear-queued-text", "stop-playback", "reset-tts", "record-metric"]);
    });
  }

  test("phrase and audio sequences advance independently and reset for a new turn", () => {
    const firstPhrase = reduceTurn(generating(), { type: "PhraseReady", turnId: "session:1", phrase }).state;
    const secondPhrase = reduceTurn(firstPhrase, { type: "PhraseReady", turnId: "session:1", phrase: { ...phrase, sequence: 1 } }).state;
    const frame = reduceTurn(secondPhrase, { type: "AudioFrame", turnId: "session:1", sequence: 0, audio });
    expect(frame.effects).toHaveLength(1);
    expect(frame.state.lastPhraseSequence).toBe(1);
    expect(frame.state.lastAudioSequence).toBe(0);
    const restarted = send(frame.state, { type: "StartOfTurn" });
    const finalizing = send(restarted, { type: "EndOfTurn" });
    const ready = reduceTurn(finalizing, { type: "TranscriptFrozen", turnId: "session:2", transcript: "Next turn" }).state;
    const next = reduceTurn(ready, { type: "PhraseReady", turnId: "session:2", phrase });
    expect(next.effects).toEqual([{ type: "synthesize-phrase", turnId: "session:2", phrase }]);
  });
});

test("the reducer is deterministic and does not mutate its state or event", () => {
  const state = Object.freeze(generating());
  const event: TurnEvent = Object.freeze({ type: "PhraseReady", turnId: "session:1", phrase: Object.freeze({ ...phrase }) });
  const before = structuredClone(state);
  const first = reduceTurn(state, event);
  const second = reduceTurn(state, event);
  expect(first).toEqual(second);
  expect(state).toEqual(before);
  expect(state.lastPhraseSequence).toBe(-1);
  expect(event.phrase).toEqual({ text: "A response. ", sequence: 0, isFinal: false });
});
