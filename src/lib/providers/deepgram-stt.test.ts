import { describe, expect, test } from "bun:test";
import { DeepgramSttClient, type DeepgramSocket, type DeepgramSttEvent } from "./deepgram-stt";

class Socket implements DeepgramSocket {
  readyState = 0;
  bufferedAmount = 0;
  binaryType: BinaryType = "blob";
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  sent: (string | Uint8Array)[] = [];
  closed = 0;
  send(data: string | Uint8Array) { this.sent.push(data); }
  close() { this.closed++; this.readyState = 3; }
  open() { this.readyState = 1; this.onopen?.(); }
  message(data: unknown) { this.onmessage?.({ data }); }
}

function turn(event: string, sequence = 1, index = 0, transcript = 'A "quoted" café {phrase}') {
  return JSON.stringify({ type: "TurnInfo", request_id: "request", sequence_id: sequence,
    event, turn_index: index, audio_window_start: 0, audio_window_end: 1.3,
    transcript, words: [{ word: "A", confidence: 0.8, start: 0, end: 0.1 },
      { word: "phrase", confidence: 1, start: 0.1, end: 1.3 }], end_of_turn_confidence: 0.7 });
}

function setup(
  region: "us" | "eu" = "us",
  fetcher?: (input: string, init: RequestInit) => Promise<Response>,
) {
  const events: DeepgramSttEvent[] = [];
  const socket = new Socket();
  const requests: { input: string; init: RequestInit }[] = [];
  const connections: { url: string; protocols: string[] }[] = [];
  const timers = new Map<object, () => void>();
  const client = new DeepgramSttClient({ region, onEvent: (event) => events.push(event), dependencies: {
    fetch: fetcher ?? (async (input, init) => {
      requests.push({ input, init });
      return Response.json({ accessToken: "temporary.jwt.fixture", expiresIn: 60 });
    }),
    createWebSocket: (url, protocols) => { connections.push({ url, protocols }); return socket; },
    setTimer: (callback) => { const id = {}; timers.set(id, callback); return id; },
    clearTimer: (id) => { timers.delete(id as object); },
  } });
  async function connect() {
    const connected = client.connect();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    socket.open();
    await connected;
  }
  return { client, events, socket, requests, connections, timers, connect };
}

describe("Flux protocol", () => {
  test.each(["us", "eu"] as const)("uses a temporary bearer JWT on the %s v2 endpoint", async (region) => {
    const h = setup(region);
    await h.connect();
    const url = new URL(h.connections[0].url);
    expect(url.host).toBe(region === "eu" ? "api.eu.deepgram.com" : "api.deepgram.com");
    expect(url.pathname).toBe("/v2/listen");
    expect([...url.searchParams]).toEqual([["model", "flux-general-en"], ["encoding", "linear16"], ["sample_rate", "16000"]]);
    expect(h.connections[0].protocols).toEqual(["bearer", "temporary.jwt.fixture"]);
    expect(h.requests[0].input).toBe("/api/deepgram-token");
    expect(h.requests[0].init).toMatchObject({ method: "POST", cache: "no-store", credentials: "same-origin" });
    expect(h.socket.binaryType).toBe("arraybuffer");
    expect(h.timers.size).toBe(0);
    h.client.close();
  });

  test("reassembles fragmented UTF-8 JSON and ignores speculative events and duplicates", async () => {
    const h = setup(); await h.connect();
    const wire = turn("StartOfTurn") + turn("Update", 2) + turn("EagerEndOfTurn", 3) + turn("EndOfTurn", 4);
    for (const byte of new TextEncoder().encode(wire)) h.socket.message(new Uint8Array([byte]));
    h.socket.message(turn("EndOfTurn", 4));
    h.socket.message(turn("Update", 5));
    expect(h.events).toEqual([
      { type: "StartOfTurn", turnIndex: 0, transcript: 'A "quoted" café {phrase}' },
      { type: "interim", turnIndex: 0, transcript: 'A "quoted" café {phrase}' },
      { type: "EndOfTurn", turnIndex: 0, transcript: 'A "quoted" café {phrase}', confidence: 0.9 },
    ]);
    h.client.close();
  });

  test("rejects late turn messages and streams multiple turns over one connection", async () => {
    const h = setup(); await h.connect();
    h.socket.message(turn("StartOfTurn")); h.socket.message(turn("EndOfTurn", 2));
    h.socket.message(turn("StartOfTurn", 3, 1));
    h.socket.message(turn("EndOfTurn", 4, 0));
    h.socket.message(turn("EndOfTurn", 5, 1));
    expect(h.events.map((event) => event.type)).toEqual(["StartOfTurn", "EndOfTurn", "StartOfTurn", "EndOfTurn"]);
    expect(h.connections).toHaveLength(1);
    h.client.close();
  });

  test("sends PCM in sequence and rejects gaps before corrupting the audio stream", async () => {
    const h = setup(); await h.connect();
    expect(h.client.sendAudio({ sequence: 0, audio: new Uint8Array([0, 128]) })).toBe(true);
    expect(h.client.sendAudio({ sequence: 1, audio: new Uint8Array([255, 127]) })).toBe(true);
    expect(h.client.sendAudio({ sequence: 3, audio: new Uint8Array([1, 0]) })).toBe(false);
    expect(h.socket.sent.slice(0, 2)).toEqual([new Uint8Array([0, 128]), new Uint8Array([255, 127])]);
    expect(h.events).toContainEqual({ type: "error", reason: "audio-ordering" });
    expect(h.socket.closed).toBe(1);
  });

  test("close suppresses all late events and rejects post-close audio and connections", async () => {
    const h = setup(); await h.connect();
    const lateMessage = h.socket.onmessage!;
    h.client.close(); h.client.close();
    lateMessage({ data: turn("StartOfTurn") });
    expect(h.events).toEqual([{ type: "close", code: 1000, intentional: true }]);
    expect(h.client.sendAudio({ sequence: 0, audio: new Uint8Array(2) })).toBe(false);
    await expect(h.client.connect()).rejects.toThrow("closed");
    expect(h.socket.sent).toEqual([JSON.stringify({ type: "CloseStream" })]);
    expect(h.socket.closed).toBe(1);
  });

  test("shares startup and aborts an unfinished grant without opening a late socket", async () => {
    let resolve!: (response: Response) => void;
    let signal: AbortSignal | null | undefined;
    const h = setup("us", (async (_input, init) => {
      signal = init?.signal;
      return new Promise<Response>((done) => { resolve = done; });
    }));
    const first = h.client.connect(); const second = h.client.connect();
    const outcome = first.catch((error: Error) => error.message);
    expect(first).toBe(second);
    h.client.close();
    expect(signal?.aborted).toBe(true);
    resolve(Response.json({ accessToken: "late.jwt.fixture", expiresIn: 60 }));
    expect(await outcome).toContain("closed");
    await Promise.resolve();
    expect(h.connections).toHaveLength(0);
  });

  test.each([Response.json({ error: "private-key" }, { status: 500 }), Response.json({ apiKey: "private-key" }),
    Response.json({ accessToken: "", expiresIn: 60 })])("rejects bad grants without exposing the response", async (response) => {
    const h = setup("us", async () => response);
    await expect(h.client.connect()).rejects.toThrow("token-grant");
    expect(h.connections).toHaveLength(0);
    expect(JSON.stringify(h.events)).not.toContain("private-key");
  });

  test("times out stuck startup and cleans up its deadline", async () => {
    const h = setup(); const result = h.client.connect().catch((error: Error) => error.message);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    for (const fire of [...h.timers.values()]) fire();
    expect(await result).toContain("startup-timeout");
    expect(h.socket.closed).toBe(1); expect(h.timers.size).toBe(0);
  });

  test("bounds incomplete input and sanitizes provider errors", async () => {
    const h = setup(); await h.connect();
    h.socket.message(JSON.stringify({ type: "Error", code: "SECRET", description: "private-key" }));
    expect(h.events[0]).toEqual({ type: "error", reason: "provider-error" });
    expect(JSON.stringify(h.events)).not.toContain("private-key");
    const oversized = setup(); await oversized.connect();
    oversized.socket.message('{"value":"' + "x".repeat(1_048_576));
    expect(oversized.events[0]).toEqual({ type: "error", reason: "invalid-message" });
    expect(oversized.socket.closed).toBe(1);
  });

  test("fails rather than buffering unbounded audio on a congested socket", async () => {
    const h = setup(); await h.connect(); h.socket.bufferedAmount = 300_000;
    expect(h.client.sendAudio({ sequence: 0, audio: new Uint8Array(2560) })).toBe(false);
    expect(h.events[0]).toEqual({ type: "error", reason: "audio-backpressure" });
    expect(h.socket.closed).toBe(1);
  });
});
