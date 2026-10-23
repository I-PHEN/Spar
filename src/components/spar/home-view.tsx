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
  createdAt: string;
  personas: Array<{ name: string; archetype: string }>;
  summary: { oneThingToPractice: string } | null;
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

/** One past session in the executive ledger: mode, panel, the coach's takeaway, and the debrief. */
export function SessionHistoryCard({
  session,
  onOpenDebrief,
}: {
  session: SessionHistoryEntry;
  onOpenDebrief: (sessionId: string, label: string) => void;
}) {
  const label = sessionLabel(session.scenario);
  const date = new Date(session.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const panel = session.personas.map((p) => p.name).join(" · ");

  return (
    <div className="group flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      {/* Zone 1 & 2: Metadata + Directive */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-300">
            {label}
          </span>
          <span className="text-xs text-neutral-500 font-medium">{date}</span>
          {panel && (
            <span className="text-xs text-neutral-500">
              · with {panel}
            </span>
          )}
        </div>
        {session.summary?.oneThingToPractice ? (
          <p className="text-xs leading-relaxed text-neutral-200 sm:text-sm font-normal">
            <span className="text-neutral-500 font-medium">Practice: </span>
            {session.summary.oneThingToPractice}
          </p>
        ) : (
          <p className="text-xs text-neutral-500 italic">
            No debrief — the session ended before coaching.
          </p>
        )}
      </div>

      {/* Zone 3: Action Trigger */}
      {session.summary && (
        <div className="flex-shrink-0 self-end sm:self-center">
          <button
            onClick={() => onOpenDebrief(session.id, label)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs font-semibold text-neutral-200 transition-all hover:border-white/30 hover:bg-white hover:text-black"
          >
            Read debrief
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export function HomeView({ userName, onEnterSparringRoom, onOpenDebrief }: HomeViewProps) {
  const [moment, setMoment] = useState<UpcomingMoment | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [sessions, setSessions] = useState<SessionHistoryEntry[] | null>(null);
  const [editingMoment, setEditingMoment] = useState(false);
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 pb-32 sm:px-6 sm:py-12 md:pb-16">
      {/* Executive Command Header */}
      <motion.div
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
            {greeting()} · Executive Command
          </p>
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
          {userName}.
        </h1>
        {moment && daysUntil !== null ? (
          <p className="mt-2 text-xs text-neutral-400 sm:text-sm">
            Upcoming target: <span className="text-white font-medium">{moment.title}</span> in{" "}
            <span className="font-semibold text-white">
              {daysUntil} {daysUntil === 1 ? "day" : "days"}
            </span>.
          </p>
        ) : (
          <p className="mt-2 text-xs text-neutral-400 sm:text-sm">
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
              className="group relative block w-full overflow-hidden rounded-2xl border border-white/10 bg-[#121212] p-6 text-left transition-all hover:border-white/25 hover:bg-[#161616] sm:p-7 lg:col-span-2"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-300">
                      <Swords className="h-3 w-3 text-neutral-400" />
                      Live Chamber
                    </span>
                  </div>
                  <h2 className="mt-2.5 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    New session
                  </h2>
                  <p className="mt-1.5 text-xs text-neutral-400 sm:text-sm leading-relaxed max-w-lg">
                    Spar on a topic or bring material. Face an adversarial panel. Get coached on the tape.
                  </p>
                </div>
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-white text-black transition-transform group-hover:scale-105 sm:h-14 sm:w-14">
                  <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </button>

            {/* Upcoming Moment Countdown Card (Span 1) */}
            <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#121212] p-6 transition-all hover:border-white/20">
              {moment && daysUntil !== null ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 text-neutral-400">
                      <Calendar className="h-4 w-4" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                        Upcoming Moment
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingMoment(true)}
                      aria-label="Edit upcoming moment"
                      className="h-7 w-7 text-neutral-400 hover:text-white"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="my-2">
                    <p className="text-3xl font-extrabold tracking-tight text-white tabular-nums sm:text-4xl">
                      {daysUntil}
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                      {daysUntil === 1 ? "day remaining" : "days remaining"}
                    </p>
                  </div>

                  <div className="truncate border-t border-white/5 pt-2">
                    <p className="truncate text-xs font-medium text-white">{moment.title}</p>
                    {moment.detail && (
                      <p className="truncate text-[11px] text-neutral-400">{moment.detail}</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col justify-between">
                  <div className="flex items-center gap-2 text-neutral-400">
                    <Calendar className="h-4 w-4" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                      Upcoming Moment
                    </span>
                  </div>
                  <div className="my-3">
                    <p className="text-sm font-semibold text-white">No upcoming moment set</p>
                    <p className="mt-1 text-xs text-neutral-400">
                      Anchor your sparring to an upcoming pitch, review, or defense.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingMoment(true)}
                    className="w-full border-white/10 bg-white/[0.02] text-xs text-white hover:bg-white/[0.06]"
                  >
                    Set upcoming moment
                  </Button>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Today's Focus Briefing */}
        {stats?.todaysFocus && (
          <motion.div variants={itemVariants}>
            <div className="rounded-xl border border-white/10 bg-[#141414] p-5 transition-all hover:border-white/15">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-neutral-400">
                  <Target className="h-3.5 w-3.5 text-white" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                    Today&apos;s Focus
                  </span>
                </div>
                <code className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-neutral-300">
                  {stats.todaysFocus.tag.replace(/_/g, " ")}
                </code>
              </div>
              <p className="mt-2.5 text-xs font-normal leading-relaxed text-neutral-200 sm:text-sm">
                {stats.todaysFocus.description}
              </p>
            </div>
          </motion.div>
        )}

        {/* Quick Stats Row (4 Tiles) */}
        <motion.div variants={itemVariants}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={<Sparkles className="h-3.5 w-3.5 text-neutral-400" />}
              label="Sessions this week"
              value={stats?.sessionsThisWeek ?? "—"}
            />
            <StatCard
              icon={<Flame className="h-3.5 w-3.5 text-amber-400" />}
              label="Current streak"
              value={stats ? `${stats.streak}d` : "—"}
            />
            <StatCard
              icon={<Target className="h-3.5 w-3.5 text-neutral-400" />}
              label="Top skill"
              value={stats?.topSkill?.name ?? "—"}
              sub={stats?.topSkill ? `${stats.topSkill.score}` : undefined}
            />
            <StatCard
              icon={<Swords className="h-3.5 w-3.5 text-neutral-400" />}
              label="Total sessions"
              value={stats?.totalSessions ?? "—"}
            />
          </div>
        </motion.div>

        {/* Recent Sessions Feed */}
        <motion.div variants={itemVariants} className="pt-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
              Recent sessions
            </p>
            {sessions && sessions.length > 0 && (
              <span className="text-[10px] text-neutral-500 tabular-nums font-mono">
                Showing {Math.min(sessions.length, 5)} of {sessions.length}
              </span>
            )}
          </div>

          {sessions === null ? (
            <div className="rounded-xl border border-white/5 bg-[#101010] p-6 text-center text-xs text-neutral-500">
              Loading session history…
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-[#0e0e0e] p-8 text-center">
              <Swords className="mx-auto h-6 w-6 text-neutral-600 mb-2" />
              <p className="text-sm font-semibold text-white">No sessions yet</p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-neutral-400">
                Your first spar takes about five minutes. Pick a topic, test your thesis, and get coached on the tape.
              </p>
              <Button
                size="sm"
                onClick={onEnterSparringRoom}
                className="mt-4 bg-white text-black hover:bg-neutral-200 text-xs font-semibold"
              >
                Start first session
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.08] bg-[#111111] divide-y divide-white/[0.06] overflow-hidden">
              {sessions.slice(0, 5).map((s) => (
                <SessionHistoryCard
                  key={s.id}
                  session={s}
                  onOpenDebrief={onOpenDebrief}
                />
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Mobile Floating CTA */}
      <button
        onClick={onEnterSparringRoom}
        className="fixed bottom-20 left-4 right-4 z-40 flex items-center justify-center gap-2 rounded-xl bg-white py-3.5 px-6 text-sm font-semibold text-black shadow-lg transition-transform active:scale-95 md:hidden"
      >
        <Swords className="h-4 w-4" />
        New session
      </button>

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
