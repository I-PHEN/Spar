export interface PcmFrame { turnId: string; sequence: number; audio: Uint8Array }
interface PcmBuffer { duration: number; copyToChannel(samples: Float32Array<ArrayBuffer>, channel: number): void }
interface PcmSource {
  buffer: PcmBuffer | null;
  onended: AudioBufferSourceNode["onended"] | (() => void);
  connect(destination: unknown): void;
  disconnect(): void;
  start(when: number): void;
  stop(): void;
}
export interface PcmAudioContext {
  currentTime: number;
  destination: unknown;
  resume(): Promise<void>;
  close(): Promise<void>;
  createBuffer(channels: number, length: number, rate: number): PcmBuffer;
  createBufferSource(): PcmSource;
}
export type PcmPlayerEvent = { turnId: string } & (
  | { type: "playback-start"; timestampMs: number; audioTime: number }
  | { type: "drained"; sequence: number }
  | { type: "underrun"; count: number }
);
export interface PcmPlayerOptions {
  onEvent: (event: PcmPlayerEvent) => void;
  dependencies?: { createAudioContext?: () => PcmAudioContext; now?: () => number };
}

export class PcmPlayer {
  private context?: PcmAudioContext;
  private turnId?: string;
  private generation = 0;
  private ready = false;
  private pending: PcmFrame[] = [];
  private sources = new Set<PcmSource>();
  private nextTime = 0;
  private nextSequence = 0;
  private played = false;
  private underruns = 0;

  constructor(private readonly options: PcmPlayerOptions) {}

  async start(turnId: string): Promise<void> {
    this.stop(); this.turnId = turnId;
    const generation = this.generation;
    this.context ??= this.options.dependencies?.createAudioContext?.() ?? new AudioContext();
    await this.context.resume();
    if (generation !== this.generation) return;
    this.ready = true;
    const pending = this.pending; this.pending = [];
    for (const frame of pending) this.schedule(frame);
  }

  enqueue(frame: PcmFrame): boolean {
    if (frame.turnId !== this.turnId || frame.sequence !== this.nextSequence || !frame.audio.length || frame.audio.length % 2) return false;
    this.nextSequence++;
    if (this.ready) this.schedule(frame);
    else this.pending.push({ ...frame, audio: frame.audio.slice() });
    return true;
  }

  stop(): void {
    this.generation++; this.turnId = undefined; this.ready = false; this.pending = [];
    for (const source of this.sources) {
      source.onended = null;
      try { source.stop(); } catch { /* Already stopped. */ }
      source.disconnect();
    }
    this.sources.clear(); this.nextTime = this.nextSequence = this.underruns = 0; this.played = false;
  }

  reset(): void {
    this.stop();
    const context = this.context; this.context = undefined;
    if (context) void context.close().catch(() => {});
  }

  private schedule(frame: PcmFrame): void {
    const context = this.context!;
    const generation = this.generation;
    const samples = new Float32Array(frame.audio.byteLength / 2);
    const view = new DataView(frame.audio.buffer, frame.audio.byteOffset, frame.audio.byteLength);
    for (let index = 0; index < samples.length; index++) samples[index] = view.getInt16(index * 2, true) / 32768;
    const buffer = context.createBuffer(1, samples.length, 24000);
    buffer.copyToChannel(samples, 0);
    const source = context.createBufferSource(); source.buffer = buffer; source.connect(context.destination);
    const when = Math.max(context.currentTime, this.nextTime);
    if (this.played && context.currentTime > this.nextTime + 0.002) {
      this.options.onEvent({ type: "underrun", turnId: frame.turnId, count: ++this.underruns });
      if (generation !== this.generation) { source.disconnect(); return; }
    }
    this.nextTime = when + buffer.duration;
    this.sources.add(source);
    source.onended = () => {
      source.disconnect(); this.sources.delete(source);
      if (generation !== this.generation || frame.turnId !== this.turnId) return;
      if (frame.sequence === this.nextSequence - 1) this.options.onEvent({ type: "drained", turnId: frame.turnId, sequence: frame.sequence });
    };
    source.start(when);
    if (!this.played) {
      this.played = true;
      this.options.onEvent({ type: "playback-start", turnId: frame.turnId, audioTime: when,
        timestampMs: (this.options.dependencies?.now ?? (() => performance.now()))() + (when - context.currentTime) * 1000 });
    }
  }
}
