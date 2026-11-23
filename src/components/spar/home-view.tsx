"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  ArrowRight,
  Award,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  Flame,
  MessageSquare,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Kwesi } from "./kwesi-mascot";
import { ARCHETYPES } from "@/lib/personas";
import type { ArchetypeKey } from "@/lib/types";
import { LAST_CONFIG_STORAGE_KEY } from "@/lib/user-preferences";
import { sessionLabel } from "@/lib/session-label";
import {
  addDaysToDateInput,
  combineMomentDateAndTime,
  extractMomentDateInput,
  extractMomentTimeInput,
  formatDateInputValue,
  formatMomentCountdown,
  formatMomentDisplayDate,
  getDaysUntilMoment,
  triggerMomentIcsDownload,
} from "@/lib/moment-calendar";

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

interface SavedLaunchSummary {
  modeLabel: string;
  panelCount: number;
}

const QUICK_MOMENT_PRESETS = [
  { label: "In 3 days", days: 3 },
  { label: "In 1 week", days: 7 },
  { label: "In 2 weeks", days: 14 },
] as const;

function readLastLaunchSummary(): SavedLaunchSummary | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      experience?: string;
      seats?: Array<{ filled?: boolean }>;
    };
    const modeLabel = sessionLabel(parsed.experience || "open_spar");
    const panelCount = Array.isArray(parsed.seats)
      ? parsed.seats.filter((s) => s?.filled !== false).length
      : 0;
    return { modeLabel, panelCount };
  } catch {
    return null;
  }
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

/** Deduplicate panelist names to prevent repetitions like "Ada · Ada · Priya". */
export function deduplicatePersonas(
  personas: Array<{ name: string; archetype: string }>,
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

/** Check if the coaching takeaway is generic fallback copy. */
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

/** Group sessions into timeline buckets: Today, This week, and Earlier. */
export function groupSessionsByDate(
  sessionList: SessionHistoryEntry[],
): Array<{
  group: DateGroupKey;
  sessions: SessionHistoryEntry[];
}> {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const sevenDaysAgo = startOfToday - 6 * 24 * 60 * 60 * 1000;

  const today: SessionHistoryEntry[] = [];
  const thisWeek: SessionHistoryEntry[] = [];
  const earlier: SessionHistoryEntry[] = [];

  for (const s of sessionList) {
    const time = new Date(s.createdAt).getTime();
    if (Number.isNaN(time)) {
      earlier.push(s);
    } else if (time >= startOfToday) {
      today.push(s);
    } else if (time >= sevenDaysAgo) {
      thisWeek.push(s);
    } else {
      earlier.push(s);
    }
  }

  const result: Array<{ group: DateGroupKey; sessions: SessionHistoryEntry[] }> =
    [];
  if (today.length > 0) result.push({ group: "Today", sessions: today });
  if (thisWeek.length > 0) result.push({ group: "This week", sessions: thisWeek });
  if (earlier.length > 0) result.push({ group: "Earlier", sessions: earlier });

  return result;
}

/** Lightweight count-up hook respecting prefers-reduced-motion. */
export function useCountUp(
  end: number,
  duration: number = 700,
  disabled?: boolean | null,
): number {
  const isOff = Boolean(disabled);
  const [val, setVal] = useState(end);
  useEffect(() => {
    if (isOff || end === 0) return;
    let startTime: number | null = null;
    let frame = 0;
    const step = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setVal(Math.round(ease * end));
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [end, duration, isOff]);
  return isOff || end === 0 ? end : val;
}

function resolvePersonaAccent(archetype: string): string {
  return ARCHETYPES[archetype as ArchetypeKey]?.accentHue ?? "#E4E4E7";
}

/** Single past session card in the Fight Night preparation ledger. */
export function SessionHistoryCard({
  session,
  onOpenDebrief,
  onDelete,
  deleting,
}: {
  session: SessionHistoryEntry;
  onOpenDebrief: (sessionId: string, label: string) => void;
  onDelete?: (sessionId: string) => void;
  deleting?: boolean;
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
    <div className="spar-stat-tile spar-chunky-card-interactive group flex items-start justify-between gap-2 p-4 sm:px-5 sm:py-4">
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
        className="min-w-0 flex-1 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C6FF3D]/40"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-display truncate text-[15px] font-bold tracking-tight text-[var(--text-primary)] group-hover:text-white">
              {topic}
            </h3>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span className="rounded-md border border-[#2B2B36] bg-[#181820] px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider text-neutral-200">
                {label}
              </span>
              <span className="text-[var(--text-tertiary)]">·</span>
              <span className="text-[var(--text-tertiary)]">{date}</span>
              {uniquePersonas.length > 0 && (
                <>
                  <span className="text-[var(--text-tertiary)]">·</span>
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <span className="flex flex-shrink-0 -space-x-1.5 overflow-hidden">
                      {uniquePersonas.map((p) => (
                        <span
                          key={p.name}
                          title={p.name}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] border-black/35 font-display text-[10px] font-extrabold text-[#0B0B0D] ring-2 ring-[#111116]"
                          style={{ backgroundColor: resolvePersonaAccent(p.archetype) }}
                        >
                          {p.name.charAt(0).toUpperCase()}
                        </span>
                      ))}
                    </span>
                    <span className="truncate font-medium text-[var(--text-secondary)]">
                      {panelistNames}
                    </span>
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2.5">
            {overallScore !== null ? (
              <span
                className={cn(
                  "inline-flex items-center rounded-lg border px-2.5 py-1 font-display text-xs font-bold tabular-nums",
                  overallScore >= 60
                    ? "border-[#C6FF3D]/45 bg-[#C6FF3D]/12 text-[#C6FF3D]"
                    : overallScore < 50
                      ? "border-[#FF5A1F]/40 bg-[#FF5A1F]/12 text-[#FF5A1F]"
                      : "border-white/15 bg-white/[0.06] text-white",
                )}
              >
                {animatedScore} pts
              </span>
            ) : session.summary ? (
              <span className="inline-flex items-center rounded-lg border border-[#C6FF3D]/35 bg-[#C6FF3D]/10 px-2.5 py-1 font-display text-[11px] font-bold text-[#C6FF3D]">
                Debriefed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg border border-[#2A2A34] bg-[#181820] px-2.5 py-1 text-[11px] font-medium text-[var(--text-tertiary)]">
                <Clock className="h-3 w-3" />
                Incomplete
              </span>
            )}
            <ChevronRight className="h-4 w-4 text-neutral-500 transition-transform group-hover:translate-x-0.5 group-hover:text-[#C6FF3D]" />
          </div>
        </div>

        {hasSpecificTip && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#22222B] bg-[#0B0B10]/90 px-3 py-2">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#C6FF3D]"
              aria-hidden
            />
            <p className="min-w-0 truncate text-xs text-[var(--text-secondary)]">
              <span className="font-semibold text-[#C6FF3D]">
                Practice:{" "}
              </span>
              <span className="text-neutral-200">
                {session.summary!.oneThingToPractice}
              </span>
            </p>
          </div>
        )}
      </div>

      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(session.id)}
          disabled={deleting}
          aria-label={`Delete session ${topic}`}
          title="Delete session"
          className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#71717A] opacity-65 transition-colors hover:bg-[#FF5A1F]/12 hover:text-[#FF5A1F] focus-visible:opacity-100 group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

const RECENT_COLLAPSED_KEY = "spar.recentCollapsed";
export const BETA_WHATSAPP_BANNER_DISMISSED_KEY = "spar.betaWhatsappBannerDismissed";

interface HomeViewCache {
  userName: string;
  moment: UpcomingMoment | null;
  sessions: SessionHistoryEntry[];
  stats: Stats | null;
}

let cachedHomeView: HomeViewCache | null = null;

/** Clears cached Home dashboard data on sign-out so a new user never sees stale data. */
export function clearHomeViewCache() {
  cachedHomeView = null;
}

/** Main Home ledger: greeting, active launch pad, upcoming moment, and recent sessions. */
export function HomeView({
  userName,
  onEnterSparringRoom,
  onOpenDebrief,
}: HomeViewProps) {
  const canUseClientCache =
    typeof window !== "undefined" && cachedHomeView?.userName === userName;
  const initialCache = canUseClientCache ? cachedHomeView : null;

  const [moment, setMoment] = useState<UpcomingMoment | null>(
    () => initialCache?.moment ?? null,
  );
  const [sessions, setSessions] = useState<SessionHistoryEntry[] | null>(
    () => initialCache?.sessions ?? null,
  );
  const [stats, setStats] = useState<Stats | null>(
    () => initialCache?.stats ?? null,
  );
  const [showMomentDialog, setShowMomentDialog] = useState(false);
  const [momentDialogDays, setMomentDialogDays] = useState<number>(14);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [recentCollapsed, setRecentCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(RECENT_COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [launchSummary, setLaunchSummary] = useState<SavedLaunchSummary | null>(
    () => (typeof window !== "undefined" ? readLastLaunchSummary() : null),
  );

  useEffect(() => {
    let active = true;
    setLaunchSummary(readLastLaunchSummary());

    Promise.all([
      fetch("/api/upcoming-moment")
        .then((r) => r.json())
        .then((d) => (d.upcoming ?? null) as UpcomingMoment | null)
        .catch(() => null),
      fetch("/api/sessions")
        .then((r) => r.json())
        .then((d) => (d.sessions ?? []) as SessionHistoryEntry[])
        .catch(() => [] as SessionHistoryEntry[]),
      fetch("/api/stats")
        .then((r) => r.json())
        .then((d) => (d ?? null) as Stats | null)
        .catch(() => null),
    ]).then(([nextMoment, nextSessions, nextStats]) => {
      if (!active) return;
      cachedHomeView = {
        userName,
        moment: nextMoment,
        sessions: nextSessions,
        stats: nextStats,
      };
      setMoment(nextMoment);
      setSessions(nextSessions);
      setStats(nextStats);
    });

    return () => {
      active = false;
    };
  }, [userName]);

  const daysUntil = moment ? getDaysUntilMoment(moment.date) : null;
  const firstName =
    userName && userName !== "there" ? userName : "there";

  const openMomentModal = (daysOffset = 14) => {
    setMomentDialogDays(daysOffset);
    setShowMomentDialog(true);
  };

  function toggleRecentCollapsed() {
    setRecentCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(RECENT_COLLAPSED_KEY, String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }

  async function handleDeleteSession(id: string) {
    if (deletingId) return;
    setDeletingId(id);
    const previous = sessions;
    const filtered = previous ? previous.filter((s) => s.id !== id) : previous;
    setSessions(filtered);
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setSessions(previous);
      } else {
        if (cachedHomeView && filtered) {
          cachedHomeView = { ...cachedHomeView, sessions: filtered };
        }
        fetch("/api/stats")
          .then((r) => r.json())
          .then((d) => {
            setStats(d);
            if (cachedHomeView) {
              cachedHomeView = { ...cachedHomeView, stats: d };
            }
          })
          .catch(() => {});
      }
    } catch {
      setSessions(previous);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleClearAllSessions() {
    if (clearingAll) return;
    setClearingAll(true);
    const previous = sessions;
    setSessions([]);
    setConfirmClearAll(false);
    try {
      const res = await fetch("/api/sessions", { method: "DELETE" });
      if (!res.ok) {
        setSessions(previous);
      } else {
        if (cachedHomeView) {
          cachedHomeView = { ...cachedHomeView, sessions: [] };
        }
        fetch("/api/stats")
          .then((r) => r.json())
          .then((d) => {
            setStats(d);
            if (cachedHomeView) {
              cachedHomeView = { ...cachedHomeView, stats: d };
            }
          })
          .catch(() => {});
      }
    } catch {
      setSessions(previous);
    } finally {
      setClearingAll(false);
    }
  }

  const containerVariants: Variants = {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 1, y: 0 },
    visible: {
      opacity: 1,
      y: 0,
    },
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-5xl px-5 pb-16 pt-7 sm:px-8 sm:pt-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-5"
        >
          {/* Header + Kwesi Corner Greeting & Streak Nudge */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-xs font-medium text-[var(--text-tertiary)]">
                {greeting()}
              </p>
              <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl">
                {firstName}.
              </h1>
            </div>
            <Kwesi
              pose={stats && stats.streak > 0 && stats.streak < 3 ? "proud" : "hype"}
              variant="cornerman"
              size="sm"
              line={
                stats && stats.streak >= 3
                  ? `${stats.streak}-day streak! Keep the pressure on — pick a round and let's work.`
                  : stats && stats.streak > 0
                    ? "You're warmed up. Ready to run another round?"
                    : "Start today — one quick round keeps your reflexes sharp."
              }
            />
          </motion.div>

          {/* Equal-Height Row: Volt Chunky Launcher + Upcoming Moment */}
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12"
          >
            {/* Left: Primary Volt Chunky Session Launcher */}
            <Card className="spar-chunky-card-volt h-full justify-between gap-4 rounded-[24px] border-2 border-[var(--brand-volt)] bg-[var(--surface-2)] p-6 shadow-[0_4px_0_0_var(--brand-volt-deep)] lg:col-span-7">
              <CardHeader className="gap-1.5 p-0">
                <CardTitle className="font-display text-lg font-bold tracking-tight text-[var(--text-primary)]">
                  New session
                </CardTitle>
                <CardDescription className="max-w-md text-xs leading-relaxed text-[var(--text-secondary)]">
                  Choose a scenario, bring your material, and spar with a live panel.
                </CardDescription>
                {launchSummary && (
                  <CardAction>
                    <span className="spar-chip px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                      {`${launchSummary.modeLabel}${
                        launchSummary.panelCount > 0
                          ? ` · ${launchSummary.panelCount} ${
                              launchSummary.panelCount === 1 ? "panelist" : "panelists"
                            }`
                          : ""
                      }`}
                    </span>
                  </CardAction>
                )}
              </CardHeader>

              <CardFooter className="p-0">
                <button
                  type="button"
                  onClick={onEnterSparringRoom}
                  className="spar-volt-btn inline-flex h-10 items-center justify-center gap-2 px-4 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-volt)]/60"
                >
                  <span>Start setup</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </CardFooter>
            </Card>

            {/* Right: Chunky Upcoming Moment Schedule */}
            <Card className="spar-chunky-card h-full justify-between gap-4 rounded-[24px] border-2 border-[var(--border-strong)] bg-[var(--surface-1)] p-6 shadow-[0_4px_0_0_#060608] lg:col-span-5">
              {moment ? (
                <>
                  <div className="space-y-2">
                    <CardHeader className="gap-1 p-0">
                      <CardTitle className="flex items-center gap-1.5 font-display text-xs font-bold text-[var(--text-secondary)]">
                        <Calendar className="h-3.5 w-3.5 text-[#C6FF3D]" />
                        <span>Upcoming moment</span>
                      </CardTitle>
                      {daysUntil !== null && (
                        <CardAction>
                          <span
                            className={cn(
                              "rounded-md px-2 py-0.5 text-[11px] font-bold tabular-nums",
                              daysUntil <= 1
                                ? "bg-[#C6FF3D] text-[#0B0D06]"
                                : "border border-[#232327] bg-[#1C1C21] text-[#E4E4E7]",
                            )}
                          >
                            {formatMomentCountdown(daysUntil)}
                          </span>
                        </CardAction>
                      )}
                    </CardHeader>

                    <CardContent className="p-0">
                      <h3 className="truncate font-display text-[16px] font-bold tracking-tight text-[var(--text-primary)]">
                        {moment.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                        {formatMomentDisplayDate(moment.date)}
                      </p>
                      {moment.detail && (
                        <p className="mt-1 line-clamp-1 text-xs text-[var(--text-tertiary)]">
                          {moment.detail}
                        </p>
                      )}
                    </CardContent>
                  </div>

                  <CardFooter className="flex-wrap items-center gap-2 p-0">
                    <button
                      type="button"
                      onClick={() => triggerMomentIcsDownload(moment)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#26262E] bg-[#18181D] px-3 text-xs font-medium text-[var(--text-primary)] transition-colors hover:border-[#3A3A44]"
                    >
                      <Download className="h-3.5 w-3.5 text-[#A1A1AA]" />
                      Add to calendar
                    </button>
                    <button
                      type="button"
                      onClick={() => openMomentModal(14)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-transparent px-2.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[#26262E] hover:bg-[#18181D] hover:text-white"
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </button>
                  </CardFooter>
                </>
              ) : (
                <>
                  <CardHeader className="gap-1 p-0">
                    <CardTitle className="flex items-center gap-1.5 font-display text-[15px] font-bold tracking-tight text-[var(--text-primary)]">
                      <Calendar className="h-3.5 w-3.5 text-[#C6FF3D]" />
                      <span>Upcoming moment</span>
                    </CardTitle>
                    <CardDescription className="text-xs leading-relaxed text-[var(--text-secondary)]">
                      Anchor prep to a pitch, defense, or interview.
                    </CardDescription>
                    <CardAction>
                      <span className="text-[11px] font-medium text-[var(--text-tertiary)]">
                        Unscheduled
                      </span>
                    </CardAction>
                  </CardHeader>

                  <CardFooter className="flex-wrap items-center justify-between gap-2 p-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {QUICK_MOMENT_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => openMomentModal(preset.days)}
                          className="h-7 rounded-md border border-[#26262E] bg-[#18181D] px-2.5 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[#3A3A44] hover:text-white"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => openMomentModal(14)}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-[#26262E] bg-[#18181D] px-3 text-xs font-medium text-[var(--text-primary)] transition-colors hover:border-[#3A3A44]"
                    >
                      Set date
                    </button>
                  </CardFooter>
                </>
              )}
            </Card>
          </motion.div>

          {/* 3 Separate Chunky Stat Tiles */}
          <motion.div variants={itemVariants}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(
                [
                  {
                    icon: (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#C6FF3D]/12 text-[#C6FF3D]">
                        <BarChart3 className="h-3.5 w-3.5" />
                      </span>
                    ),
                    label: "Sessions this week",
                    value: stats ? String(stats.sessionsThisWeek) : "—",
                    sub:
                      stats && stats.totalSessions > 0
                        ? `${stats.totalSessions} debriefed`
                        : "Last 7 days",
                    streakHot: false,
                  },
                  {
                    icon: (
                      <span
                        className={cn(
                          "inline-flex h-7 w-7 items-center justify-center rounded-lg",
                          stats && stats.streak >= 3
                            ? "bg-[#C6FF3D]/20 text-[#C6FF3D]"
                            : "bg-[#FF5A1F]/12 text-[#FF5A1F]",
                        )}
                      >
                        <Flame className="h-3.5 w-3.5" />
                      </span>
                    ),
                    label: "Current streak",
                    value: stats ? `${stats.streak}d` : "—",
                    sub:
                      stats && stats.streak >= 3
                        ? "Hot streak"
                        : stats && stats.streak > 0
                          ? "Consecutive days"
                          : "Start today",
                    streakHot: Boolean(stats && stats.streak >= 3),
                  },
                  {
                    icon: (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#C6FF3D]/12 text-[#C6FF3D]">
                        <Award className="h-3.5 w-3.5" />
                      </span>
                    ),
                    label: "Top skill",
                    value: stats?.topSkill ? `${stats.topSkill.score}%` : "—",
                    sub: stats?.topSkill ? stats.topSkill.name : "Earned after debrief",
                    streakHot: false,
                  },
                ] as const
              ).map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    "spar-stat-tile flex flex-col justify-between p-4 sm:p-5",
                    item.streakHot && "border-[#C6FF3D]/55 bg-[#171A10]",
                  )}
                >
                  <div className="flex items-center justify-between text-[var(--text-secondary)]">
                    <span className="text-xs font-medium">{item.label}</span>
                    {item.icon}
                  </div>
                  <div className="mt-2.5 flex items-baseline gap-2.5">
                    <span className="font-display text-2xl font-bold tracking-tight tabular-nums text-[var(--text-primary)]">
                      {item.value}
                    </span>
                    <span
                      className={cn(
                        "text-xs",
                        item.streakHot
                          ? "font-semibold text-[#C6FF3D]"
                          : "text-[var(--text-tertiary)]",
                      )}
                    >
                      {item.sub}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Recent Sessions Ledger */}
          <motion.div variants={itemVariants} className="pt-1">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={toggleRecentCollapsed}
                aria-expanded={!recentCollapsed}
                className="inline-flex items-center gap-2 font-display text-sm font-bold text-[var(--text-primary)] transition-colors hover:text-[#C6FF3D]"
              >
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-[var(--text-tertiary)] transition-transform duration-150",
                    recentCollapsed && "-rotate-90",
                  )}
                />
                <span>Recent sessions</span>
                {sessions && sessions.length > 0 && (
                  <span className="rounded-md border border-[#262630] bg-[#16161D] px-1.5 py-0.5 text-[11px] font-bold text-[var(--text-secondary)] tabular-nums">
                    {sessions.length}
                  </span>
                )}
              </button>

              {sessions && sessions.length > 0 && (
                <div className="flex items-center gap-2">
                  {!recentCollapsed && sessions.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setShowAllSessions((prev) => !prev)}
                      className="rounded-lg border border-[#26262E] bg-[#16161D] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[#3A3A46] hover:text-white"
                    >
                      {showAllSessions ? "Show fewer" : `View all ${sessions.length}`}
                    </button>
                  )}

                  {confirmClearAll ? (
                    <span className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleClearAllSessions()}
                        disabled={clearingAll}
                        className="rounded-lg border border-[#FF5A1F]/40 bg-[#FF5A1F]/15 px-2.5 py-1 text-xs font-semibold text-[#FF5A1F] transition-colors hover:bg-[#FF5A1F]/25"
                      >
                        {clearingAll ? "Deleting…" : "Confirm delete"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearAll(false)}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--text-tertiary)] transition-colors hover:text-white"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmClearAll(true)}
                      aria-label="Delete recent sessions"
                      className="inline-flex items-center gap-1 rounded-lg border border-[#26262E] bg-[#16161D] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[#FF5A1F]/40 hover:text-[#FF5A1F]"
                    >
                      <Trash2 className="h-3 w-3" />
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>

            {!recentCollapsed && (
              sessions === null ? (
                <div className="spar-chunky-card p-10 text-center text-xs text-[var(--text-tertiary)]">
                  Loading sessions…
                </div>
              ) : sessions.length === 0 ? (
                <div className="spar-chunky-card flex flex-col items-center px-6 py-10 text-center">
                  <Kwesi pose="listening" variant="cornerman" size="sm" className="mb-3" />
                  <p className="font-display text-base font-bold text-[var(--text-primary)]">
                    No sessions yet
                  </p>
                  <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-[var(--text-tertiary)]">
                    Once you finish a round, your session transcript, claim score, and next focus point appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {groupSessionsByDate(
                    showAllSessions ? sessions : sessions.slice(0, 5),
                  ).map((bucket) => (
                    <div key={bucket.group} className="space-y-2.5">
                      <div className="flex items-center gap-3 px-1">
                        <span className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                          {bucket.group}
                        </span>
                        <span className="h-px flex-1 bg-[#22222B]" aria-hidden />
                      </div>
                      <div className="space-y-3">
                        {bucket.sessions.map((s) => (
                          <SessionHistoryCard
                            key={s.id}
                            session={s}
                            onOpenDebrief={onOpenDebrief}
                            onDelete={handleDeleteSession}
                            deleting={deletingId === s.id}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </motion.div>
        </motion.div>
      </div>

      <UpcomingMomentDialog
        open={showMomentDialog}
        onOpenChange={setShowMomentDialog}
        existing={moment}
        initialDaysOffset={momentDialogDays}
        onSaved={(m) => {
          setMoment(m);
          if (cachedHomeView) {
            cachedHomeView = { ...cachedHomeView, moment: m };
          }
          setShowMomentDialog(false);
        }}
        onDeleted={() => {
          setMoment(null);
          if (cachedHomeView) {
            cachedHomeView = { ...cachedHomeView, moment: null };
          }
          setShowMomentDialog(false);
        }}
      />
    </div>
  );
}

/** Crisp compact stat card kept exported for test/panel reuse. */
export function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="spar-stat-tile flex flex-col justify-between p-5">
      <div className="flex items-center justify-between text-[var(--text-secondary)]">
        <span className="text-xs font-medium">{label}</span>
        {icon}
      </div>
      <div className="mt-3 flex items-baseline gap-2.5">
        <span className="font-display text-2xl font-bold tracking-tight tabular-nums text-[var(--text-primary)]">
          {value}
        </span>
        {sub && (
          <span className="text-xs text-[var(--text-tertiary)]">
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

const DATE_PRESETS = [
  { label: "Today", days: 0 },
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "In 1 week", days: 7 },
  { label: "In 2 weeks", days: 14 },
];

export function UpcomingMomentDialog({
  open,
  onOpenChange,
  existing,
  initialDaysOffset = 14,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existing: UpcomingMoment | null;
  initialDaysOffset?: number;
  onSaved: (m: UpcomingMoment) => void;
  onDeleted: () => void;
}) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(existing?.title || "");
      setDetail(existing?.detail || "");
      setDate(
        existing
          ? extractMomentDateInput(existing.date)
          : addDaysToDateInput(initialDaysOffset),
      );
      setTime(existing ? extractMomentTimeInput(existing.date) : "");
      setError(null);
    }
  }, [open, existing, initialDaysOffset]);

  async function handleSave() {
    setError(null);

    if (!title.trim()) {
      setError("Give this moment a title.");
      return;
    }
    if (!date) {
      setError("Pick a target date.");
      return;
    }

    const combinedIso = combineMomentDateAndTime(date, time);
    if (!combinedIso) {
      setError("Enter a valid date.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/upcoming-moment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          detail: detail.trim(),
          date: combinedIso,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save this moment. Please try again.");
        return;
      }

      onSaved({
        id: data.id,
        title: data.title,
        detail: data.detail,
        date: data.date,
      });
    } catch {
      setError("Network error while saving. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/upcoming-moment", { method: "DELETE" });
      if (!res.ok) {
        setError("Could not clear this moment.");
        return;
      }
      onDeleted();
    } catch {
      setError("Network error while removing.");
    } finally {
      setSaving(false);
    }
  }

  function handleCalendarDownload() {
    if (!title.trim() || !date) {
      setError("Add a title and date first to export a calendar invite.");
      return;
    }
    const iso = combineMomentDateAndTime(date, time);
    if (!iso) return;
    triggerMomentIcsDownload({
      title: title.trim(),
      detail: detail.trim() || null,
      date: iso,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[24px] border-2 border-[var(--border-strong)] bg-[#141418] text-white shadow-[0_6px_0_0_#060608] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-bold tracking-tight text-white">
            {existing ? "Edit upcoming moment" : "Set upcoming moment"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {error && (
            <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="moment-title" className="text-xs text-neutral-300">
              What are you preparing for?
            </Label>
            <Input
              id="moment-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Series A Pitch, Thesis Defense"
              className="rounded-xl border-[var(--border-subtle)] bg-[#0B0B0D] text-white placeholder:text-neutral-600 focus-visible:border-[#C6FF3D]/70 focus-visible:ring-0"
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {DATE_PRESETS.map((preset) => {
                const presetDate = addDaysToDateInput(preset.days);
                const selected = date === presetDate;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setDate(presetDate)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors",
                      selected
                        ? "border-[#C6FF3D]/70 bg-[#C6FF3D]/15 text-[#C6FF3D] font-semibold"
                        : "border-[#26262E] bg-[#18181D] text-neutral-400 hover:text-white",
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="moment-date" className="text-xs text-neutral-300">
                  Date
                </Label>
                <Input
                  id="moment-date"
                  type="date"
                  min={formatDateInputValue(new Date())}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="rounded-xl border-[var(--border-subtle)] bg-[#0B0B0D] text-white [color-scheme:dark] focus-visible:border-[#C6FF3D]/70 focus-visible:ring-0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="moment-time" className="text-xs text-neutral-300">
                  Time (optional)
                </Label>
                <Input
                  id="moment-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="rounded-xl border-[var(--border-subtle)] bg-[#0B0B0D] text-white [color-scheme:dark] focus-visible:border-[#C6FF3D]/70 focus-visible:ring-0"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="moment-detail" className="text-xs text-neutral-300">
              Notes or stakes (optional)
            </Label>
            <Textarea
              id="moment-detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="e.g. 20 minutes with two general partners focused on retention metrics"
              rows={2}
              className="resize-none rounded-xl border-[var(--border-subtle)] bg-[#0B0B0D] text-white placeholder:text-neutral-600 focus-visible:border-[#C6FF3D]/70 focus-visible:ring-0"
            />
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex items-center gap-1">
            {existing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={saving}
                className="text-xs text-neutral-400 hover:bg-neutral-900 hover:text-red-400"
              >
                <X className="mr-1 h-3.5 w-3.5" /> Remove
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCalendarDownload}
              disabled={saving || !title.trim() || !date}
              className="text-xs text-neutral-300 hover:bg-[#18181D] hover:text-white"
            >
              <Download className="mr-1 h-3.5 w-3.5 text-[#C6FF3D]" /> Add to calendar (.ics)
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-neutral-300 hover:bg-[#18181D] hover:text-white"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void handleSave()}
              disabled={saving || !title.trim() || !date}
              className="spar-white-btn h-9 rounded-xl px-4 text-xs"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
