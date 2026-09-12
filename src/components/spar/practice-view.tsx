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
  EXPERIENCE_LIST,
  EXPERIENCES,
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

interface PracticeViewProps {
  onSessionCreated: (
    sessionId: string,
    experience: ExperienceKey,
    drillTarget: DrillTarget | null,
    coachingEnabled: boolean,
    coachingFocus: string
  ) => void;
  onCancel: () => void;
}

// ─── Types ──────────────────────────────────────────────────────────────

interface PanelSeat {
  archetype: ArchetypeKey;
  name: string;
  intensity: 1 | 2 | 3;
  filled: boolean;
}

const STEP_LABELS = ["Defend", "Experience", "Panel"];

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
  const [currentStep, setCurrentStep] = useState(0);

  // Step 1 — Material
  const [material, setMaterial] = useState("");
  const [materialTitle, setMaterialTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [hasMaterial, setHasMaterial] = useState(true);

  // Step 2 — Experience + Coaching
  const [experience, setExperience] = useState<ExperienceKey>("defense");
  const [drillTarget, setDrillTarget] = useState<DrillTarget>("hedging");
  const [customRoom, setCustomRoom] = useState("");
  const [coachingEnabled, setCoachingEnabled] = useState(true);
  const [coachingFocus, setCoachingFocus] = useState("");

  // Step 3 — Panel (derived from experience, user can override)
  const [seats, setSeats] = useState<PanelSeat[]>(
    defaultSeatsForExperience("defense")
  );
  const [editingSeat, setEditingSeat] = useState<number | null>(null);

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When experience changes, reset the panel to the experience's default
  function selectExperience(key: ExperienceKey) {
    setExperience(key);
    setSeats(defaultSeatsForExperience(key));
    // Clear custom room when switching (each experience has its own default)
    setCustomRoom("");
  }

  // ─── Validation ────────────────────────────────────────────────────────

  const materialValid = hasMaterial
    ? material.trim().length >= 10
    : topic.trim().length >= 10;

  const stepValid = [
    materialValid, // Step 1
    true, // Step 2 (experience always has a default)
    seats.filter((s) => s.filled).length >= 1, // Step 3
  ];

  const canStart =
    materialValid && stepValid[2] && !creating;

  const disabledReason = creating
    ? null
    : !materialValid
    ? hasMaterial
      ? "Add at least 10 characters of material to start"
      : "Add a topic (10+ chars) to start"
    : seats.filter((s) => s.filled).length < 1
    ? "Add at least one panelist"
    : null;

  // ─── Navigation ───────────────────────────────────────────────────────

  function nextStep() {
    if (currentStep < 2 && stepValid[currentStep]) {
      setCurrentStep(currentStep + 1);
    }
  }

  function prevStep() {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  }

  function goToStep(step: number) {
    if (step <= currentStep || stepValid.slice(0, step).every(Boolean)) {
      setCurrentStep(step);
    }
  }

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
        coachingEnabled,
        coachingFocus: coachingFocus.trim() || null,
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
        experience === "drill" ? drillTarget : null,
        coachingEnabled,
        coachingFocus.trim()
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8 pb-32">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-600">
          Suit up
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white sm:text-[28px]">
          Configure the room
        </h1>
      </div>

      {/* Stepper — 3 steps */}
      <div className="mb-10">
        <div className="flex items-center">
          {STEP_LABELS.map((label, i) => {
            const isComplete = i < currentStep;
            const isCurrent = i === currentStep;
            const isClickable =
              i <= currentStep || stepValid.slice(0, i).every(Boolean);
            return (
              <div
                key={label}
                className="flex items-center flex-1 last:flex-none"
              >
                <button
                  onClick={() => isClickable && goToStep(i)}
                  disabled={!isClickable}
                  className={cn(
                    "flex items-center gap-2.5 transition-colors",
                    isClickable ? "cursor-pointer" : "cursor-not-allowed"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full transition-colors",
                      isComplete || isCurrent ? "bg-white" : "bg-neutral-700"
                    )}
                  />
                  <span
                    className={cn(
                      "text-xs font-medium hidden sm:inline transition-colors tracking-tight",
                      isCurrent
                        ? "text-white"
                        : isComplete
                        ? "text-neutral-400"
                        : "text-neutral-600"
                    )}
                  >
                    {label}
                  </span>
                </button>
                {i < STEP_LABELS.length - 1 && (
                  <div
                    className={cn(
                      "flex-1 h-px mx-3 transition-colors",
                      i < currentStep ? "bg-neutral-600" : "bg-neutral-800"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
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
          <Step2Experience
            experience={experience}
            selectExperience={selectExperience}
            drillTarget={drillTarget}
            setDrillTarget={setDrillTarget}
            customRoom={customRoom}
            setCustomRoom={setCustomRoom}
            coachingEnabled={coachingEnabled}
            setCoachingEnabled={setCoachingEnabled}
            coachingFocus={coachingFocus}
            setCoachingFocus={setCoachingFocus}
          />
        )}
        {currentStep === 2 && (
          <Step3Panel
            seats={seats}
            setSeats={setSeats}
            onEditSeat={setEditingSeat}
          />
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="mt-10 flex items-center justify-between">
        {currentStep > 0 ? (
          <button
            onClick={prevStep}
            className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition-colors px-2 py-2"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        ) : (
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition-colors px-2 py-2"
          >
            <ArrowLeft className="h-4 w-4" /> Home
          </button>
        )}

        {currentStep < 2 ? (
          <button
            onClick={nextStep}
            disabled={!stepValid[currentStep]}
            className={cn(
              "flex items-center gap-2 px-5 h-11 rounded-md text-sm font-medium transition-all",
              stepValid[currentStep]
                ? "bg-neutral-100 text-black hover:bg-white"
                : "bg-neutral-900 text-neutral-600 cursor-not-allowed"
            )}
          >
            Next <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <div className="flex flex-col items-end gap-1.5">
            <button
              onClick={handleStart}
              disabled={!canStart}
              className={cn(
                "flex items-center gap-2 px-5 h-11 rounded-md text-sm font-medium transition-all",
                canStart
                  ? "bg-neutral-100 text-black hover:bg-white"
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
        )}
      </div>

      {/* Sticky start button (mobile) */}
      {currentStep === 2 && (
        <div className="fixed bottom-20 left-4 right-4 z-40 md:hidden">
          <button
            onClick={handleStart}
            disabled={!canStart}
            className={cn(
              "w-full h-12 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-all",
              canStart
                ? "bg-neutral-100 text-black hover:bg-white"
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
            <p className="text-center text-[11px] text-neutral-600 mt-2">
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
                  ? "Ready — paste more for richer claim extraction"
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

// ─── Step 2: Experience + Coaching ──────────────────────────────────────

function Step2Experience({
  experience,
  selectExperience,
  drillTarget,
  setDrillTarget,
  customRoom,
  setCustomRoom,
  coachingEnabled,
  setCoachingEnabled,
  coachingFocus,
  setCoachingFocus,
}: {
  experience: ExperienceKey;
  selectExperience: (key: ExperienceKey) => void;
  drillTarget: DrillTarget;
  setDrillTarget: (t: DrillTarget) => void;
  customRoom: string;
  setCustomRoom: (s: string) => void;
  coachingEnabled: boolean;
  setCoachingEnabled: (v: boolean) => void;
  coachingFocus: string;
  setCoachingFocus: (s: string) => void;
}) {
  return (
    <div>
      <SectionHeader number="02" title="How will you spar?" />

      {/* Experience cards */}
      <div className="space-y-2">
        {EXPERIENCE_LIST.map((exp) => {
          const isSelected = experience === exp.key;
          return (
            <div key={exp.key}>
              <div
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
                    ? "bg-[#171717] border-[#343434]"
                    : "bg-[#101010] border-[#202020] hover:bg-[#161616] hover:border-[#2a2a2a]"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-medium mb-0.5">
                      {exp.label}
                    </h4>
                    <p className="text-neutral-400 text-xs mb-1.5 leading-relaxed">
                      {exp.description}
                    </p>
                    <p className="text-[10px] text-neutral-600 italic">
                      {exp.openingPrompt}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="flex-shrink-0">
                      <Check className="h-4 w-4 text-neutral-300" />
                    </div>
                  )}
                </div>
              </div>

              {/* Drill target selector — only when Drill is selected */}
              {exp.key === "drill" && isSelected && (
                <div className="mt-2 ml-1">
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
        })}
      </div>

      {/* Optional custom room context */}
      <div className="mt-5 space-y-1.5">
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

      {/* Coaching toggle */}
      <div className="mt-6 rounded-md border border-[#1a1a1a] bg-[#0f0f0f] p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-white">Real-time coaching</p>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Your coach is present in the room and gives you a read before Q&A.
            </p>
          </div>
          <button
            onClick={() => setCoachingEnabled(!coachingEnabled)}
            className={cn(
              "relative h-6 w-11 rounded-full transition-colors flex-shrink-0",
              coachingEnabled ? "bg-neutral-100" : "bg-neutral-700"
            )}
            aria-label="Toggle coaching"
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-[#0a0a0a] transition-transform",
                coachingEnabled && "translate-x-5"
              )}
            />
          </button>
        </div>

        {/* Coaching focus — only when coaching is enabled */}
        {coachingEnabled && (
          <div className="mt-3 space-y-1.5">
            <Label
              htmlFor="coaching-focus"
              className="text-[10px] uppercase tracking-wider text-neutral-500"
            >
              Focus (optional)
            </Label>
            <Input
              id="coaching-focus"
              value={coachingFocus}
              onChange={(e) => setCoachingFocus(e.target.value)}
              placeholder="e.g., I'm working on not hedging when challenged on financials."
              className="bg-[#0a0a0a] border-[#202020] text-white placeholder:text-neutral-600 focus:border-[#3a3a3a] focus-visible:ring-0 rounded-md text-sm"
            />
            <p className="text-[10px] text-neutral-600">
              The coach prioritizes this focus during the session and debrief.
            </p>
          </div>
        )}
      </div>
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
      <p className="text-[11px] text-neutral-500 mb-4">
        Pre-filled based on your experience. Click a seat to customize.
      </p>

      <div className="relative rounded-md border border-[#1a1a1a] bg-[#0a0a0a] p-6 overflow-x-auto">
        {/* "YOU" position */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-md border-2 border-[#2a2a2a] bg-[#101010]">
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

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex w-[140px] sm:w-[160px] flex-col items-center rounded-md border bg-[#101010] p-4 transition-all hover:bg-[#161616] hover:border-[#2a2a2a]",
        "border-[#202020]"
      )}
    >
      <span className="absolute top-2 left-2 text-[9px] text-neutral-600 tabular-nums">
        {index + 1}
      </span>
      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-md bg-[#1a1a1a] ring-1 ring-[#2a2a2a]">
        <Icon className="h-5 w-5 text-neutral-300" />
      </div>
      <p className="text-center text-xs font-medium text-white leading-tight">
        {seat.name}
      </p>
      <p className="mt-0.5 text-[9px] uppercase tracking-wider text-neutral-500">
        {def.defaultName}
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
                      {arch.defaultName.replace("The ", "")}
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
    <div className="mb-5 flex items-baseline gap-2.5">
      <span className="text-xs text-neutral-600 tabular-nums">{number}</span>
      <h2 className="text-base font-medium text-white tracking-tight">
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

function defaultSeatsForExperience(experience: ExperienceKey): PanelSeat[] {
  const exp = EXPERIENCES[experience];
  return exp.defaultPanel.map((p) => ({
    archetype: p.archetype,
    name: ARCHETYPES[p.archetype].defaultName,
    intensity:
      p.behaviorStyle === "gentle"
        ? 1
        : p.behaviorStyle === "moderate"
        ? 2
        : 3,
    filled: true,
  }));
}
