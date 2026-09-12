"use client";

import { useState } from "react";
import {
  FileText,
  Mic,
  Check,
  ArrowRight,
  ArrowLeft,
  Search,
  Microscope,
  Target,
  Timer,
  Handshake,
  Plus,
  X,
  Loader2,
  Send,
  Lightbulb,
  Gauge,
  MessageSquare,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SCENARIO_LIST } from "@/lib/scenarios";
import { ARCHETYPE_LIST, ARCHETYPES } from "@/lib/personas";
import type {
  ArchetypeKey,
  BehaviorStyle,
  PersonaConfig,
  ScenarioKey,
  SessionMode,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface PracticeViewProps {
  onSessionCreated: (sessionId: string) => void;
  onCancel: () => void;
}

// One-tap topic presets for the Quick Spar path.
const TOPIC_PRESETS: Array<{
  icon: typeof Lightbulb;
  label: string;
  topic: string;
}> = [
  {
    icon: Lightbulb,
    label: "Defend an idea",
    topic: "I believe remote-first teams can build better products than hybrid teams, if they invest heavily in async communication and written culture.",
  },
  {
    icon: Gauge,
    label: "Pressure-test a number",
    topic: "I'm projecting 40% month-over-month growth for the next 6 months based on our current trajectory and a planned sales hire in month 3.",
  },
  {
    icon: MessageSquare,
    label: "Practice a hard conversation",
    topic: "I need to tell my co-founder that I think we should pivot away from our current product direction because the market signal isn't there.",
  },
];

const ARCHETYPE_ICONS: Record<ArchetypeKey, typeof Search> = {
  skeptic: Search,
  nitpicker: Microscope,
  so_what: Target,
  timekeeper: Timer,
  ally: Handshake,
};

interface PanelSlot {
  archetype: ArchetypeKey;
  name: string;
  behaviorStyle: BehaviorStyle;
}

export function PracticeView({ onSessionCreated, onCancel }: PracticeViewProps) {
  // Quick Spar state — the fast path at the top.
  const [quickTopic, setQuickTopic] = useState("");
  const [quickStarting, setQuickStarting] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  // Full config state — the detailed path below.
  const [mode, setMode] = useState<SessionMode>("with_material");
  const [material, setMaterial] = useState("");
  const [materialTitle, setMaterialTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [scenario, setScenario] = useState<ScenarioKey>("thesis_defense");
  const [customRoom, setCustomRoom] = useState("");
  const [panel, setPanel] = useState<PanelSlot[]>([
    { archetype: "skeptic", name: "The Skeptic", behaviorStyle: "moderate" },
    { archetype: "so_what", name: "The So-What", behaviorStyle: "moderate" },
    { archetype: "nitpicker", name: "The Nitpicker", behaviorStyle: "moderate" },
  ]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quickTopicValid = quickTopic.trim().length >= 5;

  async function startQuickSpar(topicOverride?: string) {
    const t = (topicOverride ?? quickTopic).trim();
    if (t.length < 5) {
      setQuickError("Give us at least 5 characters to work with.");
      return;
    }
    setQuickStarting(true);
    setQuickError(null);
    try {
      const res = await fetch("/api/sessions/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: t }),
      });
      const data = await res.json();
      if (!res.ok) {
        setQuickError(data.error || "Failed to start session");
        return;
      }
      onSessionCreated(data.session.id);
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

  const materialValid =
    mode === "without_material"
      ? topic.trim().length >= 10
      : material.trim().length >= 10;

  const customValid =
    scenario !== "custom" || customRoom.trim().length >= 10;

  const panelValid = panel.length >= 1 && panel.length <= 3;
  const canStart = materialValid && panelValid && customValid && !creating;

  // Compute a clear reason for why the button is disabled (for the UI hint)
  const disabledReason = creating
    ? null
    : !materialValid
    ? mode === "with_material"
      ? "Add at least 10 characters of material to start"
      : "Add a topic (10+ chars) to start"
    : !customValid
    ? "Describe your custom room to start"
    : !panelValid
    ? "Add at least one panelist"
    : null;

  async function handleStart() {
    if (!canStart) return;
    setCreating(true);
    setError(null);
    try {
      const personas: PersonaConfig[] = panel.map((p, i) => ({
        archetype: p.archetype,
        name: p.name.trim() || ARCHETYPES[p.archetype].defaultName,
        behaviorStyle: p.behaviorStyle,
        seatOrder: i,
      }));

      const body = {
        scenario,
        mode,
        rawMaterial:
          mode === "with_material" ? material.trim() : topic.trim() || undefined,
        materialTitle:
          mode === "with_material" ? materialTitle.trim() || undefined : topic.trim() || undefined,
        roomContext: scenario === "custom" ? customRoom.trim() : undefined,
        personas,
      };

      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create session");
        return;
      }
      onSessionCreated(data.session.id);
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70">
            Suit up
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Practice
          </h1>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>

      {/* Quick Spar — the fast path */}
      <div className="premium-card rounded-xl p-5 sm:p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-white" />
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-white">
                Spar on a topic
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Type what&apos;s on your mind. We&apos;ll build the room.
              </p>
            </div>
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

      {/* Divider with label */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex-1 border-t border-white/[0.06]" />
        <span className="text-[11px] uppercase tracking-[0.2em] text-neutral-600">
          Or configure manually
        </span>
        <div className="flex-1 border-t border-white/[0.06]" />
      </div>

      <div className="space-y-8">
        {/* Section 01 — Mode */}
        <Section number="01" title="How will you spar?">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ModeOption
              active={mode === "with_material"}
              onClick={() => setMode("with_material")}
              icon={<FileText className="h-5 w-5" />}
              title="With Material"
              desc="Paste your deck, abstract, memo, or proposal. We extract 3-5 key claims and the panel goes at them."
            />
            <ModeOption
              active={mode === "without_material"}
              onClick={() => setMode("without_material")}
              icon={<Mic className="h-5 w-5" />}
              title="Without Material"
              desc="Speak from memory. Give us a topic and the panel will probe your core claims directly."
            />
          </div>
        </Section>

        {/* Section 02 — Material / Topic */}
        <Section
          number="02"
          title={mode === "with_material" ? "What are you defending?" : "What's the topic?"}
        >
          {mode === "with_material" ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="material-title">Title (optional)</Label>
                <Input
                  id="material-title"
                  value={materialTitle}
                  onChange={(e) => setMaterialTitle(e.target.value)}
                  placeholder="e.g., PhD Dissertation Defense — Chapter 4"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="material-text">Paste your material</Label>
                <Textarea
                  id="material-text"
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  placeholder="Paste your pitch, abstract, strategy memo, proposal, or talking points here. The more substance, the sharper the panel."
                  rows={8}
                  className="font-mono text-sm resize-y"
                />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground/70">
                  <span>
                    {material.trim().length < 10
                      ? `${10 - material.trim().length} more characters needed to start`
                      : material.trim().length < 60
                      ? "Ready — paste more for richer claim extraction"
                      : "3-5 key claims will be auto-extracted"}
                  </span>
                  <span>{material.length} chars</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="topic">State your topic in 1-2 sentences</Label>
              <Textarea
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., I'm defending my startup's go-to-market strategy for an enterprise SaaS product targeting mid-market healthcare."
                rows={3}
              />
              <p className="text-[11px] text-muted-foreground/70">
                The panel will challenge the central claim in your topic. Be specific.
              </p>
            </div>
          )}
        </Section>

        {/* Section 03 — Scenario */}
        <Section number="03" title="What's the room?">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {SCENARIO_LIST.map((s) => (
              <button
                key={s.key}
                onClick={() => setScenario(s.key)}
                className={cn(
                  "rounded-lg border p-3 text-left transition-all",
                  scenario === s.key
                    ? "border-white/40 bg-white/5"
                    : "border-border/60 bg-card/40 hover:border-border hover:bg-card/70"
                )}
              >
                <p className="text-sm font-medium text-foreground">{s.label}</p>
                <p className="mt-1 text-[11px] text-muted-foreground/70 line-clamp-2">
                  {s.description}
                </p>
              </button>
            ))}
          </div>
          {scenario === "custom" && (
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="custom-room">Describe who's in the room</Label>
              <Textarea
                id="custom-room"
                value={customRoom}
                onChange={(e) => setCustomRoom(e.target.value)}
                placeholder="e.g., A hiring committee of 3 senior engineers interviewing me for a staff engineer role. They'll probe my system design decisions, my leadership philosophy, and a past incident where I caused an outage. Stakes: this is my dream job."
                rows={4}
                className="resize-y"
              />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground/70">
                <span>
                  {customRoom.trim().length < 10
                    ? `${10 - customRoom.trim().length} more characters needed`
                    : "The panel will use this to shape their challenges"}
                </span>
                <span>{customRoom.length} chars</span>
              </div>
            </div>
          )}
        </Section>

        {/* Section 04 — Panel */}
        <Section number="04" title="Configure your panel">
          <div className="space-y-3">
            {panel.map((slot, i) => (
              <PanelSlotEditor
                key={i}
                slot={slot}
                onChange={(updated) =>
                  setPanel((prev) => prev.map((s, idx) => (idx === i ? updated : s)))
                }
                onRemove={() =>
                  setPanel((prev) => prev.filter((_, idx) => idx !== i))
                }
                canRemove={panel.length > 1}
              />
            ))}
            {panel.length < 3 && (
              <button
                onClick={() =>
                  setPanel((prev) => [
                    ...prev,
                    {
                      archetype: pickNextArchetype(prev.map((p) => p.archetype)),
                      name: "",
                      behaviorStyle: "moderate",
                    },
                  ])
                }
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 py-3 text-sm text-muted-foreground transition-colors hover:border-white/30 hover:text-foreground"
              >
                <Plus className="h-4 w-4" /> Add panelist ({panel.length}/3)
              </button>
            )}
          </div>
        </Section>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Start */}
        <div className="flex flex-col items-center gap-3 border-t border-border/60 pt-6 sm:flex-row sm:justify-between">
          <p className="text-xs text-muted-foreground/70">
            {canStart
              ? "When you start, the panel speaks first. Be ready to defend."
              : disabledReason}
          </p>
          <Button
            onClick={handleStart}
            disabled={!canStart}
            size="lg"
            className="w-full sm:w-auto"
          >
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Building the room...
              </>
            ) : (
              <>
                Start Sparring
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <span className="font-mono text-xs text-muted-foreground/50">{number}</span>
        <h2 className="text-base font-medium text-foreground">{title}</h2>
        <div className="flex-1 border-t border-border/40" />
      </div>
      {children}
    </section>
  );
}

function ModeOption({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg border p-4 text-left transition-all",
        active
          ? "border-white/40 bg-white/5"
          : "border-border/60 bg-card/40 hover:border-border hover:bg-card/70"
      )}
    >
      <div className="flex items-center justify-between">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-md", active ? "bg-white/10 text-foreground" : "bg-muted/40 text-muted-foreground")}>
          {icon}
        </div>
        {active && <Check className="h-4 w-4 text-foreground" />}
      </div>
      <h3 className="mt-3 text-sm font-medium text-foreground">{title}</h3>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/70">{desc}</p>
    </button>
  );
}

function PanelSlotEditor({
  slot,
  onChange,
  onRemove,
  canRemove,
}: {
  slot: PanelSlot;
  onChange: (updated: PanelSlot) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const Icon = ARCHETYPE_ICONS[slot.archetype];
  const def = ARCHETYPES[slot.archetype];
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3.5">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-white/5 text-foreground/80 ring-1 ring-white/10"
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="grid flex-1 grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
              Archetype
            </Label>
            <Select
              value={slot.archetype}
              onValueChange={(v) =>
                onChange({
                  ...slot,
                  archetype: v as ArchetypeKey,
                  name: slot.name.trim() ? slot.name : ARCHETYPES[v as ArchetypeKey].defaultName,
                })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ARCHETYPE_LIST.map((a) => (
                  <SelectItem key={a.key} value={a.key}>
                    {a.defaultName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
              Name
            </Label>
            <Input
              value={slot.name}
              onChange={(e) => onChange({ ...slot, name: e.target.value })}
              placeholder={def.defaultName}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
              Behavior
            </Label>
            <Select
              value={slot.behaviorStyle}
              onValueChange={(v) =>
                onChange({ ...slot, behaviorStyle: v as BehaviorStyle })
              }
            >
              <SelectTrigger className="h-9 capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gentle">Gentle</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="aggressive">Aggressive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {canRemove && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="mt-2.5 text-[11px] text-muted-foreground/70">
        {def.tagline} — <span className="text-muted-foreground/50">{def.lens}</span>
      </p>
    </div>
  );
}

function pickNextArchetype(used: ArchetypeKey[]): ArchetypeKey {
  const all: ArchetypeKey[] = ["skeptic", "so_what", "nitpicker", "timekeeper", "ally"];
  for (const a of all) if (!used.includes(a)) return a;
  return "skeptic";
}
