"use client";

import { useState } from "react";
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
  // Defend — material or topic
  const [material, setMaterial] = useState("");
  const [materialTitle, setMaterialTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [hasMaterial, setHasMaterial] = useState(true);

  // Mode — Q&A (default) or Drill
  const [experience, setExperience] = useState<ExperienceKey>("open_spar");
  const [drillTarget, setDrillTarget] = useState<DrillTarget>("hedging");
  const [customRoom, setCustomRoom] = useState("");
  const [showRoomDetails, setShowRoomDetails] = useState(false);

  // Panel (derived from experience, user can override)
  const [seats, setSeats] = useState<PanelSeat[]>(
    defaultSeatsFor("open_spar")
  );
  const [editingSeat, setEditingSeat] = useState<number | null>(null);

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="relative mx-auto max-w-2xl px-4 pt-6 sm:px-6 sm:pt-8">
      {/* Header — the antechamber. A whisper of light behind it for depth. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, rgba(255,255,255,0.035), transparent 70%)",
        }}
      />
      <div className="relative mb-8 spar-fade-up">
        <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-600">
          Suit up
        </p>
        <h1 className="mt-1.5 text-[26px] font-semibold tracking-tight text-white sm:text-3xl">
          Configure the room
        </h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          Defaults are set — paste your material and press Start.
        </p>
      </div>

      {/* One orchestrated entrance: the sections take their seats in turn. */}
      <div className="spar-fade-up" style={{ animationDelay: "60ms", animationFillMode: "backwards" }}>
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

      <div className="spar-fade-up" style={{ animationDelay: "140ms", animationFillMode: "backwards" }}>
        <ModeSection
          experience={experience}
          selectExperience={selectExperience}
          drillTarget={drillTarget}
          setDrillTarget={setDrillTarget}
        />
      </div>

      <div className="spar-fade-up" style={{ animationDelay: "220ms", animationFillMode: "backwards" }}>
        <PanelSection
          seats={seats}
          setSeats={setSeats}
          onEditSeat={setEditingSeat}
        />
      </div>

      {/* Room details — advanced, behind a disclosure */}
      <div className="mt-8">
        <button
          onClick={() => setShowRoomDetails((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          aria-expanded={showRoomDetails}
        >
          <Pencil className="h-3 w-3" />
          Customize the room
          <span className="text-neutral-700">
            ({showRoomDetails ? "hide" : "room description, optional"})
          </span>
        </button>
        {showRoomDetails && (
          <div className="mt-3 space-y-1.5">
            <Label
              htmlFor="custom-room"
              className="text-[10px] uppercase tracking-wider text-neutral-500"
            >
              Room description (optional)
            </Label>
            <Textarea
              id="custom-room"
              value={customRoom}
              onChange={(e) => setCustomRoom(e.target.value)}
              placeholder="Describe the specific room — e.g., 'A hiring committee of 3 senior engineers for a staff engineer role.' Overrides the default."
              rows={2}
              className="bg-[#0a0a0a] border-[#202020] text-white placeholder:text-neutral-600 focus:border-[#3a3a3a] focus-visible:ring-0 rounded-md resize-y"
            />
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Sticky start bar — always in reach */}
      <div className="sticky bottom-16 md:bottom-0 z-30 -mx-4 sm:-mx-6 mt-10 px-4 sm:px-6 py-3 border-t border-[#1a1a1a] bg-[#0a0a0a]/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition-colors px-2 py-2"
          >
            <ArrowLeft className="h-4 w-4" /> Home
          </button>
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={handleStart}
              disabled={!canStart}
              className={cn(
                "flex items-center gap-2 px-6 h-12 rounded-md text-sm font-semibold transition-all",
                canStart
                  ? "bg-neutral-100 text-black hover:bg-white shadow-[0_0_28px_-6px_rgba(255,255,255,0.28)]"
                  : "bg-neutral-900 text-neutral-600 cursor-not-allowed"
              )}
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
            {!canStart && disabledReason && (
              <p className="text-[11px] text-neutral-600">{disabledReason}</p>
            )}
          </div>
        </div>
      </div>

      <div className="pb-8" />

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
              className="text-[10px] uppercase tracking-wider text-neutral-500"
            >
              Title (optional)
            </Label>
            <Input
              id="material-title"
              value={materialTitle}
              onChange={(e) => setMaterialTitle(e.target.value)}
              placeholder="e.g., PhD Dissertation Defense — Chapter 4"
              className="bg-[#0a0a0a] border-[#202020] text-white placeholder:text-neutral-600 focus:border-[#3a3a3a] focus-visible:ring-0 rounded-md"
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="material-text"
              className="text-[10px] uppercase tracking-wider text-neutral-500"
            >
              Paste your material
            </Label>
            <Textarea
              id="material-text"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="Paste your pitch, abstract, strategy memo, proposal, or talking points. The more substance, the sharper the panel."
              rows={6}
              className="bg-[#0a0a0a] border-[#202020] text-white placeholder:text-neutral-600 focus:border-[#3a3a3a] focus-visible:ring-0 rounded-md resize-y"
            />
            <div className="flex items-center justify-between text-[11px] text-neutral-600">
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
            className="text-[10px] uppercase tracking-wider text-neutral-500"
          >
            State your topic in 1-2 sentences
          </Label>
          <Textarea
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., I'm defending my startup's go-to-market strategy for an enterprise SaaS product targeting mid-market healthcare."
            rows={3}
            className="bg-[#0a0a0a] border-[#202020] text-white placeholder:text-neutral-600 focus:border-[#3a3a3a] focus-visible:ring-0 rounded-md"
          />
          <p className="text-[11px] text-neutral-600">
            The panel will challenge the central claim in your topic. Be
            specific.
          </p>
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
                "w-full text-left rounded-md border p-4 transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/10",
                isSelected
                  ? exp.key === "drill"
                    ? // Drill runs hot: the warm treatment matches the room's
                      // amber drill language.
                      "bg-[#171717] border-amber-500/30 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.08)]"
                    : "bg-[#171717] border-[#343434]"
                  : "bg-[#101010] border-[#202020] hover:bg-[#161616] hover:border-[#2a2a2a]"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-medium mb-0.5">
                    {exp.label}
                  </h4>
                  <p className="text-neutral-400 text-xs leading-relaxed">
                    {exp.description}
                  </p>
                </div>
                {isSelected && (
                  <div className="flex-shrink-0">
                    <Check
                      className={cn(
                        "h-4 w-4",
                        exp.key === "drill" ? "text-amber-300" : "text-neutral-300"
                      )}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Drill target — expands under the cards when Drill is selected */}
      {experience === "drill" && (
        <div className="mt-3">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-2">
            What are you drilling?
          </p>
          <div className="flex flex-wrap gap-2">
            {DRILL_TARGETS.map((target) => (
              <button
                key={target.id}
                onClick={() => setDrillTarget(target.id)}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-md border transition-colors",
                  drillTarget === target.id
                    ? "bg-[#1b1b1b] border-[#3a3a3a] text-neutral-100"
                    : "bg-[#101010] border-[#202020] text-neutral-400 hover:bg-[#161616] hover:border-[#2a2a2a]"
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
      <p className="text-[11px] text-neutral-500 mb-4">
        Pre-filled based on your experience. Click a seat to customize.
      </p>

      <div className="relative rounded-md border border-[#1a1a1a] bg-[#0a0a0a] p-6 overflow-x-auto">
        {/* "YOU" position */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#2a2a2a] bg-[#101010] shadow-[0_0_20px_-6px_rgba(255,255,255,0.12)]">
            <span className="text-sm font-bold text-white">YOU</span>
          </div>
          <p className="mt-2 text-[10px] uppercase tracking-wider text-neutral-600">
            Presenting here
          </p>
          <ArrowRight className="h-4 w-4 text-neutral-700 rotate-90 mt-1" />
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
              onClick={() => setSeats(addSeat(seats))}
              className="flex w-[140px] sm:w-[160px] flex-col items-center justify-center rounded-md border border-dashed border-[#252525] py-8 transition-all hover:border-[#3a3a3a] hover:bg-[#0f0f0f]"
            >
              <span className="text-[10px] uppercase tracking-wider text-neutral-600 mb-1">
                Add panelist
              </span>
              <span className="text-xs text-neutral-500">Up to {MAX_SEATS}</span>
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
                className="flex items-center justify-between rounded-md border border-[#202020] bg-[#101010] px-3 py-2.5 text-left transition-all hover:bg-[#161616]"
              >
                <span className="flex items-center gap-2 text-sm text-white">
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
                  <span className="text-neutral-500"> · {INTENSITY_LABELS[seat.intensity]}</span>
                </span>
                <span className="text-[10px] uppercase tracking-wider text-neutral-500">
                  Edit
                </span>
              </button>
            ))}
          {seats.length < MAX_SEATS && (
            <button
              onClick={() => setSeats(addSeat(seats))}
              className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-[#252525] px-3 py-2.5 text-xs text-neutral-500 transition-all hover:border-[#3a3a3a] hover:bg-[#0f0f0f]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add panelist (up to {MAX_SEATS})
            </button>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-neutral-600">
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
        "group relative flex w-[140px] sm:w-[160px] flex-col items-center rounded-md border border-[#202020] p-4 transition-all hover:brightness-125",
        "spar-fade-up"
      )}
    >
      <span className="absolute top-2 left-2 text-[9px] text-neutral-600 tabular-nums">
        {index + 1}
      </span>
      <div
        className="mb-2 flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold"
        style={avatarStyle}
        aria-hidden
      >
        {def.initials}
      </div>
      <p className="text-center text-xs font-medium text-white leading-tight">
        {seat.name}
      </p>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3].map((level) => (
          <span
            key={level}
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-colors",
              level <= seat.intensity ? "bg-white" : "bg-neutral-700"
            )}
          />
        ))}
      </div>
      <p className="mt-1.5 text-[9px] uppercase tracking-wider text-neutral-500">
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
      <DialogContent className="sm:max-w-md bg-[#0a0a0a] border-[#202020] rounded-md">
        <DialogHeader>
          <DialogTitle className="text-white">
            Configure Seat {seatIndex + 1}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-widest text-neutral-500">
              Name
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={ARCHETYPES[archetype].defaultName}
              className="bg-[#0a0a0a] border-[#202020] text-white placeholder:text-neutral-600 focus:border-[#3a3a3a] focus-visible:ring-0 rounded-md"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-widest text-neutral-500">
              Archetype
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {ARCHETYPE_LIST.map((arch) => {
                const Icon = ARCHETYPE_ICONS[arch.key];
                const isSelected = archetype === arch.key;
                return (
                  <button
                    key={arch.key}
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
                      "p-3 rounded-md border text-center transition-all",
                      isSelected
                        ? "bg-[#171717] border-[#343434]"
                        : "bg-[#101010] border-[#202020] hover:bg-[#161616] hover:border-[#2a2a2a]"
                    )}
                  >
                    <div className="mb-1.5 flex h-8 w-8 mx-auto items-center justify-center rounded-md bg-[#1a1a1a] ring-1 ring-[#2a2a2a]">
                      <Icon className="h-4 w-4 text-neutral-300" />
                    </div>
                    <p className="text-[11px] font-medium text-white leading-tight">
                      {arch.defaultName}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-widest text-neutral-500">
              Intensity
            </Label>
            <div className="flex bg-[#0a0a0a] rounded-md p-1 border border-[#202020]">
              {[1, 2, 3].map((level) => (
                <button
                  key={level}
                  onClick={() => setIntensity(level as 1 | 2 | 3)}
                  className={cn(
                    "flex-1 py-2 text-xs rounded transition-all flex items-center justify-center gap-1.5",
                    intensity === level
                      ? "bg-[#1b1b1b] text-neutral-100"
                      : "text-neutral-500 hover:text-neutral-300"
                  )}
                >
                  <span className="flex gap-0.5">
                    {[1, 2, 3].map((dot) => (
                      <span
                        key={dot}
                        className={cn(
                          "h-1 w-1 rounded-full",
                          dot <= level ? "bg-white" : "bg-neutral-700"
                        )}
                      />
                    ))}
                  </span>
                  {INTENSITY_LABELS[level]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          {canRemove && seat.filled && (
            <button
              onClick={onRemove}
              className="text-sm text-neutral-500 hover:text-red-400 transition-colors mr-auto"
            >
              <X className="h-4 w-4 mr-1 inline" /> Remove
            </button>
          )}
          <button
            onClick={handleSave}
            className="px-4 h-10 rounded-md bg-neutral-100 text-black hover:bg-white text-sm font-medium transition-all"
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
      {/* The page is a true sequence (what you defend → how → who), so the
          numerals earn their place — large, light, quiet. */}
      <span
        aria-hidden
        className="text-[38px] font-extralight leading-none text-white/[0.13] tabular-nums select-none"
      >
        {number}
      </span>
      <h2 className="text-[15px] font-medium text-white tracking-tight">
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
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-all",
        active
          ? "bg-[#1b1b1b] border-[#3a3a3a] text-neutral-100"
          : "bg-[#101010] border-[#202020] text-neutral-400 hover:bg-[#161616] hover:border-[#2a2a2a]"
      )}
      style={
        !active ? { boxShadow: "0 0 0 3px rgba(255,255,255,0.0)" } : undefined
      }
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

function intensityToBehavior(intensity: 1 | 2 | 3): BehaviorStyle {
  return intensity === 1 ? "gentle" : intensity === 2 ? "moderate" : "aggressive";
}

