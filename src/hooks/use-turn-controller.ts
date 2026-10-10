"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LivePersona, LiveTurnEvent, LiveTurnRequest } from "../lib/spar/live-turn-service";
import type { TurnMetricEvent } from "../lib/observability/turn-metrics";
import type { DeepgramSttEvent } from "../lib/providers/deepgram-stt";
import type { PhraseChunk } from "../lib/voice/phrase-chunker";
import { PERSONA_VOICES } from "../lib/providers/deepgram-tts";
import { initialTurnState, reduceTurn, type TurnEffect, type TurnEvent, type TurnState } from "../lib/voice/turn-state";
import { useStreamingVoice, type StreamingSpeechEvent, type StreamingVoiceDependencies, type StreamingSpeechDependencies, type StreamingVoiceFallbackMetric } from "./use-streaming-voice";
import { useLiveVoice, type LiveEngineMetricEvent, type LiveVoiceConfig, type LiveVoiceDependencies, type LiveVoiceHook, type LiveVoiceStatus } from "./use-live-voice";

export interface TurnControllerMessage {
  id: string;
  messageId?: string;
  turnId: string;
  role: "user" | "assistant";
  content: string;
  persona?: LivePersona;
  metadata?: Extract<LiveTurnEvent, { type: "complete" }>["metadata"];
}

export interface TurnControllerSnapshot {
  turn: TurnState;
  transcriptPreview: string;
  assistantCaption: string;
  messages: TurnControllerMessage[];
  error: string | null;
  usingSttFallback: boolean;
  usingTtsFallback: boolean;
  activePersona: LivePersona | null;
  assistantMetadata: TurnControllerMessage["metadata"] | null;
}

export interface TurnControllerDependencies {
  streamTurn(request: LiveTurnRequest, signal: AbortSignal): AsyncIterable<LiveTurnEvent>;
  beginSpeech(turnId: string, model: string): Promise<void>;
  speakPhrase(turnId: string, phrase: PhraseChunk): void;
  finishSpeech(turnId: string): void;
  cancelGeneration(turnId: string): void;
  invalidatePhraseQueue(turnId: string): void;
  resetPhraseQueue(turnId: string): void;
  stopAudio(turnId: string): void;
  clearTts(turnId: string): void;
  beginListening(turnId: string): void;
  recordMetric(metric: TurnMetricEvent): Promise<void>;
  now(): number;
  createLifecycleId?(): string;
}

type SttTurnEvent =
  | { type: "StartOfTurn"; turnIndex?: number; transcript: string; confidence?: number }
  | { type: "interim"; turnIndex?: number; transcript: string; confidence?: number }
  | { type: "EndOfTurn"; turnIndex?: number; transcript: string; confidence: number };

/** Truncates by code units without splitting a surrogate pair at the cut. */
function truncateWellFormed(value: string, limit: number): string {
  const sliced = value.slice(0, limit);
  const last = sliced.charCodeAt(sliced.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? sliced.slice(0, -1) : sliced;
}

export class LiveTurnController {
  private turn: TurnState;
  private snapshot: TurnControllerSnapshot;
  private listeners = new Set<(snapshot: TurnControllerSnapshot) => void>();
  private generation?: { turnId: string; abort: AbortController };
  private disposed = false;
  private turnStartedAt = 0;
  private activeVoiceModel: string;
  private submittedCurrentTurn = false;
  private requestOptions: TurnRequestOptions = {};
  private lastSttTurnIndex = -1;
  private cancelledTurns = new Set<string>();
  /** Live turns that received turn-complete; cleanup must not mark them cancelled. */
  private liveFinalizedTurns = new Set<string>();
  private metricWrites = Promise.resolve();

  constructor(
    private readonly sessionId: string,
    private readonly voiceModel: string,
    private readonly dependencies: TurnControllerDependencies,
  ) {
    this.activeVoiceModel = voiceModel;
    const lifecycleId = dependencies.createLifecycleId?.() || "";
    const prefix = lifecycleId ? `${truncateWellFormed(sessionId, 80)}:${lifecycleId.slice(0, 36)}` : sessionId;
    this.turn = initialTurnState(sessionId, prefix);
    this.snapshot = {
      turn: this.turn,
      transcriptPreview: "",
      assistantCaption: "",
      messages: [],
      error: null,
      usingSttFallback: false,
      usingTtsFallback: false,
      activePersona: null,
      assistantMetadata: null,
    };
  }

  getSnapshot(): TurnControllerSnapshot { return this.snapshot; }

  subscribe(listener: (snapshot: TurnControllerSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  private publish(patch: Partial<TurnControllerSnapshot> = {}): void {
    this.snapshot = { ...this.snapshot, ...patch, turn: this.turn };
    for (const listener of this.listeners) listener(this.snapshot);
  }

  async acceptStt(event: SttTurnEvent): Promise<void> {
    if (this.disposed) return;
    if (event.type === "interim") {
      this.publish({ transcriptPreview: event.transcript });
      return;
    }
    if (event.type === "StartOfTurn") {
      if (event.turnIndex !== undefined && event.turnIndex <= this.lastSttTurnIndex) return;
      if (event.turnIndex !== undefined) this.lastSttTurnIndex = event.turnIndex;
      this.submittedCurrentTurn = false;
      this.requestOptions = {};
      await this.dispatch({ type: "StartOfTurn", turnId: this.turn.turnId });
      this.turnStartedAt = this.dependencies.now();
      this.publish({ transcriptPreview: event.transcript, assistantCaption: "", assistantMetadata: null, error: null, usingTtsFallback: false });
      return;
    }
    this.turnStartedAt = this.dependencies.now();
    this.publish({ transcriptPreview: event.transcript });
    await this.dispatch({ type: "EndOfTurn", turnId: this.turn.turnId }, { transcript: event.transcript, confidence: event.confidence });
  }

  queuePrimaryEndOfTurn(requestOptions: TurnRequestOptions = {}): void {
    this.requestOptions = requestOptions;
  }

  async finalizeFallbackTranscript(
    transcript: string,
    confidence = 1,
    requestOptions: TurnRequestOptions = {},
  ): Promise<void> {
    if (!this.snapshot.usingSttFallback) return;
    await this.submitManualTranscript(transcript, confidence, requestOptions);
  }

  async submitPresentationTurn(transcript: string, alreadyPersisted: boolean, requestOptions: TurnRequestOptions = {}): Promise<void> {
    await this.submitManualTranscript(transcript, 1, { ...requestOptions, presentationHandoff: alreadyPersisted });
  }

  private async submitManualTranscript(transcript: string, confidence: number, requestOptions: TurnRequestOptions): Promise<void> {
    if (this.submittedCurrentTurn) return;
    this.requestOptions = requestOptions;
    if (this.turn.status !== "listening") await this.acceptStt({ type: "StartOfTurn", transcript: "" });
    this.requestOptions = requestOptions;
    await this.acceptStt({ type: "EndOfTurn", transcript, confidence });
  }

  acceptServerEvent(event: LiveTurnEvent): void {
    if (this.disposed || event.turnId !== this.turn.turnId) return;
    if (event.type === "turn-start") {
      this.publish({ activePersona: event.persona });
      const voice = PERSONA_VOICES[event.persona.archetype as keyof typeof PERSONA_VOICES] ?? this.voiceModel;
      this.activeVoiceModel = voice;
      void this.dependencies.beginSpeech(event.turnId, voice);
    } else if (event.type === "text-delta") {
      void this.dispatch({ type: "GenerationDelta", turnId: event.turnId, text: event.text });
    } else if (event.type === "phrase") {
      void this.dispatch({ type: "PhraseReady", turnId: event.turnId, phrase: event.phrase });
    } else if (event.type === "metric") {
      // Server milestones are already persisted by the service. The identity
      // guard above is still the stale-event boundary; do not write duplicates.
      return;
    } else if (event.type === "fallback") {
      // The fallback provider restarts the phrase stream within the same turn;
      // trim the discarded queue without permanently invalidating speech.
      this.dependencies.resetPhraseQueue(event.turnId);
      this.publish({ assistantCaption: "" });
    } else if (event.type === "complete") {
      if (!this.snapshot.messages.some(message => message.messageId === event.messageId)) {
        this.publish({ messages: [...this.snapshot.messages, {
          id: `assistant:${event.turnId}`, messageId: event.messageId, turnId: event.turnId,
          role: "assistant", content: event.text, persona: this.snapshot.activePersona ?? undefined, metadata: event.metadata,
        }] });
      }
      this.publish({ assistantMetadata: event.metadata });
      void this.dispatch({ type: "GenerationComplete", turnId: event.turnId });
    } else if (event.type === "error") {
      this.publish({ error: event.message });
      void this.dispatch({ type: "Error", turnId: event.turnId, error: event.code });
    }
  }

  acceptSpeechEvent(event: StreamingSpeechEvent): void {
    if (this.disposed || event.turnId !== this.turn.turnId) return;
    if (event.type === "audio") {
      void this.dispatch({ type: "AudioFrame", turnId: event.turnId, sequence: event.sequence, audio: event.audio });
    } else if (event.type === "playback-start") {
      void this.dispatch({ type: "PlaybackStarted", turnId: event.turnId });
      void this.recordBrowserMetric({ type: "first-playback", turnId: event.turnId, sessionId: this.sessionId, offsetMs: this.offset() });
    } else if (event.type === "drained") {
      void this.dispatch({ type: "PlaybackDrained", turnId: event.turnId, sequence: event.sequence });
    } else if (event.type === "complete") {
      void this.dispatch({ type: "AudioComplete", turnId: event.turnId });
    } else if (event.type === "first-tts-byte") {
      void this.recordBrowserMetric({ type: "first-tts-byte", turnId: event.turnId, sessionId: this.sessionId,
        offsetMs: this.offset(), provider: "deepgram", model: this.activeVoiceModel });
    } else if (event.type === "browser-playback-start") {
      void this.dispatch({ type: "PlaybackStarted", turnId: event.turnId });
      void this.recordBrowserMetric({ type: "first-playback", turnId: event.turnId, sessionId: this.sessionId, offsetMs: this.offset() });
    } else if (event.type === "fallback") {
      this.publish({ usingTtsFallback: true });
      void this.recordBrowserMetric({ type: "fallback", turnId: event.turnId, sessionId: this.sessionId, reason: event.reason });
    } else if (event.type === "error") {
      this.publish({ error: event.reason });
      void this.dispatch({ type: "Error", turnId: event.turnId, error: event.reason });
    }
  }

  setSttFallback(value: boolean): void { this.publish({ usingSttFallback: value }); }

  /**
   * STT fallback metrics are room-scoped; attribute them to the current turn
   * so socket-error and microphone fallbacks reach /api/turn-metrics like the
   * other browser milestones.
   */
  recordVoiceFallback(metric: StreamingVoiceFallbackMetric): void {
    if (this.disposed) return;
    void this.queueMetric({ type: "fallback", turnId: this.turn.turnId, sessionId: this.sessionId, reason: metric.reason });
  }

  /**
   * Gemini Live engine lifecycle: the Live socket — not streamTurn — owns
   * generation, so turns are registered here and driven by the caption/audio
   * callbacks below. StartOfTurn allocates the next id synchronously inside
   * dispatch (the reducer runs before any await), so the return value is
   * already the fresh turnId.
   */
  registerLiveTurn(): string {
    if (this.disposed) return this.turn.turnId;
    void this.dispatch({ type: "StartOfTurn", turnId: this.turn.turnId });
    return this.turn.turnId;
  }

  cancelLiveTurn(turnId: string): void {
    if (this.disposed || turnId !== this.turn.turnId) return;
    void this.dispatch({ type: "Cancel", turnId });
  }

  /** `turn-complete`: the live turn finished cleanly, so its later cleanup is not a cancellation. */
  completeLiveTurn(turnId: string): void {
    if (this.disposed || turnId !== this.turn.turnId) return;
    this.liveFinalizedTurns.add(turnId);
  }

  acceptLiveUserInterim(text: string): void {
    if (this.disposed) return;
    this.publish({ transcriptPreview: text });
  }

  acceptLiveUserFinal(text: string): void {
    if (this.disposed || !text.trim()) return;
    const turnId = this.turn.turnId;
    if (this.snapshot.messages.some(message => message.id === `user:${turnId}`)) return;
    this.publish({ transcriptPreview: text, messages: [...this.snapshot.messages, {
      id: `user:${turnId}`, turnId, role: "user", content: text,
    }] });
  }

  acceptLiveAssistantCaption(turnId: string, text: string): void {
    if (this.disposed || turnId !== this.turn.turnId) return;
    this.publish({ assistantCaption: text });
  }

  /** Live-engine metrics ride the same queueMetric path as browser milestones. */
  recordLiveEngineEvent(event: LiveEngineMetricEvent): void {
    if (this.disposed) return;
    void this.queueMetric({
      type: "live-engine",
      turnId: this.turn.turnId,
      sessionId: this.sessionId,
      ...event,
      // firstLiveAudioMs is int-strict on the metrics route; round at the queue boundary.
      ...(event.firstLiveAudioMs === undefined ? {} : { firstLiveAudioMs: Math.max(0, Math.round(event.firstLiveAudioMs)) }),
    });
  }

  networkLost(message = "Network connection lost."): void {
    if (this.disposed) return;
    this.publish({ error: message });
    void this.dispatch({ type: "Error", turnId: this.turn.turnId, error: "network-loss" });
  }

  dispose(): void {
    if (this.disposed) return;
    if (["listening", "finalizing", "generating", "speaking"].includes(this.turn.status)) {
      void this.dispatch({ type: "Cancel", turnId: this.turn.turnId });
    }
    this.disposed = true;
    this.listeners.clear();
  }

  private offset(): number { return Math.max(0, this.dependencies.now() - this.turnStartedAt); }

  private async recordBrowserMetric(metric: TurnMetricEvent): Promise<void> {
    if (metric.turnId !== this.turn.turnId || this.disposed) return;
    await this.queueMetric(metric);
  }

  private queueMetric(metric: TurnMetricEvent): Promise<void> {
    this.metricWrites = this.metricWrites.then(() => this.dependencies.recordMetric(metric)).catch(() => {});
    return this.metricWrites;
  }

  private async dispatch(event: TurnEvent, frozen?: { transcript: string; confidence: number }): Promise<void> {
    if (this.disposed || event.turnId !== this.turn.turnId) return;
    const reduction = reduceTurn(this.turn, event);
    this.turn = reduction.state;
    this.publish();
    for (const effect of reduction.effects) await this.execute(effect, frozen);
  }

  private async execute(effect: TurnEffect, frozen?: { transcript: string; confidence: number }): Promise<void> {
    switch (effect.type) {
      case "begin-listening":
        this.dependencies.beginListening(effect.turnId);
        return;
      case "freeze-transcript": {
        const transcript = frozen?.transcript.trim() ?? this.snapshot.transcriptPreview.trim();
        if (transcript && !this.requestOptions.presentationHandoff) this.publish({ messages: [...this.snapshot.messages, {
          id: `user:${effect.turnId}`, turnId: effect.turnId, role: "user", content: transcript,
        }] });
        this.submittedCurrentTurn = true;
        await this.recordBrowserMetric({ type: "transcript-finalized", turnId: effect.turnId, sessionId: this.sessionId,
          offsetMs: this.offset(), confidence: frozen?.confidence ?? 0 });
        await this.dispatch({ type: "TranscriptFrozen", turnId: effect.turnId, transcript }, frozen);
        return;
      }
      case "start-generation":
        await this.startGeneration(effect.turnId, effect.transcript, frozen?.confidence ?? 0);
        return;
      case "append-text":
        this.publish({ assistantCaption: this.snapshot.assistantCaption + effect.text });
        return;
      case "flush-phrases":
        await this.dispatch({ type: "PhrasesFinalized", turnId: effect.turnId });
        return;
      case "synthesize-phrase":
        this.dependencies.speakPhrase(effect.turnId, effect.phrase);
        return;
      case "finalize-tts":
        this.dependencies.finishSpeech(effect.turnId);
        return;
      case "queue-audio":
        return;
      case "record-metric":
        await this.recordBrowserMetric(effect.metric);
        return;
      case "abort-generation":
        if (this.generation?.turnId === effect.turnId) this.generation.abort.abort();
        this.dependencies.cancelGeneration(effect.turnId);
        if (!this.cancelledTurns.has(effect.turnId) && !this.liveFinalizedTurns.has(effect.turnId)) {
          this.cancelledTurns.add(effect.turnId);
          void this.queueMetric({ type: "cancelled", turnId: effect.turnId, sessionId: this.sessionId, offsetMs: this.offset() });
        }
        return;
      case "clear-queued-text":
        this.dependencies.invalidatePhraseQueue(effect.turnId);
        this.publish({ assistantCaption: "" });
        return;
      case "stop-playback":
        this.dependencies.stopAudio(effect.turnId);
        return;
      case "reset-tts":
        this.dependencies.clearTts(effect.turnId);
        return;
    }
  }

  private async startGeneration(turnId: string, transcript: string, confidence: number): Promise<void> {
    this.publish({ assistantMetadata: this.requestOptions.isInterrupt || this.requestOptions.drillInterrupt
      ? { type: "interruption", claimRef: null, mood: "pressing" }
      : null });
    const abort = new AbortController();
    this.generation = { turnId, abort };
    try {
      for await (const event of this.dependencies.streamTurn({
        sessionId: this.sessionId, turnId, transcript, confidence, ...this.requestOptions,
      }, abort.signal)) {
        if (abort.signal.aborted || this.disposed || turnId !== this.turn.turnId) return;
        this.acceptServerEvent(event);
      }
    } catch (error) {
      if (!abort.signal.aborted && !this.disposed && turnId === this.turn.turnId) {
        this.networkLost(error instanceof Error ? error.message : "Network connection lost.");
      }
    } finally {
      if (this.generation?.turnId === turnId) this.generation = undefined;
    }
  }
}

type TurnRequestOptions = Partial<Pick<LiveTurnRequest, "forcedPersonaId" | "isInterrupt" | "drillInterrupt" | "drillClean" | "presentationHandoff">>;

export function createTurnController(sessionId: string, voiceModel: string, dependencies: TurnControllerDependencies): LiveTurnController {
  return new LiveTurnController(sessionId, voiceModel, dependencies);
}

async function* fetchTurn(request: LiveTurnRequest, signal: AbortSignal): AsyncIterable<LiveTurnEvent> {
  const { sessionId, ...payload } = request;
  const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/spar-stream`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal,
  });
  if (!response.ok || !response.body) throw new Error("Spar stream failed.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const data = frame.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
        if (data) yield JSON.parse(data) as LiveTurnEvent;
      }
      if (done) return;
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export interface UseTurnControllerOptions {
  sessionId: string;
  voiceModel: string;
  voiceDependencies?: StreamingVoiceDependencies;
  speechDependencies?: StreamingSpeechDependencies;
  /** Engine selection: configure to try Gemini Live first; absent keeps the cascade primary. */
  live?: LiveVoiceConfig & { dependencies?: LiveVoiceDependencies };
}

export interface UseTurnControllerResult extends TurnControllerSnapshot {
  isSupported: boolean;
  isListening: boolean;
  startListening(): void;
  finalTranscript: string;
  interimTranscript: string;
  start(): void;
  stop(): void;
  reset(): void;
  finishInput(requestOptions?: TurnRequestOptions): Promise<void>;
  submitPresentationTurn(transcript: string, alreadyPersisted: boolean, requestOptions?: TurnRequestOptions): Promise<void>;
  cancel(): void;
  /** Active rung of the voice engine ladder; "fallback" when Live is not configured. */
  liveEngineStatus: LiveVoiceStatus;
}

export interface TurnControllerHookRuntime {
  useCallback: typeof useCallback;
  useEffect: typeof useEffect;
  useRef: typeof useRef;
  useState: typeof useState;
}

type StreamingVoiceHook = typeof useStreamingVoice;

/** Live hook stand-in for two-argument composition: engine ladder rests on the cascade. */
const cascadeOnlyLiveHook: LiveVoiceHook = () => ({ status: "fallback", start: () => Promise.resolve(), stop: () => {} });

/**
 * Built from injectable React hooks and streaming-voice hook so deterministic
 * lifecycle tests can host the full controller wiring without a DOM.
 */
export function createTurnControllerHook(
  runtime: TurnControllerHookRuntime,
  useStreamingVoiceHook: StreamingVoiceHook,
  useLiveVoiceHook: LiveVoiceHook = cascadeOnlyLiveHook,
): (options: UseTurnControllerOptions) => UseTurnControllerResult {
  return function useTurnControllerWithRuntime(options): UseTurnControllerResult {
    const controllerRef = runtime.useRef<LiveTurnController | null>(null);
    const [snapshot, setSnapshot] = runtime.useState<TurnControllerSnapshot>(() => ({
      turn: initialTurnState(options.sessionId), transcriptPreview: "", assistantCaption: "", messages: [],
      error: null, usingSttFallback: false, usingTtsFallback: false,
      activePersona: null, assistantMetadata: null,
    }));
    const voice = useStreamingVoiceHook({
      roomId: options.sessionId, dependencies: options.voiceDependencies,
      speechDependencies: options.speechDependencies,
      onStartOfTurn: event => { void controllerRef.current?.acceptStt(event); },
      onInterimTranscript: event => { void controllerRef.current?.acceptStt(event); },
      onEndOfTurn: event => {
        const accepted = controllerRef.current?.acceptStt({ type: "EndOfTurn", turnIndex: event.turnIndex, transcript: event.transcript, confidence: event.confidence });
        voiceRef.current.stop();
        void accepted;
      },
      onFallback: () => controllerRef.current?.setSttFallback(true),
      onPrimaryReady: () => controllerRef.current?.setSttFallback(false),
      onSpeechEvent: event => controllerRef.current?.acceptSpeechEvent(event),
      onMetric: metric => { void controllerRef.current?.recordVoiceFallback(metric); },
    });
    const voiceRef = runtime.useRef(voice);
    runtime.useEffect(() => { voiceRef.current = voice; }, [voice]);
    const liveConfiguredRef = runtime.useRef(!!options.live);
    const liveVoice = useLiveVoiceHook(options.live ? {
      sessionId: options.sessionId,
      mode: options.live.mode,
      persona: options.live.persona,
      scenarioLabel: options.live.scenarioLabel,
      claims: options.live.claims,
      otherPanelists: options.live.otherPanelists,
      dependencies: options.live.dependencies,
      onUserInterim: text => controllerRef.current?.acceptLiveUserInterim(text),
      onUserFinal: text => controllerRef.current?.acceptLiveUserFinal(text),
      onAssistantCaption: (turnId, text) => controllerRef.current?.acceptLiveAssistantCaption(turnId, text),
      onRegisterTurn: () => controllerRef.current?.registerLiveTurn() ?? "",
      onCancelTurn: turnId => controllerRef.current?.cancelLiveTurn(turnId),
      onCompleteTurn: turnId => controllerRef.current?.completeLiveTurn(turnId),
      onMetric: event => controllerRef.current?.recordLiveEngineEvent(event),
      onFallback: () => voiceRef.current.start(),
    } : null);
    const liveVoiceRef = runtime.useRef(liveVoice);
    runtime.useEffect(() => { liveVoiceRef.current = liveVoice; }, [liveVoice]);

    runtime.useEffect(() => {
      const controller = createTurnController(options.sessionId, options.voiceModel, {
        streamTurn: fetchTurn,
        beginSpeech: (turnId, model) => voiceRef.current.beginSpeech(turnId, model),
        speakPhrase: (turnId, phrase) => voiceRef.current.speakPhrase(turnId, phrase),
        finishSpeech: turnId => voiceRef.current.finishSpeech(turnId),
        cancelGeneration: () => {},
        invalidatePhraseQueue: turnId => voiceRef.current.invalidateSpeech(turnId),
        resetPhraseQueue: turnId => voiceRef.current.resetSpeechText(turnId),
        stopAudio: turnId => voiceRef.current.stopSpeechAudio(turnId),
        clearTts: turnId => voiceRef.current.clearSpeechTts(turnId),
        beginListening: () => {},
        recordMetric: async metric => { await fetch("/api/turn-metrics", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(metric), keepalive: true }); },
        now: () => performance.now(),
        createLifecycleId: () => crypto.randomUUID(),
      });
      controllerRef.current = controller;
      const unsubscribe = controller.subscribe(setSnapshot);
      return () => { unsubscribe(); controller.dispose(); controllerRef.current = null; };
    }, [options.sessionId, options.voiceModel]);

    // Engine selection: Gemini Live first when configured (its onFallback
    // hands the room to the cascade), otherwise the existing cascade start.
    const startListening = runtime.useCallback(() => {
      if (liveConfiguredRef.current) void liveVoiceRef.current?.start();
      else voiceRef.current.start();
    }, []);
    const finishInput = runtime.useCallback(async (requestOptions = {}) => {
      const transcript = `${voiceRef.current.finalTranscript} ${voiceRef.current.interimTranscript}`.trim();
      if (voiceRef.current.usingFallback) {
        voiceRef.current.stop();
        if (transcript) await controllerRef.current?.finalizeFallbackTranscript(transcript, voiceRef.current.finalizedTranscript?.confidence ?? 1, requestOptions);
        controllerRef.current?.setSttFallback(false);
      } else {
        controllerRef.current?.queuePrimaryEndOfTurn(requestOptions);
      }
    }, []);
    const submitPresentationTurn = runtime.useCallback(async (transcript: string, alreadyPersisted: boolean, requestOptions = {}) => {
      await controllerRef.current?.submitPresentationTurn(transcript, alreadyPersisted, requestOptions);
    }, []);
    const cancel = runtime.useCallback(() => controllerRef.current?.dispose(), []);
    const stop = runtime.useCallback(() => {
      liveVoiceRef.current?.stop();
      voiceRef.current.stop();
    }, []);

    return { ...snapshot, isSupported: voice.isSupported, isListening: voice.isListening,
      finalTranscript: voice.finalTranscript, interimTranscript: voice.interimTranscript,
      startListening, start: startListening, stop, reset: voice.reset,
      finishInput, submitPresentationTurn, cancel, liveEngineStatus: liveVoice.status };
  };
}

export const useTurnController = createTurnControllerHook(
  { useCallback, useEffect, useRef, useState },
  useStreamingVoice,
  useLiveVoice,
);
