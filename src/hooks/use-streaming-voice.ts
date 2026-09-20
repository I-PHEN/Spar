"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DeepgramSttClient,
  type DeepgramSocket,
  type DeepgramSttEvent,
  type DeepgramSttFailure,
  type DeepgramSttOptions,
} from "../lib/providers/deepgram-stt";
import {
  MicrophoneStream,
  type MicrophoneStreamDependencies,
  type MicrophoneStreamOptions,
} from "../lib/voice/microphone-stream";
import { useVoiceRecognition } from "./use-voice";
import { DeepgramTtsClient, type DeepgramTtsOptions, type DeepgramTtsEvent } from "../lib/providers/deepgram-tts";
import { PcmPlayer, type PcmPlayerOptions, type PcmPlayerEvent } from "../lib/voice/pcm-player";
import { createPhraseChunker, type PhraseChunk, type PhraseChunker } from "../lib/voice/phrase-chunker";

const RECONNECT_BASE_MS = 250;
const RECONNECT_CAP_MS = 5_000;

export type StreamingVoiceFallbackReason = DeepgramSttFailure | "microphone";

export interface FinalizedVoiceTranscript {
  turnIndex: number;
  transcript: string;
  confidence: number;
}

export interface StreamingVoiceFallbackMetric {
  type: "fallback";
  roomId: string;
  reason: StreamingVoiceFallbackReason;
  /** Monotonic timestamp; the turn controller owns conversion to a turn offset. */
  timestampMs: number;
}

interface SttConnection {
  connect(): Promise<void>;
  sendAudio(chunk: Parameters<DeepgramSttClient["sendAudio"]>[0]): boolean;
  close(): void;
}

interface MicrophoneConnection {
  start(): Promise<void>;
  stop(): void;
}

export interface StreamingVoiceDependencies
  extends Pick<MicrophoneStreamDependencies, "mediaDevices" | "createAudioContext" | "createAudioWorkletNode" | "createWorkletUrl" | "revokeWorkletUrl"> {
  fetch?: (input: string, init: RequestInit) => Promise<Response>;
  createWebSocket?: (url: string, protocols: string[]) => DeepgramSocket;
  createSttClient?: (options: DeepgramSttOptions) => SttConnection;
  createMicrophoneStream?: (options: MicrophoneStreamOptions) => MicrophoneConnection;
  now?: () => number;
  random?: () => number;
  setTimer?: (callback: () => void, delayMs: number) => unknown;
  clearTimer?: (timer: unknown) => void;
}

export interface StreamingVoiceSessionOptions {
  roomId: string;
  region: "us" | "eu";
  onStartOfTurn?: (event: Extract<DeepgramSttEvent, { type: "StartOfTurn" }>) => void;
  onInterimTranscript?: (event: Extract<DeepgramSttEvent, { type: "interim" }>) => void;
  onEndOfTurn?: (event: FinalizedVoiceTranscript) => void;
  onFallback?: (reason: StreamingVoiceFallbackReason) => void;
  onPrimaryReady?: () => void;
  onListeningChange?: (listening: boolean) => void;
  onMetric?: (metric: StreamingVoiceFallbackMetric) => void;
  dependencies?: StreamingVoiceDependencies;
}

interface ActiveCapture {
  epoch: number;
  stt: SttConnection;
  microphone?: MicrophoneConnection;
}

/**
 * Browser-resource owner used by the React hook and by deterministic lifecycle
 * tests. One instance belongs to one mounted room.
 */
export class StreamingVoiceSession {
  private active?: ActiveCapture;
  private desired = false;
  private disposed = false;
  private epoch = 0;
  private fallbackActive = false;
  private reconnectAttempt = 0;
  private reconnectTimer: unknown;
  private startPromise?: Promise<void>;
  private readonly dependencies: StreamingVoiceDependencies;

  constructor(private readonly options: StreamingVoiceSessionOptions) {
    this.dependencies = options.dependencies ?? {};
  }

  start(): Promise<void> {
    if (this.disposed) return Promise.reject(new Error("Streaming voice session disposed"));
    if (this.desired && this.startPromise) return this.startPromise;
    this.desired = true;
    this.clearReconnect();
    this.startPromise = this.connect(++this.epoch);
    return this.startPromise;
  }

  stop(): void {
    this.desired = false;
    this.epoch += 1;
    this.clearReconnect();
    this.releaseActive();
    this.startPromise = undefined;
    this.reconnectAttempt = 0;
    this.fallbackActive = false;
    this.options.onListeningChange?.(false);
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
  }

  private async connect(epoch: number): Promise<void> {
    if (!this.desired || this.disposed || epoch !== this.epoch) return;
    const createStt = this.dependencies.createSttClient
      ?? ((options: DeepgramSttOptions) => new DeepgramSttClient(options));
    const stt = createStt({
      region: this.options.region,
      onEvent: (event) => this.acceptSttEvent(epoch, event),
      dependencies: {
        fetch: this.dependencies.fetch,
        createWebSocket: this.dependencies.createWebSocket,
        setTimer: this.dependencies.setTimer,
        clearTimer: this.dependencies.clearTimer,
      },
    });
    const capture: ActiveCapture = { epoch, stt };
    this.active = capture;
    let startingMicrophone = false;

    try {
      await stt.connect();
      if (!this.isCurrent(capture)) {
        stt.close();
        return;
      }

      const createMicrophone = this.dependencies.createMicrophoneStream
        ?? ((options: MicrophoneStreamOptions) => new MicrophoneStream(options));
      startingMicrophone = true;
      const microphone = createMicrophone({
        onChunk: (chunk) => {
          if (this.isCurrent(capture)) stt.sendAudio(chunk);
        },
        onError: () => this.fail(epoch, "microphone"),
        dependencies: {
          mediaDevices: this.dependencies.mediaDevices,
          createAudioContext: this.dependencies.createAudioContext,
          createAudioWorkletNode: this.dependencies.createAudioWorkletNode,
          createWorkletUrl: this.dependencies.createWorkletUrl,
          revokeWorkletUrl: this.dependencies.revokeWorkletUrl,
        },
      });
      capture.microphone = microphone;
      await microphone.start();
      if (!this.isCurrent(capture)) {
        microphone.stop();
        stt.close();
        return;
      }

      this.reconnectAttempt = 0;
      this.options.onListeningChange?.(true);
      if (this.fallbackActive) {
        this.fallbackActive = false;
        this.options.onPrimaryReady?.();
      }
    } catch {
      this.fail(epoch, startingMicrophone ? "microphone" : "socket-error");
    }
  }

  private acceptSttEvent(epoch: number, event: DeepgramSttEvent): void {
    if (!this.active || this.active.epoch !== epoch || !this.desired || this.disposed) return;
    switch (event.type) {
      case "StartOfTurn":
        this.options.onStartOfTurn?.(event);
        return;
      case "interim":
        this.options.onInterimTranscript?.(event);
        return;
      case "EndOfTurn":
        this.options.onEndOfTurn?.({
          turnIndex: event.turnIndex,
          transcript: event.transcript,
          confidence: event.confidence,
        });
        return;
      case "error":
        this.fail(epoch, event.reason);
        return;
      case "close":
        if (!event.intentional) this.fail(epoch, "socket-error");
    }
  }

  private fail(epoch: number, reason: StreamingVoiceFallbackReason): void {
    if (!this.active || this.active.epoch !== epoch || !this.desired || this.disposed) return;
    this.releaseActive();
    this.startPromise = undefined;
    this.options.onListeningChange?.(false);
    if (!this.fallbackActive) {
      this.fallbackActive = true;
      this.options.onFallback?.(reason);
      this.options.onMetric?.({
        type: "fallback",
        roomId: this.options.roomId,
        reason,
        timestampMs: (this.dependencies.now ?? (() => performance.now()))(),
      });
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (!this.desired || this.disposed || this.reconnectTimer !== undefined) return;
    const random = Math.max(0, Math.min(1, (this.dependencies.random ?? Math.random)()));
    const windowMs = Math.min(
      RECONNECT_CAP_MS,
      RECONNECT_BASE_MS * 2 ** Math.min(this.reconnectAttempt, 20),
    );
    this.reconnectAttempt += 1;
    const delayMs = Math.round(windowMs * (0.5 + random * 0.5));
    const setTimer = this.dependencies.setTimer ?? ((callback: () => void, delay: number) => setTimeout(callback, delay));
    this.reconnectTimer = setTimer(() => {
      this.reconnectTimer = undefined;
      if (!this.desired || this.disposed) return;
      this.startPromise = this.connect(++this.epoch);
    }, delayMs);
  }

  private isCurrent(capture: ActiveCapture): boolean {
    return this.active === capture && this.desired && !this.disposed && capture.epoch === this.epoch;
  }

  private releaseActive(): void {
    const active = this.active;
    this.active = undefined;
    if (!active) return;
    active.microphone?.stop();
    active.stt.close();
  }

  private clearReconnect(): void {
    if (this.reconnectTimer === undefined) return;
    const clearTimer = this.dependencies.clearTimer
      ?? ((timer: unknown) => clearTimeout(timer as ReturnType<typeof setTimeout>));
    clearTimer(this.reconnectTimer);
    this.reconnectTimer = undefined;
  }
}

interface BrowserSpeech {
  speak(text: string, callbacks: { onStart: () => void; onEnd: () => void; onError: () => void }): void;
  cancel(): void;
}

export interface StreamingSpeechDependencies {
  fetch?: StreamingVoiceDependencies["fetch"];
  createWebSocket?: StreamingVoiceDependencies["createWebSocket"];
  createTtsClient?: (options: DeepgramTtsOptions) => Pick<DeepgramTtsClient, "beginTurn" | "speak" | "flush" | "clear" | "close">;
  createPlayer?: (options: PcmPlayerOptions) => Pick<PcmPlayer, "start" | "enqueue" | "stop" | "reset">;
  createPlaybackContext?: NonNullable<PcmPlayerOptions["dependencies"]>["createAudioContext"];
  browserSpeech?: BrowserSpeech;
  now?: () => number;
  setTimer?: StreamingVoiceDependencies["setTimer"];
  clearTimer?: StreamingVoiceDependencies["clearTimer"];
}

export type StreamingSpeechEvent = DeepgramTtsEvent | PcmPlayerEvent | ({ turnId: string } & (
  | { type: "caption"; text: string }
  | { type: "browser-playback-start"; timestampMs: number }
  | { type: "first-tts-byte"; timestampMs: number }
  | { type: "fallback"; reason: "tts-unavailable"; timestampMs: number }
  | { type: "error"; reason: "playback-unavailable" | "browser-speech-unavailable" }
));

export interface StreamingSpeechOptions {
  roomId: string;
  region: "us" | "eu";
  onEvent?: (event: StreamingSpeechEvent) => void;
  dependencies?: StreamingSpeechDependencies;
}

interface SpeechTurn {
  turnId: string;
  model: string;
  chunker: PhraseChunker;
  phrases: PhraseChunk[];
  mode: "connecting" | "streaming" | "fallback" | "failed";
  started: boolean;
  firstByte: boolean;
  finalized: boolean;
  complete: boolean;
  sent: number;
  pendingBrowser: number;
  externalPhrases: boolean;
  releaseStartup?: () => void;
}

/** Speech output is independent of microphone capture and owns all room resources. */
export class StreamingSpeechSession {
  private readonly dependencies: StreamingSpeechDependencies;
  private readonly clients = new Map<string, ReturnType<NonNullable<StreamingSpeechDependencies["createTtsClient"]>>>();
  private readonly player: ReturnType<NonNullable<StreamingSpeechDependencies["createPlayer"]>>;
  private active?: SpeechTurn;
  private disposed = false;
  private token?: { value: string; expiresAt: number };
  private tokenPromise?: Promise<string>;
  private readonly abort = new AbortController();
  private audioDeadline: unknown;
  private browser?: BrowserSpeech;

  constructor(private readonly options: StreamingSpeechOptions) {
    this.dependencies = options.dependencies ?? {};
    this.player = (this.dependencies.createPlayer ?? (options => new PcmPlayer(options)))({
      onEvent: event => {
        const turn = this.active;
        if (!turn || event.turnId !== turn.turnId || (turn.mode !== "connecting" && turn.mode !== "streaming")) return;
        if (event.type === "playback-start") { turn.started = true; this.clearAudioDeadline(); }
        this.options.onEvent?.(event);
      },
      dependencies: { createAudioContext: this.dependencies.createPlaybackContext, now: this.dependencies.now },
    });
  }

  async begin(turnId: string, model: string): Promise<void> {
    if (this.disposed) return;
    if (this.active) this.cancel(this.active.turnId);
    const turn: SpeechTurn = { turnId, model, chunker: createPhraseChunker(), phrases: [], mode: "connecting",
      started: false, firstByte: false, finalized: false, complete: false, sent: 0, pendingBrowser: 0, externalPhrases: false };
    this.active = turn;
    const createClient = () => {
      let created!: ReturnType<NonNullable<StreamingSpeechDependencies["createTtsClient"]>>;
      created = (this.dependencies.createTtsClient ?? (options => new DeepgramTtsClient(options)))({
        region: this.options.region, model,
        onEvent: event => this.acceptTts(turn.model, created, event),
        dependencies: { getToken: () => this.getToken(), createWebSocket: this.dependencies.createWebSocket,
          setTimer: this.dependencies.setTimer, clearTimer: this.dependencies.clearTimer },
      });
      this.clients.set(model, created);
      return created;
    };
    let client = this.clients.get(model) ?? createClient();
    const cancelled = new Promise<void>(resolve => { turn.releaseStartup = resolve; });
    this.armAudioDeadline(turn);
    let replaced = false;
    while (true) {
      let ttsFailed = false;
      try {
        const ttsReady = client.beginTurn(turnId).catch(error => { ttsFailed = true; throw error; });
        await Promise.race([Promise.all([ttsReady, this.player.start(turnId)]), cancelled]);
        turn.releaseStartup = undefined;
        if (this.active !== turn || turn.mode !== "connecting") return;
        turn.mode = "streaming"; this.sendPending(turn);
        return;
      } catch {
        if (ttsFailed && !replaced && !turn.started && this.active === turn && turn.mode === "connecting") {
          client.close();
          if (this.clients.get(model) === client) this.clients.delete(model);
          client = createClient(); replaced = true;
          continue;
        }
        if (this.active === turn && turn.mode === "connecting") this.fallback(turn);
        return;
      }
    }
  }

  pushText(turnId: string, delta: string): void {
    const turn = this.active;
    if (!turn || turn.turnId !== turnId || turn.finalized || turn.externalPhrases) return;
    this.options.onEvent?.({ type: "caption", turnId, text: delta });
    for (const phrase of turn.chunker.push(delta)) this.queuePhrase(turn, phrase);
  }

  /** Alternative to pushText for the server's exact phrase-chunker output. */
  speakPhrase(turnId: string, phrase: PhraseChunk): void {
    const turn = this.active;
    if (!turn || turn.turnId !== turnId || turn.finalized) return;
    if (phrase.sequence !== turn.phrases.length) {
      this.fail(turn, "phrase-ordering");
      return;
    }
    turn.externalPhrases = true;
    this.options.onEvent?.({ type: "caption", turnId, text: phrase.text });
    this.queuePhrase(turn, phrase);
  }

  finish(turnId: string): void {
    const turn = this.active;
    if (!turn || turn.turnId !== turnId || turn.finalized) return;
    if (!turn.externalPhrases) for (const phrase of turn.chunker.flush().chunks) this.queuePhrase(turn, phrase);
    turn.finalized = true;
    if (turn.mode === "streaming") this.clients.get(turn.model)?.flush();
    if (turn.mode === "fallback") this.finishBrowser(turn);
  }

  cancel(turnId: string): void {
    const turn = this.active;
    if (!turn || turn.turnId !== turnId) return;
    this.active = undefined; turn.chunker.cancel(); this.clearAudioDeadline();
    turn.releaseStartup?.();
    this.player.stop(); this.browser?.cancel();
    if (turn.mode === "connecting") {
      this.clients.get(turn.model)?.close(); this.clients.delete(turn.model);
    } else if (!turn.complete) this.clients.get(turn.model)?.clear();
  }

  dispose(): void {
    if (this.active) this.cancel(this.active.turnId);
    this.disposed = true; this.abort.abort(); this.token = undefined;
    for (const client of this.clients.values()) client.close();
    this.clients.clear(); this.player.reset();
  }

  private queuePhrase(turn: SpeechTurn, phrase: PhraseChunk): void {
    if (phrase.sequence !== turn.phrases.length) {
      this.fail(turn, "phrase-ordering"); return;
    }
    turn.phrases.push(phrase);
    if (turn.mode === "streaming" || turn.mode === "fallback") this.sendPending(turn);
  }

  private sendPending(turn: SpeechTurn): void {
    while (turn.sent < turn.phrases.length && this.active === turn) {
      const phrase = turn.phrases[turn.sent++];
      if (turn.mode === "streaming") {
        this.armAudioDeadline(turn);
        if (!this.clients.get(turn.model)?.speak(phrase.text, phrase.sequence)) {
          if (turn.mode === "streaming") this.fallback(turn);
          return;
        }
      } else if (turn.mode === "fallback") this.speakBrowser(turn, phrase.text);
      else return;
    }
    if (turn.finalized && turn.mode === "streaming") this.clients.get(turn.model)?.flush();
  }

  private acceptTts(model: string, client: ReturnType<NonNullable<StreamingSpeechDependencies["createTtsClient"]>>, event: DeepgramTtsEvent): void {
    const turn = this.active;
    if (!turn || event.turnId !== turn.turnId || client !== this.clients.get(model) || (turn.mode !== "streaming" && turn.mode !== "connecting")) return;
    if (event.type === "error") {
      if (turn.started) this.fail(turn, event.reason);
      else this.fallback(turn);
    } else if (event.type === "audio") {
      if (!turn.firstByte) {
        turn.firstByte = true;
        this.options.onEvent?.({ type: "first-tts-byte", turnId: turn.turnId, timestampMs: this.now() });
      }
      this.options.onEvent?.(event);
      try {
        if (!this.player.enqueue(event)) throw new Error();
      } catch {
        if (turn.started) this.fail(turn, "playback-unavailable");
        else this.fallback(turn);
      }
    } else {
      turn.complete = true;
      this.options.onEvent?.(event);
    }
  }

  private fallback(turn: SpeechTurn): void {
    if (this.active !== turn || turn.mode === "fallback" || turn.mode === "failed") return;
    if (turn.started) { this.fail(turn, "playback-unavailable"); return; }
    turn.mode = "fallback"; this.clearAudioDeadline(); this.player.stop();
    turn.releaseStartup?.();
    this.clients.get(turn.model)?.close(); this.clients.delete(turn.model);
    this.options.onEvent?.({ type: "fallback", turnId: turn.turnId, reason: "tts-unavailable", timestampMs: this.now() });
    turn.sent = 0;
    this.sendPending(turn);
    this.finishBrowser(turn);
  }

  private speakBrowser(turn: SpeechTurn, text: string): void {
    turn.pendingBrowser++;
    try {
      this.browser ??= this.dependencies.browserSpeech ?? {
        speak: (text, callbacks) => {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.onstart = callbacks.onStart; utterance.onend = callbacks.onEnd; utterance.onerror = callbacks.onError;
          speechSynthesis.speak(utterance);
        },
        cancel: () => { if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel(); },
      };
      this.browser.speak(text, {
        onStart: () => {
          if (this.active !== turn || turn.mode !== "fallback" || turn.started) return;
          turn.started = true;
          // Browser synthesis exposes a real start event but no AudioContext clock.
          this.options.onEvent?.({ type: "browser-playback-start", turnId: turn.turnId, timestampMs: this.now() });
        },
        onEnd: () => {
          if (this.active !== turn || turn.mode !== "fallback") return;
          turn.pendingBrowser--; this.finishBrowser(turn);
        },
        onError: () => { if (this.active === turn && turn.mode === "fallback") this.fail(turn, "browser-speech-unavailable"); },
      });
    } catch { this.fail(turn, "browser-speech-unavailable"); }
  }

  private finishBrowser(turn: SpeechTurn): void {
    if (this.active === turn && turn.mode === "fallback" && turn.finalized && !turn.pendingBrowser && !turn.complete) {
      turn.complete = true;
      this.options.onEvent?.({ type: "complete", turnId: turn.turnId });
    }
  }

  private fail(turn: SpeechTurn, reason: Extract<StreamingSpeechEvent, { type: "error" }>["reason"]): void {
    if (this.active !== turn || turn.mode === "failed") return;
    turn.mode = "failed"; this.clearAudioDeadline(); this.player.stop(); this.browser?.cancel();
    turn.releaseStartup?.();
    this.clients.get(turn.model)?.close(); this.clients.delete(turn.model);
    this.options.onEvent?.({ type: "error", turnId: turn.turnId, reason });
  }

  private armAudioDeadline(turn: SpeechTurn): void {
    if (turn.started || this.audioDeadline !== undefined) return;
    const setTimer = this.dependencies.setTimer ?? ((callback, delay) => setTimeout(callback, delay));
    this.audioDeadline = setTimer(() => {
      this.audioDeadline = undefined;
      if (this.active === turn && !turn.started) this.fallback(turn);
    }, 10_000);
  }

  private clearAudioDeadline(): void {
    if (this.audioDeadline !== undefined) {
      (this.dependencies.clearTimer ?? (timer => clearTimeout(timer as ReturnType<typeof setTimeout>)))(this.audioDeadline);
      this.audioDeadline = undefined;
    }
  }

  private now(): number { return (this.dependencies.now ?? (() => performance.now()))(); }

  private getToken(): Promise<string> {
    if (this.token && this.token.expiresAt > this.now()) return Promise.resolve(this.token.value);
    if (this.tokenPromise) return this.tokenPromise;
    this.tokenPromise = (async () => {
      try {
        const response = await (this.dependencies.fetch ?? fetch)("/api/deepgram-token", {
          method: "POST", credentials: "same-origin", cache: "no-store", signal: this.abort.signal,
        });
        if (!response.ok) throw new Error();
        const grant = await response.json() as { accessToken?: unknown; expiresIn?: unknown };
        if (typeof grant.accessToken !== "string" || !grant.accessToken.trim() || typeof grant.expiresIn !== "number" || !Number.isFinite(grant.expiresIn) || grant.expiresIn <= 0 || this.disposed) throw new Error();
        this.token = { value: grant.accessToken, expiresAt: this.now() + Math.max(0, grant.expiresIn - 5) * 1000 };
        return grant.accessToken;
      } catch { throw new Error("token-grant"); }
      finally { this.tokenPromise = undefined; }
    })();
    return this.tokenPromise;
  }
}

export type UseStreamingVoiceOptions = StreamingVoiceSessionOptions & {
  speechDependencies?: StreamingSpeechDependencies;
  onSpeechEvent?: (event: StreamingSpeechEvent) => void;
};

export interface UseStreamingVoiceResult {
  isSupported: boolean;
  isListening: boolean;
  interimTranscript: string;
  finalTranscript: string;
  finalizedTranscript: FinalizedVoiceTranscript | null;
  error: string | null;
  usingFallback: boolean;
  start: () => void;
  stop: () => void;
  reset: () => void;
  beginSpeech: (turnId: string, model: string) => Promise<void>;
  pushSpeechText: (turnId: string, text: string) => void;
  speakPhrase: (turnId: string, phrase: PhraseChunk) => void;
  finishSpeech: (turnId: string) => void;
  cancelSpeech: (turnId: string) => void;
}

export interface StreamingVoiceCapabilities {
  webSocket: boolean;
  mediaDevices: boolean;
  audioContext: boolean;
}

export function isStreamingVoiceSupported(
  capabilities: StreamingVoiceCapabilities,
  webSpeechSupported: boolean,
): boolean {
  return webSpeechSupported
    || (capabilities.webSocket && capabilities.mediaDevices && capabilities.audioContext);
}

export interface StreamingVoiceHookRuntime {
  useCallback: typeof useCallback;
  useEffect: typeof useEffect;
  useRef: typeof useRef;
  useState: typeof useState;
}

type VoiceRecognitionHook = typeof useVoiceRecognition;

/**
 * Room-scoped Flux transcription with the existing Web Speech hook as its
 * operational fallback. Task 9 supplies turn-controller callbacks.
 */
export function createStreamingVoiceHook(
  runtime: StreamingVoiceHookRuntime,
  useFallbackVoice: VoiceRecognitionHook,
): (options: UseStreamingVoiceOptions) => UseStreamingVoiceResult {
  return function useStreamingVoiceWithRuntime(options): UseStreamingVoiceResult {
    const webSpeech = useFallbackVoice();
    const callbacks = runtime.useRef(options);
    const sessionRef = runtime.useRef<StreamingVoiceSession | null>(null);
    const speechRef = runtime.useRef<StreamingSpeechSession | null>(null);
    const [primaryListening, setPrimaryListening] = runtime.useState(false);
    const [interimTranscript, setInterimTranscript] = runtime.useState("");
    const [finalizedTranscript, setFinalizedTranscript] = runtime.useState<FinalizedVoiceTranscript | null>(null);
    const [usingFallback, setUsingFallback] = runtime.useState(false);
    const [error, setError] = runtime.useState<string | null>(null);

    const webSpeechStart = webSpeech.start;
    const webSpeechStop = webSpeech.stop;
    const webSpeechReset = webSpeech.reset;

    runtime.useEffect(() => {
      callbacks.current = options;
    });

    runtime.useEffect(() => {
      setPrimaryListening(false);
      setInterimTranscript("");
      setFinalizedTranscript(null);
      setUsingFallback(false);
      setError(null);
      webSpeechReset();
      const session = new StreamingVoiceSession({
        roomId: options.roomId,
        region: options.region,
        dependencies: options.dependencies,
        onStartOfTurn: (event) => {
          setInterimTranscript("");
          callbacks.current.onStartOfTurn?.(event);
        },
        onInterimTranscript: (event) => {
          setInterimTranscript(event.transcript);
          callbacks.current.onInterimTranscript?.(event);
        },
        onEndOfTurn: (event) => {
          setInterimTranscript("");
          setFinalizedTranscript(event);
          callbacks.current.onEndOfTurn?.(event);
        },
        onFallback: (reason) => {
          setUsingFallback(true);
          setError(`Streaming transcription unavailable (${reason}); using browser speech recognition.`);
          webSpeechStart();
          callbacks.current.onFallback?.(reason);
        },
        onPrimaryReady: () => {
          webSpeechStop();
          setUsingFallback(false);
          setError(null);
          callbacks.current.onPrimaryReady?.();
        },
        onListeningChange: (listening) => {
          setPrimaryListening(listening);
          callbacks.current.onListeningChange?.(listening);
        },
        onMetric: (metric) => callbacks.current.onMetric?.(metric),
      });
      sessionRef.current = session;
      const speech = new StreamingSpeechSession({ roomId: options.roomId, region: options.region,
        dependencies: options.speechDependencies, onEvent: event => callbacks.current.onSpeechEvent?.(event) });
      speechRef.current = speech;
      return () => {
        speech.dispose();
        speechRef.current = null;
        session.dispose();
        sessionRef.current = null;
        webSpeechStop();
      };
    }, [options.roomId, options.region, webSpeechStart, webSpeechStop, webSpeechReset]);

    const start = runtime.useCallback(() => {
      setError(null);
      void sessionRef.current?.start();
    }, []);

    const stop = runtime.useCallback(() => {
      sessionRef.current?.stop();
      webSpeechStop();
      setPrimaryListening(false);
      setUsingFallback(false);
    }, [webSpeechStop]);

    const reset = runtime.useCallback(() => {
      setInterimTranscript("");
      setFinalizedTranscript(null);
      setError(null);
      webSpeechReset();
    }, [webSpeechReset]);

    const dependencies = options.dependencies;
    const injectedPrimary = !!(dependencies?.createSttClient && dependencies.createMicrophoneStream);
    const capabilities: StreamingVoiceCapabilities = {
      webSocket: injectedPrimary || typeof WebSocket !== "undefined",
      mediaDevices: injectedPrimary
        || !!dependencies?.mediaDevices
        || (typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia),
      audioContext: injectedPrimary
        || !!dependencies?.createAudioContext
        || typeof AudioContext !== "undefined",
    };

    return {
      isSupported: isStreamingVoiceSupported(capabilities, webSpeech.isSupported),
      isListening: usingFallback ? webSpeech.isListening : primaryListening,
      interimTranscript: usingFallback ? webSpeech.interimTranscript : interimTranscript,
      finalTranscript: usingFallback ? webSpeech.finalTranscript : (finalizedTranscript?.transcript ?? ""),
      finalizedTranscript,
      error: usingFallback ? (webSpeech.error ?? error) : error,
      usingFallback,
      start,
      stop,
      reset,
      beginSpeech: (turnId, model) => speechRef.current?.begin(turnId, model) ?? Promise.resolve(),
      pushSpeechText: (turnId, text) => speechRef.current?.pushText(turnId, text),
      speakPhrase: (turnId, phrase) => speechRef.current?.speakPhrase(turnId, phrase),
      finishSpeech: turnId => speechRef.current?.finish(turnId),
      cancelSpeech: turnId => speechRef.current?.cancel(turnId),
    };
  };
}

export const useStreamingVoice = createStreamingVoiceHook(
  { useCallback, useEffect, useRef, useState },
  useVoiceRecognition,
);
