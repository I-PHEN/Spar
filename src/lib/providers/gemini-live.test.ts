import { describe, expect, test } from "bun:test";
import {
  GeminiLiveClient,
  type GeminiLiveEvent,
  type GeminiLiveOptions,
  type GeminiLiveSocket,
} from "./gemini-live";
import { vadConfigFor } from "../spar/mode-contracts";

class Socket implements GeminiLiveSocket {
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];
  closed = 0;
  send(data: string): void { this.sent.push(data); }
  close(): void {
    if (this.readyState === 3) return;
    this.closed += 1;
    this.readyState = 3;
  }
  open(): void { this.readyState = 1; this.onopen?.(); }
  message(data: unknown): void { this.onmessage?.({ data }); }
  frame(value: unknown): void { this.message(JSON.stringify(value)); }
  serverClose(): void { this.readyState = 3; this.onclose?.(); }
  networkFail(): void { this.readyState = 3; this.onerror?.(); this.onclose?.(); }
}

const VAD = vadConfigFor("boardroom").automaticActivityDetection;
const TOKEN = "auth_tokens/fixture-live-token";

function harness(overrides: Partial<GeminiLiveOptions> = {}) {
  const events: GeminiLiveEvent[] = [];
  const sockets: Socket[] = [];
  const urls: string[] = [];
  const backoffAttempts: number[] = [];
  const client = new GeminiLiveClient({
    token: TOKEN,
    model: "models/gemini-3.8-live",
    systemInstruction: "spoken system instruction",
    voiceName: "Kore",
    vad: VAD,
    onEvent: (event) => events.push(event),
    dependencies: {
      webSocket: (url) => {
        urls.push(url);
        const socket = new Socket();
        sockets.push(socket);
        return socket;
      },
      backoffMs: (attempt) => { backoffAttempts.push(attempt); return 0; },
    },
    ...overrides,
  });
  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  async function connect(index = 0): Promise<void> {
    const ready = client.connect();
    sockets[index].open();
    sockets[index].frame({ setupComplete: {} });
    await ready;
  }
  return { client, events, sockets, urls, backoffAttempts, settle, connect };
}

describe("Gemini Live adapter", () => {
  test("(a) connects directly to the Constrained endpoint with the ephemeral token", async () => {
    const h = harness();
    const ready = h.client.connect();
    expect(h.client.connect()).toBe(ready);
    const url = new URL(h.urls[0]);
    expect(url.protocol).toBe("wss:");
    expect(url.host).toBe("generativelanguage.googleapis.com");
    expect(url.pathname).toBe(
      "/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained",
    );
    expect([...url.searchParams]).toEqual([["access_token", TOKEN]]);
    h.sockets[0].open();
    h.sockets[0].frame({ setupComplete: {} });
    await ready;
    h.client.close();
  });

  test("(b) sends exactly the documented setup message and nothing before setupComplete", async () => {
    const h = harness();
    const ready = h.client.connect();
    h.sockets[0].open();
    h.client.sendAudio("before-setup-complete");
    expect(h.sockets[0].sent).toHaveLength(1);
    expect(JSON.parse(h.sockets[0].sent[0])).toEqual({
      setup: {
        model: "models/gemini-3.8-live",
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
        },
        systemInstruction: { parts: [{ text: "spoken system instruction" }] },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        realtimeInputConfig: { automaticActivityDetection: VAD },
        sessionResumption: { handle: null },
        contextWindowCompression: { slidingWindow: { targetTokens: 8000 }, triggerTokens: 25000 },
      },
    });
    h.sockets[0].frame({ setupComplete: {} });
    await ready;
    h.client.close();
  });

  test("(c) maps server frames to typed events", async () => {
    const h = harness();
    await h.connect();
    const wire = h.sockets[0];
    wire.frame({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm;rate=24000", data: "first-audio" } }] } } });
    wire.frame({
      serverContent: {
        modelTurn: {
          parts: [
            { inlineData: { mimeType: "audio/pcm;rate=16000", data: "input-rate-audio" } },
            { inlineData: { mimeType: "audio/pcm;rate=24000", data: "second-audio" } },
          ],
        },
      },
    });
    wire.frame({ serverContent: { outputTranscription: { text: "model words" } } });
    wire.frame({ serverContent: { inputTranscription: { text: "user words" } } });
    wire.frame({ serverContent: { interimInputTranscription: { text: "user words so fa" } } });
    wire.frame({ serverContent: { interrupted: true } });
    wire.frame({ serverContent: { turnComplete: true, interactionStatus: "IN_PROGRESS" } });
    wire.frame({ serverContent: { turnComplete: true, interactionStatus: "IDLE" } });
    wire.frame({ serverContent: { turnComplete: true } });
    wire.frame({ serverContent: { generationComplete: true } });
    wire.frame({ sessionResumptionUpdate: { newHandle: "later-handle", resumable: true } });
    wire.frame({ usageMetadata: { totalTokenCount: 12 } });
    wire.message("not json");
    wire.message(42);
    expect(h.events).toEqual([
      { type: "ready" },
      { type: "audio-out", pcmBase64: "first-audio" },
      { type: "audio-out", pcmBase64: "second-audio" },
      { type: "output-transcript", text: "model words" },
      { type: "input-transcript", text: "user words" },
      { type: "interim-input-transcript", text: "user words so fa" },
      { type: "interrupted" },
      { type: "turn-complete" },
      { type: "turn-complete" },
    ]);
    wire.frame({
      serverContent: {
        interrupted: true,
        modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm;rate=24000", data: "combined" } }] },
        outputTranscription: { text: "combined frame" },
      },
    });
    expect(h.events.slice(-3)).toEqual([
      { type: "interrupted" },
      { type: "audio-out", pcmBase64: "combined" },
      { type: "output-transcript", text: "combined frame" },
    ]);
    h.client.close();
  });

  test("(d) reconnects after an unexpected close and resumes with the stored handle", async () => {
    const h = harness();
    await h.connect();
    h.sockets[0].frame({ sessionResumptionUpdate: { newHandle: "resumption-handle-1", resumable: true } });
    expect(h.events).toEqual([{ type: "ready" }]); // the handle is internal state, not an event
    h.sockets[0].serverClose();
    h.client.sendAudio("while-reconnecting"); // not ready anymore — must be a no-op
    expect(h.events[1]).toEqual({ type: "reconnecting", attempt: 1 });
    expect(h.backoffAttempts).toEqual([1]);
    await h.settle();
    expect(h.urls).toHaveLength(2);
    h.sockets[1].open();
    const setup = JSON.parse(h.sockets[1].sent[0]);
    expect(setup.setup.sessionResumption.handle).toBe("resumption-handle-1");
    expect(setup.setup.model).toBe("models/gemini-3.8-live");
    h.sockets[1].frame({ setupComplete: {} });
    expect(h.events).toEqual([
      { type: "ready" },
      { type: "reconnecting", attempt: 1 },
      { type: "ready" },
    ]);
    expect(h.sockets[1].sent).toHaveLength(1); // the dropped audio never reached the new socket
    h.client.close();
  });

  test("goAway warns and reconnects before the server closes", async () => {
    const h = harness();
    await h.connect();
    h.sockets[0].frame({ goAway: { timeLeft: "10s" } });
    expect(h.events.slice(1)).toEqual([
      { type: "goaway", timeLeft: "10s" },
      { type: "reconnecting", attempt: 1 },
    ]);
    expect(h.sockets[0].closed).toBe(1); // the adapter itself closed the socket first
    await h.settle();
    expect(h.urls).toHaveLength(2);
    h.sockets[1].open();
    h.sockets[1].frame({ setupComplete: {} });
    expect(h.events.at(-1)).toEqual({ type: "ready" });
    h.client.close();
  });

  test("a socket error followed by close triggers exactly one reconnect", async () => {
    const h = harness();
    await h.connect();
    h.sockets[0].networkFail();
    expect(h.events.slice(1)).toEqual([{ type: "reconnecting", attempt: 1 }]);
    await h.settle();
    expect(h.urls).toHaveLength(2);
    h.client.close();
  });

  test("emits error socket after three failed reconnect attempts", async () => {
    const h = harness();
    await h.connect();
    h.sockets[0].serverClose(); // attempt 1
    await h.settle();
    h.sockets[1].serverClose(); // attempt 2
    await h.settle();
    h.sockets[2].serverClose(); // attempt 3
    await h.settle();
    h.sockets[3].serverClose(); // budget spent
    expect(h.events).toEqual([
      { type: "ready" },
      { type: "reconnecting", attempt: 1 },
      { type: "reconnecting", attempt: 2 },
      { type: "reconnecting", attempt: 3 },
      { type: "error", reason: "socket" },
    ]);
    expect(h.urls).toHaveLength(4); // initial connection + exactly three attempts
    expect(h.backoffAttempts).toEqual([1, 2, 3]);
    expect(JSON.stringify(h.events)).not.toContain(TOKEN); // the token never leaves the URL
    h.sockets[3].serverClose(); // fatal: stale sockets can no longer trigger anything
    await h.settle();
    expect(h.urls).toHaveLength(4);
  });

  test("rejects connect with setup-rejected after three failed setup attempts", async () => {
    const h = harness();
    const result = h.client.connect();
    h.sockets[0].open();
    h.sockets[0].serverClose(); // dies before setupComplete
    await h.settle();
    h.sockets[1].serverClose();
    await h.settle();
    h.sockets[2].serverClose();
    await h.settle();
    h.sockets[3].serverClose();
    await expect(result).rejects.toThrow("setup-rejected");
    expect(h.events).toEqual([
      { type: "reconnecting", attempt: 1 },
      { type: "reconnecting", attempt: 2 },
      { type: "reconnecting", attempt: 3 },
      { type: "error", reason: "setup-rejected" },
    ]);
  });

  test.each(["", "   "])("rejects a blank token without opening a socket", async (token) => {
    const h = harness({ token });
    await expect(h.client.connect()).rejects.toThrow("token-grant");
    expect(h.events).toEqual([{ type: "error", reason: "token-grant" }]);
    expect(h.urls).toHaveLength(0);
  });

  test("(e) sendAudio is a no-op before ready and wraps PCM after setupComplete", async () => {
    const h = harness();
    const ready = h.client.connect();
    h.client.sendAudio("before-open");
    h.sockets[0].open();
    h.client.sendAudio("before-setup-complete");
    expect(h.sockets[0].sent).toHaveLength(1); // only the setup message so far
    h.sockets[0].frame({ setupComplete: {} });
    await ready;
    h.client.sendAudio("pcm-chunk");
    expect(h.sockets[0].sent[1]).toBe(
      JSON.stringify({ realtimeInput: { audio: { data: "pcm-chunk", mimeType: "audio/pcm;rate=16000" } } }),
    );
    h.client.close();
    h.client.sendAudio("after-close");
    expect(h.sockets[0].sent).toHaveLength(2);
  });

  test("(f) close is idempotent and prevents further reconnects", async () => {
    const h = harness();
    await h.connect();
    h.sockets[0].serverClose();
    h.client.close();
    h.client.close();
    await h.settle();
    await h.settle();
    h.sockets[0].serverClose(); // stale close: the adapter already detached
    await h.settle();
    expect(h.urls).toHaveLength(1); // no reconnect ever ran
    expect(h.events).toEqual([
      { type: "ready" },
      { type: "reconnecting", attempt: 1 },
    ]);
  });

  test("close during startup rejects connect with aborted", async () => {
    const h = harness();
    const result = h.client.connect();
    h.client.close();
    await expect(result).rejects.toThrow("aborted");
    expect(h.events).toEqual([{ type: "error", reason: "aborted" }]);
    expect(h.sockets[0].closed).toBe(1);
    await expect(h.client.connect()).rejects.toThrow("closed");
  });
});
