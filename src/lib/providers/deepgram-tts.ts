import type { DeepgramSocket, VoiceTimers } from "./deepgram-stt";

/** Safe to import in browser code; no server SDK or durable credentials. */
export const PERSONA_VOICES = {
  skeptic: "aura-2-zeus-en", nitpicker: "aura-2-athena-en", so_what: "aura-2-orion-en",
  timekeeper: "aura-2-arcas-en", ally: "aura-2-apollo-en",
} as const;

export type DeepgramTtsFailure = "token-grant" | "socket-error" | "startup-timeout" | "clear-timeout" | "provider-error" | "invalid-message" | "phrase-ordering";
export type DeepgramTtsEvent = { turnId: string } & (
  | { type: "audio"; sequence: number; audio: Uint8Array }
  | { type: "complete" }
  | { type: "error"; reason: DeepgramTtsFailure }
);
export interface DeepgramTtsOptions {
  model: string;
  onEvent: (event: DeepgramTtsEvent) => void;
  dependencies: Partial<VoiceTimers> & {
    /**
     * Obtain/reuse a short-lived grant plus the server-selected region it
     * carries; never supply a durable API key.
     */
    getToken: () => Promise<{ token: string; region: "us" | "eu" }>;
    createWebSocket?: (url: string, protocols: string[]) => DeepgramSocket;
  };
}

/** One connection per voice; reconnect by replacing this client between turns. */
export class DeepgramTtsClient {
  private socket?: DeepgramSocket;
  private connection?: Promise<void>;
  private resolveConnection?: () => void;
  private rejectConnection?: (error: Error) => void;
  private barrier?: Promise<void>;
  private resolveBarrier?: () => void;
  private rejectBarrier?: (error: Error) => void;
  private deadline: unknown;
  private closed = false;
  private turnId?: string;
  private pendingTurn?: string;
  private phraseSequence = 0;
  private audioSequence = 0;
  private flushed = false;
  private generation = 0;
  private readonly timers: VoiceTimers;

  constructor(private readonly options: DeepgramTtsOptions) {
    this.timers = {
      setTimer: options.dependencies.setTimer ?? ((callback, delay) => setTimeout(callback, delay)),
      clearTimer: options.dependencies.clearTimer ?? (timer => clearTimeout(timer as ReturnType<typeof setTimeout>)),
    };
  }

  async beginTurn(turnId: string): Promise<void> {
    if (this.closed) throw new Error("TTS closed");
    if (this.turnId || this.pendingTurn) throw new Error("TTS turn still active");
    this.pendingTurn = turnId;
    const generation = this.generation;
    try {
      if (!this.connection) {
        this.connection = new Promise<void>((resolve, reject) => { this.resolveConnection = resolve; this.rejectConnection = reject; });
        this.deadline = this.timers.setTimer(() => this.fail("startup-timeout"), 10_000);
        void this.open();
      }
      await this.connection;
      if (this.barrier) await this.barrier;
      if (this.closed || generation !== this.generation) throw new Error("TTS turn cancelled");
      this.turnId = turnId;
      this.phraseSequence = this.audioSequence = 0;
      this.flushed = false;
    } finally {
      if (this.pendingTurn === turnId) this.pendingTurn = undefined;
    }
  }

  speak(phrase: string, sequence: number): boolean {
    if (!this.turnId || this.closed || this.flushed) return false;
    if (sequence !== this.phraseSequence) { this.fail("phrase-ordering"); return false; }
    if (!this.send({ type: "Speak", text: phrase })) return false;
    this.phraseSequence++;
    return true;
  }

  flush(): boolean {
    if (!this.turnId || this.closed || this.flushed) return false;
    this.flushed = true;
    return this.send({ type: "Flush" });
  }

  clear(): void {
    this.generation++;
    this.turnId = this.pendingTurn = undefined;
    if (this.closed || this.barrier) return;
    if (this.socket?.readyState !== 1) { this.close(); return; }
    this.barrier = new Promise<void>((resolve, reject) => { this.resolveBarrier = resolve; this.rejectBarrier = reject; });
    // Clearing without a following turn must not leave an unhandled rejection.
    void this.barrier.catch(() => {});
    this.deadline = this.timers.setTimer(() => this.fail("clear-timeout"), 10_000);
    this.send({ type: "Clear" });
  }

  close(): void { this.finish("TTS closed"); }

  private async open(): Promise<void> {
    let grant: { token: string; region: "us" | "eu" };
    try {
      grant = await this.options.dependencies.getToken();
      if (!grant?.token?.trim() || (grant.region !== "us" && grant.region !== "eu")) throw new Error();
    }
    catch { this.fail("token-grant"); return; }
    if (this.closed) return;
    try {
      // The grant carries the server-selected region so the socket host can
      // never diverge from the server's DEEPGRAM_REGION.
      const host = grant.region === "eu" ? "api.eu.deepgram.com" : "api.deepgram.com";
      const params = new URLSearchParams({ model: this.options.model, encoding: "linear16", sample_rate: "24000" });
      const create = this.options.dependencies.createWebSocket ?? ((url, protocols) => new WebSocket(url, protocols));
      const socket = create(`wss://${host}/v1/speak?${params}`, ["bearer", grant.token]);
      this.socket = socket; socket.binaryType = "arraybuffer";
      socket.onopen = () => {
        if (this.closed) return;
        this.clearDeadline(); this.resolveConnection?.();
        this.resolveConnection = this.rejectConnection = undefined;
      };
      socket.onmessage = ({ data }: { data: unknown }) => this.receive(data);
      socket.onerror = () => this.fail("socket-error");
      socket.onclose = () => this.fail("socket-error");
    } catch { this.fail("socket-error"); }
  }

  private receive(data: unknown): void {
    if (this.closed) return;
    if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      if (!this.turnId || this.barrier) return;
      const audio = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      if (!audio.length || audio.length % 2) { this.fail("invalid-message"); return; }
      this.options.onEvent({ type: "audio", turnId: this.turnId, sequence: this.audioSequence++, audio });
      return;
    }
    try {
      if (typeof data !== "string") throw new Error();
      const message = JSON.parse(data) as { type?: string };
      if (message.type === "Error" || message.type === "Warning") { this.fail("provider-error"); return; }
      if (message.type === "Cleared" && this.barrier) {
        this.clearDeadline(); this.resolveBarrier?.();
        this.barrier = this.resolveBarrier = this.rejectBarrier = undefined;
      } else if (message.type === "Flushed" && this.turnId && this.flushed && !this.barrier) {
        const turnId = this.turnId; this.turnId = undefined;
        this.options.onEvent({ type: "complete", turnId });
      }
    } catch { this.fail("invalid-message"); }
  }

  private send(message: object): boolean {
    try {
      if (this.socket?.readyState !== 1 || this.socket.bufferedAmount > 65_536) throw new Error();
      this.socket.send(JSON.stringify(message)); return true;
    } catch { this.fail("socket-error"); return false; }
  }

  private fail(reason: DeepgramTtsFailure): void {
    if (this.closed) return;
    // While clearing, provider messages still belong to the cancelled turn.
    const turnId = this.barrier ? undefined : this.turnId ?? this.pendingTurn;
    this.finish(reason);
    if (turnId) this.options.onEvent({ type: "error", turnId, reason });
  }

  private finish(reason: string): void {
    if (this.closed) return;
    this.closed = true; this.generation++; this.turnId = this.pendingTurn = undefined;
    this.clearDeadline();
    this.rejectConnection?.(new Error(reason)); this.rejectBarrier?.(new Error(reason));
    this.resolveConnection = this.rejectConnection = this.resolveBarrier = this.rejectBarrier = undefined;
    const socket = this.socket; this.socket = undefined;
    if (socket) {
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      try { socket.close(); } catch { /* Already closed. */ }
    }
  }

  private clearDeadline(): void {
    if (this.deadline !== undefined) this.timers.clearTimer(this.deadline);
    this.deadline = undefined;
  }
}
