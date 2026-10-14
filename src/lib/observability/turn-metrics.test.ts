import { describe, expect, test } from "bun:test";
import {
  applyMetricEvent,
  summarizeTurnMetrics,
  type TurnMetricEvent,
  type TurnMetricRecord,
} from "./turn-metrics";

function applyEvents(events: readonly TurnMetricEvent[]): TurnMetricRecord {
  return events.reduce<TurnMetricRecord | null>(applyMetricEvent, null)!;
}

describe("applyMetricEvent", () => {
  test("records turn context and every measured pipeline milestone", () => {
    const record = applyEvents([
      {
        type: "turn-context",
        turnId: "turn-1",
        sessionId: "session-1",
        traceId: "trace-1",
        experience: "boardroom",
        persona: "The Skeptic",
        selectedRegion: "eu",
      },
      {
        type: "transcript-finalized",
        turnId: "turn-1",
        sessionId: "session-1",
        offsetMs: 125.5,
        confidence: 0.94,
      },
      {
        type: "generation-started",
        turnId: "turn-1",
        sessionId: "session-1",
        offsetMs: 180,
        provider: "groq",
        model: "openai/gpt-oss-20b",
      },
      {
        type: "first-token",
        turnId: "turn-1",
        sessionId: "session-1",
        offsetMs: 245,
      },
      {
        type: "first-phrase",
        turnId: "turn-1",
        sessionId: "session-1",
        offsetMs: 315,
      },
      {
        type: "first-tts-byte",
        turnId: "turn-1",
        sessionId: "session-1",
        offsetMs: 405,
        provider: "deepgram",
        model: "aura-2-thalia-en",
      },
      {
        type: "first-playback",
        turnId: "turn-1",
        sessionId: "session-1",
        offsetMs: 470,
      },
      {
        type: "usage",
        turnId: "turn-1",
        sessionId: "session-1",
        inputTokens: 950,
        outputTokens: 48,
        cachedTokens: 640,
        estimatedCostUsd: 0.00021,
      },
      {
        type: "fallback",
        turnId: "turn-1",
        sessionId: "session-1",
        reason: "groq-unavailable-before-speech",
      },
      {
        type: "cancelled",
        turnId: "turn-1",
        sessionId: "session-1",
        offsetMs: 500,
      },
      {
        type: "ordering-failure",
        turnId: "turn-1",
        sessionId: "session-1",
        count: 2,
      },
    ]);

    expect(record).toEqual({
      turnId: "turn-1",
      sessionId: "session-1",
      traceId: "trace-1",
      experience: "boardroom",
      persona: "The Skeptic",
      transcriptConfidence: 0.94,
      selectedRegion: "eu",
      transcriptFinalizedOffsetMs: 125.5,
      serverGenerationStartedOffsetMs: 180,
      firstTokenOffsetMs: 245,
      firstPhraseOffsetMs: 315,
      firstTtsByteOffsetMs: 405,
      firstPlaybackOffsetMs: 470,
      cancellationOffsetMs: 500,
      generationProvider: "groq",
      generationModel: "openai/gpt-oss-20b",
      ttsProvider: "deepgram",
      ttsModel: "aura-2-thalia-en",
      inputTokens: 950,
      outputTokens: 48,
      cachedTokens: 640,
      estimatedCostUsd: 0.00021,
      fallbackReason: "groq-unavailable-before-speech",
      cancelled: true,
      orderingFailureCount: 2,
      voiceEngine: null,
      firstLiveAudioMs: null,
      interruptions: null,
    });
  });

  test("keeps the first value when a stage event is duplicated", () => {
    const initial = applyEvents([
      {
        type: "turn-context",
        turnId: "turn-1",
        sessionId: "session-1",
        traceId: "trace-original",
        experience: "open_spar",
        persona: "The Ally",
        selectedRegion: "us",
      },
      {
        type: "first-playback",
        turnId: "turn-1",
        sessionId: "session-1",
        offsetMs: 700,
      },
      {
        type: "usage",
        turnId: "turn-1",
        sessionId: "session-1",
        inputTokens: 800,
        outputTokens: 30,
        cachedTokens: 500,
        estimatedCostUsd: 0.0001,
      },
    ]);

    const duplicateContext = applyMetricEvent(initial, {
      type: "turn-context",
      turnId: "turn-1",
      sessionId: "session-1",
      traceId: "trace-duplicate",
      experience: "drill",
      persona: "A different persona",
      selectedRegion: "eu",
    });
    const duplicatePlayback = applyMetricEvent(duplicateContext, {
      type: "first-playback",
      turnId: "turn-1",
      sessionId: "session-1",
      offsetMs: 999,
    });
    const duplicateUsage = applyMetricEvent(duplicatePlayback, {
      type: "usage",
      turnId: "turn-1",
      sessionId: "session-1",
      inputTokens: 1,
      outputTokens: 1,
      cachedTokens: 1,
      estimatedCostUsd: 1,
    });

    expect(duplicateUsage).toEqual(initial);
  });

  test("ignores stale turn IDs and session mismatches without changing the record", () => {
    const initial = applyEvents([
      {
        type: "first-token",
        turnId: "turn-current",
        sessionId: "session-current",
        offsetMs: 220,
      },
    ]);

    const staleTurn = applyMetricEvent(initial, {
      type: "first-playback",
      turnId: "turn-stale",
      sessionId: "session-current",
      offsetMs: 500,
    });
    const wrongSession = applyMetricEvent(initial, {
      type: "first-playback",
      turnId: "turn-current",
      sessionId: "session-other",
      offsetMs: 500,
    });

    expect(staleTurn).toBe(initial);
    expect(wrongSession).toBe(initial);
    expect(initial.firstPlaybackOffsetMs).toBeNull();
  });

  test("records live-engine attribution with first-writer-wins per field", () => {
    const declared = applyEvents([
      {
        type: "live-engine",
        turnId: "turn-1",
        sessionId: "session-1",
        voiceEngine: "gemini-live",
      },
    ]);

    expect(declared.voiceEngine).toBe("gemini-live");
    expect(declared.firstLiveAudioMs).toBeNull();
    expect(declared.interruptions).toBeNull();

    const measured = applyMetricEvent(declared, {
      type: "live-engine",
      turnId: "turn-1",
      sessionId: "session-1",
      voiceEngine: "cascade",
      firstLiveAudioMs: 812,
      interruptions: 1,
    });

    expect(measured.voiceEngine).toBe("gemini-live");
    expect(measured.firstLiveAudioMs).toBe(812);
    expect(measured.interruptions).toBe(1);

    const duplicate = applyMetricEvent(measured, {
      type: "live-engine",
      turnId: "turn-1",
      sessionId: "session-1",
      voiceEngine: "browser",
      firstLiveAudioMs: 999,
      interruptions: 3,
    });

    expect(duplicate).toEqual(measured);
  });

  test("treats ordering failure counts as idempotent absolute totals", () => {
    const initial = applyEvents([
      {
        type: "ordering-failure",
        turnId: "turn-1",
        sessionId: "session-1",
        count: 2,
      },
    ]);
    const duplicate = applyMetricEvent(initial, {
      type: "ordering-failure",
      turnId: "turn-1",
      sessionId: "session-1",
      count: 2,
    });
    const laterTotal = applyMetricEvent(duplicate, {
      type: "ordering-failure",
      turnId: "turn-1",
      sessionId: "session-1",
      count: 3,
    });

    expect(duplicate.orderingFailureCount).toBe(2);
    expect(laterTotal.orderingFailureCount).toBe(3);
  });
});

describe("summarizeTurnMetrics", () => {
  test("summarizes complete playback spans, tokens, costs, fallbacks, cancellations, and ordering failures", () => {
    const first = applyEvents([
      {
        type: "transcript-finalized",
        turnId: "turn-1",
        sessionId: "session-1",
        offsetMs: 100,
        confidence: 0.9,
      },
      {
        type: "first-playback",
        turnId: "turn-1",
        sessionId: "session-1",
        offsetMs: 900,
      },
      {
        type: "usage",
        turnId: "turn-1",
        sessionId: "session-1",
        inputTokens: 900,
        outputTokens: 40,
        cachedTokens: 600,
        estimatedCostUsd: 0.0001,
      },
    ]);
    const second = applyEvents([
      {
        type: "transcript-finalized",
        turnId: "turn-2",
        sessionId: "session-1",
        offsetMs: 300,
        confidence: 0.8,
      },
      {
        type: "first-playback",
        turnId: "turn-2",
        sessionId: "session-1",
        offsetMs: 1500,
      },
      {
        type: "usage",
        turnId: "turn-2",
        sessionId: "session-1",
        inputTokens: 1100,
        outputTokens: 55,
        cachedTokens: 700,
        estimatedCostUsd: 0.0002,
      },
      {
        type: "fallback",
        turnId: "turn-2",
        sessionId: "session-1",
        reason: "groq-unavailable-before-speech",
      },
      {
        type: "cancelled",
        turnId: "turn-2",
        sessionId: "session-1",
        offsetMs: 1600,
      },
      {
        type: "ordering-failure",
        turnId: "turn-2",
        sessionId: "session-1",
        count: 3,
      },
    ]);

    expect(summarizeTurnMetrics([first, second])).toEqual({
      p50PlaybackMs: 1000,
      p95PlaybackMs: 1180,
      maxInputTokens: 1100,
      maxOutputTokens: 55,
      cacheRatio: 0.65,
      totalCostUsd: 0.00030000000000000003,
      fallbackCount: 1,
      cancelledCount: 1,
      orderingFailureCount: 3,
      voiceEngines: { "gemini-live": null, cascade: null, browser: null },
    });
  });

  test("does not invent a playback duration when either endpoint is missing or backwards", () => {
    const missingStart = applyEvents([
      {
        type: "first-playback",
        turnId: "turn-missing-start",
        sessionId: "session-1",
        offsetMs: 450,
      },
    ]);
    const missingEnd = applyEvents([
      {
        type: "transcript-finalized",
        turnId: "turn-missing-end",
        sessionId: "session-1",
        offsetMs: 100,
        confidence: 0.92,
      },
    ]);
    const backwards = applyEvents([
      {
        type: "transcript-finalized",
        turnId: "turn-backwards",
        sessionId: "session-1",
        offsetMs: 500,
        confidence: 0.92,
      },
      {
        type: "first-playback",
        turnId: "turn-backwards",
        sessionId: "session-1",
        offsetMs: 400,
      },
    ]);

    expect(
      summarizeTurnMetrics([missingStart, missingEnd, backwards]),
    ).toEqual({
      p50PlaybackMs: null,
      p95PlaybackMs: null,
      maxInputTokens: 0,
      maxOutputTokens: 0,
      cacheRatio: null,
      totalCostUsd: 0,
      fallbackCount: 0,
      cancelledCount: 0,
      orderingFailureCount: 0,
      voiceEngines: { "gemini-live": null, cascade: null, browser: null },
    });
  });

  test("labels firstLiveAudioMs percentiles and interruptions by engine and counts live turns only there", () => {
    const liveFast = applyEvents([
      {
        type: "live-engine",
        turnId: "turn-live-1",
        sessionId: "session-1",
        voiceEngine: "gemini-live",
        firstLiveAudioMs: 812,
        interruptions: 1,
      },
      // Pipeline events on a live turn must not leak into playback percentiles.
      {
        type: "transcript-finalized",
        turnId: "turn-live-1",
        sessionId: "session-1",
        offsetMs: 100,
        confidence: 0.9,
      },
      {
        type: "first-playback",
        turnId: "turn-live-1",
        sessionId: "session-1",
        offsetMs: 900,
      },
    ]);
    const liveMiddle = applyEvents([
      {
        type: "live-engine",
        turnId: "turn-live-2",
        sessionId: "session-1",
        voiceEngine: "gemini-live",
        firstLiveAudioMs: 900,
      },
    ]);
    const liveSlow = applyEvents([
      {
        type: "live-engine",
        turnId: "turn-live-3",
        sessionId: "session-1",
        voiceEngine: "gemini-live",
        firstLiveAudioMs: 1200,
        interruptions: 2,
      },
    ]);
    const cascadeTurn = applyEvents([
      {
        type: "live-engine",
        turnId: "turn-cascade",
        sessionId: "session-1",
        voiceEngine: "cascade",
        firstLiveAudioMs: 400,
      },
    ]);
    const browserTurn = applyEvents([
      {
        type: "live-engine",
        turnId: "turn-browser",
        sessionId: "session-1",
        voiceEngine: "browser",
      },
    ]);
    const textTurn = applyEvents([
      {
        type: "transcript-finalized",
        turnId: "turn-text",
        sessionId: "session-1",
        offsetMs: 200,
        confidence: 0.9,
      },
      {
        type: "first-playback",
        turnId: "turn-text",
        sessionId: "session-1",
        offsetMs: 700,
      },
    ]);

    const summary = summarizeTurnMetrics([
      liveFast,
      liveMiddle,
      liveSlow,
      cascadeTurn,
      browserTurn,
      textTurn,
    ]);

    expect(summary.p50PlaybackMs).toBe(500);
    expect(summary.p95PlaybackMs).toBe(500);
    expect(summary.voiceEngines).toEqual({
      "gemini-live": {
        turnCount: 3,
        p50FirstLiveAudioMs: 900,
        p95FirstLiveAudioMs: 1170,
        interruptions: 3,
      },
      cascade: {
        turnCount: 1,
        p50FirstLiveAudioMs: 400,
        p95FirstLiveAudioMs: 400,
        interruptions: 0,
      },
      browser: {
        turnCount: 1,
        p50FirstLiveAudioMs: null,
        p95FirstLiveAudioMs: null,
        interruptions: 0,
      },
    });
  });

  test("renders unmeasured engine latency as null instead of zero", () => {
    const liveTurn = applyEvents([
      {
        type: "live-engine",
        turnId: "turn-live-1",
        sessionId: "session-1",
        voiceEngine: "browser",
      },
    ]);

    const summary = summarizeTurnMetrics([liveTurn]);

    expect(summary.voiceEngines.browser).toEqual({
      turnCount: 1,
      p50FirstLiveAudioMs: null,
      p95FirstLiveAudioMs: null,
      interruptions: 0,
    });
    expect(summary.voiceEngines["gemini-live"]).toBeNull();
    expect(summary.voiceEngines.cascade).toBeNull();
  });

  test("uses only measured input/cache pairs when calculating the cache ratio", () => {
    const completeUsage = applyEvents([
      {
        type: "usage",
        turnId: "turn-complete",
        sessionId: "session-1",
        inputTokens: 100,
        outputTokens: 10,
        cachedTokens: 40,
        estimatedCostUsd: null,
      },
    ]);
    const missingUsage = applyEvents([
      {
        type: "first-token",
        turnId: "turn-missing",
        sessionId: "session-1",
        offsetMs: 10,
      },
    ]);

    expect(summarizeTurnMetrics([completeUsage, missingUsage]).cacheRatio).toBe(
      0.4,
    );
  });
});
