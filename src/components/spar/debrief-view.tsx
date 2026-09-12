"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Sparkles,
  TrendingUp,
  AlertCircle,
  Target,
  BarChart3,
  Share2,
  Check,
  ArrowRight,
  ArrowLeft,
  Quote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DebriefPayload, TelemetrySnapshot } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DebriefViewProps {
  sessionId: string;
  scenarioLabel?: string;
  onBackHome: () => void;
  onSparAgain: () => void;
}

interface DebriefResponse {
  debrief: DebriefPayload;
  telemetry: TelemetrySnapshot | null;
  skillSnapshot?: {
    clarity: number;
    recovery: number;
    concision: number;
    presence: number;
    evidence: number;
  };
}

export function DebriefView({
  sessionId,
  scenarioLabel,
  onBackHome,
  onSparAgain,
}: DebriefViewProps) {
  const [data, setData] = useState<DebriefResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/debrief`);
        if (!res.ok) throw new Error("Failed to load debrief");
        const json = await res.json();
        if (mounted) setData(json);
      } catch (e) {
        if (mounted) setError(String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [sessionId]);

  async function handleCopy() {
    if (!data?.debrief.shareableSummary) return;
    try {
      await navigator.clipboard.writeText(data.debrief.shareableSummary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
        <p className="text-sm text-muted-foreground">
          The coach is reviewing the tape...
        </p>
        <p className="max-w-md text-center text-xs text-muted-foreground/60">
          We&apos;re analyzing your transcript, computing telemetry, and connecting patterns from previous sessions. This takes ~10-15 seconds.
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">
          {error || "Failed to load debrief."}
        </p>
        <Button variant="outline" onClick={onBackHome}>
          Back to Home
        </Button>
      </div>
    );
  }

  const d = data.debrief;
  const t = data.telemetry;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70">
          {scenarioLabel || "Session"} — Debrief
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          The coach&apos;s notes
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Honest. Specific. Forward-looking. No scores — just development.
        </p>
      </div>

      <div className="space-y-5">
        {/* Section 1 — The Moment */}
        <DebriefSection
          number="01"
          icon={<Quote className="h-4 w-4" />}
          title="The Moment"
          accent="primary"
        >
          <p className="text-sm leading-relaxed text-foreground/90">{d.momentDescription}</p>
        </DebriefSection>

        {/* Section 2 — What You Did Well */}
        <DebriefSection
          number="02"
          icon={<Sparkles className="h-4 w-4" />}
          title="What You Did Well"
          accent="emerald"
        >
          <ul className="space-y-2">
            {d.whatWentWell.length > 0 ? (
              d.whatWentWell.map((item, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-foreground/90">
                  <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-white/60" />
                  <span>{item}</span>
                </li>
              ))
            ) : (
              <li className="text-sm text-muted-foreground">
                No specific strengths noted.
              </li>
            )}
          </ul>
        </DebriefSection>

        {/* Section 3 — The Pattern */}
        <DebriefSection
          number="03"
          icon={<TrendingUp className="h-4 w-4" />}
          title="The Pattern"
          accent="amber"
        >
          <p className="text-sm leading-relaxed text-foreground/90">{d.thePattern}</p>
        </DebriefSection>

        {/* Section 4 — One Thing to Practice */}
        <DebriefSection
          number="04"
          icon={<Target className="h-4 w-4" />}
          title="One Thing to Practice"
          accent="primary"
          highlighted
        >
          <p className="text-sm leading-relaxed text-foreground/90">{d.oneThingToPractice}</p>
        </DebriefSection>

        {/* Section 5 — Telemetry as Insight */}
        <DebriefSection
          number="05"
          icon={<BarChart3 className="h-4 w-4" />}
          title="Telemetry"
          accent="slate"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TelemetryInsight
              label="Pace"
              value={d.telemetryInsights.pace}
              metric={
                t
                  ? `${t.avgWordsPerResponse} words / response`
                  : undefined
              }
            />
            <TelemetryInsight
              label="Fillers"
              value={d.telemetryInsights.fillers}
              metric={
                t
                  ? `${t.hedgeCount} hedges (${t.hedgesPerResponse}/response)`
                  : undefined
              }
            />
            <TelemetryInsight
              label="Recovery"
              value={d.telemetryInsights.recovery}
              metric={
                t
                  ? `${t.deflections} deflections / ${t.userTurns} turns`
                  : undefined
              }
            />
            <TelemetryInsight
              label="Evidence"
              value={d.telemetryInsights.evidence}
              metric={
                t
                  ? `${t.evidenceCitations}/${t.userTurns} responses cited data`
                  : undefined
              }
            />
          </div>
        </DebriefSection>

        {/* Section 6 — Save or Share */}
        <DebriefSection
          number="06"
          icon={<Share2 className="h-4 w-4" />}
          title="Save or Share"
          accent="slate"
        >
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
            <p className="mb-3 text-[11px] uppercase tracking-wider text-muted-foreground/70">
              Shareable summary
            </p>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
              {d.shareableSummary}
            </pre>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1.5" /> Copied
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5 mr-1.5" /> Copy summary
                </>
              )}
            </Button>
          </div>
        </DebriefSection>

        {/* Skill snapshot — subtle, framed as baseline not score */}
        {data.skillSnapshot && (
          <div className="rounded-lg border border-border/40 bg-card/30 p-4">
            <p className="mb-3 text-[11px] uppercase tracking-wider text-muted-foreground/70">
              Skill baseline (this session)
            </p>
            <div className="grid grid-cols-5 gap-2">
              {[
                { name: "Clarity", v: data.skillSnapshot.clarity },
                { name: "Recovery", v: data.skillSnapshot.recovery },
                { name: "Concision", v: data.skillSnapshot.concision },
                { name: "Presence", v: data.skillSnapshot.presence },
                { name: "Evidence", v: data.skillSnapshot.evidence },
              ].map((s) => (
                <div key={s.name} className="text-center">
                  <div className="mx-auto h-16 w-2 overflow-hidden rounded-full bg-muted/40">
                    <div
                      className="h-full rounded-full bg-white/70 transition-all"
                      style={{ height: `${s.v}%`, marginTop: `${100 - s.v}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    {s.name}
                  </p>
                  <p className="text-xs font-medium text-foreground tabular-nums">{s.v}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="mt-8 flex flex-col gap-3 border-t border-border/60 pt-6 sm:flex-row sm:justify-between">
        <Button variant="ghost" onClick={onBackHome}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Home
        </Button>
        <Button onClick={onSparAgain}>
          Spar again <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}

function DebriefSection({
  number,
  icon,
  title,
  accent,
  highlighted,
  children,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  accent: "primary" | "emerald" | "amber" | "slate";
  highlighted?: boolean;
  children: React.ReactNode;
}) {
  const accentClasses = {
    primary: "text-white",
    emerald: "text-white/70",
    amber: "text-white/70",
    slate: "text-neutral-500",
  };
  return (
    <section
      className={cn(
        "rounded-lg border bg-card/40 p-5",
        highlighted ? "border-white/20 bg-white/[0.03]" : "border-border/60"
      )}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <span className={cn("flex h-6 w-6 items-center justify-center rounded", accentClasses[accent])}>
          {icon}
        </span>
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground/40">{number}</span>
      </div>
      {children}
    </section>
  );
}

function TelemetryInsight({
  label,
  value,
  metric,
}: {
  label: string;
  value: string;
  metric?: string;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-muted/20 p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
          {label}
        </span>
        {metric && (
          <span className="font-mono text-[10px] text-muted-foreground/60">{metric}</span>
        )}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-foreground/90">{value}</p>
    </div>
  );
}
