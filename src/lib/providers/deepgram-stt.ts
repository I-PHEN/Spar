import type { MicrophoneChunk } from "../voice/microphone-stream";

export type DeepgramSttFailure =
  | "token-grant" | "socket-error" | "startup-timeout" | "provider-error"
  | "invalid-message" | "audio-ordering" | "audio-backpressure";

export type DeepgramSttEvent =
  | { type: "StartOfTurn"; turnIndex: number; transcript: string }
  | { type: "interim"; turnIndex: number; transcript: string }
  | { type: "EndOfTurn"; turnIndex: number; transcript: string; confidence: number }
  | { type: "error"; reason: DeepgramSttFailure }
  | { type: "close"; code: number; intentional: boolean };

/** Small browser boundary: tests do not need a DOM or a real socket. */
export interface DeepgramSocket {
  readonly readyState: number;
  readonly bufferedAmount: number;
  binaryType: BinaryType;
  onopen: WebSocket["onopen"] | (() => void);
  onmessage: WebSocket["onmessage"] | ((event: { data: unknown }) => void);
  onerror: WebSocket["onerror"] | (() => void);
  onclose: WebSocket["onclose"] | ((event: { code: number }) => void);
  send(data: string | Uint8Array): void;
  close(): void;
}

export interface VoiceTimers {
  setTimer: (callback: () => void, delayMs: number) => unknown;
  clearTimer: (timer: unknown) => void;
}

export interface DeepgramSttDependencies extends Partial<VoiceTimers> {
  fetch?: (input: string, init: RequestInit) => Promise<Response>;
  createWebSocket?: (url: string, protocols: string[]) => DeepgramSocket;
}

export interface DeepgramSttOptions {
  /** Pass the server-selected DEEPGRAM_REGION; never a public credential. */
  region: "us" | "eu";
  onEvent: (event: DeepgramSttEvent) => void;
  dependencies?: DeepgramSttDependencies;
}

/** A single, permanent connection for multiple turns. Reconnect with a new client. */
export class DeepgramSttClient {
  private socket: DeepgramSocket | null = null;
  private readonly abort = new AbortController();
  private closed = false;
  private opened = false;
  private connection: Promise<void> | null = null;
  private resolveConnection?: () => void;
  private rejectConnection?: (error: Error) => void;
  private deadline: unknown;
  private readonly timers: VoiceTimers;
  private nextAudioSequence = 0;
  private lastSequence = -1;
  private turnIndex = -1;
  private turnEnded = true;
  private decoder = new TextDecoder("utf-8", { fatal: true });
  private input = "";
  private depth = 0;
  private quoted = false;
  private escaped = false;

  constructor(private readonly options: DeepgramSttOptions) {
    this.timers = {
      setTimer: options.dependencies?.setTimer ?? ((callback, delay) => setTimeout(callback, delay)),
      clearTimer: options.dependencies?.clearTimer ?? ((timer) => clearTimeout(timer as ReturnType<typeof setTimeout>)),
    };
  }

  connect(): Promise<void> {
    if (this.closed) return Promise.reject(new Error("STT closed"));
    if (this.connection) return this.connection;
    this.connection = new Promise<void>((resolve, reject) => {
      this.resolveConnection = resolve;
      this.rejectConnection = reject;
    });
    this.deadline = this.timers.setTimer(() => this.fail("startup-timeout"), 10_000);
    void this.open();
    return this.connection;
  }

  private async open(): Promise<void> {
    const fetcher = this.options.dependencies?.fetch ?? globalThis.fetch;
    let grant: { accessToken?: unknown; expiresIn?: unknown };
    try {
      const response = await fetcher("/api/deepgram-token", {
        method: "POST", credentials: "same-origin", cache: "no-store", signal: this.abort.signal,
      });
      if (!response.ok) throw new Error();
      grant = await response.json();
      if (!grant || typeof grant.accessToken !== "string" || !grant.accessToken.trim() ||
        typeof grant.expiresIn !== "number" || !Number.isFinite(grant.expiresIn) || grant.expiresIn <= 0) throw new Error();
    } catch {
      if (!this.closed) this.fail("token-grant");
      return;
    }
    if (this.closed) return;
    try {
      const host = this.options.region === "eu" ? "api.eu.deepgram.com" : "api.deepgram.com";
      const url = `wss://${host}/v2/listen?model=flux-general-en&encoding=linear16&sample_rate=16000`;
      const create = this.options.dependencies?.createWebSocket ?? ((address, protocols) => new WebSocket(address, protocols));
      const socket = create(url, ["bearer", grant.accessToken as string]);
      this.socket = socket;
      socket.binaryType = "arraybuffer";
      socket.onopen = () => {
        if (this.closed) return;
        this.opened = true;
        this.clearDeadline();
        this.resolveConnection?.();
        this.resolveConnection = undefined;
        this.rejectConnection = undefined;
      };
      socket.onmessage = ({ data }: { data: unknown }) => {
        if (this.closed || !this.opened) return;
        try {
          const value = typeof data === "string" ? data :
            data instanceof ArrayBuffer || ArrayBuffer.isView(data) ? this.decoder.decode(data, { stream: true }) : null;
          if (value === null) throw new Error();
          this.read(value);
        } catch {
          this.fail("invalid-message");
        }
      };
      socket.onerror = () => this.fail("socket-error");
      socket.onclose = ({ code }: { code: number }) => this.finish(false, code);
    } catch {
      this.fail("socket-error");
    }
  }

  sendAudio(chunk: MicrophoneChunk): boolean {
    if (this.closed || !this.opened || this.socket?.readyState !== 1) return false;
    if (chunk.sequence !== this.nextAudioSequence || chunk.audio.byteLength === 0 || chunk.audio.byteLength % 2 !== 0) {
      this.fail("audio-ordering");
      return false;
    }
    // Keep at most eight seconds of 16 kHz PCM in the browser's send queue.
    if (this.socket.bufferedAmount + chunk.audio.byteLength > 256_000) {
      this.fail("audio-backpressure");
      return false;
    }
    try {
      this.socket.send(chunk.audio);
      this.nextAudioSequence++;
      return true;
    } catch {
      this.fail("socket-error");
      return false;
    }
  }

  close(): void { this.finish(true, 1000); }

  private clearDeadline(): void {
    if (this.deadline !== undefined) this.timers.clearTimer(this.deadline);
    this.deadline = undefined;
  }

  private fail(reason: DeepgramSttFailure): void {
    if (this.closed) return;
    // Finish first so a callback cannot re-enter the failed stream.
    this.finish(false, 1006, reason);
  }

  private finish(intentional: boolean, code: number, reason?: DeepgramSttFailure): void {
    if (this.closed) return;
    this.closed = true;
    this.abort.abort();
    this.clearDeadline();
    this.rejectConnection?.(new Error(reason ?? "STT closed"));
    this.resolveConnection = undefined;
    this.rejectConnection = undefined;
    this.input = "";
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      try {
        if (intentional && socket.readyState === 1) socket.send(JSON.stringify({ type: "CloseStream" }));
      } catch { /* Cleanup must still close the connection. */ }
      try { socket.close(); } catch { /* Already closed. */ }
    }
    if (reason) this.options.onEvent({ type: "error", reason });
    this.options.onEvent({ type: "close", code, intentional });
  }

  /** Browsers assemble WS frames; incremental decoding also supports fragmented transports. */
  private read(text: string): void {
    for (const character of text) {
      if (this.closed) return;
      if (!this.input && /\s/.test(character)) continue;
      if (!this.input && character !== "{") throw new Error();
      this.input += character;
      if (this.input.length > 1_048_576) throw new Error();
      if (this.quoted) {
        if (this.escaped) this.escaped = false;
        else if (character === "\\") this.escaped = true;
        else if (character === '"') this.quoted = false;
      } else if (character === '"') this.quoted = true;
      else if (character === "{") this.depth++;
      else if (character === "}") this.depth--;
      if (this.depth === 0) {
        const message: unknown = JSON.parse(this.input);
        this.input = "";
        this.normalize(message);
      }
    }
  }

  private normalize(value: unknown): void {
    if (!value || typeof value !== "object") throw new Error();
    const message = value as Record<string, unknown>;
    if (message.type === "Error") { this.fail("provider-error"); return; }
    if (message.type !== "TurnInfo") return;
    if (!["StartOfTurn", "Update", "EndOfTurn"].includes(message.event as string)) return;
    const sequence = message.sequence_id as number;
    const index = message.turn_index as number;
    if (!Number.isSafeInteger(sequence) || sequence < 0 || !Number.isSafeInteger(index) || index < 0 ||
      typeof message.transcript !== "string") throw new Error();
    if (sequence <= this.lastSequence) return;
    this.lastSequence = sequence;
    const transcript = message.transcript;
    if (message.event === "StartOfTurn") {
      if (index <= this.turnIndex) return;
      this.turnIndex = index;
      this.turnEnded = false;
      this.options.onEvent({ type: "StartOfTurn", turnIndex: index, transcript });
    } else if (index === this.turnIndex && !this.turnEnded) {
      if (message.event === "Update") this.options.onEvent({ type: "interim", turnIndex: index, transcript });
      else {
        if (!Array.isArray(message.words)) throw new Error();
        const confidences = message.words.map((word: unknown) => {
          const confidence = (word as { confidence?: unknown } | null)?.confidence;
          if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error();
          return confidence;
        });
        // No words is conservatively zero; EOT confidence is a different quantity.
        const confidence = confidences.length ? confidences.reduce((sum, score) => sum + score, 0) / confidences.length : 0;
        this.turnEnded = true;
        this.options.onEvent({ type: "EndOfTurn", turnIndex: index, transcript, confidence });
      }
    }
  }
}
