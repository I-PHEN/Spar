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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DebriefPayload, TelemetrySnapshot } from "@/lib/types";
import { getSessionClips, createClipURL } from "@/lib/audio-db";
import { cn } from "@/lib/utils";
import type { Variants } from "framer-motion";

export interface DebriefViewProps {
  sessionId: string;
  scenarioLabel?: string;
  courseContext?: {
    courseId: string;
    lessonId: string;
    courseTitle?: string;
    lessonTitle?: string;
    nextLessonTitle?: string;
    passCriteria?: string;
  } | null;
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
  coachingFocus?: string | null;
  materialTitle?: string | null;
  transcript?: TranscriptEntry[];
  drillStats?: DrillStats | null;
}

export function DebriefView({
  sessionId,
  scenarioLabel,
  courseContext,
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
      clips.forEach((c) => URL.revokeObjectURL(c.url));
    };
  }, [sessionId]);

  function playClip(index: number) {
    const clip = clips.get(index);
    if (!clip) return;

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
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center bg-[var(--bg-base)]">
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)]">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium tracking-tight text-[var(--text-primary)]">
            The coach is reviewing the tape...
          </p>
          <p className="max-w-md text-xs leading-relaxed text-[var(--text-secondary)]">
            Analyzing transcript, telemetry curves, and past session habits.
            Your debrief will be ready in a moment.
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center bg-[var(--bg-base)]">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 text-red-400">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {error || "Failed to load debrief."}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
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
      courseContext={courseContext}
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
  courseContext,
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
  courseContext?: DebriefViewProps["courseContext"];
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
  const targetRule = courseContext?.passCriteria || data.coachingFocus || null;
  const resolvedLabel = data.materialTitle?.trim() || scenarioLabel || "Session";
  const completedRep = !t || t.userTurns > 0;

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
    <div className="relative min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* Top-center Electric Cobalt atmospheric lighting dome */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        <div
          className="absolute -top-[160px] left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full opacity-30 blur-[110px]"
          style={{
            background:
              "radial-gradient(circle, var(--accent-soft) 0%, rgba(47,101,246,0.03) 45%, transparent 70%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Executive Memo Header */}
        <motion.div
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8 border-b border-[var(--border-subtle)] pb-6"
        >
          <div className="flex flex-wrap items-center gap-2">
            {courseContext ? (
              <>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]",
                    completedRep
                      ? "border-[var(--accent)]/35 bg-[var(--accent-soft)]/15 text-[#93B4FF]"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      completedRep ? "bg-[var(--accent)] shadow-[0_0_6px_var(--accent)]" : "bg-amber-400"
                    )}
                  />
                  {completedRep ? "Course Drill Completed" : "Incomplete Rep — Retry Needed"}
                </span>
                {courseContext.courseTitle && (
                  <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                    {courseContext.courseTitle}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)]/12 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#93B4FF]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_6px_var(--accent)]" />
                  Executive Dossier
                </span>
                <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                  {resolvedLabel}
                </span>
              </>
            )}
            {t && (
              <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2.5 py-0.5 text-[10px] text-[var(--text-tertiary)] tabular-nums">
                {t.userTurns} {t.userTurns === 1 ? "turn" : "turns"}
              </span>
            )}
          </div>

          <h1 className="mt-3 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            {courseContext?.lessonTitle
              ? `Lesson Debrief: ${courseContext.lessonTitle}`
              : "The coach's notes"}
          </h1>
          <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
            {courseContext
              ? "Focused readout on how you applied this lesson's technique under pressure."
              : "Honest. Specific. Forward-looking. No vanity scores — pure executive development."}
          </p>

          {targetRule && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[var(--accent)]/30 bg-[var(--surface-1)] px-4 py-3.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#93B4FF]">
                  Lesson Target Evaluated
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-primary)]">
                  {targetRule}
                </p>
              </div>
            </div>
          )}
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
              <div className="relative pl-3.5 border-l-4 border-[var(--accent)]">
                <p className="text-sm leading-relaxed text-[var(--text-primary)] font-normal sm:text-base">
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
                <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/70 p-3.5">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-2 font-semibold">
                    Attempt breakdown
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: data.drillStats.totalChallenges }).map((_, i) => {
                      const isClean1 = i < data.drillStats!.attempt1Clean;
                      const isClean2 =
                        !isClean1 &&
                        i < data.drillStats!.attempt1Clean + data.drillStats!.attempt2Clean;
                      const color = isClean1
                        ? "bg-[var(--accent)] shadow-[0_0_8px_var(--accent-soft)]"
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
                  <div className="mt-3 flex flex-wrap gap-4 text-[10px] text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
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
                <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                  {d.presentationEvaluation}
                </p>
                {d.coachRead && (
                  <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/60 p-3.5">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1 font-semibold">
                      Coach&apos;s initial read
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] italic">&ldquo;{d.coachRead}&rdquo;</p>
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
                    <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-[var(--text-primary)]">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400/90" />
                      <span>{item}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-[var(--text-tertiary)]">
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
              <p className="text-sm leading-relaxed text-[var(--text-primary)]">{d.thePattern}</p>
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
              <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--surface-2)]/80 p-4">
                <p className="text-sm font-medium leading-relaxed text-[var(--text-primary)]">
                  {d.oneThingToPractice}
                </p>
              </div>
            </DebriefSection>
          </motion.div>

          {/* Section 6 — Telemetry as Bespoke Visual Gauges (Full practice debrief only) */}
          {!courseContext && (
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
          )}

          {/* Section 7 — Save or Share (Full practice debrief only) */}
          {!courseContext && (
            <motion.div variants={itemVariants}>
              <DebriefSection
                number={d.presentationEvaluation ? "07" : "06"}
                icon={<Share2 className="h-4 w-4" />}
                title="Save or Share"
                accent="slate"
              >
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4">
                  <p className="mb-2 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">
                    Executive debrief memo
                  </p>
                  <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-[var(--text-secondary)]">
                    {d.shareableSummary}
                  </pre>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCopy}
                    className="border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-primary)] hover:border-[var(--accent)] hover:bg-[var(--surface-2)]"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-400" /> Copied to clipboard
                      </>
                    ) : (
                      <>
                        <Share2 className="h-3.5 w-3.5 mr-1.5 text-[var(--accent)]" /> Copy summary
                      </>
                    )}
                  </Button>
                </div>
              </DebriefSection>
            </motion.div>
          )}

          {/* Skill snapshot — illuminated baseline bars (Full practice debrief only) */}
          {!courseContext && data.skillSnapshot && (
            <motion.div variants={itemVariants}>
              <div className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_8px_24px_-12px_rgba(0,0,0,0.6)]">
                <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
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
                      <div className="relative h-18 w-2.5 overflow-hidden rounded-full border border-white/10 bg-[var(--surface-2)]">
                        <div
                          className="absolute bottom-0 w-full rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent-soft)] transition-all duration-500"
                          style={{ height: `${s.v}%` }}
                        />
                      </div>
                      <p className="mt-2 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                        {s.name}
                      </p>
                      <p className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">{s.v}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Full Transcript Accordion */}
        {data.transcript && data.transcript.length > 0 && (
          <div className="mt-6 border-t border-[var(--border-subtle)] pt-6">
            <button
              onClick={onToggleTranscript}
              className="flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--text-secondary)] hover:text-white transition-colors"
            >
              {showTranscript ? (
                <ChevronDown className="h-3.5 w-3.5 text-[var(--accent)]" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-[var(--accent)]" />
              )}
              Full transcript ({data.transcript.length} turns)
            </button>
            {showTranscript && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ duration: 0.2 }}
                className="mt-3 max-h-96 overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4"
              >
                <div className="space-y-3">
                  {data.transcript.map((m, i) => {
                    const isUser = m.role === "user";
                    return (
                      <div
                        key={i}
                        className={cn(
                          "rounded-xl p-3 text-xs leading-relaxed",
                          isUser
                            ? "border border-[var(--accent)]/25 bg-[var(--accent-soft)]/10"
                            : "border border-[var(--border-subtle)] bg-[var(--surface-2)]/70"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={cn(
                              "font-semibold text-[11px]",
                              isUser ? "text-white" : "text-[var(--text-secondary)]"
                            )}
                          >
                            {isUser ? "You" : m.personaName || "Panelist"}
                          </span>
                          {m.type === "interruption" && (
                            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] text-amber-300">
                              interruption
                            </span>
                          )}
                          {m.type === "opening" && (
                            <span className="rounded bg-[var(--surface-1)] px-1.5 py-0.5 text-[9px] text-[var(--text-tertiary)]">
                              opening
                            </span>
                          )}
                        </div>
                        <p className={isUser ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}>
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
        <div className="mt-8 flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-6 sm:flex-row sm:justify-between">
          <Button
            variant="ghost"
            onClick={onBackHome}
            className="text-[var(--text-secondary)] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            {courseContext
              ? `Back to ${courseContext.courseTitle || "Course"} Roadmap`
              : "Back to Home"}
          </Button>
          <Button
            onClick={onSparAgain}
            className="rounded-full bg-white px-6 text-[#0A0D14] font-bold hover:bg-neutral-200 active:translate-y-[3px] transition-all"
            style={{ boxShadow: "0 4px 0 #CBD5E1" }}
          >
            {courseContext
              ? !completedRep
                ? `Retry Rep: ${courseContext.lessonTitle || "Lesson"}`
                : courseContext.nextLessonTitle
                ? `Next Lesson: ${courseContext.nextLessonTitle}`
                : "Continue Course"
              : "Spar again"}{" "}
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </div>
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
    primary: "text-[var(--accent)] bg-[var(--accent-soft)]/20 border border-[var(--accent)]/30",
    emerald: "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20",
    amber: "text-amber-400 bg-amber-500/10 border border-amber-500/20",
    slate: "text-[var(--text-secondary)] bg-[var(--surface-2)] border border-[var(--border-subtle)]",
  };
  return (
    <section
      className={cn(
        "rounded-[20px] border p-5 sm:p-6 transition-all shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_8px_24px_-12px_rgba(0,0,0,0.6)]",
        highlighted
          ? "border-[var(--accent)]/35 bg-[var(--surface-1)]"
          : "border-[var(--border-subtle)] bg-[var(--surface-1)] hover:border-[var(--border-strong)]"
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
        <h2 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
        <span className="ml-auto font-mono text-[10px] text-[var(--text-tertiary)]">{number}</span>
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
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/70 p-3.5 transition-colors hover:border-[var(--border-strong)]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          {label}
        </span>
        {metric && (
          <span className="font-mono text-[10px] text-[#93B4FF] tabular-nums">
            {metric}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">{value}</p>
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
    <section className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 sm:p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_8px_24px_-12px_rgba(0,0,0,0.6)]">
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--accent)]/30 bg-[var(--accent-soft)]/20 text-[var(--accent)]">
          <Headphones className="h-3.5 w-3.5" />
        </span>
        <h2 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">Your answers</h2>
        <span className="ml-auto font-mono text-[10px] text-[var(--text-tertiary)]">
          {userAnswers.length} {userAnswers.length === 1 ? "clip" : "clips"}
        </span>
      </div>

      {!hasClips && (
        <p className="text-xs text-[var(--text-tertiary)] mb-3">
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
                "rounded-xl border p-3.5 transition-colors",
                isPlaying
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]/10"
                  : "border-[var(--border-subtle)] bg-[var(--surface-2)]/70 hover:border-[var(--border-strong)]"
              )}
            >
              {a.contextQ && (
                <div className="mb-2 flex items-baseline gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    {a.contextPersona || "Panelist"} asked:
                  </span>
                  <span className="text-xs text-[var(--text-secondary)] italic truncate max-w-[80%]">
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
                        ? "bg-[var(--accent)] text-white shadow-[0_0_12px_var(--accent-soft)]"
                        : "bg-white/10 text-white hover:bg-[var(--accent)] hover:text-white"
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
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] text-[var(--text-tertiary)]">
                    <Play className="h-4 w-4 ml-0.5" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-relaxed text-[var(--text-primary)] line-clamp-2">
                    {a.answer}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-[10px] text-[var(--text-tertiary)]">
                    {clip && (
                      <span className="tabular-nums font-mono">
                        {clip.duration > 0 ? `${Math.round(clip.duration)}s` : ""}
                      </span>
                    )}
                    {isPlaying && (
                      <span className="flex items-end gap-0.5 h-2.5">
                        <span className="w-0.5 h-full bg-[var(--accent)] animate-pulse" />
                        <span className="w-0.5 h-1/2 bg-[var(--accent)] animate-pulse" style={{ animationDelay: "150ms" }} />
                        <span className="w-0.5 h-3/4 bg-[var(--accent)] animate-pulse" style={{ animationDelay: "300ms" }} />
                        <span className="text-[#93B4FF] ml-1 text-[9px] uppercase tracking-wider">
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
          className="mt-3.5 flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-white transition-colors"
        >
          {expanded ? (
            <>
              <ChevronDown className="h-3.5 w-3.5 text-[var(--accent)]" /> Show fewer
            </>
          ) : (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-[var(--accent)]" /> Show all {userAnswers.length}
            </>
          )}
        </button>
      )}
    </section>
  );
}

export function DrillStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/70 p-3 transition-colors hover:border-[var(--border-strong)]">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-[var(--text-primary)] tabular-nums">
        {value}
      </p>
    </div>
  );
}
