import { describe, expect, test } from "bun:test";
import { DeepgramTtsClient, type DeepgramTtsEvent } from "./deepgram-tts";
import type { DeepgramSocket } from "./deepgram-stt";

class Socket implements DeepgramSocket {
  readyState = 0;
  bufferedAmount = 0;
  binaryType: BinaryType = "blob";
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  sent: unknown[] = [];
  closed = 0;
  send(data: string | Uint8Array) { this.sent.push(typeof data === "string" ? JSON.parse(data) : data); }
  close() { this.closed++; this.readyState = 3; }
  open() { this.readyState = 1; this.onopen?.(); }
  message(data: unknown) { this.onmessage?.({ data }); }
}

function setup(region: "us" | "eu" = "us") {
  const socket = new Socket();
  const events: DeepgramTtsEvent[] = [];
  const connections: { url: string; protocols: string[] }[] = [];
  const timers = new Map<object, () => void>();
  const client = new DeepgramTtsClient({ model: "aura-2-athena-en", onEvent: event => events.push(event),
    dependencies: {
      getToken: async () => ({ token: "temporary.jwt.fixture", region }),
      createWebSocket: (url, protocols) => { connections.push({ url, protocols }); return socket; },
      setTimer: callback => { const id = {}; timers.set(id, callback); return id; },
      clearTimer: id => { timers.delete(id as object); },
    },
  });
  async function begin(turnId = "turn-1") {
    const promise = client.beginTurn(turnId);
    await Promise.resolve(); await Promise.resolve();
    socket.open();
    await promise;
  }
  return { client, socket, events, connections, timers, begin };
}

describe("Aura streaming protocol", () => {
  test.each(["us", "eu"] as const)("authenticates the granted %s regional PCM stream with a temporary JWT", async region => {
    const h = setup(region); await h.begin();
    expect(h.connections).toEqual([{ url: `wss://${region === "eu" ? "api.eu.deepgram.com" : "api.deepgram.com"}/v1/speak?model=aura-2-athena-en&encoding=linear16&sample_rate=24000`, protocols: ["bearer", "temporary.jwt.fixture"] }]);
    expect(h.socket.binaryType).toBe("arraybuffer");
    h.client.speak("Exact  text. ", 0); h.client.speak("Final!", 1); h.client.flush(); h.client.flush();
    expect(h.socket.sent).toEqual([{ type: "Speak", text: "Exact  text. " }, { type: "Speak", text: "Final!" }, { type: "Flush" }]);
    h.socket.message(new Uint8Array([0, 128]).buffer);
    h.socket.message(JSON.stringify({ type: "Flushed", sequence_id: 0 }));
    expect(h.events).toEqual([{ type: "audio", turnId: "turn-1", sequence: 0, audio: new Uint8Array([0, 128]) }, { type: "complete", turnId: "turn-1" }]);
    await h.client.beginTurn("turn-2"); h.client.speak("Next", 0);
    expect(h.connections).toHaveLength(1); h.client.close();
  });

  test("uses Cleared as a barrier before attributing untagged audio to a new turn", async () => {
    const h = setup(); await h.begin(); h.client.speak("Old", 0); h.client.flush();
    h.client.clear();
    const next = h.client.beginTurn("turn-2");
    h.socket.message(new Uint8Array([1, 0]).buffer);
    h.socket.message(JSON.stringify({ type: "Flushed", sequence_id: 0 }));
    expect(h.events).toEqual([]);
    h.socket.message(JSON.stringify({ type: "Cleared", sequence_id: 1 }));
    await next; h.client.speak("New", 0);
    h.socket.message(new Uint8Array([2, 0]).buffer);
    expect(h.events).toEqual([{ type: "audio", turnId: "turn-2", sequence: 0, audio: new Uint8Array([2, 0]) }]);
    const late = h.socket.onmessage!; h.client.close(); late({ data: new Uint8Array([3, 0]).buffer });
    expect(h.events).toHaveLength(1); expect(h.socket.closed).toBe(1);
  });

  test("fails ordered text and sanitizes provider errors without reconnect or replay", async () => {
    const h = setup(); await h.begin();
    expect(h.client.speak("Gap", 1)).toBe(false);
    expect(h.events).toEqual([{ type: "error", turnId: "turn-1", reason: "phrase-ordering" }]);
    expect(h.socket.sent).toEqual([]);
    await expect(h.client.beginTurn("turn-2")).rejects.toThrow("closed");
    const other = setup(); await other.begin();
    other.socket.message(JSON.stringify({ type: "Error", description: "private upstream details" }));
    expect(other.events).toEqual([{ type: "error", turnId: "turn-1", reason: "provider-error" }]);
  });

  test("bounds startup and clear waits and suppresses cancelled provider errors", async () => {
    const h = setup(); const pending = h.client.beginTurn("turn-1").catch((error: Error) => error.message);
    for (const fire of [...h.timers.values()]) fire();
    expect(await pending).toContain("startup-timeout");
    const other = setup(); await other.begin(); other.client.clear();
    other.socket.message(JSON.stringify({ type: "Error", description: "old" }));
    expect(other.events).toEqual([]);
    const barrier = setup(); await barrier.begin(); barrier.client.clear();
    const next = barrier.client.beginTurn("turn-2").catch((error: Error) => error.message);
    for (const fire of [...barrier.timers.values()]) fire();
    expect(await next).toContain("clear-timeout");
  });
});
