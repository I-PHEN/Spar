import { z } from "zod";

const eventIdentity = {
  turnId: z.string().min(1).max(128),
  sessionId: z.string().min(1).max(128),
};

const offsetMs = z.number().finite().nonnegative();
const tokenCount = z.number().int().nonnegative();
const providerName = z.string().min(1).max(64);
const modelName = z.string().min(1).max(128);

export const turnMetricEventSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...eventIdentity,
      type: z.literal("turn-context"),
      traceId: z.string().min(1).max(128),
      experience: z.enum(["defense", "boardroom", "open_spar", "drill"]),
      persona: z.string().min(1).max(120),
      selectedRegion: z.enum(["us", "eu"]),
    })
    .strict(),
  z
    .object({
      ...eventIdentity,
      type: z.literal("transcript-finalized"),
      offsetMs,
      confidence: z.number().finite().min(0).max(1),
    })
    .strict(),
  z
    .object({
      ...eventIdentity,
      type: z.literal("generation-started"),
      offsetMs,
      provider: providerName,
      model: modelName,
    })
    .strict(),
  z
    .object({
      ...eventIdentity,
      type: z.literal("first-token"),
      offsetMs,
    })
    .strict(),
  z
    .object({
      ...eventIdentity,
      type: z.literal("first-phrase"),
      offsetMs,
    })
    .strict(),
  z
    .object({
      ...eventIdentity,
      type: z.literal("first-tts-byte"),
      offsetMs,
      provider: providerName,
      model: modelName,
    })
    .strict(),
  z
    .object({
      ...eventIdentity,
      type: z.literal("first-playback"),
      offsetMs,
    })
    .strict(),
  z
    .object({
      ...eventIdentity,
      type: z.literal("usage"),
      inputTokens: tokenCount,
      outputTokens: tokenCount,
      cachedTokens: tokenCount,
      estimatedCostUsd: z.number().finite().nonnegative().nullable(),
    })
    .strict(),
  z
    .object({
      ...eventIdentity,
      type: z.literal("fallback"),
      reason: z.string().min(1).max(128),
    })
    .strict(),
  z
    .object({
      ...eventIdentity,
      type: z.literal("cancelled"),
      offsetMs,
    })
    .strict(),
  z
    .object({
      ...eventIdentity,
      type: z.literal("ordering-failure"),
      count: z.number().int().positive(),
    })
    .strict(),
]);

export type TurnMetricEvent = z.infer<typeof turnMetricEventSchema>;

export interface TurnMetricRecord {
  turnId: string;
  sessionId: string;
  traceId: string | null;
  experience: string | null;
  persona: string | null;
  transcriptConfidence: number | null;
  selectedRegion: string | null;
  transcriptFinalizedOffsetMs: number | null;
  serverGenerationStartedOffsetMs: number | null;
  firstTokenOffsetMs: number | null;
  firstPhraseOffsetMs: number | null;
  firstTtsByteOffsetMs: number | null;
  firstPlaybackOffsetMs: number | null;
  cancellationOffsetMs: number | null;
  generationProvider: string | null;
  generationModel: string | null;
  ttsProvider: string | null;
  ttsModel: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cachedTokens: number | null;
  estimatedCostUsd: number | null;
  fallbackReason: string | null;
  cancelled: boolean;
  orderingFailureCount: number;
}

export interface TurnMetricSummary {
  p50PlaybackMs: number | null;
  p95PlaybackMs: number | null;
  maxInputTokens: number;
  maxOutputTokens: number;
  cacheRatio: number | null;
  totalCostUsd: number;
  fallbackCount: number;
  cancelledCount: number;
  orderingFailureCount: number;
}

function newRecord(event: TurnMetricEvent): TurnMetricRecord {
  return {
    turnId: event.turnId,
    sessionId: event.sessionId,
    traceId: null,
    experience: null,
    persona: null,
    transcriptConfidence: null,
    selectedRegion: null,
    transcriptFinalizedOffsetMs: null,
    serverGenerationStartedOffsetMs: null,
    firstTokenOffsetMs: null,
    firstPhraseOffsetMs: null,
    firstTtsByteOffsetMs: null,
    firstPlaybackOffsetMs: null,
    cancellationOffsetMs: null,
    generationProvider: null,
    generationModel: null,
    ttsProvider: null,
    ttsModel: null,
    inputTokens: null,
    outputTokens: null,
    cachedTokens: null,
    estimatedCostUsd: null,
    fallbackReason: null,
    cancelled: false,
    orderingFailureCount: 0,
  };
}

export function applyMetricEvent(
  record: TurnMetricRecord | null,
  event: TurnMetricEvent,
): TurnMetricRecord {
  if (
    record !== null &&
    (record.turnId !== event.turnId || record.sessionId !== event.sessionId)
  ) {
    return record;
  }

  const next = record ?? newRecord(event);

  switch (event.type) {
    case "turn-context":
      return {
        ...next,
        traceId: next.traceId ?? event.traceId,
        experience: next.experience ?? event.experience,
        persona: next.persona ?? event.persona,
        selectedRegion: next.selectedRegion ?? event.selectedRegion,
      };
    case "transcript-finalized":
      return {
        ...next,
        transcriptFinalizedOffsetMs:
          next.transcriptFinalizedOffsetMs ?? event.offsetMs,
        transcriptConfidence:
          next.transcriptConfidence ?? event.confidence,
      };
    case "generation-started":
      return {
        ...next,
        serverGenerationStartedOffsetMs:
          next.serverGenerationStartedOffsetMs ?? event.offsetMs,
        generationProvider: next.generationProvider ?? event.provider,
        generationModel: next.generationModel ?? event.model,
      };
    case "first-token":
      return {
        ...next,
        firstTokenOffsetMs: next.firstTokenOffsetMs ?? event.offsetMs,
      };
    case "first-phrase":
      return {
        ...next,
        firstPhraseOffsetMs: next.firstPhraseOffsetMs ?? event.offsetMs,
      };
    case "first-tts-byte":
      return {
        ...next,
        firstTtsByteOffsetMs: next.firstTtsByteOffsetMs ?? event.offsetMs,
        ttsProvider: next.ttsProvider ?? event.provider,
        ttsModel: next.ttsModel ?? event.model,
      };
    case "first-playback":
      return {
        ...next,
        firstPlaybackOffsetMs: next.firstPlaybackOffsetMs ?? event.offsetMs,
      };
    case "usage":
      return {
        ...next,
        inputTokens: next.inputTokens ?? event.inputTokens,
        outputTokens: next.outputTokens ?? event.outputTokens,
        cachedTokens: next.cachedTokens ?? event.cachedTokens,
        estimatedCostUsd:
          next.inputTokens === null ? event.estimatedCostUsd : next.estimatedCostUsd,
      };
    case "fallback":
      return {
        ...next,
        fallbackReason: next.fallbackReason ?? event.reason,
      };
    case "cancelled":
      return {
        ...next,
        cancellationOffsetMs: next.cancellationOffsetMs ?? event.offsetMs,
        cancelled: true,
      };
    case "ordering-failure":
      return {
        ...next,
        orderingFailureCount: Math.max(next.orderingFailureCount, event.count),
      };
  }
}

function percentile(values: readonly number[], position: number): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * position;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const lower = sorted[lowerIndex];
  const upper = sorted[upperIndex];

  return lower + (upper - lower) * (index - lowerIndex);
}

function playbackDuration(record: TurnMetricRecord): number | null {
  const start = record.transcriptFinalizedOffsetMs;
  const end = record.firstPlaybackOffsetMs;

  if (start === null || end === null || end < start) return null;
  return end - start;
}

export function summarizeTurnMetrics(
  records: readonly TurnMetricRecord[],
): TurnMetricSummary {
  const playbackDurations = records
    .map(playbackDuration)
    .filter((duration): duration is number => duration !== null);

  let measuredInputTokens = 0;
  let measuredCachedTokens = 0;
  let hasMeasuredCachePair = false;

  for (const record of records) {
    if (record.inputTokens !== null && record.cachedTokens !== null) {
      measuredInputTokens += record.inputTokens;
      measuredCachedTokens += record.cachedTokens;
      hasMeasuredCachePair = true;
    }
  }

  return {
    p50PlaybackMs: percentile(playbackDurations, 0.5),
    p95PlaybackMs: percentile(playbackDurations, 0.95),
    maxInputTokens: records.reduce(
      (maximum, record) => Math.max(maximum, record.inputTokens ?? 0),
      0,
    ),
    maxOutputTokens: records.reduce(
      (maximum, record) => Math.max(maximum, record.outputTokens ?? 0),
      0,
    ),
    cacheRatio:
      hasMeasuredCachePair && measuredInputTokens > 0
        ? measuredCachedTokens / measuredInputTokens
        : null,
    totalCostUsd: records.reduce(
      (total, record) => total + (record.estimatedCostUsd ?? 0),
      0,
    ),
    fallbackCount: records.filter((record) => record.fallbackReason !== null)
      .length,
    cancelledCount: records.filter((record) => record.cancelled).length,
    orderingFailureCount: records.reduce(
      (total, record) => total + record.orderingFailureCount,
      0,
    ),
  };
}
