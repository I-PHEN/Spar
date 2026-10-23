"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
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
  CheckCircle2,
  Clock,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DebriefPayload, TelemetrySnapshot } from "@/lib/types";
import { getSessionClips, createClipURL } from "@/lib/audio-db";
import { cn } from "@/lib/utils";
import type { Variants } from "framer-motion";

export interface DebriefViewProps {
  sessionId: string;
  scenarioLabel?: string;
  onBackHome: () => void;
  onSparAgain: () => void;
}

export interface TranscriptEntry {
  role: string;
  personaName: string | null;
  content: string;
  type: string;
  createdAt: string;
}

export interface DrillStats {
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

export interface DebriefResponse {
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
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium tracking-tight text-white">
            The coach is reviewing the tape...
          </p>
          <p className="max-w-md text-xs leading-relaxed text-neutral-400">
            Analyzing transcript, telemetry curves, and past session habits.
            Your debrief will be ready in a moment.
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 text-red-400">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-white">
            {error || "Failed to load debrief."}
          </p>
          <p className="text-xs text-neutral-400">
            We couldn&apos;t load the analysis for this session.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onBackHome} className="mt-2">
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back to Home
        </Button>
      </div>
    );
  }

  return (
    <DebriefContent
      scenarioLabel={scenarioLabel}
      data={data}
      clips={clips}
      playingIndex={playingIndex}
      showTranscript={showTranscript}
      copied={copied}
      onPlay={playClip}
      onPause={pauseClip}
      onCopy={handleCopy}
      onToggleTranscript={() => setShowTranscript(!showTranscript)}
      onBackHome={onBackHome}
      onSparAgain={onSparAgain}
    />
  );
}

/**
 * Pure presentation component for the Executive Coaching Dossier.
 */
export function DebriefContent({
  scenarioLabel,
  data,
  clips,
  playingIndex,
  showTranscript,
  copied,
  onPlay,
  onPause,
  onCopy,
  onToggleTranscript,
  onBackHome,
  onSparAgain,
}: {
  scenarioLabel?: string;
  data: DebriefResponse;
  clips: Map<number, { url: string; duration: number }>;
  playingIndex: number | null;
  showTranscript: boolean;
  copied: boolean;
  onPlay: (index: number) => void;
  onPause: () => void;
  onCopy: () => void;
  onToggleTranscript: () => void;
  onBackHome: () => void;
  onSparAgain: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const d = data.debrief;
  const t = data.telemetry;

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.06,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.28, ease: "easeOut" as const },
    },
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Executive Memo Header */}
      <motion.div
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8 border-b border-white/[0.08] pb-6"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Executive Dossier
          </span>
          <span className="rounded-full border border-white/10 bg-neutral-900 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-400">
            {scenarioLabel || "Session"}
          </span>
          {t && (
            <span className="rounded-full border border-white/5 bg-neutral-950 px-2.5 py-0.5 text-[10px] text-neutral-500 tabular-nums">
              {t.userTurns} {t.userTurns === 1 ? "turn" : "turns"}
            </span>
          )}
        </div>

        <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          The coach&apos;s notes
        </h1>
        <p className="mt-1.5 text-xs text-neutral-400">
          Honest. Specific. Forward-looking. No vanity scores — pure executive development.
        </p>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-4"
      >
        {/* Section 1 — The Moment (Hero Callout) */}
        <motion.div variants={itemVariants}>
          <DebriefSection
            number="01"
            icon={<Quote className="h-4 w-4" />}
            title="The Moment"
            accent="primary"
            highlighted
          >
            <div className="relative pl-3 border-l-2 border-white/40">
              <p className="text-sm leading-relaxed text-white font-normal sm:text-base">
                &ldquo;{d.momentDescription}&rdquo;
              </p>
            </div>
          </DebriefSection>
        </motion.div>

        {/* Your Answers — Audio playback section */}
        {data.transcript && data.transcript.some((m) => m.role === "user") && (
          <motion.div variants={itemVariants}>
            <YourAnswersSection
              transcript={data.transcript}
              clips={clips}
              playingIndex={playingIndex}
              onPlay={onPlay}
              onPause={onPause}
            />
          </motion.div>
        )}

        {/* Drill Stats — conditional for drill mode */}
        {data.drillStats && (
          <motion.div variants={itemVariants}>
            <DebriefSection
              number="—"
              icon={<Activity className="h-4 w-4" />}
              title={`Drill: ${data.drillStats.label}`}
              accent="amber"
            >
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <DrillStat label="Challenges" value={`${data.drillStats.totalChallenges}`} />
                <DrillStat label="Resolved" value={`${data.drillStats.resolvedChallenges}`} />
                <DrillStat label="Score" value={`${data.drillStats.totalScore}/${data.drillStats.maxScore}`} />
                <DrillStat label="Avg recovery" value={`${data.drillStats.avgRecovery}s`} />
              </div>

              {/* Attempt breakdown pills */}
              <div className="mt-4 rounded-lg border border-white/5 bg-neutral-950/60 p-3">
                <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-2">
                  Attempt breakdown
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: data.drillStats.totalChallenges }).map((_, i) => {
                    const isClean1 = i < data.drillStats!.attempt1Clean;
                    const isClean2 =
                      !isClean1 &&
                      i < data.drillStats!.attempt1Clean + data.drillStats!.attempt2Clean;
                    const color = isClean1
                      ? "bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                      : isClean2
                      ? "bg-amber-500/80"
                      : "bg-red-500/80";
                    return (
                      <div
                        key={i}
                        className={cn("h-2.5 w-6 rounded-full transition-all", color)}
                        title={`Challenge ${i + 1}`}
                      />
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-[10px] text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500/80" />
                    Clean on 1st try ({data.drillStats.attempt1Clean})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500/80" />
                    2nd try ({data.drillStats.attempt2Clean})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-red-500/80" />
                    3+ tries ({data.drillStats.attempt3Plus})
                  </span>
                </div>
              </div>
            </DebriefSection>
          </motion.div>
        )}

        {/* Section 2 — Your Presentation (Defense/Boardroom only) */}
        {d.presentationEvaluation && (
          <motion.div variants={itemVariants}>
            <DebriefSection
              number="02"
              icon={<FileText className="h-4 w-4" />}
              title="Your Presentation"
              accent="slate"
            >
              <p className="text-sm leading-relaxed text-neutral-300">
                {d.presentationEvaluation}
              </p>
              {d.coachRead && (
                <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
                    Coach&apos;s initial read
                  </p>
                  <p className="text-xs text-neutral-300 italic">&ldquo;{d.coachRead}&rdquo;</p>
                </div>
              )}
            </DebriefSection>
          </motion.div>
        )}

        {/* Section 3 — What You Did Well */}
        <motion.div variants={itemVariants}>
          <DebriefSection
            number={d.presentationEvaluation ? "03" : "02"}
            icon={<Sparkles className="h-4 w-4" />}
            title="What You Did Well"
            accent="emerald"
          >
            <ul className="space-y-2.5">
              {d.whatWentWell.length > 0 ? (
                d.whatWentWell.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-neutral-200">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400/90" />
                    <span>{item}</span>
                  </li>
                ))
              ) : (
                <li className="text-sm text-neutral-500">
                  No specific strengths recorded for this exchange.
                </li>
              )}
            </ul>
          </DebriefSection>
        </motion.div>

        {/* Section 4 — The Pattern */}
        <motion.div variants={itemVariants}>
          <DebriefSection
            number={d.presentationEvaluation ? "04" : "03"}
            icon={<TrendingUp className="h-4 w-4" />}
            title="The Pattern"
            accent="amber"
          >
            <p className="text-sm leading-relaxed text-neutral-200">{d.thePattern}</p>
          </DebriefSection>
        </motion.div>

        {/* Section 5 — One Thing to Practice (Focal Directive) */}
        <motion.div variants={itemVariants}>
          <DebriefSection
            number={d.presentationEvaluation ? "05" : "04"}
            icon={<Target className="h-4 w-4" />}
            title="One Thing to Practice"
            accent="primary"
            highlighted
          >
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3.5">
              <p className="text-sm font-medium leading-relaxed text-white">
                {d.oneThingToPractice}
              </p>
            </div>
          </DebriefSection>
        </motion.div>

        {/* Section 6 — Telemetry as Bespoke Visual Gauges */}
        <motion.div variants={itemVariants}>
          <DebriefSection
            number={d.presentationEvaluation ? "06" : "05"}
            icon={<BarChart3 className="h-4 w-4" />}
            title="Telemetry"
            accent="slate"
          >
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <TelemetryInsight
                label="Pace"
                value={d.telemetryInsights.pace}
                metric={
                  t ? `${t.avgWordsPerResponse} words / response` : undefined
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
                  t ? `${t.deflections} deflections / ${t.userTurns} turns` : undefined
                }
              />
              <TelemetryInsight
                label="Evidence"
                value={d.telemetryInsights.evidence}
                metric={
                  t ? `${t.evidenceCitations}/${t.userTurns} cited data` : undefined
                }
              />
            </div>
          </DebriefSection>
        </motion.div>

        {/* Section 7 — Save or Share */}
        <motion.div variants={itemVariants}>
          <DebriefSection
            number={d.presentationEvaluation ? "07" : "06"}
            icon={<Share2 className="h-4 w-4" />}
            title="Save or Share"
            accent="slate"
          >
            <div className="rounded-lg border border-white/10 bg-neutral-950 p-4">
              <p className="mb-2 text-[10px] uppercase tracking-wider text-neutral-500">
                Executive debrief memo
              </p>
              <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-neutral-300">
                {d.shareableSummary}
              </pre>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onCopy}
                className="border-white/15 bg-white/[0.03] text-neutral-200 hover:bg-white/[0.08] hover:text-white"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-400" /> Copied to clipboard
                  </>
                ) : (
                  <>
                    <Share2 className="h-3.5 w-3.5 mr-1.5" /> Copy summary
                  </>
                )}
              </Button>
            </div>
          </DebriefSection>
        </motion.div>

        {/* Skill snapshot — subtle baseline bars */}
        {data.skillSnapshot && (
          <motion.div variants={itemVariants}>
            <div className="rounded-xl border border-white/[0.08] bg-[#121212] p-5">
              <p className="mb-4 text-[10px] uppercase tracking-wider text-neutral-500">
                Skill baseline (this session)
              </p>
              <div className="grid grid-cols-5 gap-3">
                {[
                  { name: "Clarity", v: data.skillSnapshot.clarity },
                  { name: "Recovery", v: data.skillSnapshot.recovery },
                  { name: "Concision", v: data.skillSnapshot.concision },
                  { name: "Presence", v: data.skillSnapshot.presence },
                  { name: "Evidence", v: data.skillSnapshot.evidence },
                ].map((s) => (
                  <div key={s.name} className="flex flex-col items-center">
                    <div className="relative h-18 w-2 overflow-hidden rounded-full bg-neutral-800">
                      <div
                        className="absolute bottom-0 w-full rounded-full bg-white transition-all duration-500"
                        style={{ height: `${s.v}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[10px] uppercase tracking-wider text-neutral-500">
                      {s.name}
                    </p>
                    <p className="text-xs font-semibold text-white tabular-nums">{s.v}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Full Transcript Accordion */}
      {data.transcript && data.transcript.length > 0 && (
        <div className="mt-6 border-t border-white/[0.08] pt-6">
          <button
            onClick={onToggleTranscript}
            className="flex items-center gap-2 text-xs uppercase tracking-wider text-neutral-400 hover:text-white transition-colors"
          >
            {showTranscript ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            Full transcript ({data.transcript.length} turns)
          </button>
          {showTranscript && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.2 }}
              className="mt-3 max-h-96 overflow-y-auto rounded-xl border border-white/10 bg-[#0e0e0e] p-4"
            >
              <div className="space-y-3">
                {data.transcript.map((m, i) => {
                  const isUser = m.role === "user";
                  return (
                    <div
                      key={i}
                      className={cn(
                        "rounded-lg p-2.5 text-xs leading-relaxed",
                        isUser
                          ? "border border-white/10 bg-white/[0.04]"
                          : "border border-neutral-800/80 bg-neutral-950/60"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={cn(
                            "font-semibold text-[11px]",
                            isUser ? "text-white" : "text-neutral-400"
                          )}
                        >
                          {isUser ? "You" : m.personaName || "Panelist"}
                        </span>
                        {m.type === "interruption" && (
                          <span className="rounded bg-amber-500/20 px-1 py-0.2 text-[9px] text-amber-300">
                            interruption
                          </span>
                        )}
                        {m.type === "opening" && (
                          <span className="rounded bg-neutral-800 px-1 py-0.2 text-[9px] text-neutral-400">
                            opening
                          </span>
                        )}
                      </div>
                      <p className={isUser ? "text-neutral-200" : "text-neutral-300"}>
                        {m.content}
                      </p>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Footer Navigation CTAs */}
      <div className="mt-8 flex flex-col gap-3 border-t border-white/[0.08] pt-6 sm:flex-row sm:justify-between">
        <Button
          variant="ghost"
          onClick={onBackHome}
          className="text-neutral-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Home
        </Button>
        <Button
          onClick={onSparAgain}
          className="bg-white text-black hover:bg-neutral-200 font-medium"
        >
          Spar again <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}

export function DebriefSection({
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
    primary: "text-white bg-white/10",
    emerald: "text-emerald-400 bg-emerald-500/10",
    amber: "text-amber-400 bg-amber-500/10",
    slate: "text-neutral-400 bg-neutral-800",
  };
  return (
    <section
      className={cn(
        "rounded-xl border p-5 transition-all",
        highlighted
          ? "border-white/20 bg-[#161616]"
          : "border-white/[0.08] bg-[#121212] hover:border-white/15"
      )}
    >
      <div className="mb-3.5 flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md text-xs",
            accentClasses[accent]
          )}
        >
          {icon}
        </span>
        <h2 className="text-sm font-semibold tracking-tight text-white">{title}</h2>
        <span className="ml-auto font-mono text-[10px] text-neutral-500">{number}</span>
      </div>
      {children}
    </section>
  );
}

export function TelemetryInsight({
  label,
  value,
  metric,
}: {
  label: string;
  value: string;
  metric?: string;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-neutral-950/70 p-3.5 transition-colors hover:border-white/10">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
          {label}
        </span>
        {metric && (
          <span className="font-mono text-[10px] text-neutral-400 tabular-nums">
            {metric}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-neutral-300">{value}</p>
    </div>
  );
}

export function YourAnswersSection({
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

  const visible = expanded ? userAnswers : userAnswers.slice(0, 3);
  const hasClips = clips.size > 0;

  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#121212] p-5">
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-white">
          <Headphones className="h-3.5 w-3.5" />
        </span>
        <h2 className="text-sm font-semibold tracking-tight text-white">Your answers</h2>
        <span className="ml-auto font-mono text-[10px] text-neutral-500">
          {userAnswers.length} {userAnswers.length === 1 ? "clip" : "clips"}
        </span>
      </div>

      {!hasClips && (
        <p className="text-xs text-neutral-500 mb-3">
          Recording unavailable for this session. (Audio recording needs a browser that supports MediaRecorder + mic permission.)
        </p>
      )}

      <div className="space-y-2.5">
        {visible.map((a) => {
          const clip = clips.get(a.index);
          const isPlaying = playingIndex === a.index;
          return (
            <div
              key={a.index}
              className={cn(
                "rounded-lg border p-3.5 transition-colors",
                isPlaying
                  ? "border-white/30 bg-white/[0.05]"
                  : "border-white/5 bg-neutral-950/70 hover:border-white/10"
              )}
            >
              {a.contextQ && (
                <div className="mb-2 flex items-baseline gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    {a.contextPersona || "Panelist"} asked:
                  </span>
                  <span className="text-xs text-neutral-400 italic truncate max-w-[80%]">
                    &ldquo;{a.contextQ}&rdquo;
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3">
                {clip ? (
                  <button
                    onClick={() => (isPlaying ? onPause() : onPlay(a.index))}
                    className={cn(
                      "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-all",
                      isPlaying
                        ? "bg-white text-black shadow-[0_0_12px_rgba(255,255,255,0.4)]"
                        : "bg-white/10 text-white hover:bg-white hover:text-black"
                    )}
                    aria-label={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4 fill-current" />
                    ) : (
                      <Play className="h-4 w-4 fill-current ml-0.5" />
                    )}
                  </button>
                ) : (
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/5 text-neutral-600">
                    <Play className="h-4 w-4 ml-0.5" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-relaxed text-neutral-200 line-clamp-2">
                    {a.answer}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-[10px] text-neutral-500">
                    {clip && (
                      <span className="tabular-nums font-mono">
                        {clip.duration > 0 ? `${Math.round(clip.duration)}s` : ""}
                      </span>
                    )}
                    {isPlaying && (
                      <span className="flex items-end gap-0.5 h-2.5">
                        <span className="w-0.5 h-full bg-emerald-400 animate-pulse" />
                        <span className="w-0.5 h-1/2 bg-emerald-400 animate-pulse" style={{ animationDelay: "150ms" }} />
                        <span className="w-0.5 h-3/4 bg-emerald-400 animate-pulse" style={{ animationDelay: "300ms" }} />
                        <span className="text-emerald-400 ml-1 text-[9px] uppercase tracking-wider">
                          Playing
                        </span>
                      </span>
                    )}
                  </div>
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
          className="mt-3.5 flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
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

export function DrillStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-neutral-950/70 p-3 transition-colors hover:border-white/10">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-white tabular-nums">
        {value}
      </p>
    </div>
  );
}
