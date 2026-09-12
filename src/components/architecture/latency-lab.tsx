"use client";

import { Activity, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import type { MetricSummary, TurnMetricView } from "@/architecture/metrics";

interface MetricsResponse {
  turns: TurnMetricView[];
  summary: MetricSummary;
}

function formatMilliseconds(value: number | null): string {
  return value === null ? "—" : `${Math.round(value).toLocaleString()} ms`;
}

function formatRatio(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function formatCost(value: number): string {
  return `$${value.toFixed(6)}`;
}

function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="rounded-lg border border-border bg-background/55 p-4">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{note}</p>
    </article>
  );
}

export function LatencyLab() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadMetrics() {
      try {
        const response = await fetch("/api/dev/metrics", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Metrics request failed (${response.status})`);
        setMetrics((await response.json()) as MetricsResponse);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : "Metrics request failed");
      }
    }

    loadMetrics();
    return () => controller.abort();
  }, []);

  return (
    <section className="rounded-xl border border-border bg-card/45 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-foreground/70" aria-hidden="true" />
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Local measurements only
            </p>
          </div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight">Turn latency lab</h2>
        </div>
        <p className="max-w-lg text-xs leading-5 text-muted-foreground sm:text-right">
          Reads the same-origin development metrics route. Opening this view does not call a model, speech, or provider endpoint.
        </p>
      </div>

      <div className="mt-6 border-t border-border pt-6" aria-live="polite" aria-busy={!metrics && !error}>
        {error ? (
          <div className="flex min-h-52 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background/35 px-5 text-center">
            <AlertTriangle className="size-5 text-muted-foreground" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-medium">Metrics are unavailable</h3>
            <p className="mt-2 max-w-md text-xs leading-5 text-muted-foreground">{error}</p>
          </div>
        ) : !metrics ? (
          <div className="flex min-h-52 items-center justify-center rounded-lg border border-dashed border-border bg-background/35 px-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Reading local turns…</p>
          </div>
        ) : metrics.turns.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background/35 px-5 text-center">
            <span className="size-2 rounded-full border border-foreground/40" aria-hidden="true" />
            <h3 className="mt-4 text-base font-semibold tracking-tight">No measured turns yet</h3>
            <p className="mt-2 max-w-md text-xs leading-5 text-muted-foreground">
              This endpoint currently has no persisted turn traces. Percentiles and costs remain blank until real measurements exist.
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-baseline justify-between gap-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Measured summary</p>
              <p className="font-mono text-[10px] tabular-nums text-foreground/70">
                {metrics.summary.turnCount} {metrics.summary.turnCount === 1 ? "turn" : "turns"}
              </p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Playback p50" value={formatMilliseconds(metrics.summary.p50PlaybackMs)} note="Median time to playback" />
              <MetricCard label="Playback p95" value={formatMilliseconds(metrics.summary.p95PlaybackMs)} note="Linear-interpolated tail" />
              <MetricCard label="Max input" value={metrics.summary.maxInputTokens.toLocaleString()} note="Largest measured prompt" />
              <MetricCard label="Max output" value={metrics.summary.maxOutputTokens.toLocaleString()} note="Largest measured response" />
              <MetricCard label="Cache ratio" value={formatRatio(metrics.summary.cacheRatio)} note="Cached ÷ input tokens" />
              <MetricCard label="Total cost" value={formatCost(metrics.summary.totalCostUsd)} note="Recorded estimated spend" />
              <MetricCard label="Fallbacks" value={metrics.summary.fallbackCount.toLocaleString()} note="Measured fallback turns" />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
