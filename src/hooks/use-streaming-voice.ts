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
    const exponential = RECONNECT_BASE_MS * 2 ** Math.min(this.reconnectAttempt, 20);
    this.reconnectAttempt += 1;
    const delayMs = Math.min(RECONNECT_CAP_MS, Math.round(exponential * (0.5 + random)));
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

export type UseStreamingVoiceOptions = StreamingVoiceSessionOptions;

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
      return () => {
        session.dispose();
        sessionRef.current = null;
        webSpeechStop();
      };
    }, [options.roomId, options.region, webSpeechStart, webSpeechStop]);

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
    };
  };
}

export const useStreamingVoice = createStreamingVoiceHook(
  { useCallback, useEffect, useRef, useState },
  useVoiceRecognition,
);
