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
  FileText,
  Play,
  Pause,
  Headphones,
  ChevronDown,
  ChevronRight,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DebriefPayload, TelemetrySnapshot } from "@/lib/types";
import { getSessionClips, createClipURL } from "@/lib/audio-db";
import { cn } from "@/lib/utils";

interface DebriefViewProps {
  sessionId: string;
  scenarioLabel?: string;
  onBackHome: () => void;
  onSparAgain: () => void;
}

interface TranscriptEntry {
  role: string;
  personaName: string | null;
  content: string;
  type: string;
  createdAt: string;
}

interface DrillStats {
  target: string;
  label: string;
  totalChallenges: number;
  resolvedChallenges: number;
  unresolvedChallenges: number;
  attempt1Clean: number;
  attempt2Clean: number;
  attempt3Plus: number;
  fastestRecovery: number;
  slowestRecovery: number;
  avgRecovery: number;
  totalScore: number;
  maxScore: number;
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
  transcript?: TranscriptEntry[];
  drillStats?: DrillStats | null;
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
  // Audio clips from IndexedDB — keyed by messageIndex
  const [clips, setClips] = useState<Map<number, { url: string; duration: number }>>(new Map());
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    let mounted = true;
    let audioEl: HTMLAudioElement | null = null;
    (async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/debrief`);
        if (!res.ok) throw new Error("Failed to load debrief");
        const json = await res.json();
        if (!mounted) return;
        setData(json);

        // Fetch audio clips from IndexedDB (after data loads so we know the transcript)
        try {
          const clipMap = await getSessionClips(sessionId);
          const urlMap = new Map<number, { url: string; duration: number }>();
          let idx = 0;
          for (const entry of json.transcript || []) {
            if (entry.role === "user") {
              const clip = clipMap.get(idx);
              if (clip) {
                const url = createClipURL(clip.blob);
                if (url) {
                  urlMap.set(idx, { url, duration: clip.duration });
                }
              }
              idx++;
            }
          }
          if (mounted) setClips(urlMap);
        } catch {
          // IndexedDB not available — clips stay empty
        }
      } catch (e) {
        if (mounted) setError(String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
      if (audioEl) {
        audioEl.pause();
      }
      // Revoke object URLs to free memory
      clips.forEach((c) => URL.revokeObjectURL(c.url));
    };
  }, [sessionId]);

  // Play an audio clip
  function playClip(index: number) {
    const clip = clips.get(index);
    if (!clip) return;

    // Stop any currently playing audio
    if (playingIndex !== null) {
      const existing = document.getElementById(`audio-${playingIndex}`) as HTMLAudioElement | null;
      if (existing) existing.pause();
    }

    const el = document.getElementById(`audio-${index}`) as HTMLAudioElement | null;
    if (el) {
      el.currentTime = 0;
      el.play().then(() => setPlayingIndex(index)).catch(() => {});
    }
  }

  function pauseClip() {
    if (playingIndex !== null) {
      const el = document.getElementById(`audio-${playingIndex}`) as HTMLAudioElement | null;
      if (el) el.pause();
    }
    setPlayingIndex(null);
  }

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

        {/* Your Answers — audio playback section.
            Shows each user message with a play button (if a clip exists).
            Collapsible so it doesn't overwhelm the debrief. */}
        {data.transcript && data.transcript.some((m) => m.role === "user") && (
          <YourAnswersSection
            transcript={data.transcript}
            clips={clips}
            playingIndex={playingIndex}
            onPlay={playClip}
            onPause={pauseClip}
          />
        )}

        {/* Drill stats — only for drill sessions */}
        {data.drillStats && (
          <DebriefSection
            number="—"
            icon={<Activity className="h-4 w-4" />}
            title={`Drill: ${data.drillStats.label}`}
            accent="amber"
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <DrillStat label="Challenges" value={`${data.drillStats.totalChallenges}`} />
              <DrillStat label="Resolved" value={`${data.drillStats.resolvedChallenges}`} />
              <DrillStat label="Score" value={`${data.drillStats.totalScore}/${data.drillStats.maxScore}`} />
              <DrillStat label="Avg recovery" value={`${data.drillStats.avgRecovery}s`} />
            </div>
            {/* Attempt breakdown — visual dots */}
            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2">
                Attempt breakdown
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: data.drillStats.totalChallenges }).map((_, i) => {
                  // Each challenge: green (1st try), amber (2nd), red (3+)
                  // We don't track per-challenge here, so show aggregate
                  const isClean1 = i < data.drillStats!.attempt1Clean;
                  const isClean2 = !isClean1 && i < data.drillStats!.attempt1Clean + data.drillStats!.attempt2Clean;
                  const color = isClean1 ? "bg-emerald-500/70" : isClean2 ? "bg-amber-500/70" : "bg-red-500/70";
                  return (
                    <div
                      key={i}
                      className={cn("h-2 w-2 rounded-full", color)}
                      title={`Challenge ${i + 1}`}
                    />
                  );
                })}
              </div>
              <div className="mt-2 flex gap-4 text-[10px] text-muted-foreground/60">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/70" />
                  Clean on 1st try ({data.drillStats.attempt1Clean})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500/70" />
                  2nd try ({data.drillStats.attempt2Clean})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500/70" />
                  3+ tries ({data.drillStats.attempt3Plus})
                </span>
              </div>
            </div>
          </DebriefSection>
        )}

        {/* Section 2 — Your Presentation (Defense/Boardroom only) */}
        {d.presentationEvaluation && (
          <DebriefSection
            number="02"
            icon={<FileText className="h-4 w-4" />}
            title="Your Presentation"
            accent="slate"
            highlighted
          >
            <p className="text-sm leading-relaxed text-foreground/90">{d.presentationEvaluation}</p>
            {d.coachRead && (
              <div className="mt-3 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
                  Coach&apos;s initial read
                </p>
                <p className="text-xs text-neutral-400 italic">{d.coachRead}</p>
              </div>
            )}
          </DebriefSection>
        )}

        {/* Section 3 — What You Did Well */}
        <DebriefSection
          number={d.presentationEvaluation ? "03" : "02"}
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
          number={d.presentationEvaluation ? "04" : "03"}
          icon={<TrendingUp className="h-4 w-4" />}
          title="The Pattern"
          accent="amber"
        >
          <p className="text-sm leading-relaxed text-foreground/90">{d.thePattern}</p>
        </DebriefSection>

        {/* Section 4 — One Thing to Practice */}
        <DebriefSection
          number={d.presentationEvaluation ? "05" : "04"}
          icon={<Target className="h-4 w-4" />}
          title="One Thing to Practice"
          accent="primary"
          highlighted
        >
          <p className="text-sm leading-relaxed text-foreground/90">{d.oneThingToPractice}</p>
        </DebriefSection>

        {/* Section 5 — Telemetry as Insight */}
        <DebriefSection
          number={d.presentationEvaluation ? "06" : "05"}
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
          number={d.presentationEvaluation ? "07" : "06"}
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

      {/* Collapsible full transcript */}
      {data.transcript && data.transcript.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            {showTranscript ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            Full transcript ({data.transcript.length} messages)
          </button>
          {showTranscript && (
            <div className="mt-3 max-h-96 overflow-y-auto rounded-lg border border-border/40 bg-muted/20 p-4">
              <div className="space-y-2.5">
                {data.transcript.map((m, i) => (
                  <div key={i} className="text-xs">
                    <span className="font-medium text-muted-foreground">
                      {m.role === "user" ? "You" : m.personaName || "Panelist"}
                      {m.type === "interruption" && " (interrupting)"}
                      {m.type === "opening" && " (opening)"}
                      :
                    </span>{" "}
                    <span className="text-foreground/80">{m.content}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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

/**
 * Your Answers section — audio playback for each user message.
 * Shows the preceding persona question (context) + the user's answer
 * + a play button if an audio clip exists.
 */
function YourAnswersSection({
  transcript,
  clips,
  playingIndex,
  onPlay,
  onPause,
}: {
  transcript: TranscriptEntry[];
  clips: Map<number, { url: string; duration: number }>;
  playingIndex: number | null;
  onPlay: (index: number) => void;
  onPause: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // Extract user messages with their preceding persona context
  const userAnswers: Array<{
    index: number;
    contextQ: string | null;
    contextPersona: string | null;
    answer: string;
    type: string;
  }> = [];

  let currentUserIdx = 0;
  for (let i = 0; i < transcript.length; i++) {
    if (transcript[i].role === "user") {
      // Find the preceding persona message
      let contextQ: string | null = null;
      let contextPersona: string | null = null;
      for (let j = i - 1; j >= 0; j--) {
        if (transcript[j].role === "persona") {
          contextQ = transcript[j].content;
          contextPersona = transcript[j].personaName;
          break;
        }
      }
      userAnswers.push({
        index: currentUserIdx,
        contextQ,
        contextPersona,
        answer: transcript[i].content,
        type: transcript[i].type,
      });
      currentUserIdx++;
    }
  }

  // Show first 3 by default, expand to show all
  const visible = expanded ? userAnswers : userAnswers.slice(0, 3);
  const hasClips = clips.size > 0;

  return (
    <section className="rounded-lg border border-border/60 bg-card/40 p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded text-white/70">
          <Headphones className="h-4 w-4" />
        </span>
        <h2 className="text-sm font-medium text-foreground">Your answers</h2>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground/40">
          {userAnswers.length} {userAnswers.length === 1 ? "clip" : "clips"}
        </span>
      </div>

      {!hasClips && (
        <p className="text-xs text-muted-foreground/60 mb-3">
          Recording unavailable for this session. (Audio recording needs a
          browser that supports MediaRecorder + mic permission.)
        </p>
      )}

      <div className="space-y-3">
        {visible.map((a) => {
          const clip = clips.get(a.index);
          const isPlaying = playingIndex === a.index;
          return (
            <div
              key={a.index}
              className="rounded-lg border border-border/40 bg-muted/20 p-3"
            >
              {a.contextQ && (
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1">
                  {a.contextPersona || "Panelist"} asked
                </p>
              )}
              {a.contextQ && (
                <p className="text-xs text-muted-foreground/80 mb-2 italic line-clamp-2">
                  &ldquo;{a.contextQ.slice(0, 150)}{a.contextQ.length > 150 ? "…" : ""}&rdquo;
                </p>
              )}
              <div className="flex items-start gap-2.5">
                {clip ? (
                  <button
                    onClick={() => (isPlaying ? onPause() : onPlay(a.index))}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 text-black hover:bg-white transition-all"
                    aria-label={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? (
                      <Pause className="h-3.5 w-3.5 fill-current" />
                    ) : (
                      <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                    )}
                  </button>
                ) : (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border/40 text-muted-foreground/30">
                    <Play className="h-3.5 w-3.5" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-relaxed text-foreground/80 line-clamp-2">
                    {a.answer.slice(0, 200)}{a.answer.length > 200 ? "…" : ""}
                  </p>
                  {clip && (
                    <p className="mt-1 text-[10px] text-muted-foreground/50">
                      {clip.duration > 0 ? `${Math.round(clip.duration)}s` : ""}
                    </p>
                  )}
                </div>
              </div>
              {clip && (
                <audio
                  id={`audio-${a.index}`}
                  src={clip.url}
                  onEnded={onPause}
                  className="hidden"
                />
              )}
            </div>
          );
        })}
      </div>

      {userAnswers.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          {expanded ? (
            <>
              <ChevronDown className="h-3.5 w-3.5" /> Show fewer
            </>
          ) : (
            <>
              <ChevronRight className="h-3.5 w-3.5" /> Show all {userAnswers.length}
            </>
          )}
        </button>
      )}
    </section>
  );
}

function DrillStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-foreground tabular-nums">
        {value}
      </p>
    </div>
  );
}
