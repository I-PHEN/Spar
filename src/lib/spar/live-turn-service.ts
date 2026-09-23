import "server-only";

import { db } from "@/lib/db";
import {
  buildDrillNextQuestionInstruction,
  buildDrillPrompt,
  buildBoardroomInterruptInstruction,
  getDrillAcknowledgment,
  getDrillCorrection,
} from "@/lib/drills";
import { buildPatternMemoryContext } from "@/lib/llm";
import { applyMetricEvent, type TurnMetricEvent, type TurnMetricRecord } from "@/lib/observability/turn-metrics";
import { extractPartialContent, parseStreamedPersonaResponse } from "@/lib/openrouter";
import { buildPersonaContext } from "@/lib/persona/context-builder";
import { buildPersonaSessionRules, buildPersonaStablePrefix } from "@/lib/personas";
import { createPersonaGenerator } from "@/lib/providers/persona-generator";
import type { GenerationFailureCode, GenerationUsage, PersonaGenerator } from "@/lib/providers/types";
import { SCENARIOS } from "@/lib/scenarios";
import {
  abandonLiveTurnBuffer,
  appendLiveTurnBuffer,
  beginLiveTurnBuffer,
  finalizeLiveTurnBuffer,
  getCachedPrompt,
  getCachedSession,
  resetLiveTurnBuffer,
  setCachedPrompt,
  setCachedSession,
} from "@/lib/session-cache";
import type { ArchetypeKey, BehaviorStyle, DrillTarget, ExperienceKey, ExtractedClaim, PersonaMood } from "@/lib/types";
import { createPhraseChunker, type PhraseChunk } from "@/lib/voice/phrase-chunker";

export const LIVE_TURN_MAX_OUTPUT_TOKENS = 80;

export interface LiveTurnRequest {
  sessionId: string;
  turnId: string;
  transcript: string;
  confidence: number;
  forcedPersonaId?: string;
  isInterrupt?: boolean;
  drillInterrupt?: boolean;
  drillClean?: boolean;
  presentationHandoff?: boolean;
}

export interface LivePersona {
  id: string;
  name: string;
  archetype: string;
  behaviorStyle: string;
  seatOrder: number;
}

export interface LiveTurnContext {
  persona: LivePersona;
  experience: ExperienceKey;
  selectedRegion: "us" | "eu";
  stablePrefix: string;
  sessionRules: string;
  rollingSummary: string;
  history: ReadonlyArray<{ role: "user" | "assistant"; content: string }>;
  deterministicState: Readonly<Record<string, unknown>>;
}

export type LiveTurnEvent = { turnId: string } & (
  | { type: "turn-start"; persona: LivePersona; model: string; maxOutputTokens: 80 }
  | { type: "text-delta"; text: string }
  | { type: "phrase"; phrase: PhraseChunk }
  | { type: "usage"; usage: GenerationUsage }
  | { type: "metric"; metric: TurnMetricEvent }
  | { type: "fallback"; from: "groq"; to: "openrouter"; reason: GenerationFailureCode; resetText: true }
  | { type: "complete"; text: string; messageId: string; metadata: { type: "normal" | "interruption"; claimRef: number | null; mood: PersonaMood } }
  | { type: "error"; code: string; message: string }
);

export interface LiveTurnDependencies {
  loadContext(request: LiveTurnRequest, signal: AbortSignal): Promise<LiveTurnContext>;
  persistUser(sessionId: string, text: string, signal: AbortSignal): Promise<void>;
  persistAssistant(
    request: LiveTurnRequest,
    text: string,
    metadata: { personaId: string; type: "normal" | "interruption"; claimRef: number | null; mood: PersonaMood },
    signal: AbortSignal,
  ): Promise<string>;
  persistMetric(metric: TurnMetricEvent, signal: AbortSignal): Promise<void>;
  generator: PersonaGenerator;
  now(): number;
}

type LiveTurnService = (request: LiveTurnRequest, signal: AbortSignal) => AsyncIterable<LiveTurnEvent>;

function abortIfNeeded(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException("Turn cancelled.", "AbortError");
}

export function createLiveTurnService(dependencies: LiveTurnDependencies): LiveTurnService {
  return async function* liveTurn(request, signal) {
    const transcript = request.transcript.trim().slice(0, 5_000);
    if (!transcript) {
      yield { type: "error", turnId: request.turnId, code: "invalid-transcript", message: "A finalized transcript is required." };
      return;
    }

    const startedAt = dependencies.now();
    const offset = () => Math.max(0, dependencies.now() - startedAt);
    let metricWrites = Promise.resolve();
    const emitMetric = (metric: TurnMetricEvent): LiveTurnEvent => {
      abortIfNeeded(signal);
      metricWrites = metricWrites.then(() => dependencies.persistMetric(metric, signal)).catch(() => {});
      return { type: "metric", turnId: request.turnId, metric };
    };

    try {
      beginLiveTurnBuffer(request.sessionId, request.turnId);
      abortIfNeeded(signal);
      if (!request.presentationHandoff) await dependencies.persistUser(request.sessionId, transcript, signal);
      abortIfNeeded(signal);
      const context = await dependencies.loadContext({ ...request, transcript }, signal);
      abortIfNeeded(signal);

      yield {
        type: "turn-start",
        turnId: request.turnId,
        persona: context.persona,
        model: "openai/gpt-oss-20b",
        maxOutputTokens: LIVE_TURN_MAX_OUTPUT_TOKENS,
      };
      yield await emitMetric({
        type: "turn-context", turnId: request.turnId, sessionId: request.sessionId,
        traceId: request.turnId, experience: context.experience, persona: context.persona.name,
        selectedRegion: context.selectedRegion,
      });
      yield await emitMetric({
        type: "transcript-finalized", turnId: request.turnId, sessionId: request.sessionId,
        offsetMs: 0, confidence: request.confidence,
      });

      let chunker = createPhraseChunker();
      let answer = "";
      let raw = "";
      let providerContent = "";
      let firstToken = true;
      let firstPhrase = true;
      let selectedProvider: "groq" | "openrouter" = "groq";
      let selectedModel = "openai/gpt-oss-20b";
      let generationStartedOffsetMs = 0;
      let usage: GenerationUsage | null = null;
      let usageEmitted = false;

      const acceptText = async function* (text: string): AsyncGenerator<LiveTurnEvent> {
        if (!text) return;
        answer += text;
        appendLiveTurnBuffer(request.sessionId, request.turnId, text);
        yield { type: "text-delta", turnId: request.turnId, text };
        if (firstToken) {
          firstToken = false;
          yield await emitMetric({ type: "first-token", turnId: request.turnId, sessionId: request.sessionId, offsetMs: offset() });
        }
        for (const phrase of chunker.push(text)) {
          yield { type: "phrase", turnId: request.turnId, phrase };
          if (firstPhrase) {
            firstPhrase = false;
            yield await emitMetric({ type: "first-phrase", turnId: request.turnId, sessionId: request.sessionId, offsetMs: offset() });
          }
        }
      };

      if (request.drillInterrupt && context.experience === "drill") {
        for await (const event of acceptText(getDrillCorrection((context.deterministicState.drillTarget as DrillTarget) ?? "hedging"))) yield event;
      } else {
        const personaContext = buildPersonaContext({
          stablePrefix: context.stablePrefix,
          sessionRules: context.sessionRules,
          rollingSummary: context.rollingSummary,
          deterministicState: context.deterministicState,
          history: context.history,
          newestUtterance: transcript,
        });

        if (request.drillClean && context.experience === "drill") {
          const acknowledgment = `${getDrillAcknowledgment((context.deterministicState.drillTarget as DrillTarget) ?? "hedging")} `;
          for await (const event of acceptText(acknowledgment)) yield event;
        }

        let completionStatus: "success" | "provider-error" | null = null;
        let completionReason: GenerationFailureCode | undefined;
        for await (const event of dependencies.generator.stream({
          messages: personaContext.messages,
          speechStarted: () => !firstPhrase,
        }, signal)) {
          abortIfNeeded(signal);
          if (event.type === "provider-selected") {
            selectedProvider = event.provider;
            selectedModel = event.model;
            generationStartedOffsetMs = offset();
          } else if (event.type === "text-delta") {
            raw += event.text;
            const partial = extractPartialContent(raw);
            if (partial !== null && partial.length > providerContent.length) {
              const delta = partial.slice(providerContent.length);
              providerContent = partial;
              for await (const output of acceptText(delta)) yield output;
            }
          } else if (event.type === "fallback") {
            raw = "";
            answer = "";
            providerContent = "";
            resetLiveTurnBuffer(request.sessionId, request.turnId);
            firstToken = true;
            chunker.cancel();
            chunker = createPhraseChunker();
            yield { ...event, turnId: request.turnId };
            yield await emitMetric({ type: "fallback", turnId: request.turnId, sessionId: request.sessionId, reason: event.reason });
          } else if (event.type === "usage") {
            usage = event.usage;
            usageEmitted = true;
            yield { type: "usage", turnId: request.turnId, usage };
            yield await emitMetric({ type: "usage", turnId: request.turnId, sessionId: request.sessionId,
              inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, cachedTokens: usage.cachedTokens,
              estimatedCostUsd: usage.estimatedCostUsd });
          } else if (event.type === "complete") {
            completionStatus = event.status;
            completionReason = event.reason;
            usage ??= event.usage;
          }
        }
        if (completionStatus !== "success") {
          abandonLiveTurnBuffer(request.sessionId, request.turnId);
          yield { type: "error", turnId: request.turnId, code: completionReason ?? "provider-error", message: "The panelist could not finish this turn." };
          return;
        }
        yield await emitMetric({
          type: "generation-started", turnId: request.turnId, sessionId: request.sessionId,
          offsetMs: generationStartedOffsetMs, provider: selectedProvider, model: selectedModel,
        });
        if (usage && !usageEmitted) {
          yield { type: "usage", turnId: request.turnId, usage };
          yield await emitMetric({ type: "usage", turnId: request.turnId, sessionId: request.sessionId,
            inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, cachedTokens: usage.cachedTokens,
            estimatedCostUsd: usage.estimatedCostUsd });
        }
      }

      const flushed = chunker.flush();
      for (const phrase of flushed.chunks) {
        yield { type: "phrase", turnId: request.turnId, phrase };
        if (firstPhrase) {
          firstPhrase = false;
          yield await emitMetric({ type: "first-phrase", turnId: request.turnId, sessionId: request.sessionId, offsetMs: offset() });
        }
      }
      const parsed = parseStreamedPersonaResponse(raw);
      if (!request.drillInterrupt && (!parsed || parsed.content !== providerContent)) {
        abandonLiveTurnBuffer(request.sessionId, request.turnId);
        yield { type: "error", turnId: request.turnId, code: "invalid-response", message: "The panelist returned an invalid response." };
        return;
      }
      const metadata = {
        personaId: context.persona.id,
        type: request.isInterrupt || request.drillInterrupt ? "interruption" as const : parsed?.type ?? "normal" as const,
        claimRef: parsed?.claimRef ?? null,
        mood: (parsed?.mood ?? (request.isInterrupt ? "pressing" : "neutral")) as PersonaMood,
      };
      abortIfNeeded(signal);
      const messageId = await dependencies.persistAssistant(request, answer, metadata, signal);
      abortIfNeeded(signal);
      finalizeLiveTurnBuffer(request.sessionId, request.turnId);
      await metricWrites;
      yield { type: "complete", turnId: request.turnId, text: answer, messageId,
        metadata: { type: metadata.type, claimRef: metadata.claimRef, mood: metadata.mood } };
    } catch (error) {
      abandonLiveTurnBuffer(request.sessionId, request.turnId);
      if (signal.aborted || (error instanceof Error && error.name === "AbortError")) return;
      yield { type: "error", turnId: request.turnId, code: "live-turn-error",
        message: error instanceof Error ? error.message : "Live turn failed." };
    }
  };
}

function experienceRules(experience: ExperienceKey, drillTarget: string | null): string {
  if (experience === "defense") return "# EXPERIENCE: DEFENSE\nChallenge a specific claim from the presentation. Never open with a generic question.";
  if (experience === "boardroom") return "# EXPERIENCE: BOARDROOM\nApply high-pressure boardroom questioning and challenge the specific weakness.";
  if (experience === "drill") return buildDrillPrompt((drillTarget as DrillTarget) || "hedging");
  return "# EXPERIENCE: OPEN SPAR\nRun direct conversational Q&A. Ask one focused challenge and probe the next weakness.";
}

function rollingSummary(history: ReadonlyArray<{ role: "user" | "assistant"; content: string }>): string {
  const earlier = history.slice(0, Math.max(0, history.length - 6));
  const value = earlier.map(message => `${message.role === "user" ? "User" : "Panelist"}: ${message.content}`).join("\n");
  const limit = 875;
  return value.length <= limit ? value : `[Earlier conversation omitted.]\n${tailWellFormed(value, limit - 32)}`;
}

/** Keeps a value's tail without opening it on a lone low surrogate. */
function tailWellFormed(value: string, limit: number): string {
  const sliced = value.slice(-limit);
  const first = sliced.charCodeAt(0);
  return first >= 0xdc00 && first <= 0xdfff ? sliced.slice(1) : sliced;
}

function parseClaims(value: string | null): ExtractedClaim[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as ExtractedClaim[] : [];
  } catch {
    return [];
  }
}

async function defaultLoadContext(request: LiveTurnRequest, signal: AbortSignal): Promise<LiveTurnContext> {
  abortIfNeeded(signal);
  let cached = getCachedSession(request.sessionId);
  const session = await db.session.findUnique({
    where: { id: request.sessionId },
    include: {
      personas: { orderBy: { seatOrder: "asc" } }, messages: { orderBy: { createdAt: "asc" } },
      user: { include: { patternMemories: { orderBy: { lastSeen: "desc" }, take: 5 },
        sessions: { where: { status: "debriefed" }, orderBy: { endedAt: "desc" }, take: 2, include: { summary: true, personas: true } } } },
    },
  });
  abortIfNeeded(signal);
  if (!session) throw new Error("Session not found.");
  if (session.status !== "active" && session.status !== "presenting") throw new Error(`Session not active (status: ${session.status}).`);
  const persona = request.forcedPersonaId
    ? session.personas.find(item => item.id === request.forcedPersonaId)
    : session.personas[0];
  if (!persona) throw new Error("No persona available.");
  const experience = session.experience as ExperienceKey;
  const stablePrefix = getCachedPrompt(request.sessionId, persona.id) ?? buildPersonaStablePrefix({
    archetype: persona.archetype as ArchetypeKey, behaviorStyle: persona.behaviorStyle as BehaviorStyle,
  });
  setCachedPrompt(request.sessionId, persona.id, stablePrefix);
  const claims = parseClaims(session.extractedClaims);
  const scenario = SCENARIOS[session.scenario as keyof typeof SCENARIOS];
  const patternMemory = buildPatternMemoryContext({
    patterns: session.user.patternMemories.map(item => ({ tag: item.tag, description: item.description, occurrences: item.occurrences })),
    recentSummaries: session.user.sessions.filter(item => item.summary).map(item => ({
      scenarioLabel: SCENARIOS[item.scenario as keyof typeof SCENARIOS]?.label ?? item.scenario,
      thePattern: item.summary!.thePattern, oneThingToPractice: item.summary!.oneThingToPractice,
      createdAt: item.endedAt ?? item.createdAt,
    })),
  });
  const personaMap = new Map(session.personas.map(item => [item.id, {
    id: item.id, archetype: item.archetype, name: item.name, behaviorStyle: item.behaviorStyle, seatOrder: item.seatOrder,
  }]));
  if (!cached) {
    setCachedSession(request.sessionId, { systemPrompt: stablePrefix, personaIds: session.personas.map(item => item.id),
      personaMap, claims, scenarioLabel: scenario?.label ?? "Custom Session", roomContext: session.roomContext ?? scenario?.roomContext ?? "",
      experience, drillTarget: session.drillTarget, coachingEnabled: session.coachingEnabled });
    cached = getCachedSession(request.sessionId);
  }
  const history = session.messages.map(message => message.role === "user"
    ? { role: "user" as const, content: message.content }
    : { role: "assistant" as const, content: `${personaMap.get(message.personaId ?? "")?.name ?? "Panelist"}: ${message.content}` });
  const rules = [
    buildPersonaSessionRules({ scenarioLabel: cached?.scenarioLabel ?? "Custom Session", claims,
      patternMemory, otherPersonas: [...personaMap.values()].filter(item => item.id !== persona.id).map(item => ({ name: item.name, archetype: item.archetype as ArchetypeKey })) }),
    experienceRules(experience, session.drillTarget),
    request.isInterrupt && experience === "boardroom" ? buildBoardroomInterruptInstruction() : "",
    request.drillClean && experience === "drill" ? buildDrillNextQuestionInstruction((session.drillTarget as DrillTarget) || "hedging") : "",
  ].filter(Boolean).join("\n\n");
  return { persona, experience, selectedRegion: process.env.DEEPGRAM_REGION === "eu" ? "eu" : "us",
    stablePrefix, sessionRules: rules, rollingSummary: rollingSummary(history), history,
    deterministicState: { experience, isInterrupt: !!request.isInterrupt, drillClean: !!request.drillClean,
      drillTarget: experience === "drill" ? session.drillTarget ?? "hedging" : null } };
}

async function defaultPersistMetric(metric: TurnMetricEvent, signal: AbortSignal): Promise<void> {
  abortIfNeeded(signal);
  const metricDb = db as unknown as { $transaction<T>(work: (tx: { turnMetric: {
    findUnique(args: { where: { turnId: string } }): Promise<TurnMetricRecord | null>;
    create(args: { data: TurnMetricRecord }): Promise<unknown>;
    update(args: { where: { turnId: string }; data: TurnMetricRecord }): Promise<unknown>;
  } }) => Promise<T>): Promise<T> };
  await metricDb.$transaction(async tx => {
    const current = await tx.turnMetric.findUnique({ where: { turnId: metric.turnId } });
    abortIfNeeded(signal);
    const existing = current ? liveMetricFields(current) : null;
    const next = liveMetricFields(applyMetricEvent(existing, metric));
    if (current) await tx.turnMetric.update({ where: { turnId: metric.turnId }, data: next });
    else await tx.turnMetric.create({ data: next });
  });
}

function liveMetricFields(record: TurnMetricRecord): TurnMetricRecord {
  return {
    turnId: record.turnId, sessionId: record.sessionId, traceId: record.traceId,
    experience: record.experience, persona: record.persona, transcriptConfidence: record.transcriptConfidence,
    selectedRegion: record.selectedRegion, transcriptFinalizedOffsetMs: record.transcriptFinalizedOffsetMs,
    serverGenerationStartedOffsetMs: record.serverGenerationStartedOffsetMs, firstTokenOffsetMs: record.firstTokenOffsetMs,
    firstPhraseOffsetMs: record.firstPhraseOffsetMs, firstTtsByteOffsetMs: record.firstTtsByteOffsetMs,
    firstPlaybackOffsetMs: record.firstPlaybackOffsetMs, cancellationOffsetMs: record.cancellationOffsetMs,
    generationProvider: record.generationProvider, generationModel: record.generationModel,
    ttsProvider: record.ttsProvider, ttsModel: record.ttsModel, inputTokens: record.inputTokens,
    outputTokens: record.outputTokens, cachedTokens: record.cachedTokens, estimatedCostUsd: record.estimatedCostUsd,
    fallbackReason: record.fallbackReason, cancelled: record.cancelled, orderingFailureCount: record.orderingFailureCount,
  };
}

const defaultDependencies: LiveTurnDependencies = {
  now: () => performance.now(),
  loadContext: defaultLoadContext,
  persistUser: async (sessionId, text, signal) => {
    abortIfNeeded(signal);
    await db.sessionMessage.create({ data: { sessionId, role: "user", content: text, type: "normal" } });
  },
  persistAssistant: async (request, text, metadata, signal) => {
    abortIfNeeded(signal);
    const message = await db.sessionMessage.create({ data: { sessionId: request.sessionId, personaId: metadata.personaId,
      role: "persona", content: text.slice(0, 2_000), type: metadata.type, claimRef: metadata.claimRef } });
    return message.id;
  },
  persistMetric: defaultPersistMetric,
  generator: createPersonaGenerator({ groqApiKey: process.env.GROQ_API_KEY ?? "", openRouterApiKey: process.env.OPENROUTER_API_KEY ?? "" }),
};

export const liveTurnService = createLiveTurnService(defaultDependencies);
