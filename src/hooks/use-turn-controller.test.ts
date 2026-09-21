import { describe, expect, test } from "bun:test";
import type { LiveTurnEvent, LiveTurnRequest } from "../lib/spar/live-turn-service";
import type { DeepgramTtsOptions, DeepgramTtsEvent } from "../lib/providers/deepgram-tts";
import type { PcmPlayerOptions, PcmPlayerEvent, PcmFrame } from "../lib/voice/pcm-player";
import { createTurnController, type LiveTurnController, type TurnControllerDependencies } from "./use-turn-controller";
import { StreamingSpeechSession, type StreamingSpeechDependencies } from "./use-streaming-voice";

function stream(events: LiveTurnEvent[]): TurnControllerDependencies["streamTurn"] {
  return async function* (_request, signal) {
    for (const event of events) {
      if (signal.aborted) return;
      yield event;
    }
  };
}

function event<T extends LiveTurnEvent["type"]>(type: T, value: Omit<Extract<LiveTurnEvent, { type: T }>, "type" | "turnId">, turnId = "room:1") {
  return { type, turnId, ...value } as Extract<LiveTurnEvent, { type: T }>;
}

function harness(events: LiveTurnEvent[]) {
  const effects: string[] = [];
  const spoken: string[] = [];
  const requests: LiveTurnRequest[] = [];
  const dependencies: TurnControllerDependencies = {
    streamTurn: async function* (request, signal) {
      requests.push(request);
      yield* stream(events)(request, signal);
    },
    beginSpeech: async turnId => { effects.push(`begin-speech:${turnId}`); },
    speakPhrase: (turnId, phrase) => { effects.push(`speak:${turnId}`); spoken.push(phrase.text); },
    finishSpeech: turnId => { effects.push(`finish:${turnId}`); },
    cancelGeneration: turnId => { effects.push(`abort:${turnId}`); },
    invalidatePhraseQueue: turnId => { effects.push(`invalidate:${turnId}`); },
    resetPhraseQueue: turnId => { effects.push(`reset:${turnId}`); },
    stopAudio: turnId => { effects.push(`stop-audio:${turnId}`); },
    clearTts: turnId => { effects.push(`clear-tts:${turnId}`); },
    beginListening: turnId => { effects.push(`listen:${turnId}`); },
    recordMetric: async () => {},
    now: () => 20,
    createLifecycleId: () => "",
  };
  return { controller: createTurnController("room", "aura-2-thalia-en", dependencies), effects, spoken, requests };
}

/**
 * Controller wired to a real StreamingSpeechSession with deterministic TTS,
 * player, and browser-speech doubles, so fallback speech must traverse the
 * production speakPhrase/scheduling path instead of a mock.
 */
function realSpeechHarness(events: LiveTurnEvent[]) {
  const scheduled: string[] = [];
  const browser: string[] = [];
  const audio: PcmFrame[] = [];
  let flushes = 0;
  let clientOptions!: DeepgramTtsOptions;
  let playerOptions!: PcmPlayerOptions;
  const dependencies: StreamingSpeechDependencies = {
    createTtsClient: options => {
      clientOptions = options;
      return {
        async beginTurn() {},
        speak(text) { scheduled.push(text); return true; },
        flush() { flushes += 1; return true; },
        clear() {}, close() {},
      };
    },
    createPlayer: options => {
      playerOptions = options;
      return { async start() {}, enqueue(frame) { audio.push(frame); return true; }, stop() {}, reset() {} };
    },
    browserSpeech: { speak(text) { browser.push(text); }, cancel() {} },
    now: () => 1234,
    setTimer: () => ({}), clearTimer: () => {},
  };
  let controller!: LiveTurnController;
  const speech = new StreamingSpeechSession({
    roomId: "room", region: "eu", dependencies,
    onEvent: speechEvent => controller.acceptSpeechEvent(speechEvent),
  });
  controller = createTurnController("room", "aura-2-thalia-en", {
    streamTurn: stream(events),
    beginSpeech: (turnId, model) => speech.begin(turnId, model),
    speakPhrase: (turnId, phrase) => speech.speakPhrase(turnId, phrase),
    finishSpeech: turnId => speech.finish(turnId),
    cancelGeneration: () => {},
    invalidatePhraseQueue: turnId => speech.invalidateText(turnId),
    resetPhraseQueue: turnId => speech.resetText(turnId),
    stopAudio: turnId => speech.stopAudio(turnId),
    clearTts: turnId => speech.clearTts(turnId),
    beginListening: () => {},
    recordMetric: async () => {},
    now: () => 20,
    createLifecycleId: () => "",
  });
  return {
    controller, scheduled, browser, audio,
    flushes: () => flushes,
    ttsEvent: (ttsEvent: DeepgramTtsEvent) => clientOptions.onEvent(ttsEvent),
    playback: (playbackEvent: PcmPlayerEvent) => playerOptions.onEvent(playbackEvent),
  };
}

const persona = { id: "p", name: "The Skeptic", archetype: "skeptic", behaviorStyle: "moderate", seatOrder: 0 };
const normalEvents = [
  event("turn-start", { persona, model: "openai/gpt-oss-20b", maxOutputTokens: 80 }),
  event("text-delta", { text: "Exact answer. " }),
  event("phrase", { phrase: { text: "Exact answer. ", sequence: 0, isFinal: false } }),
  event("complete", { text: "Exact answer. ", messageId: "m1", metadata: { type: "normal", claimRef: null, mood: "neutral" } }),
];

describe("turn controller", () => {
  test("submits only EndOfTurn and yields one visible and audible assistant answer", async () => {
    const h = harness(normalEvents);
    await h.controller.acceptStt({ type: "StartOfTurn", transcript: "", confidence: 0 });
    h.controller.acceptStt({ type: "interim", transcript: "My exact", confidence: 0.8 });
    expect(h.requests).toHaveLength(0);
    await h.controller.acceptStt({ type: "EndOfTurn", transcript: "My exact words.", confidence: 0.94 });

    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]).toMatchObject({ turnId: "room:1", transcript: "My exact words.", confidence: 0.94 });
    expect(h.controller.getSnapshot().messages).toEqual([
      expect.objectContaining({ role: "user", content: "My exact words." }),
      expect.objectContaining({ role: "assistant", content: "Exact answer. ", messageId: "m1" }),
    ]);
    expect(h.controller.getSnapshot().assistantCaption).toBe("Exact answer. ");
    expect(h.spoken).toEqual(["Exact answer. "]);
    expect(h.effects.filter(value => value.startsWith("finish:"))).toHaveLength(1);
  });

  test("primary Done and agitation only annotate the next real Flux EndOfTurn", async () => {
    const h = harness(normalEvents);
    await h.controller.acceptStt({ type: "StartOfTurn", turnIndex: 1, transcript: "" });
    h.controller.queuePrimaryEndOfTurn({ isInterrupt: true, forcedPersonaId: "p" });
    expect(h.requests).toHaveLength(0);
    await h.controller.acceptStt({ type: "interim", turnIndex: 1, transcript: "still talking" });
    expect(h.requests).toHaveLength(0);
    await h.controller.acceptStt({ type: "EndOfTurn", turnIndex: 1, transcript: "actual Flux final", confidence: 0.9 });
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]).toMatchObject({ transcript: "actual Flux final", isInterrupt: true, forcedPersonaId: "p" });
  });

  test("explicit fallback finalization and presentation handoff remain functional", async () => {
    const fallback = harness(normalEvents);
    fallback.controller.setSttFallback(true);
    await fallback.controller.finalizeFallbackTranscript("browser final", 0.7, { drillClean: true });
    expect(fallback.requests[0]).toMatchObject({ transcript: "browser final", confidence: 0.7, drillClean: true });

    const presentation = harness(normalEvents);
    await presentation.controller.submitPresentationTurn("persisted presentation", true);
    expect(presentation.requests[0]).toMatchObject({ transcript: "persisted presentation", presentationHandoff: true });
  });

  test("uses a unique injected lifecycle prefix across controller remounts", async () => {
    let lifecycle = 0;
    const build = () => {
      return createTurnController("room", "aura-2-thalia-en", {
        streamTurn: stream([]), beginSpeech: async () => {}, speakPhrase: () => {}, finishSpeech: () => {},
        cancelGeneration: () => {}, invalidatePhraseQueue: () => {}, resetPhraseQueue: () => {}, stopAudio: () => {}, clearTts: () => {},
        beginListening: () => {}, recordMetric: async () => {}, now: () => 0,
        createLifecycleId: () => `life-${++lifecycle}`,
      });
    };
    const first = build();
    const second = build();
    await first.acceptStt({ type: "StartOfTurn", turnIndex: 0, transcript: "" });
    await second.acceptStt({ type: "StartOfTurn", turnIndex: 0, transcript: "" });
    expect(first.getSnapshot().turn.turnId).not.toBe(second.getSnapshot().turn.turnId);
    expect(first.getSnapshot().turn.turnId.length).toBeLessThanOrEqual(128);
  });

  test("retains completion type, mood, and claim reference on the visible message", async () => {
    const h = harness([
      event("turn-start", { persona, model: "openai/gpt-oss-20b", maxOutputTokens: 80 }),
      event("text-delta", { text: "Hold on. " }),
      event("phrase", { phrase: { text: "Hold on. ", sequence: 0, isFinal: false } }),
      event("complete", { text: "Hold on. ", messageId: "interrupt", metadata: { type: "interruption", claimRef: 3, mood: "pressing" } }),
    ]);
    await h.controller.acceptStt({ type: "StartOfTurn", transcript: "" });
    await h.controller.acceptStt({ type: "EndOfTurn", transcript: "answer", confidence: 1 });
    expect(h.controller.getSnapshot().messages.at(-1)).toMatchObject({
      metadata: { type: "interruption", claimRef: 3, mood: "pressing" },
    });
  });

  test("resets unspoken Groq text on fallback without duplicating captions or speech", async () => {
    const h = harness([
      event("turn-start", { persona, model: "openai/gpt-oss-20b", maxOutputTokens: 80 }),
      event("text-delta", { text: "Discard me" }),
      event("fallback", { from: "groq", to: "openrouter", reason: "network-error", resetText: true }),
      event("text-delta", { text: "Use me. " }),
      event("phrase", { phrase: { text: "Use me. ", sequence: 0, isFinal: false } }),
      event("complete", { text: "Use me. ", messageId: "m2", metadata: { type: "normal", claimRef: null, mood: "neutral" } }),
    ]);
    await h.controller.acceptStt({ type: "StartOfTurn", transcript: "", confidence: 0 });
    await h.controller.acceptStt({ type: "EndOfTurn", transcript: "Question", confidence: 1 });
    expect(h.controller.getSnapshot().assistantCaption).toBe("Use me. ");
    expect(h.spoken).toEqual(["Use me. "]);
    expect(h.controller.getSnapshot().messages.filter(message => message.role === "assistant")).toHaveLength(1);
    // A mid-turn fallback trims the phrase queue; it must not permanently
    // invalidate the turn's speech (that semantic belongs to cleanup only).
    expect(h.effects).toContain("reset:room:1");
    expect(h.effects).not.toContain("invalidate:room:1");
  });

  test("speaks the fallback provider's answer through the real streaming speech session", async () => {
    const h = realSpeechHarness([
      event("turn-start", { persona, model: "openai/gpt-oss-20b", maxOutputTokens: 80 }),
      event("text-delta", { text: "Groq partial" }),
      event("fallback", { from: "groq", to: "openrouter", reason: "network-error", resetText: true }),
      event("text-delta", { text: "Fallback answer. " }),
      event("phrase", { phrase: { text: "Fallback answer. ", sequence: 0, isFinal: false } }),
      event("complete", { text: "Fallback answer. ", messageId: "m3", metadata: { type: "normal", claimRef: null, mood: "neutral" } }),
    ]);
    await h.controller.acceptStt({ type: "StartOfTurn", transcript: "", confidence: 0 });
    await h.controller.acceptStt({ type: "EndOfTurn", transcript: "Question", confidence: 1 });

    // Visible: one captioned assistant message carrying only the fallback text.
    expect(h.controller.getSnapshot().assistantCaption).toBe("Fallback answer. ");
    expect(h.controller.getSnapshot().messages.filter(message => message.role === "assistant")).toEqual([
      expect.objectContaining({ content: "Fallback answer. ", messageId: "m3" }),
    ]);
    // Audible: the restarted phrase stream reaches actual TTS playback
    // scheduling through the real session, not browser fallback or silence.
    expect(h.scheduled).toEqual(["Fallback answer. "]);
    expect(h.flushes()).toBe(1);
    expect(h.browser).toEqual([]);
    h.ttsEvent({ type: "audio", turnId: "room:1", sequence: 0, audio: new Uint8Array([0, 0]) });
    expect(h.audio).toHaveLength(1);
    h.playback({ type: "playback-start", turnId: "room:1", timestampMs: 1, audioTime: 2 });
    expect(h.controller.getSnapshot().turn.status).toBe("speaking");
  });

  test.each(["generation", "playback"])("executes fixed cancellation order for barge-in during %s", async phase => {
    const h = harness(phase === "playback" ? normalEvents : normalEvents.slice(0, 2));
    await h.controller.acceptStt({ type: "StartOfTurn", transcript: "", confidence: 0 });
    await h.controller.acceptStt({ type: "EndOfTurn", transcript: "First", confidence: 1 });
    h.effects.length = 0;
    await h.controller.acceptStt({ type: "StartOfTurn", transcript: "", confidence: 0 });
    expect(h.effects.slice(0, 5)).toEqual([
      "abort:room:1", "invalidate:room:1", "stop-audio:room:1", "clear-tts:room:1", "listen:room:2",
    ]);
  });

  test("repeated StartOfTurn, unmount, network loss, and old-turn completion remain idempotent", async () => {
    const h = harness([]);
    await h.controller.acceptStt({ type: "StartOfTurn", turnIndex: 4, transcript: "", confidence: 0 });
    const beforeRepeat = h.effects.length;
    await h.controller.acceptStt({ type: "StartOfTurn", turnIndex: 4, transcript: "", confidence: 0 });
    expect(h.effects).toHaveLength(beforeRepeat);
    const afterRepeat = h.effects.length;
    h.controller.acceptServerEvent(event("complete", { text: "stale", messageId: "old", metadata: { type: "normal", claimRef: null, mood: "neutral" } }, "room:0"));
    expect(h.controller.getSnapshot().messages).toHaveLength(0);
    h.controller.networkLost("offline");
    expect(h.controller.getSnapshot().error).toBe("offline");
    h.controller.setSttFallback(true);
    h.controller.acceptSpeechEvent({ type: "fallback", turnId: "room:1", reason: "tts-unavailable", timestampMs: 20 });
    expect(h.controller.getSnapshot()).toMatchObject({ usingSttFallback: true, usingTtsFallback: true });
    h.controller.dispose();
    h.controller.dispose();
    expect(h.effects.length).toBeGreaterThan(afterRepeat);
  });
});
