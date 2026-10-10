"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ArchetypeKey, BehaviorStyle } from "../lib/types";
import type { VoiceEngine } from "../lib/observability/turn-metrics";
import { buildLiveSystemInstruction } from "../lib/spar/live-instruction";
import { LIVE_MODEL_BY_MODE, vadConfigFor } from "../lib/spar/mode-contracts";
import { GeminiLiveClient, type GeminiLiveDependencies, type GeminiLiveEvent, type GeminiLiveOptions } from "../lib/providers/gemini-live";
import { MicrophoneStream, type MicrophoneStreamDependencies, type MicrophoneStreamOptions } from "../lib/voice/microphone-stream";
import { PcmPlayer, type PcmFrame, type PcmPlayerOptions } from "../lib/voice/pcm-player";

/**
 * Gemini Live voice session: mic -> adapter -> PcmPlayer -> turn machine.
 *
 * The turn state machine is NOT driven through the text cascade here; the Live
 * socket owns generation. The session registers each AI utterance as a fresh
 * turn via `onRegisterTurn`, attributes every async callback to that turnId,
 * and drops frames for finished turns. Engine ladder: gemini-live first, then
 * the existing cascade via `onFallback` (which starts it), browser speech
 * beneath the cascade as before.
 */

/** Kore is the only Live-documented voice; the rest come from the TTS prebuilt set. */
export const LIVE_VOICES: Record<ArchetypeKey, string> = {
  skeptic: "Kore",
  nitpicker: "Charon",
  so_what: "Pulcherrima",
  timekeeper: "Alnilam",
  ally: "Achird",
};
export const FALLBACK_VOICE = "Kore";

export type LiveVoiceStatus = "connecting" | "live" | "fallback";

export type LiveVoiceMode = keyof typeof LIVE_MODEL_BY_MODE;

export interface LiveVoicePersonaSpec {
  archetype: ArchetypeKey;
  behaviorStyle: BehaviorStyle;
}

/** Turn-machine-independent engine metric; the controller adds turn/session identity. */
export interface LiveEngineMetricEvent {
  voiceEngine: VoiceEngine;
  firstLiveAudioMs?: number;
  interruptions?: number;
}

interface LiveClientConnection {
  connect(): Promise<void>;
  sendAudio(pcm16Base64: string): void;
  close(): void;
}

interface MicrophoneConnection {
  start(): Promise<void>;
  stop(): void;
}

type PlayerHandle = Pick<PcmPlayer, "start" | "enqueue" | "stop" | "reset">;

export interface LiveVoiceDependencies {
  fetch?: (input: string, init: RequestInit) => Promise<Response>;
  webSocket?: GeminiLiveDependencies["webSocket"];
  backoffMs?: GeminiLiveDependencies["backoffMs"];
  createClient?: (options: GeminiLiveOptions) => LiveClientConnection;
  createMicrophoneStream?: (options: MicrophoneStreamOptions) => MicrophoneConnection;
  createPlayer?: (options: PcmPlayerOptions) => PlayerHandle;
  microphone?: MicrophoneStreamDependencies;
  encodeBase64?: (bytes: Uint8Array) => string;
  decodeBase64?: (data: string) => Uint8Array;
  now?: () => number;
}

function encodeBase64Bytes(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(...bytes.subarray(index, index + step));
  }
  return btoa(binary);
}

function decodeBase64Bytes(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export interface LiveVoiceConfig {
  mode: LiveVoiceMode;
  persona: LiveVoicePersonaSpec;
  scenarioLabel: string;
  claims: Array<{ id: number; label: string; claim: string; evidence?: string }>;
  otherPanelists: Array<{ name: string; archetype: ArchetypeKey }>;
}

export interface LiveVoiceSessionOptions extends LiveVoiceConfig {
  sessionId: string;
  onStatusChange?(status: LiveVoiceStatus): void;
  onUserInterim?(text: string): void;
  onUserFinal?(text: string): void;
  /** Accumulated caption for the AI utterance attributed to the registered turn. */
  onAssistantCaption?(turnId: string, text: string): void;
  /** Allocates a fresh turnId from the turn state machine. */
  onRegisterTurn?(): string;
  onCancelTurn?(turnId: string): void;
  /** `turn-complete` for the registered turn: finalized cleanly, not cancelled. */
  onCompleteTurn?(turnId: string): void;
  onMetric?(event: LiveEngineMetricEvent): void;
  /** The cascade takes over the room (fallback ladder rung 2). */
  onFallback?(): void;
  dependencies?: LiveVoiceDependencies;
}

/**
 * Browser-resource owner for one room's Live session. Deterministic and
 * dependency-injected so lifecycle tests host the full wiring without a DOM.
 */
export class LiveVoiceSession {
  private status: LiveVoiceStatus = "connecting";
  private stopped = false;
  private fallbackNotified = false;
  private startPromise?: Promise<void>;
  private client?: LiveClientConnection;
  private microphone?: MicrophoneConnection;
  private readonly player: PlayerHandle;
  private epoch = 0;
  // Per-utterance attribution state; frames for finished turns are dropped.
  private liveTurnId: string | null = null;
  private turnFinished = false;
  private cycleArmed = true; // the opening greeting may arrive without prior user speech
  private responseStartedAt: number | null = null;
  private firstAudioEmitted = false;
  private interruptions = 0;
  private audioSequence = 0;
  private caption = "";
  private readonly dependencies: LiveVoiceDependencies;

  constructor(private readonly options: LiveVoiceSessionOptions) {
    this.dependencies = options.dependencies ?? {};
    this.player = (this.dependencies.createPlayer ?? (playerOptions => new PcmPlayer(playerOptions)))({
      onEvent: () => {},
      dependencies: { now: this.dependencies.now },
    });
  }

  /** Never throws: every failure mode lands on the fallback ladder instead. */
  start(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.status === "fallback") {
      this.notifyFallback();
      return Promise.resolve();
    }
    if (this.startPromise) return this.startPromise;
    this.setStatus("connecting");
    this.startPromise = this.connect(++this.epoch);
    return this.startPromise;
  }

  /** User-initiated stop: closes adapter, mic, and player; no fallback after this. */
  stop(): void {
    this.stopped = true;
    this.epoch += 1;
    this.startPromise = undefined;
    this.releaseResources();
  }

  private stale(epoch: number): boolean {
    return this.stopped || epoch !== this.epoch;
  }

  private setStatus(status: LiveVoiceStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.options.onStatusChange?.(status);
  }

  private async connect(epoch: number): Promise<void> {
    try {
      const token = await this.fetchToken();
      if (this.stale(epoch)) return;
      const createClient = this.dependencies.createClient ?? (clientOptions => new GeminiLiveClient(clientOptions));
      const client = createClient({
        token,
        model: LIVE_MODEL_BY_MODE[this.options.mode],
        systemInstruction: buildLiveSystemInstruction({
          archetype: this.options.persona.archetype,
          behaviorStyle: this.options.persona.behaviorStyle,
          mode: this.options.mode,
          scenarioLabel: this.options.scenarioLabel,
          claims: this.options.claims,
          otherPanelists: this.options.otherPanelists,
        }),
        voiceName: LIVE_VOICES[this.options.persona.archetype] ?? FALLBACK_VOICE,
        vad: vadConfigFor(this.options.mode).automaticActivityDetection,
        onEvent: event => this.acceptClientEvent(epoch, event),
        dependencies: {
          webSocket: this.dependencies.webSocket,
          now: this.dependencies.now,
          backoffMs: this.dependencies.backoffMs,
        },
      });
      this.client = client;
      await client.connect(); // resolves on setupComplete; rejects after retries
      if (this.stale(epoch)) return;
      this.setStatus("live");
      await this.startMicrophone(epoch);
    } catch {
      // Token 503, setup rejection, socket exhaustion, or mic failure:
      // ladder down to the cascade without ever throwing to the caller.
      if (!this.stale(epoch)) this.goFallback();
    }
  }

  private async fetchToken(): Promise<string> {
    const doFetch = this.dependencies.fetch ?? ((input: string, init: RequestInit) => fetch(input, init));
    const response = await doFetch("/api/gemini-live-token", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) throw new Error("gemini-live-unavailable");
    const grant = await response.json() as { token?: unknown; expiresIn?: unknown };
    if (typeof grant.token !== "string" || !grant.token.trim()
      || typeof grant.expiresIn !== "number" || !Number.isFinite(grant.expiresIn) || grant.expiresIn <= 0) {
      throw new Error("gemini-live-unavailable");
    }
    return grant.token;
  }

  private async startMicrophone(epoch: number): Promise<void> {
    const createMicrophone = this.dependencies.createMicrophoneStream
      ?? (micOptions => new MicrophoneStream(micOptions));
    const microphone = createMicrophone({
      onChunk: chunk => {
        // Continuous capture while live; never forwarded once the cascade owns the room.
        if (!this.stale(epoch) && this.status === "live" && this.client) {
          this.client.sendAudio((this.dependencies.encodeBase64 ?? encodeBase64Bytes)(chunk.audio));
        }
      },
      onError: () => { if (!this.stale(epoch)) this.goFallback(); },
      dependencies: this.dependencies.microphone,
    });
    this.microphone = microphone;
    await microphone.start();
    if (this.stale(epoch)) {
      microphone.stop();
      this.microphone = undefined;
    }
  }

  private acceptClientEvent(epoch: number, event: GeminiLiveEvent): void {
    if (this.stale(epoch) || this.status === "fallback") return;
    switch (event.type) {
      case "audio-out":
        this.acceptAudio(event.pcmBase64);
        return;
      case "output-transcript":
        this.registerTurnIfNeeded();
        this.appendCaption(event.text);
        return;
      case "interim-input-transcript":
        this.options.onUserInterim?.(event.text);
        return;
      case "input-transcript":
        // Finalized user speech: end-of-speech signal and the latency baseline.
        this.cycleArmed = true;
        this.responseStartedAt = (this.dependencies.now ?? (() => performance.now()))();
        this.options.onUserFinal?.(event.text);
        return;
      case "turn-complete":
        this.completeTurn();
        return;
      case "interrupted":
        this.interrupt();
        return;
      case "error":
        if (event.reason !== "aborted") this.goFallback();
        return;
      default:
        return; // ready/reconnecting/goaway are informational here
    }
  }

  /**
   * First modelTurn/audio after idle allocates a new turnId. After a finished
   * turn the cycle must be re-armed by fresh user speech, so trailing stale
   * frames for the finished turn are dropped instead of replayed.
   */
  private registerTurnIfNeeded(): string | null {
    if (this.liveTurnId !== null && !this.turnFinished) return this.liveTurnId;
    if (this.liveTurnId !== null && !this.cycleArmed) return null;
    const turnId = this.options.onRegisterTurn?.();
    if (!turnId) return null;
    this.liveTurnId = turnId;
    this.turnFinished = false;
    this.caption = "";
    this.audioSequence = 0;
    this.firstAudioEmitted = false;
    this.interruptions = 0;
    void this.player.start(turnId);
    return turnId;
  }

  private acceptAudio(pcmBase64: string): void {
    const turnId = this.registerTurnIfNeeded();
    if (!turnId) return;
    const audio = (this.dependencies.decodeBase64 ?? decodeBase64Bytes)(pcmBase64);
    // A false return (stale/ordering) drops the frame; the Live stream is not resequenced.
    this.player.enqueue({ turnId, sequence: this.audioSequence++, audio });
    if (!this.firstAudioEmitted) {
      this.firstAudioEmitted = true;
      if (this.responseStartedAt !== null) {
        const elapsed = (this.dependencies.now ?? (() => performance.now()))() - this.responseStartedAt;
        // firstLiveAudioMs is int-strict on the metrics route; always round.
        this.options.onMetric?.({ voiceEngine: "gemini-live", firstLiveAudioMs: Math.max(0, Math.round(elapsed)) });
      }
    }
  }

  private appendCaption(text: string): void {
    const turnId = this.liveTurnId;
    if (!turnId || this.turnFinished) return;
    this.caption += text;
    this.options.onAssistantCaption?.(turnId, this.caption);
  }

  private completeTurn(): void {
    if (!this.liveTurnId || this.turnFinished) return;
    this.turnFinished = true;
    this.cycleArmed = false;
    this.options.onCompleteTurn?.(this.liveTurnId);
    if (this.caption) this.options.onAssistantCaption?.(this.liveTurnId, this.caption);
  }

  /** Barge-in needs no user action (server VAD); discard playback and cancel the turn. */
  private interrupt(): void {
    this.player.stop();
    const turnId = this.liveTurnId;
    if (!turnId || this.turnFinished) return;
    this.turnFinished = true;
    this.cycleArmed = false;
    this.interruptions += 1;
    this.options.onMetric?.({ voiceEngine: "gemini-live", interruptions: this.interruptions });
    this.options.onCancelTurn?.(turnId);
  }

  private goFallback(): void {
    if (this.stopped || this.status === "fallback") return;
    this.releaseResources();
    this.setStatus("fallback");
    this.notifyFallback();
  }

  private notifyFallback(): void {
    if (this.fallbackNotified) return;
    this.fallbackNotified = true;
    this.options.onMetric?.({ voiceEngine: "cascade" });
    this.options.onFallback?.();
  }

  private releaseResources(): void {
    this.client?.close();
    this.client = undefined;
    this.microphone?.stop();
    this.microphone = undefined;
    this.player.reset();
    this.liveTurnId = null;
    this.turnFinished = false;
    this.cycleArmed = true;
    this.responseStartedAt = null;
    this.caption = "";
  }
}

export type UseLiveVoiceOptions = LiveVoiceSessionOptions;

export interface UseLiveVoiceResult {
  status: LiveVoiceStatus;
  start(): Promise<void>;
  stop(): void;
}

export interface LiveVoiceHookRuntime {
  useCallback: typeof useCallback;
  useEffect: typeof useEffect;
  useRef: typeof useRef;
  useState: typeof useState;
}

export type LiveVoiceHook = (options: UseLiveVoiceOptions | null) => UseLiveVoiceResult;

/** Built from injectable React hooks so deterministic lifecycle tests can host the wiring. */
export function createLiveVoiceHook(runtime: LiveVoiceHookRuntime): LiveVoiceHook {
  return function useLiveVoiceWithRuntime(options): UseLiveVoiceResult {
    const callbacks = runtime.useRef(options);
    const sessionRef = runtime.useRef<LiveVoiceSession | null>(null);
    const [status, setStatus] = runtime.useState<LiveVoiceStatus>("connecting");

    runtime.useEffect(() => { callbacks.current = options; });
    runtime.useEffect(() => {
      if (!options) return;
      const session = new LiveVoiceSession({
        sessionId: options.sessionId,
        mode: options.mode,
        persona: options.persona,
        scenarioLabel: options.scenarioLabel,
        claims: options.claims,
        otherPanelists: options.otherPanelists,
        dependencies: options.dependencies,
        onStatusChange: next => { setStatus(next); callbacks.current?.onStatusChange?.(next); },
        onUserInterim: text => { callbacks.current?.onUserInterim?.(text); },
        onUserFinal: text => { callbacks.current?.onUserFinal?.(text); },
        onAssistantCaption: (turnId, text) => { callbacks.current?.onAssistantCaption?.(turnId, text); },
        onRegisterTurn: () => callbacks.current?.onRegisterTurn?.() ?? "",
        onCancelTurn: turnId => { callbacks.current?.onCancelTurn?.(turnId); },
        onCompleteTurn: turnId => { callbacks.current?.onCompleteTurn?.(turnId); },
        onMetric: event => { callbacks.current?.onMetric?.(event); },
        onFallback: () => { callbacks.current?.onFallback?.(); },
      });
      sessionRef.current = session;
      return () => { session.stop(); sessionRef.current = null; };
      // `options` is null without Live configuration; the optional chain keeps
      // the deps array evaluable so the unconfigured hook never throws at render.
    }, [options?.sessionId]);

    const start = runtime.useCallback(() => sessionRef.current?.start() ?? Promise.resolve(), []);
    const stop = runtime.useCallback(() => sessionRef.current?.stop(), []);
    // Without Live configuration the engine ladder already rests on the cascade.
    return { status: options ? status : "fallback", start, stop };
  };
}

export const useLiveVoice = createLiveVoiceHook(
  { useCallback, useEffect, useRef, useState },
);
