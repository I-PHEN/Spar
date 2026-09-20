import { describe, expect, test } from "bun:test";
import { PcmPlayer, type PcmAudioContext, type PcmPlayerEvent } from "./pcm-player";

function setup(resume: () => Promise<void> = async () => {}) {
  const scheduled: { samples: Float32Array; when: number; stopped: boolean; end: () => void }[] = [];
  const events: PcmPlayerEvent[] = [];
  const context: PcmAudioContext = {
    currentTime: 2, destination: {}, resume, close: async () => {},
    createBuffer: (_channels, length, rate) => ({ duration: length / rate, copyToChannel(samples) { bufferData = samples; } }),
    createBufferSource: () => {
      const source = { buffer: null, onended: null as (() => void) | null,
        connect() {}, disconnect() {},
        start(when: number) { const ended = source.onended; scheduled.push({ samples: data, when, stopped: false, end: () => ended?.() }); },
        stop() { const item = scheduled.find(item => item.samples === data); if (item) item.stopped = true; },
      };
      let data = new Float32Array();
      Object.defineProperty(source, "buffer", { set() { data = bufferData; } });
      return source;
    },
  };
  let bufferData = new Float32Array();
  const player = new PcmPlayer({ onEvent: event => events.push(event), dependencies: { createAudioContext: () => context, now: () => 1000 } });
  return { player, context, scheduled, events };
}

describe("incremental PCM playback", () => {
  test("decodes little-endian signed samples and schedules the first frame immediately", async () => {
    const h = setup(); await h.player.start("turn-1");
    h.player.enqueue({ turnId: "turn-1", sequence: 0, audio: new Uint8Array([0,128,0,0,255,127]) });
    expect([...h.scheduled[0].samples]).toEqual([-1, 0, 32767 / 32768]);
    expect(h.scheduled[0].when).toBe(2);
    expect(h.events[0]).toEqual({ type: "playback-start", turnId: "turn-1", timestampMs: 1000, audioTime: 2 });
  });
  test("schedules adjacent frames without gaps and counts an actual underrun", async () => {
    const h = setup(); await h.player.start("turn-1");
    for (let sequence = 0; sequence < 2; sequence++) h.player.enqueue({ turnId: "turn-1", sequence, audio: new Uint8Array(4800) });
    expect(h.scheduled.map(item => item.when)).toEqual([2, 2.1]);
    h.context.currentTime = 2.3;
    h.player.enqueue({ turnId: "turn-1", sequence: 2, audio: new Uint8Array(4800) });
    expect(h.scheduled[2].when).toBe(2.3);
    expect(h.events).toContainEqual({ type: "underrun", turnId: "turn-1", count: 1 });
    h.scheduled[2].end();
    expect(h.events).toContainEqual({ type: "drained", turnId: "turn-1", sequence: 2 });
  });
  test("stop synchronously invalidates old frames, active sources, and late callbacks", async () => {
    const h = setup(); await h.player.start("old");
    h.player.enqueue({ turnId: "old", sequence: 0, audio: new Uint8Array(48) });
    const late = h.scheduled[0].end; h.player.stop();
    expect(h.scheduled[0].stopped).toBe(true);
    await h.player.start("new"); late();
    expect(h.player.enqueue({ turnId: "old", sequence: 1, audio: new Uint8Array(48) })).toBe(false);
    expect(h.events.filter(event => event.type === "drained")).toEqual([]);
  });
  test("cancel during AudioContext resume prevents pending playback", async () => {
    let resume!: () => void;
    const h = setup(() => new Promise<void>(resolve => { resume = resolve; }));
    const started = h.player.start("old");
    h.player.enqueue({ turnId: "old", sequence: 0, audio: new Uint8Array(48) });
    h.player.stop(); resume(); await started;
    expect(h.scheduled).toEqual([]);
  });
  test("an underrun callback can cancel synchronously without scheduling uncancellable audio", async () => {
    const h = setup();
    const player = new PcmPlayer({ dependencies: { createAudioContext: () => h.context },
      onEvent: event => { if (event.type === "underrun") player.stop(); } });
    await player.start("one");
    player.enqueue({ turnId: "one", sequence: 0, audio: new Uint8Array(4800) });
    h.context.currentTime = 3;
    player.enqueue({ turnId: "one", sequence: 1, audio: new Uint8Array(4800) });
    expect(h.scheduled.every(item => item.stopped)).toBe(true);
  });
});
