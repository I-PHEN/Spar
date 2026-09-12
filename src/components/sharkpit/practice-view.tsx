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
  const [mode, setMode] = useState<SessionMode>("with_material");
  const [material, setMaterial] = useState("");
  const [materialTitle, setMaterialTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [scenario, setScenario] = useState<ScenarioKey>("thesis_defense");
  const [panel, setPanel] = useState<PanelSlot[]>([
    { archetype: "skeptic", name: "The Skeptic", behaviorStyle: "moderate" },
    { archetype: "so_what", name: "The So-What", behaviorStyle: "moderate" },
    { archetype: "nitpicker", name: "The Nitpicker", behaviorStyle: "moderate" },
  ]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const materialValid =
    mode === "without_material"
      ? topic.trim().length >= 10
      : material.trim().length >= 30;

  const panelValid = panel.length >= 1 && panel.length <= 3;
  const canStart = materialValid && panelValid && !creating;

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
            Configure the room
          </h1>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
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
                    {material.trim().length < 30
                      ? `${30 - material.trim().length} more characters needed`
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
                    ? "border-primary/60 bg-primary/10 shadow-[0_0_0_1px_var(--primary)]"
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
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
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
            When you start, the panel speaks first. Be ready to defend.
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
          ? "border-primary/60 bg-primary/10"
          : "border-border/60 bg-card/40 hover:border-border hover:bg-card/70"
      )}
    >
      <div className="flex items-center justify-between">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-md", active ? "bg-primary/15 text-primary" : "bg-muted/40 text-muted-foreground")}>
          {icon}
        </div>
        {active && <Check className="h-4 w-4 text-primary" />}
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
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md"
          style={{ background: def.accentHue + "30", color: def.accentHue }}
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
