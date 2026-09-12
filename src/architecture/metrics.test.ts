import { expect, test } from "bun:test";
import { summarizeMetrics } from "./metrics";

test("summarizes playback latency and token use", () => {
  const summary = summarizeMetrics([
    {
      turnId: "1",
      playbackMs: 800,
      inputTokens: 900,
      outputTokens: 40,
      cachedTokens: 600,
      costUsd: 0.0001,
      fallback: false,
    },
    {
      turnId: "2",
      playbackMs: 1200,
      inputTokens: 1100,
      outputTokens: 55,
      cachedTokens: 700,
      costUsd: 0.0002,
      fallback: true,
    },
  ]);

  expect(summary.p50PlaybackMs).toBe(1000);
  expect(summary.p95PlaybackMs).toBe(1180);
  expect(summary.maxInputTokens).toBe(1100);
  expect(summary.maxOutputTokens).toBe(55);
  expect(summary.cacheRatio).toBe(0.65);
  expect(summary.totalCostUsd).toBeCloseTo(0.0003);
  expect(summary.fallbackCount).toBe(1);
});

test("returns null percentiles and zero totals for no measured turns", () => {
  expect(summarizeMetrics([])).toEqual({
    turnCount: 0,
    p50PlaybackMs: null,
    p95PlaybackMs: null,
    maxInputTokens: 0,
    maxOutputTokens: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCachedTokens: 0,
    cacheRatio: null,
    totalCostUsd: 0,
    fallbackCount: 0,
  });
});

test("uses linear interpolation for unsorted playback samples", () => {
  const summary = summarizeMetrics([
    {
      turnId: "slow",
      playbackMs: 400,
      inputTokens: 10,
      outputTokens: 8,
      cachedTokens: 5,
      costUsd: 0.4,
      fallback: false,
    },
    {
      turnId: "fast",
      playbackMs: 100,
      inputTokens: 20,
      outputTokens: 2,
      cachedTokens: 0,
      costUsd: 0.1,
      fallback: false,
    },
    {
      turnId: "medium",
      playbackMs: 300,
      inputTokens: 0,
      outputTokens: 6,
      cachedTokens: 0,
      costUsd: 0.3,
      fallback: true,
    },
    {
      turnId: "quick",
      playbackMs: 200,
      inputTokens: 5,
      outputTokens: 4,
      cachedTokens: 0,
      costUsd: 0.2,
      fallback: true,
    },
  ]);

  expect(summary.p50PlaybackMs).toBe(250);
  expect(summary.p95PlaybackMs).toBe(385);
  expect(summary.totalInputTokens).toBe(35);
  expect(summary.totalOutputTokens).toBe(20);
  expect(summary.totalCachedTokens).toBe(5);
  expect(summary.cacheRatio).toBeCloseTo(1 / 7);
  expect(summary.totalCostUsd).toBeCloseTo(1);
  expect(summary.fallbackCount).toBe(2);
});

test("handles a single turn with no input tokens without dividing by zero", () => {
  const summary = summarizeMetrics([
    {
      turnId: "1",
      playbackMs: 275,
      inputTokens: 0,
      outputTokens: 12,
      cachedTokens: 0,
      costUsd: 0,
      fallback: false,
    },
  ]);

  expect(summary.p50PlaybackMs).toBe(275);
  expect(summary.p95PlaybackMs).toBe(275);
  expect(summary.cacheRatio).toBeNull();
});
