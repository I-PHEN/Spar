import { describe, expect, test } from "bun:test";
import type { LiveTurnEvent, LiveTurnRequest } from "../lib/spar/live-turn-service";
import type { TurnMetricEvent } from "../lib/observability/turn-metrics";
import type { DeepgramTtsOptions, DeepgramTtsEvent } from "../lib/providers/deepgram-tts";
import type { PcmPlayerOptions, PcmPlayerEvent, PcmFrame } from "../lib/voice/pcm-player";
import {
  createTurnController,
  createTurnControllerHook,
  type LiveTurnController,
  type TurnControllerDependencies,
  type TurnControllerHookRuntime,
} from "./use-turn-controller";
import {
  createStreamingVoiceHook,
  StreamingSpeechSession,
  type StreamingSpeechDependencies,
} from "./use-streaming-voice";
import type { LiveVoiceHook, LiveVoiceStatus, UseLiveVoiceOptions } from "./use-live-voice";
import type { UseVoiceRecognitionResult } from "./use-voice";

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
    roomId: "room", dependencies,
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

  test("never splits a surrogate pair when trimming the session id prefix", async () => {
    // 82 code units of emoji: the 80-unit cut lands inside the last pair.
    const controller = createTurnController("😀".repeat(41), "aura-2-thalia-en", {
      streamTurn: stream([]), beginSpeech: async () => {}, speakPhrase: () => {}, finishSpeech: () => {},
      cancelGeneration: () => {}, invalidatePhraseQueue: () => {}, resetPhraseQueue: () => {}, stopAudio: () => {}, clearTts: () => {},
      beginListening: () => {}, recordMetric: async () => {}, now: () => 0,
      createLifecycleId: () => "life",
    });
    const turnId = controller.getSnapshot().turn.turnId;
    expect(turnId.isWellFormed()).toBe(true);
    expect(turnId.length).toBeLessThanOrEqual(128);
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

describe("turn controller live engine wiring", () => {
  function liveHarness() {
    const metrics: TurnMetricEvent[] = [];
    const effects: string[] = [];
    const dependencies: TurnControllerDependencies = {
      streamTurn: stream([]), beginSpeech: async () => {}, speakPhrase: () => {}, finishSpeech: () => {},
      cancelGeneration: () => {}, invalidatePhraseQueue: () => {}, resetPhraseQueue: () => {}, stopAudio: () => {}, clearTts: () => {},
      beginListening: turnId => { effects.push(`listen:${turnId}`); },
      recordMetric: async metric => { metrics.push(metric); },
      now: () => 20,
      createLifecycleId: () => "",
    };
    return { controller: createTurnController("room", "aura-2-thalia-en", dependencies), metrics, effects };
  }

  test("registerLiveTurn allocates a fresh machine turnId per AI utterance", () => {
    const h = liveHarness();
    const first = h.controller.registerLiveTurn();
    const second = h.controller.registerLiveTurn();
    expect(first).toMatch(/^room:\d+$/);
    expect(second).toMatch(/^room:\d+$/);
    expect(second).not.toBe(first);
  });

  test("a turn-complete-finalized live turn is not recorded as cancelled when the next turn registers", async () => {
    const h = liveHarness();
    const first = h.controller.registerLiveTurn();
    h.controller.completeLiveTurn(first);
    h.controller.registerLiveTurn();
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(h.metrics.filter(metric => metric.type === "cancelled")).toHaveLength(0);
  });

  test("a live-turn cancellation (barge-in) records exactly one cancelled metric and stays idempotent", async () => {
    const h = liveHarness();
    const turnId = h.controller.registerLiveTurn();
    h.controller.cancelLiveTurn(turnId);
    h.controller.cancelLiveTurn(turnId);
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    const cancelled = h.metrics.filter(metric => metric.type === "cancelled");
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0]).toMatchObject({ turnId, sessionId: "room" });
  });

  test("live captions honor turn identity and live-engine metrics carry the machine identity with integer milliseconds", async () => {
    const h = liveHarness();
    const stale = h.controller.registerLiveTurn();
    const turnId = h.controller.registerLiveTurn();
    h.controller.acceptLiveAssistantCaption(stale, "stale text");
    expect(h.controller.getSnapshot().assistantCaption).toBe("");
    h.controller.acceptLiveAssistantCaption(turnId, "live answer");
    expect(h.controller.getSnapshot().assistantCaption).toBe("live answer");

    h.controller.recordLiveEngineEvent({ voiceEngine: "gemini-live", firstLiveAudioMs: 812.6 });
    h.controller.recordLiveEngineEvent({ voiceEngine: "cascade" });
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(h.metrics.filter(metric => metric.type === "live-engine")).toEqual([
      // The queueMetric boundary enforces the int-strict firstLiveAudioMs contract.
      { type: "live-engine", turnId, sessionId: "room", voiceEngine: "gemini-live", firstLiveAudioMs: 813 },
      { type: "live-engine", turnId, sessionId: "room", voiceEngine: "cascade" },
    ]);
  });

  test("live user transcripts publish interim previews and one finalized user message per turn", () => {
    const h = liveHarness();
    const turnId = h.controller.registerLiveTurn();
    h.controller.acceptLiveUserInterim("hello wor");
    expect(h.controller.getSnapshot().transcriptPreview).toBe("hello wor");
    h.controller.acceptLiveUserFinal("hello world");
    h.controller.acceptLiveUserFinal("hello world");
    expect(h.controller.getSnapshot().messages).toEqual([
      { id: `user:${turnId}`, turnId, role: "user", content: "hello world" },
    ]);
    expect(h.controller.getSnapshot().transcriptPreview).toBe("hello world");
  });
});

type HookCleanup = void | (() => void);

/**
 * Minimal deterministic host for the composed turn-controller hook; effects
 * flush after render like a commit. Simple identity semantics suffice because
 * the hosted hook receives stable options across renders.
 */
function turnControllerHookHost() {
  const state: unknown[] = [];
  const cleanups: Array<HookCleanup> = [];
  let cursor = 0;
  let pendingEffects: Array<() => void> = [];
  const runtime = {
    useState<T>(initial?: T | (() => T)) {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === "function" ? (initial as () => T)() : initial;
      const setValue = (update: T | ((previous: T) => T)) => {
        const previous = state[index] as T;
        state[index] = typeof update === "function" ? (update as (value: T) => T)(previous) : update;
      };
      return [state[index] as T, setValue] as const;
    },
    useRef<T>(initial: T) {
      const index = cursor++;
      if (!(index in state)) state[index] = { current: initial };
      return state[index] as { current: T };
    },
    useCallback<T>(callback: T) {
      const index = cursor++;
      if (!(index in state)) state[index] = callback;
      return state[index] as T;
    },
    useEffect(effect: () => HookCleanup) {
      const index = cursor++;
      if (!(index in state)) {
        state[index] = true;
        pendingEffects.push(() => { cleanups[index] = effect(); });
      }
    },
  } as unknown as TurnControllerHookRuntime;
  return {
    runtime,
    render<T>(renderHook: () => T): T {
      cursor = 0;
      pendingEffects = [];
      const result = renderHook();
      for (const flush of pendingEffects) flush();
      return result;
    },
    unmount(): void {
      for (const cleanup of cleanups) cleanup?.();
    },
  };
}

describe("turn controller voice metric wiring", () => {
  test("a streaming-voice fallback metric is persisted to /api/turn-metrics", async () => {
    const host = turnControllerHookHost();
    const fallbackVoice: UseVoiceRecognitionResult = {
      isSupported: true, isListening: false, interimTranscript: "", finalTranscript: "",
      error: null, start() {}, stop() {}, reset() {},
    };
    const useTurnControllerForTest = createTurnControllerHook(
      host.runtime,
      createStreamingVoiceHook(host.runtime, () => fallbackVoice),
    );
    const postedMetrics: unknown[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/api/turn-metrics")) {
        postedMetrics.push(typeof init?.body === "string" ? JSON.parse(init.body) : null);
        return Response.json({ ok: true });
      }
      return new Response("unreachable in this test", { status: 404 });
    }) as typeof fetch;

    try {
      const options = {
        sessionId: "metric-room",
        voiceModel: "aura-2-zeus-en",
        voiceDependencies: {
          createSttClient: () => ({ connect: () => Promise.reject(new Error("socket offline with private detail")), sendAudio: () => false, close() {} }),
          createMicrophoneStream: () => ({ start: () => Promise.resolve(), stop() {} }),
          setTimer: () => ({}),
          clearTimer: () => {},
        },
      };
      const result = host.render(() => useTurnControllerForTest(options));

      // The failed Flux startup both switches to Web Speech and emits the
      // room-scoped fallback metric through the voice session's onMetric.
      result.startListening();
      for (let index = 0; index < 10; index += 1) await Promise.resolve();
      const updated = host.render(() => useTurnControllerForTest(options));

      expect(updated.usingSttFallback).toBe(true);
      const bodies = postedMetrics.splice(0);
      expect(bodies).toEqual([
        expect.objectContaining({
          type: "fallback",
          sessionId: "metric-room",
          reason: "socket-error",
          turnId: expect.stringMatching(/^metric-room:/),
        }),
      ]);

      host.unmount();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("turn controller composed live engine", () => {
  /** Hook-free live double: records calls, captures wiring options, drives status. */
  function liveHookDouble() {
    const calls = { starts: 0, stops: 0 };
    const state: { status: LiveVoiceStatus } = { status: "connecting" };
    let wired: UseLiveVoiceOptions | null = null;
    const hook: LiveVoiceHook = options => {
      wired = options;
      return {
        get status() { return state.status; },
        start() { calls.starts += 1; return Promise.resolve(); },
        stop() { calls.stops += 1; },
      };
    };
    return { hook, calls, state, wired: () => wired };
  }

  test("engine selection, live passthrough, cascade handoff, composed stop, and status mapping", async () => {
    const host = turnControllerHookHost();
    const fallbackVoice: UseVoiceRecognitionResult = {
      isSupported: true, isListening: false, interimTranscript: "", finalTranscript: "",
      error: null, start() {}, stop() {}, reset() {},
    };
    const live = liveHookDouble();
    let micStarts = 0;
    let micStops = 0;
    const useTurnControllerForTest = createTurnControllerHook(
      host.runtime,
      createStreamingVoiceHook(host.runtime, () => fallbackVoice),
      live.hook,
    );
    const postedMetrics: unknown[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/api/turn-metrics")) {
        postedMetrics.push(typeof init?.body === "string" ? JSON.parse(init.body) : null);
        return Response.json({ ok: true });
      }
      return new Response("unreachable in this test", { status: 404 });
    }) as typeof fetch;

    try {
      const options = {
        sessionId: "compose-room",
        voiceModel: "aura-2-zeus-en",
        voiceDependencies: {
          createSttClient: () => ({ connect: () => Promise.resolve(), sendAudio: () => false, close() {} }),
          createMicrophoneStream: () => ({
            start: () => { micStarts += 1; return Promise.resolve(); },
            stop: () => { micStops += 1; },
          }),
          setTimer: () => ({}),
          clearTimer: () => {},
        },
        live: {
          mode: "open_spar" as const,
          persona: { archetype: "skeptic" as const, behaviorStyle: "moderate" as const },
          scenarioLabel: "Seed round defense",
          claims: [{ id: 1, label: "CAC", claim: "Blended CAC is $40." }],
          otherPanelists: [{ name: "The Nitpicker", archetype: "nitpicker" as const }],
        },
      };
      const result = host.render(() => useTurnControllerForTest(options));
      const liveWiring = live.wired();
      expect(liveWiring).not.toBeNull();
      expect(result.liveEngineStatus).toBe("connecting");

      // Engine selection: startListening starts Live, never the cascade mic.
      result.startListening();
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      expect(live.calls.starts).toBe(1);
      expect(micStarts).toBe(0);

      // Live passthrough: interim caption, machine turn registration, int metric.
      liveWiring?.onUserInterim?.("live interim");
      expect(host.render(() => useTurnControllerForTest(options)).transcriptPreview).toBe("live interim");
      const turnId = liveWiring?.onRegisterTurn?.() ?? "";
      // The composed hook mints the real lifecycle-id turn prefix.
      expect(turnId).toMatch(/^compose-room:.+:\d+$/);
      liveWiring?.onMetric?.({ voiceEngine: "gemini-live", firstLiveAudioMs: 812.6 });
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      expect(postedMetrics).toEqual([
        expect.objectContaining({
          type: "live-engine", turnId, sessionId: "compose-room",
          voiceEngine: "gemini-live", firstLiveAudioMs: 813,
        }),
      ]);

      // Rung-2 handoff: Live's onFallback starts the cascade, which takes the room.
      liveWiring?.onFallback?.();
      for (let index = 0; index < 10; index += 1) await Promise.resolve();
      expect(micStarts).toBe(1);
      let updated = host.render(() => useTurnControllerForTest(options));
      expect(updated.isListening).toBe(true);

      // liveEngineStatus maps the live hook's status through the composition.
      live.state.status = "fallback";
      updated = host.render(() => useTurnControllerForTest(options));
      expect(updated.liveEngineStatus).toBe("fallback");

      // Composed stop releases BOTH engines.
      updated.stop();
      expect(live.calls.stops).toBe(1);
      expect(micStops).toBe(1);
      updated = host.render(() => useTurnControllerForTest(options));
      expect(updated.isListening).toBe(false);

      host.unmount();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
