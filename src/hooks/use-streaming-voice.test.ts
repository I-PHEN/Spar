import { describe, expect, test } from "bun:test";
import type {
  DeepgramSttEvent,
  DeepgramSttOptions,
} from "../lib/providers/deepgram-stt";
import type {
  MicrophoneChunk,
  MicrophoneStreamOptions,
} from "../lib/voice/microphone-stream";
import {
  createStreamingVoiceHook,
  isStreamingVoiceSupported,
  StreamingVoiceSession,
  type StreamingVoiceDependencies,
  type StreamingVoiceHookRuntime,
} from "./use-streaming-voice";
import type { UseVoiceRecognitionResult } from "./use-voice";

class FakeStt {
  readonly sent: MicrophoneChunk[] = [];
  closeCount = 0;
  connectError?: Error;

  constructor(readonly options: DeepgramSttOptions) {}

  async connect(): Promise<void> {
    if (this.connectError) throw this.connectError;
  }

  sendAudio(chunk: MicrophoneChunk): boolean {
    this.sent.push(chunk);
    return true;
  }

  close(): void {
    this.closeCount += 1;
  }

  emit(event: DeepgramSttEvent): void {
    this.options.onEvent(event);
  }
}

class FakeMicrophone {
  startCount = 0;
  stopCount = 0;
  startError?: Error;

  constructor(readonly options: MicrophoneStreamOptions) {}

  async start(): Promise<void> {
    this.startCount += 1;
    if (this.startError) throw this.startError;
  }

  stop(): void {
    this.stopCount += 1;
  }

  emit(chunk: MicrophoneChunk): void {
    this.options.onChunk(chunk);
  }

  fail(message: string): void {
    this.options.onError?.(new Error(message));
  }
}

function harness(overrides: Partial<StreamingVoiceDependencies> = {}) {
  const sttClients: FakeStt[] = [];
  const microphones: FakeMicrophone[] = [];
  const scheduled = new Map<object, { callback: () => void; delayMs: number }>();
  const dependencies: StreamingVoiceDependencies = {
    createSttClient: (options) => {
      const client = new FakeStt(options);
      sttClients.push(client);
      return client;
    },
    createMicrophoneStream: (options) => {
      const microphone = new FakeMicrophone(options);
      microphones.push(microphone);
      return microphone;
    },
    now: () => 1_250,
    random: () => 0.5,
    setTimer: (callback, delayMs) => {
      const id = {};
      scheduled.set(id, { callback, delayMs });
      return id;
    },
    clearTimer: (id) => scheduled.delete(id as object),
    ...overrides,
  };
  const starts: number[] = [];
  const interim: string[] = [];
  const finalized: Array<{ turnIndex: number; transcript: string; confidence: number }> = [];
  const fallbacks: string[] = [];
  const recoveries: number[] = [];
  const listening: boolean[] = [];
  const metrics: Array<{ type: "fallback"; roomId: string; reason: string; timestampMs: number }> = [];
  const session = new StreamingVoiceSession({
    roomId: "room-7",
    region: "eu",
    onStartOfTurn: (event) => starts.push(event.turnIndex),
    onInterimTranscript: (event) => interim.push(event.transcript),
    onEndOfTurn: (event) => finalized.push(event),
    onFallback: (reason) => fallbacks.push(reason),
    onPrimaryReady: () => recoveries.push(recoveries.length),
    onListeningChange: (value) => listening.push(value),
    onMetric: (metric) => metrics.push(metric),
    dependencies,
  });
  return {
    session,
    sttClients,
    microphones,
    scheduled,
    starts,
    interim,
    finalized,
    fallbacks,
    recoveries,
    listening,
    metrics,
  };
}

async function fireNextTimer(
  scheduled: Map<object, { callback: () => void; delayMs: number }>,
): Promise<number> {
  const next = scheduled.entries().next().value as
    | [object, { callback: () => void; delayMs: number }]
    | undefined;
  if (!next) throw new Error("No scheduled timer");
  scheduled.delete(next[0]);
  next[1].callback();
  await Promise.resolve();
  await Promise.resolve();
  return next[1].delayMs;
}

type HookCleanup = void | (() => void);
type HookSlot =
  | { kind: "state"; value: unknown }
  | { kind: "ref"; value: { current: unknown } }
  | { kind: "callback"; value: unknown; dependencies: readonly unknown[] }
  | { kind: "effect"; cleanup: HookCleanup; dependencies?: readonly unknown[] };

function sameDependencies(
  left: readonly unknown[] | undefined,
  right: readonly unknown[] | undefined,
): boolean {
  return !!left && !!right && left.length === right.length
    && left.every((value, index) => Object.is(value, right[index]));
}

/** Minimal deterministic hook host; effects flush after render like a commit. */
function hookHost() {
  const slots: HookSlot[] = [];
  let cursor = 0;
  let pendingEffects: Array<() => void> = [];
  const runtime = {
    useState<T>(initial?: T | (() => T)) {
      const index = cursor++;
      if (!slots[index]) {
        slots[index] = {
          kind: "state",
          value: typeof initial === "function" ? (initial as () => T)() : initial,
        };
      }
      const slot = slots[index];
      if (slot.kind !== "state") throw new Error("Hook order changed");
      const setValue = (update: T | ((previous: T) => T)) => {
        const previous = slot.value as T;
        slot.value = typeof update === "function"
          ? (update as (value: T) => T)(previous)
          : update;
      };
      return [slot.value as T, setValue] as const;
    },
    useRef<T>(initial: T) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { kind: "ref", value: { current: initial } };
      const slot = slots[index];
      if (slot.kind !== "ref") throw new Error("Hook order changed");
      return slot.value as { current: T };
    },
    useCallback<T>(callback: T, dependencies: readonly unknown[]) {
      const index = cursor++;
      const existing = slots[index];
      if (!existing || existing.kind !== "callback" || !sameDependencies(existing.dependencies, dependencies)) {
        slots[index] = { kind: "callback", value: callback, dependencies };
      }
      const slot = slots[index];
      if (slot.kind !== "callback") throw new Error("Hook order changed");
      return slot.value as T;
    },
    useEffect(effect: () => HookCleanup, dependencies?: readonly unknown[]) {
      const index = cursor++;
      const existing = slots[index];
      const shouldRun = !existing
        || !dependencies
        || (existing.kind === "effect" && !sameDependencies(existing.dependencies, dependencies));
      if (!existing) {
        slots[index] = { kind: "effect", cleanup: undefined, dependencies };
      } else if (existing.kind !== "effect") {
        throw new Error("Hook order changed");
      }
      const slot = slots[index];
      if (slot.kind !== "effect") throw new Error("Hook order changed");
      if (!shouldRun) return;
      pendingEffects.push(() => {
        slot.cleanup?.();
        slot.cleanup = effect();
        slot.dependencies = dependencies;
      });
    },
  } as unknown as StreamingVoiceHookRuntime;

  return {
    runtime,
    render<T>(renderHook: () => T): T {
      cursor = 0;
      pendingEffects = [];
      const result = renderHook();
      for (const effect of pendingEffects) effect();
      return result;
    },
    unmount(): void {
      for (const slot of slots) {
        if (slot.kind === "effect") slot.cleanup?.();
      }
    },
  };
}

async function flushHookStartup(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("streaming voice room lifecycle", () => {
  test("shares one persistent Flux connection and routes turn semantics without submitting interim text", async () => {
    const h = harness();

    const first = h.session.start();
    const second = h.session.start();
    expect(first).toBe(second);
    await first;

    expect(h.sttClients).toHaveLength(1);
    expect(h.microphones).toHaveLength(1);
    h.microphones[0].emit({ sequence: 0, audio: new Uint8Array([1, 0]) });
    expect(h.sttClients[0].sent).toEqual([
      { sequence: 0, audio: new Uint8Array([1, 0]) },
    ]);

    h.sttClients[0].emit({
      type: "StartOfTurn",
      turnIndex: 4,
      transcript: "",
    });
    h.sttClients[0].emit({
      type: "interim",
      turnIndex: 4,
      transcript: "display only",
    });
    expect(h.finalized).toEqual([]);
    h.sttClients[0].emit({
      type: "EndOfTurn",
      turnIndex: 4,
      transcript: "submit once",
      confidence: 0.91,
    });

    expect(h.starts).toEqual([4]);
    expect(h.interim).toEqual(["display only"]);
    expect(h.finalized).toEqual([
      { turnIndex: 4, transcript: "submit once", confidence: 0.91 },
    ]);
    expect(h.listening).toEqual([true]);
  });

  test("activates Web Speech fallback and records one metric when startup fails", async () => {
    const h = harness({
      createSttClient: (options) => {
        const client = new FakeStt(options);
        client.connectError = new Error("temporary grant failed with private detail");
        h.sttClients.push(client);
        return client;
      },
    });

    await h.session.start();

    expect(h.fallbacks).toEqual(["socket-error"]);
    expect(h.metrics).toEqual([
      {
        type: "fallback",
        roomId: "room-7",
        reason: "socket-error",
        timestampMs: 1_250,
      },
    ]);
    expect(h.scheduled.size).toBe(1);
  });

  test("falls back on microphone failure and closes the unusable Flux connection", async () => {
    const h = harness({
      createMicrophoneStream: (options) => {
        const microphone = new FakeMicrophone(options);
        microphone.startError = new Error("permission denied");
        h.microphones.push(microphone);
        return microphone;
      },
    });

    await h.session.start();

    expect(h.fallbacks).toEqual(["microphone"]);
    expect(h.metrics[0]?.reason).toBe("microphone");
    expect(h.sttClients[0].closeCount).toBe(1);
    expect(h.microphones[0].stopCount).toBe(1);
  });

  test("classifies a synchronous microphone factory failure as microphone fallback", async () => {
    const h = harness({
      createMicrophoneStream: () => {
        throw new Error("AudioContext construction failed");
      },
    });

    await h.session.start();

    expect(h.fallbacks).toEqual(["microphone"]);
    expect(h.metrics[0]?.reason).toBe("microphone");
    expect(h.sttClients[0].closeCount).toBe(1);
  });

  test("records microphone fallback when an active capture fails at runtime", async () => {
    const h = harness();
    await h.session.start();

    h.microphones[0].fail("Microphone track ended");

    expect(h.fallbacks).toEqual(["microphone"]);
    expect(h.metrics[0]?.reason).toBe("microphone");
    expect(h.sttClients[0].closeCount).toBe(1);
    expect(h.microphones[0].stopCount).toBe(1);
    expect(h.scheduled.size).toBe(1);
  });

  test("reconnects with exponential jitter capped at five seconds and recovers primary speech", async () => {
    let rejectReconnects = true;
    const randomValues = [1, 1, 1, 1, 0.2, 0.8, 0.2, 0.8, 0.4];
    let randomIndex = 0;
    const h = harness({
      random: () => randomValues[randomIndex++],
      createSttClient: (options) => {
        const client = new FakeStt(options);
        if (h.sttClients.length > 0 && rejectReconnects) {
          client.connectError = new Error("offline");
        }
        h.sttClients.push(client);
        return client;
      },
    });
    await h.session.start();

    h.sttClients[0].emit({ type: "close", code: 1011, intentional: false });
    const delays: number[] = [];
    for (let attempt = 0; attempt < 8; attempt += 1) {
      delays.push(await fireNextTimer(h.scheduled));
    }
    expect(delays).toEqual([250, 500, 1_000, 2_000, 2_400, 4_500, 3_000, 4_500]);

    rejectReconnects = false;
    expect(await fireNextTimer(h.scheduled)).toBe(3_500);
    expect(h.sttClients).toHaveLength(10);
    expect(h.recoveries).toHaveLength(1);
  });

  test("explicit stop clears a pending retry and prevents every late reconnect", async () => {
    const h = harness();
    await h.session.start();
    h.sttClients[0].emit({ type: "error", reason: "socket-error" });
    expect(h.scheduled.size).toBe(1);

    const lateRetry = [...h.scheduled.values()][0].callback;
    h.session.stop();
    lateRetry();
    await Promise.resolve();

    expect(h.scheduled.size).toBe(0);
    expect(h.sttClients).toHaveLength(1);
    expect(h.microphones[0].stopCount).toBe(1);
    expect(h.listening.at(-1)).toBe(false);
  });

  test("dispose makes unmount terminal even if an in-flight retry callback runs", async () => {
    const h = harness();
    await h.session.start();
    h.sttClients[0].emit({ type: "close", code: 1006, intentional: false });
    const lateRetry = [...h.scheduled.values()][0].callback;

    h.session.dispose();
    lateRetry();
    await Promise.resolve();

    expect(h.sttClients).toHaveLength(1);
    await expect(h.session.start()).rejects.toThrow("disposed");
  });
});

describe("useStreamingVoice hook lifecycle", () => {
  test("mounts one room session, replaces it on room change, and disposes it on unmount", async () => {
    const host = hookHost();
    const clients: FakeStt[] = [];
    const microphones: FakeMicrophone[] = [];
    let fallbackStops = 0;
    const fallback: UseVoiceRecognitionResult = {
      isSupported: true,
      isListening: false,
      interimTranscript: "",
      finalTranscript: "",
      error: null,
      start: () => {},
      stop: () => { fallbackStops += 1; },
      reset: () => {},
    };
    const dependencies: StreamingVoiceDependencies = {
      createSttClient: (options) => {
        const client = new FakeStt(options);
        clients.push(client);
        return client;
      },
      createMicrophoneStream: (options) => {
        const microphone = new FakeMicrophone(options);
        microphones.push(microphone);
        return microphone;
      },
    };
    const useHook = createStreamingVoiceHook(host.runtime, () => fallback);
    let roomId = "room-a";
    let result = host.render(() => useHook({ roomId, region: "us", dependencies }));

    result.start();
    await flushHookStartup();
    result = host.render(() => useHook({ roomId, region: "us", dependencies }));
    result.start();
    await flushHookStartup();
    expect(clients).toHaveLength(1);
    expect(microphones).toHaveLength(1);

    roomId = "room-b";
    result = host.render(() => useHook({ roomId, region: "us", dependencies }));
    expect(clients[0].closeCount).toBe(1);
    expect(microphones[0].stopCount).toBe(1);
    result.start();
    await flushHookStartup();
    expect(clients).toHaveLength(2);

    host.unmount();
    expect(clients[1].closeCount).toBe(1);
    expect(microphones[1].stopCount).toBe(1);
    expect(fallbackStops).toBe(2);
  });

  test("starts and stops the existing Web Speech hook when primary startup falls back", async () => {
    const host = hookHost();
    const timers = new Map<object, () => void>();
    let fallbackStarts = 0;
    let fallbackStops = 0;
    const fallback: UseVoiceRecognitionResult = {
      isSupported: true,
      isListening: true,
      interimTranscript: "browser interim",
      finalTranscript: "browser final",
      error: null,
      start: () => { fallbackStarts += 1; },
      stop: () => { fallbackStops += 1; },
      reset: () => {},
    };
    const metrics: string[] = [];
    const dependencies: StreamingVoiceDependencies = {
      createSttClient: (options) => {
        const client = new FakeStt(options);
        client.connectError = new Error("offline");
        return client;
      },
      createMicrophoneStream: (options) => new FakeMicrophone(options),
      now: () => 10,
      setTimer: (callback) => {
        const id = {};
        timers.set(id, callback);
        return id;
      },
      clearTimer: (id) => timers.delete(id as object),
    };
    const useHook = createStreamingVoiceHook(host.runtime, () => fallback);
    const options = {
      roomId: "fallback-room",
      region: "eu" as const,
      dependencies,
      onMetric: (metric: { reason: string }) => metrics.push(metric.reason),
    };
    let result = host.render(() => useHook(options));

    result.start();
    await flushHookStartup();
    result = host.render(() => useHook(options));

    expect(fallbackStarts).toBe(1);
    expect(result.usingFallback).toBe(true);
    expect(result.interimTranscript).toBe("browser interim");
    expect(result.finalTranscript).toBe("browser final");
    expect(metrics).toEqual(["socket-error"]);

    host.unmount();
    expect(fallbackStops).toBe(1);
    expect(timers.size).toBe(0);
  });

  test("clears room fallback state before a healthy replacement room listens", async () => {
    const host = hookHost();
    const clients: FakeStt[] = [];
    let fallbackStops = 0;
    let fallbackResets = 0;
    const fallback: UseVoiceRecognitionResult = {
      isSupported: true,
      isListening: true,
      interimTranscript: "room A interim",
      finalTranscript: "room A final",
      error: null,
      start: () => {},
      stop: () => { fallbackStops += 1; },
      reset: () => { fallbackResets += 1; },
    };
    const dependencies: StreamingVoiceDependencies = {
      createSttClient: (options) => {
        const client = new FakeStt(options);
        if (clients.length === 0) client.connectError = new Error("room A offline");
        clients.push(client);
        return client;
      },
      createMicrophoneStream: (options) => new FakeMicrophone(options),
      setTimer: () => ({}),
      clearTimer: () => {},
    };
    const useHook = createStreamingVoiceHook(host.runtime, () => fallback);
    let roomId = "room-a";
    let result = host.render(() => useHook({ roomId, region: "us", dependencies }));

    result.start();
    await flushHookStartup();
    result = host.render(() => useHook({ roomId, region: "us", dependencies }));
    expect(result.usingFallback).toBe(true);
    expect(result.finalTranscript).toBe("room A final");

    roomId = "room-b";
    host.render(() => useHook({ roomId, region: "us", dependencies }));
    result = host.render(() => useHook({ roomId, region: "us", dependencies }));
    result.start();
    await flushHookStartup();
    result = host.render(() => useHook({ roomId, region: "us", dependencies }));

    expect(result.usingFallback).toBe(false);
    expect(result.isListening).toBe(true);
    expect(result.interimTranscript).toBe("");
    expect(result.finalTranscript).toBe("");
    expect(fallbackStops).toBeGreaterThanOrEqual(1);
    expect(fallbackResets).toBeGreaterThanOrEqual(1);

    clients[1].emit({
      type: "EndOfTurn",
      turnIndex: 0,
      transcript: "room B final",
      confidence: 0.95,
    });
    clients[0].emit({
      type: "EndOfTurn",
      turnIndex: 0,
      transcript: "late room A",
      confidence: 0.2,
    });
    result = host.render(() => useHook({ roomId, region: "us", dependencies }));
    expect(result.finalTranscript).toBe("room B final");
  });

  test("reports support only when a complete primary path or Web Speech is available", () => {
    expect(isStreamingVoiceSupported(
      { webSocket: true, mediaDevices: false, audioContext: true },
      false,
    )).toBe(false);
    expect(isStreamingVoiceSupported(
      { webSocket: true, mediaDevices: true, audioContext: true },
      false,
    )).toBe(true);
    expect(isStreamingVoiceSupported(
      { webSocket: false, mediaDevices: false, audioContext: false },
      true,
    )).toBe(true);
  });
});
