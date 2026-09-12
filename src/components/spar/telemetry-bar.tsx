"use client";

import { Activity, Clock, Gauge, ShieldCheck } from "lucide-react";

interface TelemetryBarProps {
  words: number;
  hedges: number;
  latencyMs: number;
  hasEvidence: boolean;
  /** When true, dims the bar (e.g., while personas are responding) */
  muted?: boolean;
}

/**
 * Subtle live telemetry — per brief section 3.3:
 * "Live Telemetry (subtle): WPM, filler count, pause time — numbers that
 * float in when relevant, not a dashboard."
 *
 * This is NOT a game HUD. It's coach's notes. Minimal, contextual, muted.
 */
export function TelemetryBar({
  words,
  hedges,
  latencyMs,
  hasEvidence,
  muted = false,
}: TelemetryBarProps) {
  const latencySec = latencyMs > 0 ? (latencyMs / 1000).toFixed(1) : "—";
  // Hedge warning tone: brighter if >2, muted otherwise.
  const hedgeTone = hedges > 2 ? "text-white" : "text-muted-foreground";
  const evidenceTone = hasEvidence ? "text-white" : "text-muted-foreground/60";

  return (
    <div
      className={`flex items-center gap-5 px-4 py-2 text-[11px] font-mono uppercase tracking-wider border-t border-border/60 transition-opacity ${
        muted ? "opacity-40" : "opacity-100"
      }`}
      aria-label="Live session telemetry"
    >
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Gauge className="h-3 w-3" />
        <span className="text-foreground/80">{words}</span> words
      </span>
      <span className="flex items-center gap-1.5">
        <Activity className={`h-3 w-3 ${hedgeTone}`} />
        <span className={hedgeTone}>{hedges}</span>
        <span className="text-muted-foreground/70">hedges</span>
      </span>
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span className="text-foreground/80">{latencySec}s</span> latency
      </span>
      <span className="flex items-center gap-1.5">
        <ShieldCheck className={`h-3 w-3 ${evidenceTone}`} />
        <span className={evidenceTone}>{hasEvidence ? "grounded" : "no evidence"}</span>
      </span>
    </div>
  );
}
