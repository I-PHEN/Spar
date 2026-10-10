import { describe, expect, test } from "bun:test";
import type { GeminiLiveSocket } from "../lib/providers/gemini-live";
import type { PcmFrame, PcmPlayerOptions } from "../lib/voice/pcm-player";
import type { MicrophoneChunk, MicrophoneStreamOptions } from "../lib/voice/microphone-stream";
import {
  createLiveVoiceHook,
  FALLBACK_VOICE,
  LIVE_VOICES,
  type LiveVoiceDependencies,
  type LiveVoiceHookRuntime,
  type LiveVoiceStatus,
  type UseLiveVoiceOptions,
} from "./use-live-voice";

class Socket implements GeminiLiveSocket {
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];
  closed = 0;
  send(data: string): void { this.sent.push(data); }
  close(): void { if (this.readyState === 3) return; this.closed += 1; this.readyState = 3; }
  open(): void { this.readyState = 1; this.onopen?.(); }
  message(data: unknown): void { this.onmessage?.({ data }); }
  frame(value: unknown): void { this.message(JSON.stringify(value)); }
  serverClose(): void { this.readyState = 3; this.onclose?.(); }
  networkFail(): void { this.readyState = 3; this.onerror?.(); this.onclose?.(); }
}

// Deterministic hex round-trip stands in for base64 so every frame is readable.
function encodeHex(bytes: Uint8Array): string {
  return `hex:${Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("")}`;
}
function decodeHex(data: string): Uint8Array {
  const hex = data.slice(4);
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

type HookCleanup = void | (() => void);

/** Minimal deterministic hook host, modeled on use-turn-controller.test.ts. */
function liveHookHost() {
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
  } as unknown as LiveVoiceHookRuntime;
  return {
    runtime,
    render<T>(renderHook: () => T): T {
      cursor = 0;
      pendingEffects = [];
      const result = renderHook();
      for (const flush of pendingEffects) flush();
      return result;
    },
    unmount(): void { for (const cleanup of cleanups) cleanup?.(); },
  };
}

function tokenResponse(status: number): Response {
  const body = status === 200 ? { token: "auth_tokens/fixture-live-token", expiresIn: 1800 } : { error: "gemini-unconfigured" };
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function harness(tokenStatus = 200) {
  const host = liveHookHost();
  const useLiveVoiceForTest = createLiveVoiceHook(host.runtime);
  const sockets: Socket[] = [];
  const player = { started: [] as string[], enqueued: [] as PcmFrame[], stops: 0, resets: 0 };
  const metrics: Array<{ voiceEngine: string; firstLiveAudioMs?: number; interruptions?: number }> = [];
  const statuses: LiveVoiceStatus[] = [];
  const interim: string[] = [];
  const userFinal: string[] = [];
  const captions: Array<{ turnId: string; text: string }> = [];
  const registered: string[] = [];
  const cancelled: string[] = [];
  const completed: string[] = [];
  const fallbacks: number[] = [];
  let micOnChunk: ((chunk: MicrophoneChunk) => void) | null = null;
  let micStops = 0;
  let clock = 0;
  let turnCounter = 0;
  const dependencies: LiveVoiceDependencies = {
    fetch: async () => tokenResponse(tokenStatus),
    webSocket: () => { const socket = new Socket(); sockets.push(socket); return socket; },
    createMicrophoneStream: (options: MicrophoneStreamOptions) => {
      micOnChunk = options.onChunk;
      return { start: async () => {}, stop: () => { micStops += 1; } };
    },
    createPlayer: (_options: PcmPlayerOptions) => ({
      async start(turnId: string) { player.started.push(turnId); },
      enqueue(frame: PcmFrame) { player.enqueued.push(frame); return true; },
      stop() { player.stops += 1; },
      reset() { player.resets += 1; },
    }),
    encodeBase64: encodeHex,
    decodeBase64: decodeHex,
    now: () => clock,
    backoffMs: () => 0,
  };
  const options: UseLiveVoiceOptions = {
    sessionId: "room",
    mode: "open_spar",
    persona: { archetype: "skeptic", behaviorStyle: "moderate" },
    scenarioLabel: "Seed round defense",
    claims: [{ id: 1, label: "CAC", claim: "Blended CAC is $40." }],
    otherPanelists: [{ name: "The Nitpicker", archetype: "nitpicker" }],
    onStatusChange: status => { statuses.push(status); },
    onUserInterim: text => { interim.push(text); },
    onUserFinal: text => { userFinal.push(text); },
    onAssistantCaption: (turnId, text) => { captions.push({ turnId, text }); },
    onRegisterTurn: () => { turnCounter += 1; const id = `room:${turnCounter}`; registered.push(id); return id; },
    onCancelTurn: turnId => { cancelled.push(turnId); },
    onCompleteTurn: turnId => { completed.push(turnId); },
    onMetric: event => { metrics.push({ ...event }); },
    onFallback: () => { fallbacks.push(fallbacks.length); },
    dependencies,
  };
  const result = host.render(() => useLiveVoiceForTest(options));
  const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0));
  const micChunk = (bytes: number[]) => ({ sequence: 0, audio: new Uint8Array(bytes) });
  async function goLive(): Promise<void> {
    const started = result.start();
    for (let index = 0; index < 10; index += 1) await Promise.resolve();
    sockets[0].open();
    sockets[0].frame({ setupComplete: {} });
    await started;
    await Promise.resolve();
  }
  const audioFrame = (bytes: number[]) =>
    sockets[0].frame({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm;rate=24000", data: encodeHex(new Uint8Array(bytes)) } }] } } });
  return {
    host, result, sockets, player, metrics, statuses, interim, userFinal, captions,
    registered, cancelled, completed, fallbacks, dependencies, options, settle, goLive, audioFrame, micChunk,
    mic: { emit: (chunk: MicrophoneChunk) => micOnChunk?.(chunk), stops: () => micStops },
    clock: (value: number) => { clock = value; },
    realtimeSends: () => sockets.flatMap(socket => socket.sent.map(entry => JSON.parse(entry))).filter(frame => frame.realtimeInput),
    setupSends: () => sockets.flatMap(socket => socket.sent.map(entry => JSON.parse(entry))).filter(frame => frame.setup),
  };
}

describe("live voice constants", () => {
  test("LIVE_VOICES maps every archetype and FALLBACK_VOICE is Kore", () => {
    expect(LIVE_VOICES).toEqual({
      skeptic: "Kore", nitpicker: "Charon", so_what: "Pulcherrima", timekeeper: "Alnilam", ally: "Achird",
    });
    expect(FALLBACK_VOICE).toBe("Kore");
  });
});

describe("live voice session", () => {
  test("(a) token 503 falls back to the cascade, records one live-engine metric, never throws", async () => {
    const h = harness(503);
    await expect(h.result.start()).resolves.toBeUndefined();
    const updated = h.host.render(() => createLiveVoiceHook(h.host.runtime)(h.options));
    expect(updated.status).toBe("fallback");
    expect(h.metrics).toEqual([{ voiceEngine: "cascade" }]);
    expect(h.fallbacks).toHaveLength(1);
    expect(h.sockets).toHaveLength(0);
    expect(h.player.stops).toBe(0);
    h.host.unmount();
  });

  test("(b) setupComplete goes live; mic frames reach sendAudio as base64 PCM16; audio-out reaches the player with an integer firstLiveAudioMs", async () => {
    const h = harness();
    await h.goLive();
    expect(h.host.render(() => createLiveVoiceHook(h.host.runtime)(h.options)).status).toBe("live");
    expect(h.statuses).toContain("live");

    const setup = h.setupSends()[0].setup;
    expect(setup.model).toBe("models/gemini-3.8-live");
    expect(setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe("Kore");
    expect(typeof setup.systemInstruction.parts[0].text).toBe("string");
    expect(setup.systemInstruction.parts[0].text.length).toBeGreaterThan(0);

    h.mic.emit(h.micChunk([1, 2, 3, 4]));
    expect(h.realtimeSends()).toEqual([
      { realtimeInput: { audio: { data: "hex:01020304", mimeType: "audio/pcm;rate=16000" } } },
    ]);

    h.sockets[0].frame({ serverContent: { interimInputTranscription: { text: "hello" } } });
    h.clock(1000);
    h.sockets[0].frame({ serverContent: { inputTranscription: { text: "hello there" } } });
    expect(h.userFinal).toEqual(["hello there"]);
    h.clock(1812.4);
    h.audioFrame([0, 1, 127, 128]);

    expect(h.registered).toEqual(["room:1"]);
    expect(h.player.started).toEqual(["room:1"]);
    expect(h.player.enqueued).toEqual([
      { turnId: "room:1", sequence: 0, audio: new Uint8Array([0, 1, 127, 128]) },
    ]);
    expect(h.metrics).toContainEqual({ voiceEngine: "gemini-live", firstLiveAudioMs: 812 });
    h.host.unmount();
  });

  test("(c) interrupted stops playback and cancels the active turn exactly once", async () => {
    const h = harness();
    await h.goLive();
    h.sockets[0].frame({ serverContent: { inputTranscription: { text: "question" } } });
    h.audioFrame([0, 1]);
    const stopsBefore = h.player.stops;
    h.sockets[0].frame({ serverContent: { interrupted: true } });
    h.sockets[0].frame({ serverContent: { interrupted: true } });
    expect(h.player.stops).toBe(stopsBefore + 2);
    expect(h.cancelled).toEqual(["room:1"]);
    expect(h.registered).toEqual(["room:1"]);
    expect(h.metrics.some(metric => metric.voiceEngine === "gemini-live" && metric.interruptions === 1)).toBe(true);
    h.host.unmount();
  });

  test("(d) turn-complete finalizes the turn; a stale frame is dropped; the next cycle registers a fresh turnId", async () => {
    const h = harness();
    await h.goLive();
    h.sockets[0].frame({ serverContent: { inputTranscription: { text: "question" } } });
    h.audioFrame([0, 1]);
    h.sockets[0].frame({ serverContent: { turnComplete: true } });
    expect(h.completed).toEqual(["room:1"]);

    const enqueuedBefore = h.player.enqueued.length;
    h.audioFrame([9, 9]); // stale frame for the finished turn
    expect(h.player.enqueued).toHaveLength(enqueuedBefore);
    expect(h.registered).toEqual(["room:1"]);
    expect(h.completed).toEqual(["room:1"]); // the dropped stale frame finalizes nothing

    h.sockets[0].frame({ serverContent: { inputTranscription: { text: "follow-up" } } });
    h.audioFrame([2, 3]);
    expect(h.registered).toEqual(["room:1", "room:2"]);
    expect(h.player.started).toEqual(["room:1", "room:2"]);
    expect(h.player.enqueued.at(-1)).toMatchObject({ turnId: "room:2", sequence: 0 });
    h.host.unmount();
  });

  test("(e) interim input drives the user caption and output transcripts accumulate into the AI caption", async () => {
    const h = harness();
    await h.goLive();
    h.sockets[0].frame({ serverContent: { interimInputTranscription: { text: "hello wor" } } });
    expect(h.interim).toEqual(["hello wor"]);
    h.sockets[0].frame({ serverContent: { inputTranscription: { text: "hello world" } } });
    h.sockets[0].frame({ serverContent: { outputTranscription: { text: "Answ" } } });
    h.sockets[0].frame({ serverContent: { outputTranscription: { text: "er." } } });
    expect(h.captions).toEqual([
      { turnId: "room:1", text: "Answ" },
      { turnId: "room:1", text: "Answer." },
    ]);
    h.host.unmount();
  });

  test("(f) socket failure after retries falls back to the cascade once, without crashing", async () => {
    const h = harness();
    await h.goLive();
    h.sockets[0].networkFail();
    while (h.sockets.length < 4) {
      await h.settle();
      h.sockets[h.sockets.length - 1].networkFail();
    }
    await h.settle();
    const updated = h.host.render(() => createLiveVoiceHook(h.host.runtime)(h.options));
    expect(updated.status).toBe("fallback");
    expect(h.metrics.filter(metric => metric.voiceEngine === "cascade")).toHaveLength(1);
    expect(h.fallbacks).toHaveLength(1);
    expect(h.mic.stops()).toBe(1);
    h.mic.emit(h.micChunk([5, 6])); // mic frames must not flow while the cascade owns the room
    expect(h.realtimeSends()).toHaveLength(0);
    await expect(h.result.start()).resolves.toBeUndefined();
    expect(h.sockets).toHaveLength(4);
    h.host.unmount();
  });

  test("stop() closes adapter, mic, and player; later mic frames go nowhere", async () => {
    const h = harness();
    await h.goLive();
    h.result.stop();
    expect(h.sockets[0].closed).toBe(1);
    expect(h.mic.stops()).toBe(1);
    expect(h.player.resets).toBe(1);
    h.mic.emit(h.micChunk([7, 8]));
    expect(h.realtimeSends()).toHaveLength(0);
    h.host.unmount();
  });

  test("hook surface is exactly status, start, and stop", async () => {
    const h = harness();
    expect(Object.keys(h.result).sort()).toEqual(["start", "status", "stop"]);
    h.host.unmount();
  });

  test("null options (Live unconfigured) render, start, and stop without touching any resource", async () => {
    const host = liveHookHost();
    const useLiveVoiceForTest = createLiveVoiceHook(host.runtime);
    const result = host.render(() => useLiveVoiceForTest(null));
    expect(result.status).toBe("fallback");
    await expect(result.start()).resolves.toBeUndefined();
    expect(() => result.stop()).not.toThrow();
    host.unmount();
  });
});
