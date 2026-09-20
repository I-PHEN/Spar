"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LivePersona, LiveTurnEvent, LiveTurnRequest } from "../lib/spar/live-turn-service";
import type { TurnMetricEvent } from "../lib/observability/turn-metrics";
import type { DeepgramSttEvent } from "../lib/providers/deepgram-stt";
import type { PhraseChunk } from "../lib/voice/phrase-chunker";
import { PERSONA_VOICES } from "../lib/providers/deepgram-tts";
import { initialTurnState, reduceTurn, type TurnEffect, type TurnEvent, type TurnState } from "../lib/voice/turn-state";
import { useStreamingVoice, type StreamingSpeechEvent, type StreamingVoiceDependencies, type StreamingSpeechDependencies } from "./use-streaming-voice";

export interface TurnControllerMessage {
  id: string;
  messageId?: string;
  turnId: string;
  role: "user" | "assistant";
  content: string;
  persona?: LivePersona;
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
}

export interface TurnControllerDependencies {
  streamTurn(request: LiveTurnRequest, signal: AbortSignal): AsyncIterable<LiveTurnEvent>;
  beginSpeech(turnId: string, model: string): Promise<void>;
  speakPhrase(turnId: string, phrase: PhraseChunk): void;
  finishSpeech(turnId: string): void;
  cancelGeneration(turnId: string): void;
  invalidatePhraseQueue(turnId: string): void;
  stopAudio(turnId: string): void;
  clearTts(turnId: string): void;
  beginListening(turnId: string): void;
  recordMetric(metric: TurnMetricEvent): Promise<void>;
  now(): number;
}

type SttTurnEvent =
  | { type: "StartOfTurn"; turnIndex?: number; transcript: string; confidence?: number }
  | { type: "interim"; turnIndex?: number; transcript: string; confidence?: number }
  | { type: "EndOfTurn"; turnIndex?: number; transcript: string; confidence: number };

export class LiveTurnController {
  private turn: TurnState;
  private snapshot: TurnControllerSnapshot;
  private listeners = new Set<(snapshot: TurnControllerSnapshot) => void>();
  private generation?: { turnId: string; abort: AbortController };
  private disposed = false;
  private turnStartedAt = 0;
  private activeVoiceModel: string;
  private submittedCurrentTurn = false;
  private requestOptions: Partial<Pick<LiveTurnRequest, "forcedPersonaId" | "isInterrupt" | "drillInterrupt" | "drillClean">> = {};
  private lastSttTurnIndex = -1;
  private cancelledTurns = new Set<string>();
  private metricWrites = Promise.resolve();

  constructor(
    private readonly sessionId: string,
    private readonly voiceModel: string,
    private readonly dependencies: TurnControllerDependencies,
  ) {
    this.activeVoiceModel = voiceModel;
    this.turn = initialTurnState(sessionId);
    this.snapshot = {
      turn: this.turn,
      transcriptPreview: "",
      assistantCaption: "",
      messages: [],
      error: null,
      usingSttFallback: false,
      usingTtsFallback: false,
      activePersona: null,
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
      this.publish({ transcriptPreview: event.transcript, assistantCaption: "", error: null, usingTtsFallback: false });
      return;
    }
    this.turnStartedAt = this.dependencies.now();
    this.publish({ transcriptPreview: event.transcript });
    await this.dispatch({ type: "EndOfTurn", turnId: this.turn.turnId }, { transcript: event.transcript, confidence: event.confidence });
  }

  async submitTranscript(
    transcript: string,
    confidence = 1,
    requestOptions: Partial<Pick<LiveTurnRequest, "forcedPersonaId" | "isInterrupt" | "drillInterrupt" | "drillClean">> = {},
  ): Promise<void> {
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
      this.dependencies.invalidatePhraseQueue(event.turnId);
      this.publish({ assistantCaption: "" });
    } else if (event.type === "complete") {
      if (!this.snapshot.messages.some(message => message.messageId === event.messageId)) {
        this.publish({ messages: [...this.snapshot.messages, {
          id: `assistant:${event.turnId}`, messageId: event.messageId, turnId: event.turnId,
          role: "assistant", content: event.text, persona: this.snapshot.activePersona ?? undefined,
        }] });
      }
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
        if (transcript) this.publish({ messages: [...this.snapshot.messages, {
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
        if (!this.cancelledTurns.has(effect.turnId)) {
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
  region: "us" | "eu";
  voiceModel: string;
  voiceDependencies?: StreamingVoiceDependencies;
  speechDependencies?: StreamingSpeechDependencies;
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
  submitTranscript(transcript: string, confidence?: number, requestOptions?: Partial<Pick<LiveTurnRequest, "forcedPersonaId" | "isInterrupt" | "drillInterrupt" | "drillClean">>): Promise<void>;
  stopAndSubmit(requestOptions?: Partial<Pick<LiveTurnRequest, "forcedPersonaId" | "isInterrupt" | "drillInterrupt" | "drillClean">>): Promise<void>;
  cancel(): void;
}

export function useTurnController(options: UseTurnControllerOptions): UseTurnControllerResult {
  const controllerRef = useRef<LiveTurnController | null>(null);
  const [snapshot, setSnapshot] = useState<TurnControllerSnapshot>(() => ({
    turn: initialTurnState(options.sessionId), transcriptPreview: "", assistantCaption: "", messages: [],
    error: null, usingSttFallback: false, usingTtsFallback: false,
    activePersona: null,
  }));
  const voice = useStreamingVoice({
    roomId: options.sessionId, region: options.region, dependencies: options.voiceDependencies,
    speechDependencies: options.speechDependencies,
    onStartOfTurn: event => { void controllerRef.current?.acceptStt(event); },
    onInterimTranscript: event => { void controllerRef.current?.acceptStt(event); },
    onEndOfTurn: event => { void controllerRef.current?.acceptStt({ type: "EndOfTurn", transcript: event.transcript, confidence: event.confidence }); },
    onFallback: () => controllerRef.current?.setSttFallback(true),
    onPrimaryReady: () => controllerRef.current?.setSttFallback(false),
    onSpeechEvent: event => controllerRef.current?.acceptSpeechEvent(event),
  });
  const voiceRef = useRef(voice);
  useEffect(() => { voiceRef.current = voice; }, [voice]);

  useEffect(() => {
    const controller = createTurnController(options.sessionId, options.voiceModel, {
      streamTurn: fetchTurn,
      beginSpeech: (turnId, model) => voiceRef.current.beginSpeech(turnId, model),
      speakPhrase: (turnId, phrase) => voiceRef.current.speakPhrase(turnId, phrase),
      finishSpeech: turnId => voiceRef.current.finishSpeech(turnId),
      cancelGeneration: () => {},
      invalidatePhraseQueue: () => {},
      stopAudio: turnId => voiceRef.current.cancelSpeech(turnId),
      clearTts: () => {},
      beginListening: () => {},
      recordMetric: async metric => { await fetch("/api/turn-metrics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(metric), keepalive: true }); },
      now: () => performance.now(),
    });
    controllerRef.current = controller;
    const unsubscribe = controller.subscribe(setSnapshot);
    return () => { unsubscribe(); controller.dispose(); controllerRef.current = null; };
  }, [options.sessionId, options.voiceModel]);

  const startListening = useCallback(() => voiceRef.current.start(), []);
  const stopAndSubmit = useCallback(async (requestOptions = {}) => {
    voiceRef.current.stop();
    const transcript = `${voiceRef.current.finalTranscript} ${voiceRef.current.interimTranscript}`.trim();
    if (transcript) await controllerRef.current?.submitTranscript(transcript, voiceRef.current.finalizedTranscript?.confidence ?? 1, requestOptions);
  }, []);
  const submitTranscript = useCallback(async (transcript: string, confidence = 1, requestOptions = {}) => {
    await controllerRef.current?.submitTranscript(transcript, confidence, requestOptions);
  }, []);
  const cancel = useCallback(() => controllerRef.current?.dispose(), []);

  return { ...snapshot, isSupported: voice.isSupported, isListening: voice.isListening,
    finalTranscript: voice.finalTranscript, interimTranscript: voice.interimTranscript,
    startListening, start: startListening, stop: voice.stop, reset: voice.reset,
    submitTranscript, stopAndSubmit, cancel };
}
