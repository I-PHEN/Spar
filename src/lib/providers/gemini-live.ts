/**
 * Gemini Live browser adapter (BidiGenerateContent over a raw WebSocket).
 *
 * Wire ground truth: docs/research/2026-09-24-gemini-live-api-protocol.md
 * (URL literal §1.1; setup §2.1; audio in/out §3.1/§4.1; interruption §4.2;
 * resumption §4.6/§5; goAway §4.4). This class only speaks the protocol and
 * emits typed events — mic capture, PCM playback, and turn state belong to
 * the integrator. The browser connects DIRECTLY to Google with the
 * short-lived ephemeral token minted server-side (Task 2); the app server
 * never relays audio, and the token never appears in an emitted event.
 */

import type { vadConfigFor } from "../spar/mode-contracts";

export type GeminiLiveFailure = "token-grant" | "socket" | "setup-rejected" | "aborted";

export type GeminiLiveEvent =
  | { type: "ready" }
  | { type: "audio-out"; pcmBase64: string } // base64 PCM, audio/pcm;rate=24000 — decode for PcmPlayer
  | { type: "output-transcript"; text: string }
  | { type: "input-transcript"; text: string } // finalized user speech (end-of-speech signal)
  | { type: "interim-input-transcript"; text: string }
  | { type: "turn-complete" } // only on interactionStatus "IDLE" or absent (§4.2 extended thinking)
  | { type: "interrupted" } // discard playback NOW — stopping playback is the integrator's job
  | { type: "goaway"; timeLeft: string }
  | { type: "reconnecting"; attempt: number }
  | { type: "error"; reason: GeminiLiveFailure };

/** VAD block exactly as `vadConfigFor` (mode-contracts, Task 1) produces it. */
export type GeminiLiveVad = ReturnType<typeof vadConfigFor>["automaticActivityDetection"];

/** Small browser boundary: tests do not need a DOM or a real socket. */
export interface GeminiLiveSocket {
  readonly readyState: number;
  onopen: WebSocket["onopen"] | (() => void);
  onmessage: WebSocket["onmessage"] | ((event: { data: unknown }) => void);
  onerror: WebSocket["onerror"] | (() => void);
  onclose: WebSocket["onclose"] | (() => void);
  send(data: string): void;
  close(): void;
}

export interface GeminiLiveDependencies {
  webSocket?: (url: string) => GeminiLiveSocket;
  now?: () => number;
  backoffMs?: (attempt: number) => number;
}

export interface GeminiLiveOptions {
  token: string; // the "auth_tokens/..." string from the Task 2 route — not fetched here
  model: string;
  systemInstruction: string;
  voiceName: string;
  vad: GeminiLiveVad;
  onEvent: (event: GeminiLiveEvent) => void;
  dependencies?: GeminiLiveDependencies;
}

// §1.1: the ephemeral-token endpoint changes the method name to
// BidiGenerateContentConstrained and the query param to access_token
// (browser WebSocket() cannot set an Authorization header).
const LIVE_ENDPOINT =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";
const INPUT_AUDIO_MIME = "audio/pcm;rate=16000"; // §3.1
const OUTPUT_AUDIO_MIME = "audio/pcm;rate=24000"; // §4.1
const MAX_RECONNECT_ATTEMPTS = 3;

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** One Live session per client; reconnects with session resumption, no reconnect after close(). */
export class GeminiLiveClient {
  private socket: GeminiLiveSocket | null = null;
  private ready = false;
  private everReady = false;
  private closed = false;
  private connection: Promise<void> | null = null;
  private resolveConnection?: () => void;
  private rejectConnection?: (error: Error) => void;
  private reconnectAttempts = 0;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private resumptionHandle: string | null = null;
  private readonly webSocket: (url: string) => GeminiLiveSocket;
  private readonly now: () => number;
  private readonly backoffMs: (attempt: number) => number;

  constructor(private readonly options: GeminiLiveOptions) {
    this.webSocket = options.dependencies?.webSocket ?? ((url: string) => new WebSocket(url));
    this.now = options.dependencies?.now ?? (() => Date.now());
    this.backoffMs =
      options.dependencies?.backoffMs ?? ((attempt: number) => Math.min(10_000, 500 * 2 ** (attempt - 1)));
  }

  /** Resolves on the first setupComplete; rejects on token/setup failure after retries. */
  connect(): Promise<void> {
    if (this.closed) return Promise.reject(new Error("gemini-live closed"));
    if (this.connection) return this.connection;
    if (typeof this.options.token !== "string" || this.options.token.trim() === "") {
      this.emit({ type: "error", reason: "token-grant" });
      return Promise.reject(new Error("token-grant"));
    }
    this.connection = new Promise<void>((resolve, reject) => {
      this.resolveConnection = resolve;
      this.rejectConnection = reject;
    });
    this.openSocket();
    return this.connection;
  }

  sendAudio(pcm16Base64: string): void {
    if (this.closed || !this.ready) return;
    const socket = this.socket;
    if (!socket || socket.readyState !== 1) return;
    try {
      socket.send(JSON.stringify({ realtimeInput: { audio: { data: pcm16Base64, mimeType: INPUT_AUDIO_MIME } } }));
    } catch {
      // A dying socket is recovered by its own close event.
    }
  }

  /** Idempotent; stops the reconnect loop. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.clearReconnectTimer();
    const aborting = !this.everReady;
    this.dropSocket();
    if (this.rejectConnection) {
      const reject = this.rejectConnection;
      this.resolveConnection = undefined;
      this.rejectConnection = undefined;
      reject(new Error(aborting ? "aborted" : "closed"));
    }
    if (aborting) this.emit({ type: "error", reason: "aborted" });
  }

  private openSocket(): void {
    if (this.closed) return;
    try {
      const url = `${LIVE_ENDPOINT}?access_token=${encodeURIComponent(this.options.token)}`;
      const socket = this.webSocket(url);
      this.socket = socket;
      this.wire(socket);
    } catch {
      this.fail();
    }
  }

  private wire(socket: GeminiLiveSocket): void {
    // One termination per socket: an error is always followed by close, and a
    // goAway-triggered reconnect detaches the old socket's handlers itself.
    let terminated = false;
    const terminate = () => {
      if (terminated || this.closed) return;
      terminated = true;
      this.beginReconnect();
    };
    socket.onopen = () => {
      if (this.closed) return;
      // setup must be the first message; nothing else is sent before setupComplete (§2).
      socket.send(this.setupMessage());
    };
    socket.onmessage = ({ data }: { data: unknown }) => {
      if (this.closed || typeof data !== "string") return;
      let frame: unknown;
      try {
        frame = JSON.parse(data);
      } catch {
        return; // Live sends one JSON object per text frame; anything else is skipped.
      }
      this.handleFrame(frame);
    };
    socket.onerror = terminate;
    socket.onclose = terminate;
  }

  /** Exact field set per §2.1 — drift here is a setup rejection, not a client bug. */
  private setupMessage(): string {
    return JSON.stringify({
      setup: {
        model: this.options.model,
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: this.options.voiceName } } },
        },
        systemInstruction: { parts: [{ text: this.options.systemInstruction }] },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        realtimeInputConfig: { automaticActivityDetection: this.options.vad },
        sessionResumption: { handle: this.resumptionHandle }, // null fresh, latest handle on reconnect (§4.6)
        contextWindowCompression: { slidingWindow: { targetTokens: 8000 }, triggerTokens: 25000 },
      },
    });
  }

  private handleFrame(frame: unknown): void {
    const message = asObject(frame);
    if (!message) return;
    if (asObject(message.setupComplete)) {
      this.onSetupComplete();
      return;
    }
    const goAway = asObject(message.goAway);
    if (goAway && typeof goAway.timeLeft === "string") {
      this.emit({ type: "goaway", timeLeft: goAway.timeLeft });
      // §4.4/§5: goAway means the connection is about to terminate — reconnect
      // now, before the server closes it.
      this.beginReconnect();
      return;
    }
    const content = asObject(message.serverContent);
    if (content) {
      this.handleServerContent(content);
      return;
    }
    const resumption = asObject(message.sessionResumptionUpdate);
    if (resumption && typeof resumption.newHandle === "string" && resumption.newHandle) {
      // Internal state only; replayed as setup.sessionResumption.handle.
      this.resumptionHandle = resumption.newHandle;
    }
  }

  private handleServerContent(content: Record<string, unknown>): void {
    if (content.interrupted === true) {
      // Only signal (§4.2) — discarding queued playback is the integrator's job.
      this.emit({ type: "interrupted" });
    }
    const modelTurn = asObject(content.modelTurn);
    const parts = Array.isArray(modelTurn?.parts) ? modelTurn.parts : [];
    for (const part of parts) {
      const inline = asObject(asObject(part)?.inlineData);
      if (inline?.mimeType === OUTPUT_AUDIO_MIME && typeof inline.data === "string") {
        this.emit({ type: "audio-out", pcmBase64: inline.data });
      }
    }
    this.emitTranscript(content.outputTranscription, "output-transcript");
    this.emitTranscript(content.inputTranscription, "input-transcript");
    this.emitTranscript(content.interimInputTranscription, "interim-input-transcript");
    if (content.turnComplete === true && (content.interactionStatus === undefined || content.interactionStatus === "IDLE")) {
      // Extended-thinking models fire turnComplete per utterance while still
      // generating; only "IDLE" (or an absent status) means the turn ended.
      this.emit({ type: "turn-complete" });
    }
  }

  private emitTranscript(
    value: unknown,
    type: "output-transcript" | "input-transcript" | "interim-input-transcript",
  ): void {
    const text = asObject(value)?.text;
    if (typeof text === "string") this.emit({ type, text });
  }

  private onSetupComplete(): void {
    this.ready = true;
    this.everReady = true;
    this.reconnectAttempts = 0; // a healthy session gets a fresh reconnect budget
    this.resolveConnection?.();
    this.resolveConnection = undefined;
    this.rejectConnection = undefined;
    this.emit({ type: "ready" });
  }

  private beginReconnect(): void {
    if (this.closed) return;
    this.ready = false;
    this.dropSocket();
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.fail();
      return;
    }
    this.reconnectAttempts += 1;
    const attempt = this.reconnectAttempts;
    this.emit({ type: "reconnecting", attempt });
    // Backoff is measured on the injected clock; setTimeout is only a wake-up.
    const dueAtMs = this.now() + Math.max(0, this.backoffMs(attempt));
    this.scheduleReconnect(dueAtMs);
  }

  private scheduleReconnect(dueAtMs: number): void {
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      const remainingMs = dueAtMs - this.now();
      if (remainingMs > 0) {
        this.scheduleReconnect(dueAtMs);
        return;
      }
      if (!this.closed) this.openSocket();
    }, Math.max(0, dueAtMs - this.now()));
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== undefined) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private fail(): void {
    if (this.closed) return;
    this.closed = true;
    this.clearReconnectTimer();
    const reason: GeminiLiveFailure = this.everReady ? "socket" : "setup-rejected";
    this.dropSocket();
    if (this.rejectConnection) {
      const reject = this.rejectConnection;
      this.resolveConnection = undefined;
      this.rejectConnection = undefined;
      reject(new Error(reason));
    }
    this.emit({ type: "error", reason });
  }

  private dropSocket(): void {
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      try {
        socket.close();
      } catch {
        // Already closed.
      }
    }
  }

  private emit(event: GeminiLiveEvent): void {
    this.options.onEvent(event);
  }
}
