export interface TurnMetricView {
  turnId: string;
  playbackMs: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  costUsd: number;
  fallback: boolean;
}

export interface MetricSummary {
  turnCount: number;
  p50PlaybackMs: number | null;
  p95PlaybackMs: number | null;
  maxInputTokens: number;
  maxOutputTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
  cacheRatio: number | null;
  totalCostUsd: number;
  fallbackCount: number;
}

function percentile(values: number[], position: number): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * position;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const lower = sorted[lowerIndex];
  const upper = sorted[upperIndex];

  return lower + (upper - lower) * (index - lowerIndex);
}

export function summarizeMetrics(
  metrics: readonly TurnMetricView[],
): MetricSummary {
  const totals = metrics.reduce(
    (summary, metric) => ({
      maxInputTokens: Math.max(summary.maxInputTokens, metric.inputTokens),
      maxOutputTokens: Math.max(summary.maxOutputTokens, metric.outputTokens),
      totalInputTokens: summary.totalInputTokens + metric.inputTokens,
      totalOutputTokens: summary.totalOutputTokens + metric.outputTokens,
      totalCachedTokens: summary.totalCachedTokens + metric.cachedTokens,
      totalCostUsd: summary.totalCostUsd + metric.costUsd,
      fallbackCount: summary.fallbackCount + (metric.fallback ? 1 : 0),
    }),
    {
      maxInputTokens: 0,
      maxOutputTokens: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCachedTokens: 0,
      totalCostUsd: 0,
      fallbackCount: 0,
    },
  );

  return {
    turnCount: metrics.length,
    p50PlaybackMs: percentile(metrics.map((metric) => metric.playbackMs), 0.5),
    p95PlaybackMs: percentile(metrics.map((metric) => metric.playbackMs), 0.95),
    ...totals,
    cacheRatio:
      totals.totalInputTokens === 0
        ? null
        : totals.totalCachedTokens / totals.totalInputTokens,
  };
}
