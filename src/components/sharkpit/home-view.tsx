"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Calendar,
  Flame,
  Target,
  Sparkles,
  Plus,
  Pencil,
  X,
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
  onEnterSparringRoom: () => void;
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

export function HomeView({ userName, onEnterSparringRoom }: HomeViewProps) {
  const [moment, setMoment] = useState<UpcomingMoment | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [editingMoment, setEditingMoment] = useState(false);

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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Header */}
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground/70">
          {greeting()}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {userName}.
        </h1>
        {moment && daysUntil !== null ? (
          <p className="mt-2 text-base text-muted-foreground">
            Your <span className="text-foreground/90">{moment.title}</span> is in{" "}
            <span className="font-semibold text-primary">{daysUntil} {daysUntil === 1 ? "day" : "days"}</span>.
          </p>
        ) : (
          <p className="mt-2 text-base text-muted-foreground">
            No upcoming moment set.{" "}
            <button
              onClick={() => setEditingMoment(true)}
              className="text-primary hover:underline"
            >
              Set one →
            </button>
          </p>
        )}
      </div>

      {/* Primary CTA */}
      <button
        onClick={onEnterSparringRoom}
        className="group relative block w-full overflow-hidden rounded-xl border border-primary/40 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-6 text-left transition-all hover:border-primary/60 hover:from-primary/20 sm:p-8"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-primary/80">
              Start a session
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Enter the Sparring Room
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Bring an idea. Face the panel. Get coached.
            </p>
          </div>
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform group-hover:scale-110 sm:h-14 sm:w-14">
            <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>
      </button>

      {/* Upcoming Moment countdown */}
      {moment && daysUntil !== null && (
        <div className="mt-5 flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-5 py-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">{moment.title}</p>
              {moment.detail && (
                <p className="text-xs text-muted-foreground">{moment.detail}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-2xl font-semibold text-primary tabular-nums">{daysUntil}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                {daysUntil === 1 ? "day" : "days"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEditingMoment(true)}
              aria-label="Edit upcoming moment"
              className="h-8 w-8"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Quick Stats Row */}
      <div className="mt-5 grid grid-cols-3 gap-3 sm:gap-4">
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
        <div className="mt-5 rounded-lg border border-primary/20 bg-primary/[0.04] p-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-primary/70">
            Today&apos;s Focus
          </p>
          <p className="mt-2 text-sm text-foreground/90 leading-relaxed">
            {stats.todaysFocus.description}
          </p>
          <p className="mt-2 text-xs text-muted-foreground/70">
            Pattern tag:{" "}
            <code className="rounded bg-muted/40 px-1 py-0.5 text-[10px]">
              {stats.todaysFocus.tag.replace(/_/g, " ")}
            </code>
          </p>
        </div>
      )}

      {/* Set Upcoming Moment Dialog */}
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
    <div className="rounded-lg border border-border/60 bg-card/40 px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-muted-foreground/70">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-xl font-semibold text-foreground tabular-nums sm:text-2xl">
          {value}
        </span>
        {sub && (
          <span className="text-xs text-muted-foreground/60">{sub}</span>
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
