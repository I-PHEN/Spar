"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  Flame,
  Target,
  Sparkles,
  Pencil,
  X,
  Swords,
  Clock,
  Compass,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { sessionLabel } from "@/lib/session-label";

interface HomeViewProps {
  userName: string;
  onEnterSparringRoom: () => void;
  onOpenDebrief: (sessionId: string, label: string) => void;
}

export interface UpcomingMoment {
  id: string;
  title: string;
  detail: string | null;
  date: string;
}

export interface SessionHistoryEntry {
  id: string;
  scenario: string;
  materialTitle?: string | null;
  rawMaterial?: string | null;
  createdAt: string;
  personas: Array<{ name: string; archetype: string }>;
  summary: { oneThingToPractice: string } | null;
  skills?: {
    clarity: number;
    recovery: number;
    concision: number;
    presence: number;
    evidence: number;
  } | null;
}

export interface Stats {
  sessionsThisWeek: number;
  streak: number;
  topSkill: { name: string; score: number } | null;
  totalSessions: number;
  todaysFocus: { tag: string; description: string } | null;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function sessionTopic(session: SessionHistoryEntry): string {
  if (session.materialTitle?.trim()) {
    return session.materialTitle.trim();
  }
  if (session.rawMaterial?.trim()) {
    const firstLine = session.rawMaterial.trim().split("\n")[0];
    return firstLine.length > 70 ? `${firstLine.slice(0, 70)}…` : firstLine;
  }
  return sessionLabel(session.scenario);
}

/** Deduplicate panelist names to prevent repetitions like "Ada · Ada · Priya" */
export function deduplicatePersonas(
  personas: Array<{ name: string; archetype: string }>
): Array<{ name: string; archetype: string }> {
  const seen = new Set<string>();
  const unique: Array<{ name: string; archetype: string }> = [];
  for (const p of personas) {
    const trimmed = p.name?.trim();
    if (trimmed && !seen.has(trimmed.toLowerCase())) {
      seen.add(trimmed.toLowerCase());
      unique.push({ ...p, name: trimmed });
    }
  }
  return unique;
}

/** Check if the coaching takeaway is generic fallback copy */
export function isGenericPracticeTip(tip?: string | null): boolean {
  if (!tip || !tip.trim()) return true;
  const t = tip.trim().toLowerCase();
  return (
    t.includes("keep sparring") ||
    t.includes("baseline is solid") ||
    t === "no debrief" ||
    t.startsWith("no debrief")
  );
}

export type DateGroupKey = "Today" | "This week" | "Earlier";

/** Group sessions into timeline buckets: Today, This week, and Earlier */
export function groupSessionsByDate(sessionList: SessionHistoryEntry[]): Array<{
  group: DateGroupKey;
  sessions: SessionHistoryEntry[];
}> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sevenDaysAgo = startOfToday - 6 * 24 * 60 * 60 * 1000;

  const today: SessionHistoryEntry[] = [];
  const thisWeek: SessionHistoryEntry[] = [];
  const earlier: SessionHistoryEntry[] = [];

  for (const s of sessionList) {
    const time = new Date(s.createdAt).getTime();
    if (isNaN(time)) {
      earlier.push(s);
    } else if (time >= startOfToday) {
      today.push(s);
    } else if (time >= sevenDaysAgo) {
      thisWeek.push(s);
    } else {
      earlier.push(s);
    }
  }

  const result: Array<{ group: DateGroupKey; sessions: SessionHistoryEntry[] }> = [];
  if (today.length > 0) result.push({ group: "Today", sessions: today });
  if (thisWeek.length > 0) result.push({ group: "This week", sessions: thisWeek });
  if (earlier.length > 0) result.push({ group: "Earlier", sessions: earlier });

  return result;
}

/** Lightweight count-up hook respecting prefers-reduced-motion */
export function useCountUp(end: number, duration: number = 700, disabled?: boolean | null): number {
  const isOff = Boolean(disabled);
  const [val, setVal] = useState(end);
  useEffect(() => {
    if (isOff || end === 0) {
      setVal(end);
      return;
    }
    let startTime: number | null = null;
    let frame: number;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setVal(Math.round(ease * end));
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    };
    setVal(0);
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [end, duration, isOff]);
  return val;
}

/** One past session in the executive ledger: whole-row click, scannable hierarchy, deduplicated panelists, outcome badge. */
export function SessionHistoryCard({
  session,
  onOpenDebrief,
}: {
  session: SessionHistoryEntry;
  onOpenDebrief: (sessionId: string, label: string) => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const label = sessionLabel(session.scenario);
  const topic = sessionTopic(session);
  const date = new Date(session.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const uniquePersonas = deduplicatePersonas(session.personas);
  const panelistNames = uniquePersonas.map((p) => p.name).join(" · ");

  const hasSpecificTip =
    Boolean(session.summary?.oneThingToPractice) &&
    !isGenericPracticeTip(session.summary?.oneThingToPractice);

  const overallScore = session.skills
    ? Math.round(
        (session.skills.clarity +
          session.skills.recovery +
          session.skills.concision +
          session.skills.presence +
          session.skills.evidence) /
          5,
      )
    : null;

  const animatedScore = useCountUp(overallScore ?? 0, 700, shouldReduceMotion);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenDebrief(session.id, label)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDebrief(session.id, label);
        }
      }}
      aria-label={`Open debrief for ${topic}`}
      className="group flex items-center justify-between gap-4 px-5 py-4 sm:px-6 transition-all hover:bg-white/[0.035] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 select-none"
    >
      <div className="min-w-0 flex-1">
        {/* Primary Header: The Topic */}
        <h3 className="truncate text-sm font-semibold tracking-tight text-[var(--text-primary)] group-hover:text-white transition-colors sm:text-base">
          {topic}
        </h3>

        {/* Metadata: Mode badge, Date, and Deduplicated Panelists */}
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)] font-normal">
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            {label}
          </span>
          <span className="text-[var(--text-tertiary)]">·</span>
          <span>{date}</span>
          {uniquePersonas.length > 0 && (
            <>
              <span className="text-[var(--text-tertiary)]">·</span>
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <span className="flex -space-x-1.5 overflow-hidden flex-shrink-0">
                  {uniquePersonas.map((p) => (
                    <span
                      key={p.name}
                      title={p.name}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-neutral-800 ring-2 ring-[#121218] text-[9px] font-semibold text-neutral-200"
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </span>
                  ))}
                </span>
                <span className="truncate text-[var(--text-secondary)]">{panelistNames}</span>
              </span>
            </>
          )}
        </div>

        {/* The Coach Takeaway: only shown when authentic and session-specific */}
        {hasSpecificTip && (
          <p className="mt-1.5 truncate text-xs leading-relaxed text-[var(--text-secondary)]">
            <span className="text-[var(--text-tertiary)] font-medium">Practice: </span>
            <span className="text-neutral-300">{session.summary!.oneThingToPractice}</span>
          </p>
        )}
      </div>

      {/* Outcome indicator and navigation chevron */}
      <div className="flex flex-shrink-0 items-center gap-3">
        {overallScore !== null ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums border",
              overallScore >= 60
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                : overallScore < 50
                ? "border-red-500/30 bg-red-500/15 text-red-400"
                : "border-blue-500/30 bg-blue-500/15 text-blue-400"
            )}
          >
            <span>{animatedScore}</span>
            <span className="text-[9px] uppercase tracking-wider opacity-85">pts</span>
          </span>
        ) : session.summary ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Debriefed
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-medium text-neutral-400">
            Incomplete
          </span>
        )}
        <ChevronRight className="h-4 w-4 text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5 group-hover:text-white" />
      </div>
    </div>
  );
}

export function HomeView({ userName, onEnterSparringRoom, onOpenDebrief }: HomeViewProps) {
  const [moment, setMoment] = useState<UpcomingMoment | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [sessions, setSessions] = useState<SessionHistoryEntry[] | null>(null);
  const [editingMoment, setEditingMoment] = useState(false);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    Promise.all([
      fetch("/api/upcoming-moment"),
      fetch("/api/stats"),
      fetch("/api/sessions"),
    ])
      .then(async ([mr, sr, hr]) => {
        const mData = await mr.json();
        const sData = await sr.json();
        const hData = await hr.json();
        setMoment(mData.upcoming || null);
        setStats(sData);
        setSessions(Array.isArray(hData.sessions) ? hData.sessions : []);
      })
      .catch(console.error);
  }, []);

  const daysUntil = moment
    ? Math.max(0, Math.ceil((new Date(moment.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.05,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.25, ease: "easeOut" as const },
    },
  };

  const animatedStreak = useCountUp(stats?.streak ?? 0, 700, shouldReduceMotion);

  return (
    <div className="relative min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* Background Atmosphere: Top-center radial lighting + subtle texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        <div
          className="absolute -top-[140px] left-1/2 h-[640px] w-[960px] -translate-x-1/2 rounded-full opacity-70 blur-[110px]"
          style={{
            background:
              "radial-gradient(circle, var(--accent-soft) 0%, rgba(47,101,246,0.04) 45%, transparent 70%)",
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

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-8 pb-24 sm:px-6 sm:py-12 md:pb-16">
        {/* Executive Command Header */}
        <motion.div
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_6px_var(--accent-soft)]" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                {greeting()} · Executive Command
              </p>
            </div>
            {stats && stats.streak > 0 && (
              <div className="flex items-center gap-2.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3.5 py-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
                <Flame className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="text-xs font-bold text-[var(--text-primary)] tabular-nums">
                  {animatedStreak}d streak
                </span>
                <div className="flex items-center gap-1 border-l border-white/10 pl-2">
                  {Array.from({ length: 7 }).map((_, i) => {
                    const isDone = i < Math.min(stats.streak, 7);
                    return (
                      <span
                        key={i}
                        className={cn(
                          "h-1.5 w-1.5 rounded-full transition-colors",
                          isDone
                            ? "bg-[var(--accent)] shadow-[0_0_4px_var(--accent-soft)]"
                            : "border border-white/20 bg-white/[0.04]"
                        )}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl lg:text-5xl">
            {userName}.
          </h1>
          {moment && daysUntil !== null ? (
            <p className="mt-2 text-xs text-[var(--text-secondary)] sm:text-sm">
              Upcoming target: <span className="text-[var(--text-primary)] font-medium">{moment.title}</span> in{" "}
              <span className="font-semibold text-[var(--accent)]">
                {daysUntil} {daysUntil === 1 ? "day" : "days"}
              </span>.
            </p>
          ) : (
            <p className="mt-2 text-xs text-[var(--text-secondary)] sm:text-sm">
              Sharpen your instincts against adversarial panels.
            </p>
          )}
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-4"
        >
          {/* Top Command Grid: Hero Action & Countdown */}
          <motion.div variants={itemVariants}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Primary Action Card (Span 2) */}
              <button
                onClick={onEnterSparringRoom}
                aria-label="New session"
                className="group relative block w-full overflow-hidden rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-7 sm:p-8 text-left transition-all hover:border-[var(--border-strong)] hover:-translate-y-0.5 lg:col-span-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_16px_36px_-16px_rgba(0,0,0,0.75)] select-none"
                style={{
                  backgroundImage:
                    "radial-gradient(circle 380px at 100% 0%, var(--accent-soft), transparent 70%), linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.015))",
                }}
              >
                {/* Decorative Watermark Swords */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-10 -right-8 select-none text-white opacity-[0.07] rotate-[-12deg]"
                >
                  <Swords className="h-56 w-56 sm:h-64 sm:w-64" />
                </div>

                <div className="relative z-10 flex items-center justify-between gap-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                        <Swords className="h-3 w-3 text-[var(--accent)]" />
                        Live Chamber
                      </span>
                    </div>
                    <h2 className="mt-3 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
                      New session
                    </h2>
                    <p className="mt-2 text-xs text-[var(--text-secondary)] sm:text-sm leading-relaxed max-w-lg">
                      Spar on a topic or bring material. Face an adversarial panel. Get coached on the tape.
                    </p>
                  </div>
                  <div
                    className="relative flex h-13 w-13 sm:h-14 sm:w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)] text-white transition-all group-hover:scale-105 group-active:translate-y-[3px]"
                    style={{
                      boxShadow: "0 4px 0 var(--accent-dark)",
                    }}
                  >
                    <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </button>

              {/* Upcoming Moment Countdown Card (Span 1) */}
              <div
                className="flex flex-col justify-between rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 sm:p-7 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_8px_24px_-12px_rgba(0,0,0,0.6)] transition-all hover:border-[var(--border-strong)] hover:-translate-y-0.5"
                style={{
                  backgroundImage:
                    "linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.015))",
                }}
              >
                {moment && daysUntil !== null ? (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                        <Calendar className="h-4 w-4 text-[var(--text-secondary)]" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                          Upcoming Moment
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingMoment(true)}
                        aria-label="Edit upcoming moment"
                        className="h-7 w-7 rounded-full text-[var(--text-tertiary)] hover:text-white"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="my-3">
                      <p className="text-4xl font-extrabold tracking-tight text-[var(--text-primary)] tabular-nums sm:text-5xl">
                        {daysUntil}
                      </p>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--accent)] mt-0.5">
                        {daysUntil === 1 ? "day remaining" : "days remaining"}
                      </p>
                    </div>

                    <div className="truncate border-t border-white/[0.06] pt-2.5">
                      <p className="truncate text-xs font-medium text-[var(--text-primary)]">{moment.title}</p>
                      {moment.detail && (
                        <p className="truncate text-[11px] text-[var(--text-tertiary)] mt-0.5">{moment.detail}</p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex h-full flex-col justify-between">
                    <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                      <Calendar className="h-4 w-4 text-[var(--text-secondary)]" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                        Upcoming Moment
                      </span>
                    </div>
                    <div className="my-3">
                      <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">No upcoming moment set</p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">
                        Anchor your sparring to an upcoming pitch, review, or defense.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setEditingMoment(true)}
                      className="w-full rounded-full border border-white/15 bg-white/[0.08] hover:bg-white/[0.14] text-xs font-semibold text-white transition-all flex items-center justify-center gap-2 py-2.5 px-4 shadow-sm"
                    >
                      <Calendar className="h-3.5 w-3.5 text-[var(--accent)]" />
                      Set upcoming moment
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Today's Focus Card */}
          {stats?.todaysFocus && (
            <motion.div variants={itemVariants}>
              <div
                className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_8px_24px_-12px_rgba(0,0,0,0.6)] transition-all hover:border-[var(--border-strong)] hover:-translate-y-0.5"
                style={{
                  backgroundImage:
                    "linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.015))",
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                      <Target className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                      Today&apos;s Focus
                    </span>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                    {stats.todaysFocus.tag.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">
                      {stats.todaysFocus.tag === "general_pattern"
                        ? "Tighten your core openings & pacing"
                        : stats.todaysFocus.tag.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </h3>
                    <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">
                      {stats.todaysFocus.description}
                    </p>

                    {/* Compact accent progress indicator */}
                    <div className="mt-3 flex items-center gap-3">
                      <div className="h-1.5 w-36 overflow-hidden rounded-full bg-white/[0.08]">
                        <div className="h-full w-2/3 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent-soft)]" />
                      </div>
                      <span className="text-[10px] font-medium text-[var(--text-tertiary)]">Focus dimension</span>
                    </div>
                  </div>

                  <button
                    onClick={onEnterSparringRoom}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-4 text-xs font-semibold text-[var(--text-primary)] transition-all hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-white flex-shrink-0"
                  >
                    <span>Drill this</span>
                    <ArrowRight className="h-3.5 w-3.5 text-[var(--accent)]" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Recent Sessions Feed */}
          <motion.div variants={itemVariants} className="pt-4">
            <div className="mb-3.5 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                Recent sessions
              </p>
              {sessions && sessions.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllSessions((prev) => !prev)}
                  className="rounded-full px-2 py-0.5 text-xs font-medium text-[var(--text-tertiary)] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                >
                  {showAllSessions ? "Show fewer" : `View all ${sessions.length}`}
                </button>
              )}
            </div>

            {sessions === null ? (
              <div className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 text-center text-xs text-[var(--text-tertiary)]">
                Loading session history…
              </div>
            ) : sessions.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-[var(--border-subtle)] bg-[var(--surface-1)] p-8 text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                  <Swords className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">No sessions yet</p>
                <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-[var(--text-secondary)]">
                  Your first spar takes about five minutes. Pick a topic, test your thesis, and get coached on the tape.
                </p>
                <Button
                  size="sm"
                  onClick={onEnterSparringRoom}
                  className="mt-4 rounded-full bg-[var(--accent)] text-white hover:brightness-105 text-xs font-semibold px-5 py-2"
                  style={{
                    boxShadow: "0 3px 0 var(--accent-dark)",
                  }}
                >
                  Start first session
                </Button>
              </div>
            ) : (
              <div className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-1)] overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_8px_24px_-12px_rgba(0,0,0,0.6)]">
                {groupSessionsByDate(showAllSessions ? sessions : sessions.slice(0, 3)).map(
                  (bucket, groupIdx) => (
                    <div key={bucket.group}>
                      <div
                        className={cn(
                          "px-6 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] bg-white/[0.02] border-b border-white/[0.04]",
                          groupIdx > 0 && "border-t border-white/[0.04]"
                        )}
                      >
                        {bucket.group}
                      </div>
                      <div className="divide-y divide-white/[0.04]">
                        {bucket.sessions.map((s) => (
                          <SessionHistoryCard
                            key={s.id}
                            session={s}
                            onOpenDebrief={onOpenDebrief}
                          />
                        ))}
                      </div>
                    </div>
                  )
                )}
                {sessions.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowAllSessions((prev) => !prev)}
                    className="w-full border-t border-white/[0.06] py-3 text-center text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-white/[0.02] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                  >
                    {showAllSessions ? "Show fewer" : `View all ${sessions.length} sessions →`}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>

      {/* Target Moment Edit Dialog */}
      <UpcomingMomentDialog
        open={editingMoment}
        onOpenChange={setEditingMoment}
        existing={moment}
        onSaved={(m) => {
          setMoment(m);
          setEditingMoment(false);
        }}
        onDeleted={() => {
          setMoment(null);
          setEditingMoment(false);
        }}
      />
    </div>
  );
}

export function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#111111] px-4 py-3.5 transition-all hover:border-white/20 hover:bg-[#141414]">
      <div className="flex items-center gap-1.5 text-neutral-400">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-xl font-bold text-white tabular-nums sm:text-2xl">
          {value}
        </span>
        {sub && (
          <span className="text-xs text-neutral-400 font-medium">{sub}</span>
        )}
      </div>
    </div>
  );
}

export function UpcomingMomentDialog({
  open,
  onOpenChange,
  existing,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existing: UpcomingMoment | null;
  onSaved: (m: UpcomingMoment) => void;
  onDeleted: () => void;
}) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(existing?.title || "");
      setDetail(existing?.detail || "");
      setDate(
        existing
          ? new Date(existing.date).toISOString().slice(0, 10)
          : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      );
    }
  }, [open, existing]);

  async function handleSave() {
    if (!title.trim() || !date) return;
    setSaving(true);
    try {
      const res = await fetch("/api/upcoming-moment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), detail: detail.trim(), date }),
      });
      const data = await res.json();
      if (res.ok) {
        onSaved({
          id: data.id,
          title: data.title,
          detail: data.detail,
          date: data.date,
        });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await fetch("/api/upcoming-moment", { method: "DELETE" });
      onDeleted();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-white/10 bg-[#121212] text-white">
        <DialogHeader>
          <DialogTitle className="text-white font-semibold">
            {existing ? "Edit your upcoming moment" : "Set your upcoming moment"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="moment-title" className="text-xs text-neutral-300">
              What are you preparing for?
            </Label>
            <Input
              id="moment-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Series A Pitch, Boardroom Defense"
              className="border-white/10 bg-neutral-900 text-white placeholder:text-neutral-500"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="moment-detail" className="text-xs text-neutral-300">
              Detail (optional)
            </Label>
            <Textarea
              id="moment-detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Key focus areas, anticipated pushback, or specific stakeholders"
              rows={2}
              className="border-white/10 bg-neutral-900 text-white placeholder:text-neutral-500"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="moment-date" className="text-xs text-neutral-300">
              Target date
            </Label>
            <Input
              id="moment-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border-white/10 bg-neutral-900 text-white"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          {existing && (
            <Button
              variant="ghost"
              onClick={handleDelete}
              disabled={saving}
              className="mr-auto text-neutral-400 hover:text-red-400"
            >
              <X className="h-4 w-4 mr-1" /> Remove
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={saving || !title.trim() || !date}
            className="bg-white text-black hover:bg-neutral-200"
          >
            {saving ? "Saving..." : "Save moment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
