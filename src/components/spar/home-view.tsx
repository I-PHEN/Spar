"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Calendar,
  Flame,
  Target,
  Sparkles,
  Pencil,
  X,
  Loader2,
  Lightbulb,
  Gauge,
  MessageSquare,
  Send,
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

interface HomeViewProps {
  userName: string;
  /** Called when user wants the full Practice flow (has material / wants to configure). */
  onEnterSparringRoom: () => void;
  /** Called with a session ID when a quick spar session is created. */
  onQuickSparStarted: (sessionId: string) => void;
}

interface UpcomingMoment {
  id: string;
  title: string;
  detail: string | null;
  date: string;
}

interface Stats {
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

// One-tap topic presets. Each pre-fills the quick spar input + scenario.
const TOPIC_PRESETS: Array<{
  icon: typeof Lightbulb;
  label: string;
  topic: string;
  scenario: "custom";
}> = [
  {
    icon: Lightbulb,
    label: "Defend an idea",
    topic: "I believe remote-first teams can build better products than hybrid teams, if they invest heavily in async communication and written culture.",
    scenario: "custom",
  },
  {
    icon: Gauge,
    label: "Pressure-test a number",
    topic: "I'm projecting 40% month-over-month growth for the next 6 months based on our current trajectory and a planned sales hire in month 3.",
    scenario: "custom",
  },
  {
    icon: MessageSquare,
    label: "Practice a hard conversation",
    topic: "I need to tell my co-founder that I think we should pivot away from our current product direction because the market signal isn't there.",
    scenario: "custom",
  },
];

export function HomeView({ userName, onEnterSparringRoom, onQuickSparStarted }: HomeViewProps) {
  const [moment, setMoment] = useState<UpcomingMoment | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [editingMoment, setEditingMoment] = useState(false);

  // Quick spar state
  const [quickTopic, setQuickTopic] = useState("");
  const [quickStarting, setQuickStarting] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetch("/api/upcoming-moment"), fetch("/api/stats")])
      .then(async ([mr, sr]) => {
        const mData = await mr.json();
        const sData = await sr.json();
        setMoment(mData.upcoming || null);
        setStats(sData);
      })
      .catch(console.error);
  }, []);

  const daysUntil = moment
    ? Math.max(0, Math.ceil((new Date(moment.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const quickTopicValid = quickTopic.trim().length >= 5;

  async function startQuickSpar(topicOverride?: string) {
    const topic = (topicOverride ?? quickTopic).trim();
    if (topic.length < 5) {
      setQuickError("Give us at least 5 characters to work with.");
      return;
    }
    setQuickStarting(true);
    setQuickError(null);
    try {
      const res = await fetch("/api/sessions/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      if (!res.ok) {
        setQuickError(data.error || "Failed to start session");
        return;
      }
      onQuickSparStarted(data.session.id);
    } catch (e) {
      setQuickError(String(e));
    } finally {
      setQuickStarting(false);
    }
  }

  function handlePreset(presetTopic: string) {
    setQuickTopic(presetTopic);
    startQuickSpar(presetTopic);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 pb-32 sm:px-6 sm:py-12 md:pb-16">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500 mb-2">
          {greeting()}
        </p>
        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-white">
          {userName}.
        </h1>
        {moment && daysUntil !== null ? (
          <p className="mt-2 text-sm text-neutral-400">
            Your <span className="text-white/90">{moment.title}</span> is in{" "}
            <span className="font-semibold text-white">{daysUntil} {daysUntil === 1 ? "day" : "days"}</span>.
          </p>
        ) : (
          <p className="mt-2 text-sm text-neutral-400">
            No upcoming moment set.{" "}
            <button
              onClick={() => setEditingMoment(true)}
              className="text-white underline-offset-2 hover:underline"
            >
              Set one →
            </button>
          </p>
        )}
      </div>

      {/* Quick Spar — the low-friction path */}
      <div className="premium-card rounded-xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-white">
              Spar on a topic
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Type what's on your mind. We'll build the room.
            </p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-wider text-neutral-400">
            <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
            Fast path
          </span>
        </div>

        <div className="relative">
          <Textarea
            value={quickTopic}
            onChange={(e) => setQuickTopic(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                startQuickSpar();
              }
            }}
            placeholder="e.g., I think we should raise prices 30% next quarter because our churn is low and the product is underpriced."
            rows={3}
            className="resize-none bg-background/50 border-white/10 text-sm placeholder:text-neutral-600 focus-visible:border-white/30 focus-visible:ring-white/20 pr-32"
            disabled={quickStarting}
          />
          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-2">
            <span className="hidden sm:inline text-[10px] text-neutral-600">
              ⌘↵
            </span>
            <button
              onClick={() => startQuickSpar()}
              disabled={!quickTopicValid || quickStarting}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition-all",
                quickTopicValid && !quickStarting
                  ? "bg-white text-black hover:bg-white/90 spar-ready-glow"
                  : "bg-white/10 text-neutral-500 cursor-not-allowed"
              )}
            >
              {quickStarting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Building...
                </>
              ) : (
                <>
                  Spar
                  <Send className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>

        {quickError && (
          <p className="mt-2 text-xs text-red-400">{quickError}</p>
        )}

        {/* One-tap presets */}
        <div className="mt-4 flex flex-wrap gap-2">
          {TOPIC_PRESETS.map((preset) => {
            const Icon = preset.icon;
            return (
              <button
                key={preset.label}
                onClick={() => handlePreset(preset.topic)}
                disabled={quickStarting}
                className="group flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs text-neutral-400 transition-all hover:border-white/20 hover:bg-white/5 hover:text-white disabled:opacity-50"
              >
                <Icon className="h-3.5 w-3.5 text-neutral-500 group-hover:text-white transition-colors" />
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Full practice — secondary path */}
      <button
        onClick={onEnterSparringRoom}
        className="group mt-3 flex w-full items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-left transition-all hover:border-white/20 hover:bg-white/[0.04]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 text-neutral-400 ring-1 ring-white/10 transition-colors group-hover:text-white">
            <ArrowRight className="h-4 w-4 rotate-45" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              Bring material &amp; configure the room
            </p>
            <p className="text-xs text-neutral-500 mt-0.5">
              Upload a pitch, deck, or proposal. Pick your panel.
            </p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-neutral-600 group-hover:text-white transition-colors" />
      </button>

      {/* Upcoming Moment countdown */}
      {moment && daysUntil !== null && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.06] bg-card/40 px-5 py-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-neutral-500" />
            <div>
              <p className="text-sm font-medium text-white">{moment.title}</p>
              {moment.detail && (
                <p className="text-xs text-neutral-400">{moment.detail}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-2xl font-bold text-white tabular-nums">{daysUntil}</p>
              <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                {daysUntil === 1 ? "day" : "days"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEditingMoment(true)}
              aria-label="Edit upcoming moment"
              className="h-8 w-8 text-neutral-500 hover:text-white"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Quick Stats Row */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <StatCard
          icon={<Sparkles className="h-3.5 w-3.5" />}
          label="Sessions this week"
          value={stats?.sessionsThisWeek ?? "—"}
        />
        <StatCard
          icon={<Flame className="h-3.5 w-3.5" />}
          label="Current streak"
          value={stats ? `${stats.streak}d` : "—"}
        />
        <StatCard
          icon={<Target className="h-3.5 w-3.5" />}
          label="Top skill"
          value={stats?.topSkill?.name ?? "—"}
          sub={stats?.topSkill ? `${stats.topSkill.score}` : undefined}
        />
      </div>

      {/* Today's Focus */}
      {stats?.todaysFocus && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
            Today&apos;s Focus
          </p>
          <p className="mt-2 text-sm text-white/90 leading-relaxed">
            {stats.todaysFocus.description}
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            Pattern tag:{" "}
            <code className="rounded bg-white/5 px-1 py-0.5 text-[10px] text-neutral-400">
              {stats.todaysFocus.tag.replace(/_/g, " ")}
            </code>
          </p>
        </div>
      )}

      {/* Mobile floating CTA */}
      <button
        onClick={onEnterSparringRoom}
        className="fixed bottom-20 left-4 right-4 z-40 flex items-center justify-center gap-2 rounded-xl bg-white py-3.5 px-6 text-sm font-semibold text-black shadow-lg transition-transform active:scale-95 md:hidden"
      >
        Configure a custom room
        <ArrowRight className="h-4 w-4 ml-2" />
      </button>

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

function StatCard({
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
    <div className="rounded-xl border border-white/[0.06] bg-card/40 px-4 py-3.5 transition-colors hover:border-white/10">
      <div className="flex items-center gap-1.5 text-neutral-500">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-xl font-bold text-white tabular-nums sm:text-2xl">
          {value}
        </span>
        {sub && (
          <span className="text-xs text-neutral-500">{sub}</span>
        )}
      </div>
    </div>
  );
}

function UpcomingMomentDialog({
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {existing ? "Edit your upcoming moment" : "Set your upcoming moment"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="moment-title">What are you preparing for?</Label>
            <Input
              id="moment-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Thesis Defense, Investor Pitch"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="moment-detail">Detail (optional)</Label>
            <Textarea
              id="moment-detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Defense of my dissertation on X / Pitching our Series A to 3 firms"
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="moment-date">Date</Label>
            <Input
              id="moment-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          {existing && (
            <Button
              variant="ghost"
              onClick={handleDelete}
              disabled={saving}
              className="mr-auto text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4 mr-1" /> Remove
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || !title.trim() || !date}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
