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
  Gauge,
  MessageSquare,
  Pencil,
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
} from "@/components/ui/dialog";
import { SCENARIO_LIST } from "@/lib/scenarios";
import { ARCHETYPE_LIST, ARCHETYPES } from "@/lib/personas";
import type {
  ArchetypeKey,
  BehaviorStyle,
  PersonaConfig,
  ScenarioKey,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface PracticeViewProps {
  onSessionCreated: (sessionId: string) => void;
  onCancel: () => void;
}

// ─── Types ──────────────────────────────────────────────────────────────

interface PanelSeat {
  archetype: ArchetypeKey;
  name: string;
  intensity: 1 | 2 | 3; // 1=gentle, 2=moderate, 3=aggressive
  filled: boolean;
}

type CoachingMode = "pure-spar" | "coach" | "drill";
type DrillTarget = "hedging" | "over-explaining" | "recovery-speed" | "evidence-gaps";

const STEP_LABELS = ["Defend", "Room", "Panel", "Mode"];

const COACHING_MODES: Array<{
  id: CoachingMode;
  icon: string;
  title: string;
  desc: string;
  bestFor: string;
}> = [
  {
    id: "pure-spar",
    icon: "🥊",
    title: "Pure Spar",
    desc: "Just the questions. No hand-holding. Full review when you're done.",
    bestFor: "Final rehearsal before the real thing.",
  },
  {
    id: "coach",
    icon: "🎯",
    title: "Coach Mode",
    desc: "Real-time nudges, round-based tips, and ambient feedback. Adjust as you go.",
    bestFor: "Learning and building new habits.",
  },
  {
    id: "drill",
    icon: "🔥",
    title: "Drill Mode",
    desc: "Hammer one weakness until it's fixed. Repetitive, focused pressure.",
    bestFor: "Breaking a specific bad habit.",
  },
];

const DRILL_TARGETS: Array<{ id: DrillTarget; label: string }> = [
  { id: "hedging", label: "Hedging" },
  { id: "over-explaining", label: "Over-explaining" },
  { id: "recovery-speed", label: "Recovery speed" },
  { id: "evidence-gaps", label: "Evidence gaps" },
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

const DEFAULT_SEATS: PanelSeat[] = [
  { archetype: "skeptic", name: "The Skeptic", intensity: 2, filled: true },
  { archetype: "so_what", name: "The So-What", intensity: 2, filled: true },
  { archetype: "nitpicker", name: "The Nitpicker", intensity: 2, filled: true },
];

// ─── Main Component ─────────────────────────────────────────────────────

export function PracticeView({ onSessionCreated, onCancel }: PracticeViewProps) {
  const [currentStep, setCurrentStep] = useState(0);

  // Step 1 — Material
  const [material, setMaterial] = useState("");
  const [materialTitle, setMaterialTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [hasMaterial, setHasMaterial] = useState(true); // true = with material, false = topic only

  // Step 2 — Room
  const [scenario, setScenario] = useState<ScenarioKey>("thesis_defense");
  const [customRoom, setCustomRoom] = useState("");

  // Step 3 — Panel
  const [seats, setSeats] = useState<PanelSeat[]>(DEFAULT_SEATS);
  const [editingSeat, setEditingSeat] = useState<number | null>(null);

  // Step 4 — Mode
  const [coachingMode, setCoachingMode] = useState<CoachingMode>("pure-spar");
  const [drillTarget, setDrillTarget] = useState<DrillTarget>("hedging");

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Validation ────────────────────────────────────────────────────────

  const materialValid = hasMaterial
    ? material.trim().length >= 10
    : topic.trim().length >= 10;

  const customValid = scenario !== "custom" || customRoom.trim().length >= 10;

  const panelValid = seats.filter((s) => s.filled).length >= 1;

  const stepValid = [
    materialValid, // Step 1
    customValid, // Step 2
    panelValid, // Step 3
    true, // Step 4 always valid (has default)
  ];

  const canStart = materialValid && customValid && panelValid && !creating;

  const disabledReason = creating
    ? null
    : !materialValid
    ? hasMaterial
      ? "Add at least 10 characters of material to start"
      : "Add a topic (10+ chars) to start"
    : !customValid
    ? "Describe your custom room to start"
    : !panelValid
    ? "Add at least one panelist"
    : null;

  // ─── Handlers ─────────────────────────────────────────────────────────

  function nextStep() {
    if (currentStep < 3 && stepValid[currentStep]) {
      setCurrentStep(currentStep + 1);
    }
  }

  function prevStep() {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  }

  function goToStep(step: number) {
    // Allow going back to any step, but only forward to steps whose
    // prerequisites are met.
    if (step <= currentStep || stepValid.slice(0, step).every(Boolean)) {
      setCurrentStep(step);
    }
  }

  async function handleStart() {
    if (!canStart) return;
    setCreating(true);
    setError(null);
    try {
      // Map seats → PersonaConfig (only filled seats)
      const personas: PersonaConfig[] = seats
        .filter((s) => s.filled)
        .map((s, i) => ({
          archetype: s.archetype,
          name: s.name.trim() || ARCHETYPES[s.archetype].defaultName,
          behaviorStyle: intensityToBehavior(s.intensity),
          seatOrder: i,
        }));

      const body = {
        scenario,
        mode: hasMaterial ? "with_material" : "without_material",
        rawMaterial: hasMaterial ? material.trim() : topic.trim() || undefined,
        materialTitle: hasMaterial
          ? materialTitle.trim() || undefined
          : topic.trim() || undefined,
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
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10 pb-32">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
            Suit up
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Configure the room
          </h1>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>

      {/* Stepper */}
      <div className="mb-8 flex items-center justify-between">
        {STEP_LABELS.map((label, i) => {
          const isComplete = i < currentStep;
          const isCurrent = i === currentStep;
          const isClickable = i <= currentStep || stepValid.slice(0, i).every(Boolean);
          return (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <button
                onClick={() => isClickable && goToStep(i)}
                disabled={!isClickable}
                className={cn(
                  "flex items-center gap-2 transition-colors",
                  isClickable ? "cursor-pointer" : "cursor-not-allowed"
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium transition-all",
                    isComplete
                      ? "border-white bg-white text-black"
                      : isCurrent
                      ? "border-white text-white"
                      : "border-white/15 text-neutral-600"
                  )}
                >
                  {isComplete ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium hidden sm:inline transition-colors",
                    isCurrent ? "text-white" : isComplete ? "text-neutral-400" : "text-neutral-600"
                  )}
                >
                  {label}
                </span>
              </button>
              {i < STEP_LABELS.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-px mx-2 transition-colors",
                    i < currentStep ? "bg-white/30" : "bg-white/10"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="min-h-[300px]">
        {currentStep === 0 && (
          <Step1Material
            hasMaterial={hasMaterial}
            setHasMaterial={setHasMaterial}
            material={material}
            setMaterial={setMaterial}
            materialTitle={materialTitle}
            setMaterialTitle={setMaterialTitle}
            topic={topic}
            setTopic={setTopic}
          />
        )}
        {currentStep === 1 && (
          <Step2Room
            scenario={scenario}
            setScenario={setScenario}
            customRoom={customRoom}
            setCustomRoom={setCustomRoom}
          />
        )}
        {currentStep === 2 && (
          <Step3Panel seats={seats} setSeats={setSeats} onEditSeat={setEditingSeat} />
        )}
        {currentStep === 3 && (
          <Step4Mode
            coachingMode={coachingMode}
            setCoachingMode={setCoachingMode}
            drillTarget={drillTarget}
            setDrillTarget={setDrillTarget}
          />
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={prevStep}
          disabled={currentStep === 0}
          className="text-neutral-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        {currentStep < 3 ? (
          <Button
            onClick={nextStep}
            disabled={!stepValid[currentStep]}
            size="sm"
          >
            Next <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <Button
              onClick={handleStart}
              disabled={!canStart}
              size="sm"
              className={cn(
                canStart && "spar-ready-glow"
              )}
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Building...
                </>
              ) : (
                <>
                  Start Sparring <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
            {!canStart && disabledReason && (
              <p className="text-[10px] text-neutral-600">{disabledReason}</p>
            )}
          </div>
        )}
      </div>

      {/* Sticky start button (mobile) */}
      {currentStep === 3 && (
        <div className="fixed bottom-20 left-4 right-4 z-40 md:hidden">
          <Button
            onClick={handleStart}
            disabled={!canStart}
            className="w-full h-12 text-base"
          >
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Building...
              </>
            ) : (
              <>
                Start Sparring <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
          {!canStart && disabledReason && (
            <p className="text-center text-[10px] text-neutral-600 mt-2">
              {disabledReason}
            </p>
          )}
        </div>
      )}

      {/* Seat editor modal */}
      {editingSeat !== null && (
        <SeatEditor
          seatIndex={editingSeat}
          seat={seats[editingSeat]}
          onSave={(updated) => {
            setSeats((prev) =>
              prev.map((s, i) => (i === editingSeat ? { ...updated, filled: true } : s))
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

// ─── Step 1: Material ───────────────────────────────────────────────────

function Step1Material({
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

      {/* Toggle: with material / topic only */}
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
            <Label htmlFor="material-title" className="text-[10px] uppercase tracking-wider text-neutral-500">
              Title (optional)
            </Label>
            <Input
              id="material-title"
              value={materialTitle}
              onChange={(e) => setMaterialTitle(e.target.value)}
              placeholder="e.g., PhD Dissertation Defense — Chapter 4"
              className="bg-[#0a0a0a] border-white/10 text-white placeholder:text-neutral-600 focus:border-white/30 focus-visible:ring-white/20"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="material-text" className="text-[10px] uppercase tracking-wider text-neutral-500">
              Paste your material
            </Label>
            <Textarea
              id="material-text"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="Paste your pitch, abstract, strategy memo, proposal, or talking points. The more substance, the sharper the panel."
              rows={6}
              className="bg-[#0a0a0a] border-white/10 text-white placeholder:text-neutral-600 focus:border-white/30 focus-visible:ring-white/20 resize-y"
            />
            <div className="flex items-center justify-between text-[11px] text-neutral-600">
              <span>
                {material.trim().length < 10
                  ? `${10 - material.trim().length} more characters needed`
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
          <Label htmlFor="topic" className="text-[10px] uppercase tracking-wider text-neutral-500">
            State your topic in 1-2 sentences
          </Label>
          <Textarea
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., I'm defending my startup's go-to-market strategy for an enterprise SaaS product targeting mid-market healthcare."
            rows={3}
            className="bg-[#0a0a0a] border-white/10 text-white placeholder:text-neutral-600 focus:border-white/30 focus-visible:ring-white/20"
          />
          <p className="text-[11px] text-neutral-600">
            The panel will challenge the central claim in your topic. Be specific.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Step 2: Room ───────────────────────────────────────────────────────

function Step2Room({
  scenario,
  setScenario,
  customRoom,
  setCustomRoom,
}: {
  scenario: ScenarioKey;
  setScenario: (s: ScenarioKey) => void;
  customRoom: string;
  setCustomRoom: (s: string) => void;
}) {
  return (
    <div>
      <SectionHeader number="02" title="What's the room?" />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {SCENARIO_LIST.map((s) => (
          <button
            key={s.key}
            onClick={() => setScenario(s.key)}
            className={cn(
              "rounded-lg border p-3 text-left transition-all",
              scenario === s.key
                ? "border-white bg-white/5 ring-1 ring-white/20"
                : "border-white/[0.06] bg-[#111] hover:border-white/15"
            )}
          >
            <p className="text-sm font-medium text-white">{s.label}</p>
            <p className="mt-1 text-[11px] text-neutral-500 line-clamp-2">
              {s.description}
            </p>
          </button>
        ))}
      </div>
      {scenario === "custom" && (
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="custom-room" className="text-[10px] uppercase tracking-wider text-neutral-500">
            Describe who's in the room
          </Label>
          <Textarea
            id="custom-room"
            value={customRoom}
            onChange={(e) => setCustomRoom(e.target.value)}
            placeholder="e.g., A hiring committee of 3 senior engineers interviewing me for a staff engineer role. They'll probe my system design decisions, my leadership philosophy, and a past incident where I caused an outage."
            rows={4}
            className="bg-[#0a0a0a] border-white/10 text-white placeholder:text-neutral-600 focus:border-white/30 focus-visible:ring-white/20 resize-y"
          />
          <div className="flex items-center justify-between text-[11px] text-neutral-600">
            <span>
              {customRoom.trim().length < 10
                ? `${10 - customRoom.trim().length} more characters needed`
                : "The panel will use this to shape their challenges"}
            </span>
            <span>{customRoom.length} chars</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 3: Panel (Seating Chart) ──────────────────────────────────────

function Step3Panel({
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

      {/* The seating chart */}
      <div className="relative rounded-xl border border-white/[0.06] bg-[#0a0a0a] p-6 overflow-x-auto">
        {/* "YOU" position */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/30 bg-white/5">
            <span className="text-sm font-bold text-white">YOU</span>
          </div>
          <p className="mt-2 text-[10px] uppercase tracking-wider text-neutral-600">
            Presenting here
          </p>
          <ArrowRight className="h-4 w-4 text-neutral-700 rotate-90 mt-1" />
        </div>

        {/* Seats row */}
        <div className="flex gap-3 justify-center min-w-fit">
          {seats.map((seat, i) => (
            <SeatCard
              key={i}
              seat={seat}
              index={i}
              onClick={() => onEditSeat(i)}
            />
          ))}
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
  const Icon = ARCHETYPE_ICONS[seat.archetype];

  if (!seat.filled) {
    return (
      <button
        onClick={onClick}
        className="flex w-[140px] sm:w-[160px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/10 bg-transparent py-8 transition-all hover:border-white/30 hover:bg-white/[0.02]"
      >
        <span className="text-[10px] uppercase tracking-wider text-neutral-600 mb-1">
          Seat {index + 1}
        </span>
        <span className="text-xs text-neutral-500">Empty</span>
        <span className="text-[10px] text-neutral-700 mt-1">Click to fill</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex w-[140px] sm:w-[160px] flex-col items-center rounded-xl border bg-[#111] p-4 transition-all hover:scale-[1.03] hover:border-white/30",
        "border-white/[0.08]"
      )}
    >
      <span className="absolute top-2 left-2 text-[9px] font-mono text-neutral-600">
        {index + 1}
      </span>

      {/* Avatar (geometric, 48px) */}
      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
        <Icon className="h-5 w-5 text-white/80" />
      </div>

      {/* Name */}
      <p className="text-center text-xs font-semibold text-white leading-tight">
        {seat.name}
      </p>

      {/* Archetype label */}
      <p className="mt-0.5 text-[9px] uppercase tracking-wider text-neutral-500">
        {def.defaultName}
      </p>

      {/* Intensity dots */}
      <div className="mt-2 flex gap-1">
        {[1, 2, 3].map((level) => (
          <span
            key={level}
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-colors",
              level <= seat.intensity ? "bg-white" : "bg-white/15"
            )}
          />
        ))}
      </div>

      {/* Intensity label */}
      <p className="mt-1.5 text-[9px] uppercase tracking-wider text-neutral-500">
        {INTENSITY_LABELS[seat.intensity]}
      </p>

      {/* Edit hint */}
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
      <DialogContent className="sm:max-w-md bg-[#0a0a0a] border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white">
            Configure Seat {seatIndex + 1}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-widest text-neutral-500">
              Name
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={ARCHETYPES[archetype].defaultName}
              className="bg-[#0a0a0a] border-white/10 text-white placeholder:text-neutral-600 focus:border-white/30 focus-visible:ring-white/20"
            />
          </div>

          {/* Archetype picker (visual, not dropdown) */}
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
                      if (!name.trim() || name === ARCHETYPES[archetype].defaultName) {
                        setName(arch.defaultName);
                      }
                    }}
                    className={cn(
                      "p-3 rounded-lg border text-center transition-all",
                      isSelected
                        ? "border-white bg-white/5 ring-1 ring-white/20"
                        : "border-white/[0.06] hover:border-white/15 bg-[#111]"
                    )}
                  >
                    <div className="mb-1.5 flex h-8 w-8 mx-auto items-center justify-center rounded-md bg-white/5">
                      <Icon className="h-4 w-4 text-white/80" />
                    </div>
                    <p className="text-[11px] font-medium text-white leading-tight">
                      {arch.defaultName.replace("The ", "")}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Intensity toggle */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-widest text-neutral-500">
              Intensity
            </Label>
            <div className="flex bg-[#0a0a0a] rounded-lg p-1 border border-white/10">
              {([1, 2, 3] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setIntensity(level)}
                  className={cn(
                    "flex-1 py-2 text-xs rounded-md transition-all flex items-center justify-center gap-1.5",
                    intensity === level
                      ? "bg-white/10 text-white"
                      : "text-neutral-500 hover:text-neutral-300"
                  )}
                >
                  <span className="flex gap-0.5">
                    {[1, 2, 3].map((dot) => (
                      <span
                        key={dot}
                        className={cn(
                          "h-1 w-1 rounded-full",
                          dot <= level ? "bg-white" : "bg-white/20"
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
            <Button
              variant="ghost"
              onClick={onRemove}
              className="text-neutral-500 hover:text-red-400 mr-auto"
            >
              <X className="h-4 w-4 mr-1" /> Remove
            </Button>
          )}
          <Button onClick={handleSave} className="bg-white text-black hover:bg-white/90">
            Save Configuration
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Step 4: Mode ───────────────────────────────────────────────────────

function Step4Mode({
  coachingMode,
  setCoachingMode,
  drillTarget,
  setDrillTarget,
}: {
  coachingMode: CoachingMode;
  setCoachingMode: (m: CoachingMode) => void;
  drillTarget: DrillTarget;
  setDrillTarget: (t: DrillTarget) => void;
}) {
  return (
    <div>
      <SectionHeader number="04" title="Choose your mode" />

      <div className="space-y-3">
        {COACHING_MODES.map((mode) => {
          const isSelected = coachingMode === mode.id;
          return (
            <div key={mode.id}>
              <button
                onClick={() => setCoachingMode(mode.id)}
                className={cn(
                  "w-full text-left rounded-xl border p-4 transition-all",
                  isSelected
                    ? "border-white bg-white/5 ring-1 ring-white/20"
                    : "border-white/[0.06] bg-[#111] hover:border-white/15"
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">{mode.icon}</span>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-semibold mb-0.5">{mode.title}</h4>
                    <p className="text-neutral-400 text-xs mb-1.5 leading-relaxed">
                      {mode.desc}
                    </p>
                    <p className="text-[10px] text-neutral-500">
                      Best for: <span className="text-neutral-300">{mode.bestFor}</span>
                    </p>

                    {/* Drill options — only visible when Drill Mode selected */}
                    {mode.id === "drill" && isSelected && (
                      <div className="flex flex-wrap gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                        {DRILL_TARGETS.map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => setDrillTarget(opt.id)}
                            className={cn(
                              "text-xs px-3 py-1.5 rounded-full border transition-colors",
                              drillTarget === opt.id
                                ? "border-white text-white bg-white/10"
                                : "border-white/10 text-neutral-400 hover:border-white/20"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-black" />
                    </div>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Note about mode behavior */}
      <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <p className="text-[11px] text-neutral-500 leading-relaxed">
          {coachingMode === "pure-spar" && (
            <>The panel asks hard questions with no real-time feedback. You get the full debrief after — pattern analysis, telemetry, the complete picture.</>
          )}
          {coachingMode === "coach" && (
            <>Ambient cues (filler count, pace drift) are visible during the session. Between rounds, the coach whispers frameworks. The debrief includes &quot;we worked on this together&quot; framing.</>
          )}
          {coachingMode === "drill" && (
            <>The panel focuses 80% of challenges on <span className="text-white">{DRILL_TARGETS.find(t => t.id === drillTarget)?.label}</span>. Repetitive, targeted pressure. The debrief is a single-focus report on that weakness.</>
          )}
        </p>
      </div>
    </div>
  );
}

// ─── Shared components ──────────────────────────────────────────────────

function SectionHeader({ number, title }: { number: string; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="font-mono text-xs text-neutral-600">{number}</span>
      <h2 className="text-base font-medium text-white">{title}</h2>
      <div className="flex-1 border-t border-white/[0.06]" />
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
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
        active
          ? "border-white bg-white/5 text-white"
          : "border-white/[0.06] bg-[#111] text-neutral-400 hover:border-white/15"
      )}
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
