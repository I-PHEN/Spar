"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  Loader2,
  FileText,
  Lightbulb,
  Swords,
  Target,
  Timer,
  Handshake,
  Search,
  Microscope,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ARCHETYPE_LIST, ARCHETYPES } from "@/lib/personas";
import {
  VISIBLE_EXPERIENCE_LIST,
  DRILL_TARGETS,
  type ExperienceKey,
  type DrillTarget,
} from "@/lib/experiences";
import type {
  ArchetypeKey,
  BehaviorStyle,
  PersonaConfig,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  addSeat,
  defaultSeatsFor,
  MAX_SEATS,
  type PanelSeat,
} from "./panel-seats";

interface PracticeViewProps {
  onSessionCreated: (
    sessionId: string,
    experience: ExperienceKey,
    drillTarget: DrillTarget | null
  ) => void;
  onCancel: () => void;
}

// ─── Types ──────────────────────────────────────────────────────────────

/** Example topics — one click fills the box. Kept concise and specific. */
const TOPIC_EXAMPLES = [
  "Startup GTM — Defending enterprise SaaS go-to-market strategy for healthcare.",
  "Machine Learning — Defending empirical findings and statistical validity in Chapter 4.",
  "Team Proposal — Defending reorganization of customer support around regional pods.",
];

const ARCHETYPE_ICONS: Record<ArchetypeKey, typeof Search> = {
  skeptic: Search,
  nitpicker: Microscope,
  so_what: Target,
  timekeeper: Timer,
  ally: Handshake,
};

const INTENSITY_LABELS: Record<number, string> = {
  1: "Gentle",
  2: "Moderate",
  3: "Aggressive",
};

// ─── Main Component ─────────────────────────────────────────────────────

export function PracticeView({ onSessionCreated, onCancel }: PracticeViewProps) {
  // Last visit's setup (mode, panel, toggle) — restored, never the material
  // itself. A returning user starts where they left off.
  const lastConfig = (() => {
    try {
      const raw = typeof window !== "undefined" && window.localStorage.getItem("spar:last-config");
      return raw ? (JSON.parse(raw) as {
        experience: ExperienceKey; drillTarget: DrillTarget; hasMaterial: boolean; seats: PanelSeat[];
      }) : null;
    } catch {
      return null;
    }
  })();

  // Defend — material or topic
  const [material, setMaterial] = useState("");
  const [materialTitle, setMaterialTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [hasMaterial, setHasMaterial] = useState(lastConfig?.hasMaterial ?? true);

  // Mode — Q&A (default) or Drill
  const [experience, setExperience] = useState<ExperienceKey>(
    lastConfig?.experience ?? "open_spar",
  );
  const [drillTarget, setDrillTarget] = useState<DrillTarget>(
    lastConfig?.drillTarget ?? "hedging",
  );
  const [customRoom, setCustomRoom] = useState("");
  const [showRoomDetails, setShowRoomDetails] = useState(false);

  // Panel (derived from experience, user can override)
  const [seats, setSeats] = useState<PanelSeat[]>(
    lastConfig?.seats?.length ? lastConfig.seats : defaultSeatsFor("open_spar"),
  );
  const [editingSeat, setEditingSeat] = useState<number | null>(null);

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persist the setup (not the material) whenever it changes.
  useEffect(() => {
    try {
      window.localStorage.setItem(
        "spar:last-config",
        JSON.stringify({ experience, drillTarget, hasMaterial, seats }),
      );
    } catch {
      // Private browsing et al. — remembering is a nicety, not a need.
    }
  }, [experience, drillTarget, hasMaterial, seats]);

  // When experience changes, reset the panel to the experience's default
  function selectExperience(key: ExperienceKey) {
    setExperience(key);
    setSeats(defaultSeatsFor(key));
    // Clear custom room when switching (each experience has its own default)
    setCustomRoom("");
  }

  // ─── Validation ────────────────────────────────────────────────────────

  const materialValid = hasMaterial
    ? material.trim().length >= 10
    : topic.trim().length >= 10;
  const panelValid = seats.filter((s) => s.filled).length >= 1;

  const canStart = materialValid && panelValid && !creating;

  const disabledReason = creating
    ? null
    : !materialValid
    ? hasMaterial
      ? "Add at least 10 characters of material to start"
      : "Add a topic (10+ chars) to start"
    : !panelValid
    ? "Add at least one panelist"
    : null;

  // ─── Submit ───────────────────────────────────────────────────────────

  async function handleStart() {
    if (!canStart) return;
    setCreating(true);
    setError(null);
    try {
      const personas: PersonaConfig[] = seats
        .filter((s) => s.filled)
        .map((s, i) => ({
          archetype: s.archetype,
          name: s.name.trim() || ARCHETYPES[s.archetype].defaultName,
          behaviorStyle: intensityToBehavior(s.intensity),
          seatOrder: i,
        }));

      const body = {
        experience,
        drillTarget: experience === "drill" ? drillTarget : null,
        mode: hasMaterial ? "with_material" : "without_material",
        rawMaterial: hasMaterial ? material.trim() : topic.trim() || undefined,
        materialTitle: hasMaterial
          ? materialTitle.trim() || undefined
          : topic.trim() || undefined,
        roomContext: customRoom.trim() || undefined,
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
      onSessionCreated(
        data.session.id,
        experience,
        experience === "drill" ? drillTarget : null
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  }

  // Ctrl/Cmd+Enter starts the session from anywhere on the page.
  const handleStartRef = useRef(handleStart);
  useEffect(() => {
    handleStartRef.current = handleStart;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleStartRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] pb-16">
      {/* Background Atmosphere: Top-center ambient lighting + subtle noise overlay */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        <div
          className="absolute -top-[140px] left-1/2 h-[640px] w-[960px] -translate-x-1/2 rounded-full opacity-50 blur-[110px]"
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

      <div className="relative z-10 mx-auto max-w-2xl px-4 pt-6 sm:px-6 sm:pt-8">
        {/* Header — the antechamber */}
        <div className="relative mb-8 spar-fade-up">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_6px_var(--accent-soft)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
              Chamber Setup
            </p>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            Configure the room
          </h1>
          <p className="mt-1.5 text-xs text-[var(--text-secondary)] sm:text-sm">
            Defaults are set —{" "}
            {hasMaterial ? "paste your material and press Start." : "state your topic and press Start."}
          </p>
        </div>

        {/* 01 Defend Section Card */}
        <div className="spar-fade-up rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 sm:p-7 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_8px_24px_-12px_rgba(0,0,0,0.6)]" style={{ animationDelay: "60ms", animationFillMode: "backwards" }}>
          <DefendSection
            hasMaterial={hasMaterial}
            setHasMaterial={setHasMaterial}
            material={material}
            setMaterial={setMaterial}
            materialTitle={materialTitle}
            setMaterialTitle={setMaterialTitle}
            topic={topic}
            setTopic={setTopic}
          />
        </div>

        {/* 02 Mode Section Card */}
        <div className="mt-6 spar-fade-up rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 sm:p-7 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_8px_24px_-12px_rgba(0,0,0,0.6)]" style={{ animationDelay: "140ms", animationFillMode: "backwards" }}>
          <ModeSection
            experience={experience}
            selectExperience={selectExperience}
            drillTarget={drillTarget}
            setDrillTarget={setDrillTarget}
          />
        </div>

        {/* 03 Panel Section Card */}
        <div className="mt-6 spar-fade-up rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 sm:p-7 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_8px_24px_-12px_rgba(0,0,0,0.6)]" style={{ animationDelay: "220ms", animationFillMode: "backwards" }}>
          <PanelSection
            seats={seats}
            setSeats={setSeats}
            onEditSeat={setEditingSeat}
          />
        </div>

        {/* Room details — advanced, behind a disclosure */}
        <div className="mt-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)]/60 px-5 py-4">
          <button
            onClick={() => setShowRoomDetails((v) => !v)}
            className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] hover:text-white transition-colors"
            aria-expanded={showRoomDetails}
          >
            <Pencil className="h-3 w-3 text-[var(--accent)]" />
            Customize the room
            <span className="text-[var(--text-tertiary)]">
              ({showRoomDetails ? "hide" : "room description, optional"})
            </span>
          </button>
          {showRoomDetails && (
            <div className="mt-3.5 space-y-1.5">
              <Label
                htmlFor="custom-room"
                className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold"
              >
                Room description (optional)
              </Label>
              <Textarea
                id="custom-room"
                value={customRoom}
                onChange={(e) => setCustomRoom(e.target.value)}
                placeholder="Describe the specific room — e.g., 'A hiring committee of 3 senior engineers for a staff engineer role.' Overrides the default."
                rows={2}
                className="bg-[var(--surface-2)] border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus-visible:ring-1 focus-visible:ring-[var(--accent)] rounded-xl resize-y"
              />
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Sticky start bar */}
        <div className="sticky bottom-16 md:bottom-0 z-30 -mx-4 sm:-mx-6 mt-10">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-b from-transparent to-[var(--bg-base)]"
          />
          <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-base)]/90 px-4 py-4 backdrop-blur-xl sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={onCancel}
                className="hidden md:flex items-center gap-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:text-white px-2 py-2"
              >
                <ArrowLeft className="h-4 w-4" /> Home
              </button>
              <div className="flex flex-col items-stretch sm:items-end gap-1 w-full md:w-auto">
                <div className="flex items-center justify-end sm:justify-start gap-2.5 w-full">
                  {canStart && !creating && (
                    <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-mono text-[var(--text-tertiary)]">
                      Ctrl ↵
                    </span>
                  )}
                  <button
                    onClick={handleStart}
                    disabled={!canStart}
                    className={cn(
                      "flex items-center justify-center gap-2 px-7 h-12 rounded-full text-sm font-bold transition-all w-full md:w-auto",
                      canStart
                        ? "bg-[var(--accent)] text-white hover:brightness-105 active:translate-y-[3px]"
                        : "border border-white/10 bg-white/5 text-[var(--text-tertiary)] cursor-not-allowed"
                    )}
                    style={canStart ? { boxShadow: "0 4px 0 var(--accent-dark)" } : undefined}
                  >
                    {creating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Building...
                      </>
                    ) : (
                      <>
                        Start Sparring <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
                {!canStart && disabledReason && (
                  <p className="text-[11px] text-[var(--text-tertiary)] text-center md:text-right">{disabledReason}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="pb-8" />
      </div>

      {/* Seat editor modal */}
      {editingSeat !== null && (
        <SeatEditor
          seatIndex={editingSeat}
          seat={seats[editingSeat]}
          onSave={(updated) => {
            setSeats((prev) =>
              prev.map((s, i) =>
                i === editingSeat ? { ...updated, filled: true } : s
              )
            );
            setEditingSeat(null);
          }}
          onRemove={() => {
            setSeats((prev) =>
              prev.map((s, i) =>
                i === editingSeat ? { ...s, filled: false } : s
              )
            );
            setEditingSeat(null);
          }}
          canRemove={seats.filter((s) => s.filled).length > 1}
          onClose={() => setEditingSeat(null)}
        />
      )}
    </div>
  );
}

// ─── 01 Defend: material or topic ───────────────────────────────────────────────────

function DefendSection({
  hasMaterial,
  setHasMaterial,
  material,
  setMaterial,
  materialTitle,
  setMaterialTitle,
  topic,
  setTopic,
}: {
  hasMaterial: boolean;
  setHasMaterial: (v: boolean) => void;
  material: string;
  setMaterial: (v: string) => void;
  materialTitle: string;
  setMaterialTitle: (v: string) => void;
  topic: string;
  setTopic: (v: string) => void;
}) {
  return (
    <div>
      <SectionHeader number="01" title="What are you defending?" />

      <div className="mb-4 flex gap-2">
        <ToggleButton
          active={hasMaterial}
          onClick={() => setHasMaterial(true)}
          icon={<FileText className="h-4 w-4" />}
          label="Bring material"
        />
        <ToggleButton
          active={!hasMaterial}
          onClick={() => setHasMaterial(false)}
          icon={<Lightbulb className="h-4 w-4" />}
          label="Topic only"
        />
      </div>

      {hasMaterial ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label
              htmlFor="material-title"
              className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold"
            >
              Title (optional)
            </Label>
            <Input
              id="material-title"
              value={materialTitle}
              onChange={(e) => setMaterialTitle(e.target.value)}
              placeholder="e.g., PhD Dissertation Defense — Chapter 4"
              className="bg-[var(--surface-2)] border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus-visible:ring-1 focus-visible:ring-[var(--accent)] rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="material-text"
              className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold"
            >
              Paste your material
            </Label>
            <Textarea
              id="material-text"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                // Dropped text (or a small .txt/.md file) lands in the box.
                const file = e.dataTransfer.files?.[0];
                if (file && /\.(txt|md|markdown)$/i.test(file.name) && file.size < 500_000) {
                  file.text().then(setMaterial).catch(() => {});
                  return;
                }
                const text = e.dataTransfer.getData("text/plain");
                if (text) setMaterial(text);
              }}
              placeholder="Paste or drop your pitch, abstract, strategy memo, proposal, or talking points. The more substance, the sharper the panel."
              rows={6}
              className="bg-[var(--surface-2)] border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus-visible:ring-1 focus-visible:ring-[var(--accent)] rounded-xl resize-y"
            />
            <div className="flex items-center justify-between text-[11px] text-[var(--text-tertiary)]">
              <span>
                {material.trim().length < 10
                  ? `${10 - material.trim().length} more characters needed`
                  : material.trim().length < 60
                  ? "Short, so the panel will have less to challenge"
                  : "3-5 key claims will be auto-extracted"}
              </span>
              <span>{material.length} chars</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label
            htmlFor="topic"
            className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold"
          >
            State your topic (concise, max 100 chars)
          </Label>
          <Textarea
            id="topic"
            value={topic}
            maxLength={100}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., go-to-market strategy, Machine learning defense, Q3 Board review"
            rows={2}
            className="bg-[var(--surface-2)] border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus-visible:ring-1 focus-visible:ring-[var(--accent)] rounded-xl"
          />
          <div className="flex items-center justify-between text-[11px] text-[var(--text-tertiary)]">
            <span>The panel will challenge this central claim. Be specific and concise.</span>
            <span className={cn(topic.length >= 95 ? "text-amber-400 font-medium" : "")}>
              {topic.length}/100 chars
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-[var(--text-tertiary)]">Try an example:</span>
            {TOPIC_EXAMPLES.map((example) => (
              <button
                key={example}
                onClick={() => setTopic(example)}
                className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-1 text-[11px] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-white"
              >
                {example.split(" — ")[0]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 02 Mode: Q&A / Drill ──────────────────────────────────────────────

function ModeSection({
  experience,
  selectExperience,
  drillTarget,
  setDrillTarget,
}: {
  experience: ExperienceKey;
  selectExperience: (key: ExperienceKey) => void;
  drillTarget: DrillTarget;
  setDrillTarget: (t: DrillTarget) => void;
}) {
  return (
    <div>
      <SectionHeader number="02" title="How will you spar?" />

      {/* Mode cards — side by side, Q&A first (default) */}
      <div className="grid grid-cols-2 gap-2">
        {VISIBLE_EXPERIENCE_LIST.map((exp) => {
          const isSelected = experience === exp.key;
          return (
            <div
              key={exp.key}
              role="button"
              tabIndex={0}
              onClick={() => selectExperience(exp.key)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectExperience(exp.key);
                }
              }}
              className={cn(
                "w-full text-left rounded-xl border p-4.5 transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/20",
                isSelected
                  ? "bg-[var(--surface-2)] border-[var(--accent)] shadow-[inset_0_0_0_1px_var(--accent),0_4px_12px_rgba(0,0,0,0.4)]"
                  : "bg-[var(--surface-2)]/60 border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-[var(--text-primary)] font-semibold mb-0.5">
                    {exp.label}
                  </h4>
                  <p className="text-[var(--text-secondary)] text-xs leading-relaxed">
                    {exp.tagline}
                  </p>
                </div>
                {isSelected && (
                  <div className="flex-shrink-0">
                    <Check className="h-4 w-4 text-[var(--accent)]" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Drill target — expands under the cards when Drill is selected */}
      {experience === "drill" && (
        <div className="mt-3.5">
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold mb-2">
            What are you drilling?
          </p>
          <div className="flex flex-wrap gap-2">
            {DRILL_TARGETS.map((target) => (
              <button
                key={target.id}
                onClick={() => setDrillTarget(target.id)}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-full border transition-colors",
                  drillTarget === target.id
                    ? "bg-[var(--accent)] border-[var(--accent)] text-white font-semibold shadow-sm"
                    : "bg-[var(--surface-2)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-white"
                )}
              >
                {target.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 03 Panel: seating chart ──────────────────────────────────────

function PanelSection({
  seats,
  setSeats,
  onEditSeat,
}: {
  seats: PanelSeat[];
  setSeats: React.Dispatch<React.SetStateAction<PanelSeat[]>>;
  onEditSeat: (index: number) => void;
}) {
  return (
    <div>
      <SectionHeader number="03" title="Arrange your panel" />
      <p className="text-[11px] text-[var(--text-tertiary)] mb-4">
        Pre-filled based on your experience. Click a seat to customize.
      </p>

      <div className="relative rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/50 p-6 overflow-x-auto shadow-inner">
        {/* "YOU" position */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--accent)] bg-[var(--surface-1)] shadow-md">
            <span className="text-sm font-bold text-white">YOU</span>
          </div>
          <p className="mt-2 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">
            Presenting here
          </p>
          <ArrowRight className="h-4 w-4 text-[var(--accent)] rotate-90 mt-1" />
        </div>

        {/* Seats row — full cards on roomy screens */}
        <div className="hidden sm:flex gap-3 justify-center min-w-fit">
          {seats.map((seat, i) => (
            <SeatCard
              key={i}
              seat={seat}
              index={i}
              onClick={() => onEditSeat(i)}
            />
          ))}
          {seats.length < MAX_SEATS && (
            <button
              onClick={() => {
                // Straight to the editor on the new seat — no empty-seat hop.
                const next = addSeat(seats);
                setSeats(next);
                onEditSeat(next.length - 1);
              }}
              className="flex w-[140px] sm:w-[160px] flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-transparent py-8 transition-all hover:border-[var(--accent)] hover:bg-white/[0.04]"
            >
              <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-semibold mb-1">
                Add panelist
              </span>
              <span className="text-xs text-[var(--text-tertiary)]">Up to {MAX_SEATS}</span>
            </button>
          )}
        </div>

        {/* Compact summary — one line per panelist when space is tight */}
        <div className="sm:hidden flex flex-col gap-2">
          {seats
            .filter((s) => s.filled)
            .map((seat, i) => (
              <button
                key={i}
                onClick={() => onEditSeat(i)}
                className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3.5 py-2.5 text-left transition-all hover:border-[var(--border-strong)]"
              >
                <span className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <span
                    aria-hidden
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{
                      background: `color-mix(in oklab, ${
                        ARCHETYPES[seat.archetype].accentHue
                      } 60%, transparent)`,
                    }}
                  />
                  {seat.name}
                  <span className="text-[var(--text-tertiary)]"> · {INTENSITY_LABELS[seat.intensity]}</span>
                </span>
                <span className="text-[10px] uppercase tracking-wider text-[var(--accent)] font-semibold">
                  Edit
                </span>
              </button>
            ))}
          {seats.length < MAX_SEATS && (
            <button
              onClick={() => {
                const next = addSeat(seats);
                setSeats(next);
                onEditSeat(next.length - 1);
              }}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 px-3 py-2.5 text-xs text-[var(--text-secondary)] transition-all hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/20"
            >
              <Plus className="h-3.5 w-3.5 text-[var(--accent)]" />
              Add panelist (up to {MAX_SEATS})
            </button>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-[var(--text-tertiary)]">
          Click a seat to edit
        </p>
      </div>
    </div>
  );
}

function SeatCard({
  seat,
  index,
  onClick,
}: {
  seat: PanelSeat;
  index: number;
  onClick: () => void;
}) {
  const def = ARCHETYPES[seat.archetype];

  if (!seat.filled) {
    return (
      <button
        onClick={onClick}
        className="flex w-[140px] sm:w-[160px] flex-col items-center justify-center rounded-md border border-dashed border-[#252525] bg-transparent py-8 transition-all hover:border-[#3a3a3a] hover:bg-[#0f0f0f]"
      >
        <span className="text-[10px] uppercase tracking-wider text-neutral-600 mb-1">
          Seat {index + 1}
        </span>
        <span className="text-xs text-neutral-500">Empty</span>
        <span className="text-[10px] text-neutral-700 mt-1">Click to fill</span>
      </button>
    );
  }

  // A filled seat previews the room: the panelist's own muted hue on a
  // circular presence — the accent system is the room's only color.
  const accent = def.accentHue;
  const seatStyle = {
    background: `color-mix(in oklab, ${accent} 10%, #101010)`,
    borderLeft: `2px solid color-mix(in oklab, ${accent} 50%, transparent)`,
  };
  const avatarStyle = {
    background: `color-mix(in oklab, ${accent} 14%, oklch(0.16 0 0))`,
    color: `color-mix(in oklab, ${accent} 55%, oklch(0.92 0 0))`,
    boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${accent} 22%, transparent)`,
  };

  return (
    <button
      onClick={onClick}
      style={seatStyle}
      className={cn(
        "group relative flex w-[140px] sm:w-[160px] flex-col items-center rounded-xl border border-[var(--border-subtle)] p-4 transition-all hover:border-[var(--border-strong)] hover:-translate-y-0.5 shadow-sm",
        "spar-fade-up"
      )}
    >
      <span className="absolute top-2 left-2 text-[9px] text-[var(--text-tertiary)] tabular-nums font-semibold">
        {index + 1}
      </span>
      <div
        className="mb-2 flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold"
        style={avatarStyle}
        aria-hidden
      >
        {def.initials}
      </div>
      <p className="text-center text-xs font-semibold text-[var(--text-primary)] leading-tight">
        {seat.name}
      </p>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3].map((level) => (
          <span
            key={level}
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-colors",
              level <= seat.intensity ? "bg-[var(--accent)]" : "bg-white/10"
            )}
          />
        ))}
      </div>
      <p className="mt-1.5 text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] font-medium">
        {INTENSITY_LABELS[seat.intensity]}
      </p>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Pencil className="h-3 w-3 text-neutral-500" />
      </div>
    </button>
  );
}

// ─── Seat Editor Modal ──────────────────────────────────────────────────

function SeatEditor({
  seatIndex,
  seat,
  onSave,
  onRemove,
  canRemove,
  onClose,
}: {
  seatIndex: number;
  seat: PanelSeat;
  onSave: (seat: PanelSeat) => void;
  onRemove: () => void;
  canRemove: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState(seat.name);
  const [archetype, setArchetype] = useState<ArchetypeKey>(seat.archetype);
  const [intensity, setIntensity] = useState<1 | 2 | 3>(seat.intensity);

  function handleSave() {
    onSave({
      archetype,
      name: name.trim() || ARCHETYPES[archetype].defaultName,
      intensity,
      filled: true,
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          "bg-[var(--surface-1)] border-[var(--border-subtle)] text-[var(--text-primary)] shadow-2xl p-0 overflow-hidden flex flex-col",
          // Mobile Phone: Full-width slide-up bottom sheet
          "max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-full max-sm:rounded-t-[24px] max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:max-h-[90vh]",
          // Desktop: Centered elevated card
          "sm:max-w-md sm:rounded-[20px] sm:border"
        )}
      >
        {/* Mobile Grab Handle Bar */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-white/[0.06] shrink-0">
          <DialogTitle className="text-lg font-bold text-white tracking-tight">
            Configure Seat {seatIndex + 1}
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable Body (Always leaves footer visible) */}
        <div className="space-y-5 px-6 py-4 overflow-y-auto max-h-[calc(88vh-130px)] sm:max-h-[60vh]">
          {/* Name Input */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">
              Name
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={ARCHETYPES[archetype].defaultName}
              className="bg-[var(--surface-2)] border-[var(--border-subtle)] text-white placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus-visible:ring-1 focus-visible:ring-[var(--accent)] rounded-xl h-11 text-sm"
            />
          </div>

          {/* Archetype Selector */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">
              Archetype
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {ARCHETYPE_LIST.map((arch) => {
                const Icon = ARCHETYPE_ICONS[arch.key];
                const isSelected = archetype === arch.key;
                return (
                  <button
                    key={arch.key}
                    type="button"
                    onClick={() => {
                      setArchetype(arch.key);
                      if (
                        !name.trim() ||
                        name === ARCHETYPES[archetype].defaultName
                      ) {
                        setName(arch.defaultName);
                      }
                    }}
                    className={cn(
                      "relative p-3 rounded-xl border text-center transition-all cursor-pointer focus-visible:outline-none",
                      isSelected
                        ? "bg-[var(--surface-2)] border-2 border-[var(--accent)] shadow-[0_0_12px_var(--accent-soft)]"
                        : "bg-[var(--surface-2)]/60 border-[var(--border-subtle)] hover:border-white/20 hover:bg-[var(--surface-2)]"
                    )}
                  >
                    {/* Selected check badge */}
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-sm">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "mb-2 flex h-9 w-9 mx-auto items-center justify-center rounded-xl transition-transform",
                        isSelected
                          ? "bg-[var(--accent)] text-white shadow-sm scale-105"
                          : "bg-white/[0.04] text-[var(--text-secondary)]"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-xs font-semibold text-white leading-tight">
                      {arch.defaultName}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Intensity Segmented Control */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">
              Intensity
            </Label>
            <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/80 p-1">
              {[1, 2, 3].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setIntensity(level as 1 | 2 | 3)}
                  className={cn(
                    "py-2 px-2 text-xs rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5",
                    intensity === level
                      ? "bg-[var(--accent)] text-white shadow-sm"
                      : "text-[var(--text-secondary)] hover:text-white"
                  )}
                >
                  <span className="flex gap-0.5">
                    {[1, 2, 3].map((dot) => (
                      <span
                        key={dot}
                        className={cn(
                          "h-1 w-1 rounded-full",
                          dot <= level ? "bg-white" : "bg-white/30"
                        )}
                      />
                    ))}
                  </span>
                  <span>{INTENSITY_LABELS[level]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sticky Action Footer (Always pinned at the bottom on mobile & desktop) */}
        <div className="sticky bottom-0 bg-[var(--surface-1)]/95 backdrop-blur-md border-t border-white/[0.06] px-6 py-4 flex items-center justify-between gap-3 shrink-0">
          {canRemove && seat.filled && (
            <button
              type="button"
              onClick={onRemove}
              className="text-xs font-medium text-red-400 hover:text-red-300 transition-colors flex items-center gap-1.5 py-2 px-1"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Remove</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-xs font-bold text-white transition-all spar-tactile-btn active:scale-95 shadow-md ml-auto"
          >
            Save Configuration
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Shared components ──────────────────────────────────────────────────

function SectionHeader({ number, title }: { number: string; title: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span
        aria-hidden
        className="text-[34px] font-extralight leading-none text-[var(--accent)]/40 tabular-nums select-none"
      >
        {number}
      </span>
      <h2 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">
        {title}
      </h2>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition-all shadow-sm",
        active
          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
          : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-white"
      )}
    >
      <span className={cn(active ? "text-white" : "text-[var(--text-tertiary)]")}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

function intensityToBehavior(intensity: 1 | 2 | 3): BehaviorStyle {
  return intensity === 1 ? "gentle" : intensity === 2 ? "moderate" : "aggressive";
}

