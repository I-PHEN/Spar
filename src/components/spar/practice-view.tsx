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
  Upload,
  ShieldAlert,
  GraduationCap,
  Briefcase,
  Rocket,
  Scale,
  RotateCcw,
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
  ATTACK_ANGLE_LIST,
  DOMAIN_PRESET_LIST,
  DOMAIN_PRESETS,
  inferDomainFromText,
  STANCE_PRESET_LIST,
  type AttackAngleKey,
  type AttackHotspot,
  type DomainKey,
  type DrillStrictnessKey,
  type StanceKey,
} from "@/lib/domains";
import {
  VISIBLE_EXPERIENCE_LIST,
  DRILL_TARGETS,
  type ExperienceKey,
  type DrillTarget,
} from "@/lib/experiences";
import type {
  ArchetypeKey,
  BehaviorStyle,
  ExtractedClaim,
  PersonaConfig,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  readStoredUserPreferences,
  syncLastConfigFromPreferences,
} from "@/lib/user-preferences";
import {
  addSeat,
  defaultSeatsFor,
  normalizePanelSeat,
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
  "Debate Motion — This House Would ban autonomous lethal weapons under international law.",
  "Policy Debate — Universal basic income does more harm than targeted welfare programs.",
  "Startup GTM — Defending enterprise SaaS go-to-market strategy for healthcare.",
  "Machine Learning — Defending empirical findings and statistical validity in Chapter 4.",
  "Team Proposal — Defending reorganization of customer support around regional pods.",
];

export const SAMPLE_DEBATE_CASE = {
  title: "WUDC Debate Case — Banning Autonomous Lethal Weapons",
  domain: "sparring" as DomainKey,
  rawText: [
    "Motion: This House Would prohibit the development and deployment of autonomous lethal weapons systems (LAWS) under binding international law.",
    "",
    "Contention 1 — Accountability & Attribution Vacuum:",
    "Delegating lethal targeting decisions to neural networks breaks the chain of legal responsibility required by International Humanitarian Law. Because autonomous swarms operate in milliseconds across contested communication environments, no commanding officer can exercise meaningful human control, resulting in a 100% impunity gap when civilian casualties occur.",
    "",
    "Contention 2 — Flash Escalation & Crisis Instability:",
    "Autonomous systems compress decision cycles below human reaction thresholds. When two adversaries deploy machine-speed engagement algorithms, ambiguous sensor noise can trigger automated counter-strikes before diplomatic hotlines can intervene, turning border skirmishes into irreversible regional escalation.",
    "",
    "Contention 3 — Verification & Asymmetric Compliance Counter:",
    "Opposition claims rogue states will covertly develop banned drones anyway. We respond that hardware-level compute audits, export controls on military-grade edge sensors, and satellite weapons-testing telemetry raise clandestine development costs dramatically, while establishing an enforceable norm isolates violators diplomatically and economically.",
  ].join("\n"),
  hotspots: [
    {
      id: "sample-hs-1",
      target: "Unverified '100% impunity gap' claim",
      reason: "Absolute liability claims ignore commander-responsibility doctrines already codified in treaty law.",
      suggestedChallenge: "Even if a targeting algorithm misfires, why wouldn't the commanding general who authorized deployment remain legally liable under existing command responsibility rules?",
    },
    {
      id: "sample-hs-2",
      target: "Flash escalation without threshold evidence",
      reason: "Assumes armies deploy zero-human-veto kill switches instead of bounded defensive engagement rules.",
      suggestedChallenge: "Why assume states would connect autonomous sensors directly to strategic retaliation without human launch thresholds?",
    },
    {
      id: "sample-hs-3",
      target: "Dual-use sensor verification weakness",
      reason: "Civilian autonomy hardware closely mirrors battlefield robotics, making covert proliferation hard to detect.",
      suggestedChallenge: "Commercial robotics uses identical vision chips — how do your export controls verify compliance without crippling civilian drone innovation?",
    },
  ] satisfies AttackHotspot[],
};

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
  const initialPrefs = readStoredUserPreferences();

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

  // Domain & Document Ingestion state
  const [selectedDomain, setSelectedDomain] = useState<DomainKey>(
    initialPrefs.defaultDomain,
  );
  const [userPickedDomain, setUserPickedDomain] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [attackHotspots, setAttackHotspots] = useState<AttackHotspot[]>([]);
  const [selectedHotspotIds, setSelectedHotspotIds] = useState<string[]>([]);
  const [extractedClaims, setExtractedClaims] = useState<ExtractedClaim[]>([]);
  const [scanningHotspots, setScanningHotspots] = useState(false);

  // Auto-infer domain as user types topic or material unless they manually selected a preset
  useEffect(() => {
    if (userPickedDomain) return;
    const activeText = hasMaterial ? material : topic;
    const activeTitle = hasMaterial ? materialTitle || uploadedFileName : topic;
    if (!activeText.trim() && !(activeTitle ?? "").trim()) {
      setSelectedDomain(readStoredUserPreferences().defaultDomain);
      return;
    }
    const inferred = inferDomainFromText(activeText, activeTitle);
    setSelectedDomain(inferred);
  }, [hasMaterial, material, materialTitle, topic, uploadedFileName, userPickedDomain]);

  async function handleDocumentFile(file: File) {
    setUploadingFile(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/documents/parse", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not parse document");
        return;
      }
      setHasMaterial(true);
      setUploadedFileName(data.fileName || file.name);
      if (!materialTitle.trim()) {
        setMaterialTitle((data.fileName || file.name).replace(/\.[^.]+$/, ""));
      }
      setMaterial(data.rawText || "");
      if (data.detectedDomain && !userPickedDomain) {
        setSelectedDomain(data.detectedDomain as DomainKey);
      }
      const hotspots: AttackHotspot[] = Array.isArray(data.attackHotspots)
        ? data.attackHotspots
        : [];
      setAttackHotspots(hotspots);
      setSelectedHotspotIds(hotspots.map((h) => h.id));
      setExtractedClaims(Array.isArray(data.claims) ? data.claims : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Document upload failed");
    } finally {
      setUploadingFile(false);
    }
  }

  async function handleScanPastedMaterial() {
    if (material.trim().length < 20 || scanningHotspots) return;
    setScanningHotspots(true);
    setError(null);
    try {
      const res = await fetch("/api/documents/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: materialTitle.trim() || "Pasted_Material.txt",
          rawText: material.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not scan material");
        return;
      }
      if (data.detectedDomain && !userPickedDomain) {
        setSelectedDomain(data.detectedDomain as DomainKey);
      }
      const hotspots: AttackHotspot[] = Array.isArray(data.attackHotspots)
        ? data.attackHotspots
        : [];
      setAttackHotspots(hotspots);
      setSelectedHotspotIds(hotspots.map((h) => h.id));
      setExtractedClaims(Array.isArray(data.claims) ? data.claims : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to scan material");
    } finally {
      setScanningHotspots(false);
    }
  }

  function handleLoadSampleDebateCase() {
    setHasMaterial(true);
    setUploadedFileName(null);
    setMaterialTitle(SAMPLE_DEBATE_CASE.title);
    setMaterial(SAMPLE_DEBATE_CASE.rawText);
    setSelectedDomain(SAMPLE_DEBATE_CASE.domain);
    setUserPickedDomain(true);
    setAttackHotspots(SAMPLE_DEBATE_CASE.hotspots);
    setSelectedHotspotIds(SAMPLE_DEBATE_CASE.hotspots.map((h) => h.id));
    setExtractedClaims([]);
    setError(null);
  }

  // Mode — Q&A (default) or Drill
  const [experience, setExperience] = useState<ExperienceKey>(
    lastConfig?.experience ?? initialPrefs.defaultMode ?? "open_spar",
  );
  const [drillTarget, setDrillTarget] = useState<DrillTarget>(
    lastConfig?.drillTarget ?? "hedging",
  );
  const [selectedStance, setSelectedStance] = useState<StanceKey>("defending");
  const [selectedAttackAngles, setSelectedAttackAngles] = useState<AttackAngleKey[]>([
    "causal_links",
    "counterfactuals",
  ]);
  const [drillStrictness, setDrillStrictness] =
    useState<DrillStrictnessKey>("standard");
  const [customRoom, setCustomRoom] = useState("");
  const [showRoomDetails, setShowRoomDetails] = useState(false);

  // Panel (derived from experience, user can override)
  const [seats, setSeats] = useState<PanelSeat[]>(() => {
    const normalized = Array.isArray(lastConfig?.seats)
      ? lastConfig.seats
          .map((s) => normalizePanelSeat(s))
          .filter((s): s is PanelSeat => Boolean(s))
      : [];
    if (normalized.length > 0) return normalized;
    if (
      initialPrefs.defaultMode !== "open_spar" ||
      initialPrefs.panelIntensity !== "moderate"
    ) {
      return defaultSeatsFor(
        initialPrefs.defaultMode,
        initialPrefs.panelIntensity,
      );
    }
    return defaultSeatsFor("open_spar");
  });
  const [editingSeat, setEditingSeat] = useState<number | null>(null);

  function handleSelectDrillTarget(target: DrillTarget) {
    setDrillTarget(target);
    const def = DRILL_TARGETS.find((d) => d.id === target);
    if (def) {
      setSeats((prev) =>
        prev.map((seat, idx) =>
          idx === 0
            ? {
                ...seat,
                archetype: def.leadArchetype,
                name: ARCHETYPES[def.leadArchetype].defaultName,
                intensity: 3,
                filled: true,
              }
            : seat
        )
      );
    }
  }

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
  // while preserving any custom room description the user already wrote.
  function selectExperience(key: ExperienceKey) {
    setExperience(key);
    const prefs = readStoredUserPreferences();
    setSeats(defaultSeatsFor(key, prefs.panelIntensity));
  }

  function handleResetDefaults() {
    const prefs = readStoredUserPreferences();
    setExperience(prefs.defaultMode);
    setDrillTarget("hedging");
    setSelectedDomain(prefs.defaultDomain);
    setUserPickedDomain(false);
    setSelectedStance("defending");
    setSelectedAttackAngles(["causal_links", "counterfactuals"]);
    setDrillStrictness("standard");
    setSeats(defaultSeatsFor(prefs.defaultMode, prefs.panelIntensity));
    syncLastConfigFromPreferences(prefs);
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
      ? "Add at least 10 characters to start"
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
      const prefs = readStoredUserPreferences();
      const personas: PersonaConfig[] = seats
        .filter((s) => s.filled)
        .map((s, i) => ({
          archetype: s.archetype,
          name: s.name.trim() || ARCHETYPES[s.archetype].defaultName,
          behaviorStyle: intensityToBehavior(s.intensity),
          seatOrder: i,
        }));

      const activeHotspots = attackHotspots.filter((h) =>
        selectedHotspotIds.includes(h.id)
      );

      const body = {
        experience,
        drillTarget: experience === "drill" ? drillTarget : null,
        mode: hasMaterial ? "with_material" : "without_material",
        rawMaterial: hasMaterial ? material.trim() : topic.trim() || undefined,
        materialTitle: hasMaterial
          ? materialTitle.trim() || uploadedFileName || undefined
          : topic.trim() || undefined,
        roomContext: customRoom.trim() || undefined,
        domain: selectedDomain,
        stance: selectedStance,
        attackAngles: selectedAttackAngles,
        drillStrictness: experience === "drill" ? drillStrictness : undefined,
        voiceTone: prefs.voiceTone,
        hotspots: activeHotspots.length > 0 ? activeHotspots : undefined,
        claims: extractedClaims.length > 0 ? extractedClaims : undefined,
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
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] pb-16">
      <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-6 sm:pt-8">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Home
          </button>
        )}

        {/* Minimal Header */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            Configure the room
          </h1>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--text-tertiary)] transition-colors hover:bg-white/[0.04] hover:text-[var(--text-primary)]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset to defaults</span>
          </button>
        </div>

        {/* 01 Defend Section Card */}
        <div className="rounded-xl border border-[#232327] bg-[#121215] p-6 sm:p-7">
          <DefendSection
            hasMaterial={hasMaterial}
            setHasMaterial={setHasMaterial}
            material={material}
            setMaterial={setMaterial}
            topic={topic}
            setTopic={setTopic}
            uploadingFile={uploadingFile}
            uploadedFileName={uploadedFileName}
            onUploadFile={handleDocumentFile}
            onClearUploadedFile={() => {
              setUploadedFileName(null);
              setAttackHotspots([]);
              setSelectedHotspotIds([]);
              setExtractedClaims([]);
            }}
            attackHotspots={attackHotspots}
            selectedHotspotIds={selectedHotspotIds}
            onToggleHotspot={(id) =>
              setSelectedHotspotIds((prev) =>
                prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
              )
            }
            scanningHotspots={scanningHotspots}
            onScanMaterial={handleScanPastedMaterial}
            onLoadSampleDebateCase={handleLoadSampleDebateCase}
          />
        </div>

        {/* 02 Mode Section Card */}
        <div className="mt-5 rounded-xl border border-[#232327] bg-[#121215] p-6 sm:p-7">
          <ModeSection
            experience={experience}
            selectExperience={selectExperience}
            drillTarget={drillTarget}
            setDrillTarget={handleSelectDrillTarget}
            drillStrictness={drillStrictness}
            setDrillStrictness={setDrillStrictness}
          />
        </div>

        {/* 03 Panel Section Card */}
        <div className="mt-5 rounded-xl border border-[#232327] bg-[#121215] p-6 sm:p-7">
          <PanelSection
            seats={seats}
            setSeats={setSeats}
            onEditSeat={setEditingSeat}
          />
        </div>

        {/* Consolidated Optional Settings Disclosure */}
        <div className="mt-5 rounded-xl border border-[#232327] bg-[#121215] px-6 py-4">
          <button
            type="button"
            onClick={() => setShowRoomDetails((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-white"
            aria-expanded={showRoomDetails}
          >
            <span className="inline-flex items-center gap-2">
              <Pencil className="h-3 w-3 text-[var(--accent-text)]" />
              More options
            </span>
            <span className="inline-flex items-center gap-2 text-[11px] text-[var(--text-tertiary)]">
              {showRoomDetails ? (
                "Hide"
              ) : (
                <>
                  {customRoom.trim().length > 0 && (
                    <span className="rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent-text)]">
                      Custom room active
                    </span>
                  )}
                  <span>
                    {DOMAIN_PRESETS[selectedDomain].shortLabel} ·{" "}
                    {STANCE_PRESET_LIST.find((s) => s.key === selectedStance)?.shortLabel ?? "Defending"}
                  </span>
                </>
              )}
            </span>
          </button>

          {showRoomDetails && (
            <MoreOptionsSection
              hasMaterial={hasMaterial}
              materialTitle={materialTitle}
              setMaterialTitle={setMaterialTitle}
              selectedDomain={selectedDomain}
              onSelectDomain={(d) => {
                setSelectedDomain(d);
                setUserPickedDomain(true);
              }}
              selectedStance={selectedStance}
              onSelectStance={setSelectedStance}
              selectedAttackAngles={selectedAttackAngles}
              onToggleAttackAngle={(angle) =>
                setSelectedAttackAngles((prev) =>
                  prev.includes(angle)
                    ? prev.length > 1
                      ? prev.filter((item) => item !== angle)
                      : prev
                    : [...prev, angle]
                )
              }
              customRoom={customRoom}
              setCustomRoom={setCustomRoom}
            />
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Sticky start bar */}
        <div className="sticky bottom-16 md:bottom-0 z-30 -mx-4 sm:-mx-6 mt-7">
          <div className="border-t border-[#232327] bg-[#0B0B0D] px-4 py-3.5 sm:px-6">
            <div className="flex flex-col items-stretch gap-1 sm:flex-row sm:items-center sm:justify-between">
              {!canStart && disabledReason ? (
                <p className="text-center text-xs text-[var(--text-tertiary)] sm:text-left">
                  {disabledReason}
                </p>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-1 rounded-md border border-[#232327] bg-[#18181D] px-2 py-1 text-[10px] font-mono text-[var(--text-tertiary)]">
                  Ctrl ↵
                </span>
              )}

              <button
                type="button"
                onClick={handleStart}
                disabled={!canStart}
                className={cn(
                  "flex h-11 w-full items-center justify-center gap-2 rounded-xl px-6 text-sm font-medium transition-colors sm:w-auto",
                  canStart
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]"
                    : "cursor-not-allowed border border-[#232327] bg-[#18181D] text-[var(--text-tertiary)]",
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

const DOMAIN_ICONS: Record<DomainKey, typeof GraduationCap> = {
  academic: GraduationCap,
  interview: Briefcase,
  commercial: Rocket,
  sparring: Scale,
};

function DefendSection({
  hasMaterial,
  setHasMaterial,
  material,
  setMaterial,
  topic,
  setTopic,
  uploadingFile,
  uploadedFileName,
  onUploadFile,
  onClearUploadedFile,
  attackHotspots,
  selectedHotspotIds,
  onToggleHotspot,
  scanningHotspots,
  onScanMaterial,
  onLoadSampleDebateCase,
}: {
  hasMaterial: boolean;
  setHasMaterial: (v: boolean) => void;
  material: string;
  setMaterial: (v: string) => void;
  topic: string;
  setTopic: (v: string) => void;
  uploadingFile: boolean;
  uploadedFileName: string | null;
  onUploadFile: (file: File) => void;
  onClearUploadedFile: () => void;
  attackHotspots: AttackHotspot[];
  selectedHotspotIds: string[];
  onToggleHotspot: (id: string) => void;
  scanningHotspots: boolean;
  onScanMaterial: () => void;
  onLoadSampleDebateCase: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
          {/* Compact Document Attachment Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#232327] bg-[#0B0B0D] px-3.5 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <Upload className="h-3.5 w-3.5 flex-shrink-0 text-[var(--accent-text)]" />
              <p className="truncate text-xs text-[var(--text-secondary)]">
                {uploadedFileName ? (
                  <span className="font-medium text-[var(--text-primary)]">
                    {uploadedFileName}
                  </span>
                ) : (
                  "PDF, DOCX, PPTX, TXT, MD"
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.pptx,.txt,.md,.markdown"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadFile(f);
                  e.target.value = "";
                }}
              />
              {uploadedFileName && (
                <button
                  type="button"
                  onClick={onClearUploadedFile}
                  className="rounded-lg border border-[#232327] bg-[#18181D] px-2.5 py-1 text-[11px] text-[var(--text-secondary)] transition-colors hover:text-white"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                disabled={uploadingFile}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#232327] bg-[#18181D] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--accent-border)] hover:bg-[#202026] disabled:opacity-50"
              >
                {uploadingFile ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Extracting...
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5 text-[var(--accent-text)]" /> Attach File
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Textarea
              id="material-text"
              aria-label="Paste your material"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file && /\.(pdf|docx|pptx)$/i.test(file.name)) {
                  onUploadFile(file);
                  return;
                }
                if (file && /\.(txt|md|markdown)$/i.test(file.name) && file.size < 500_000) {
                  file.text().then(setMaterial).catch(() => {});
                  return;
                }
                const text = e.dataTransfer.getData("text/plain");
                if (text) setMaterial(text);
              }}
              placeholder="Paste your pitch, thesis, notes, or slides..."
              rows={4}
              className="resize-y rounded-xl border-[#232327] bg-[#0B0B0D] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-tertiary)]">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onLoadSampleDebateCase}
                  className="inline-flex items-center gap-1 font-medium text-[var(--text-secondary)] transition-colors hover:text-white"
                >
                  <Scale className="h-3 w-3 text-[var(--accent-text)]" /> Load sample debate case
                </button>
                {material.trim().length >= 30 && (
                  <button
                    type="button"
                    disabled={scanningHotspots}
                    onClick={onScanMaterial}
                    className="inline-flex items-center gap-1 font-medium text-[var(--accent-text)] hover:underline disabled:opacity-50"
                  >
                    {scanningHotspots ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" /> Scanning...
                      </>
                    ) : (
                      <>
                        <Search className="h-3 w-3" /> Scan weak spots
                      </>
                    )}
                  </button>
                )}
              </div>
              <span className="tabular-nums">{material.length} chars</span>
            </div>
          </div>

          {/* Pre-Flight Detected Attack Hotspots Card */}
          {attackHotspots.length > 0 && (
            <div className="space-y-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-semibold text-amber-200">
                    Hotspots ({selectedHotspotIds.length}/{attackHotspots.length})
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                {attackHotspots.map((hotspot) => {
                  const active = selectedHotspotIds.includes(hotspot.id);
                  return (
                    <button
                      key={hotspot.id}
                      type="button"
                      onClick={() => onToggleHotspot(hotspot.id)}
                      className={cn(
                        "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                        active
                          ? "border-amber-400/40 bg-amber-500/10 text-[var(--text-primary)]"
                          : "border-white/5 bg-black/20 text-[var(--text-tertiary)] opacity-60"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-amber-300">
                          {hotspot.target}
                        </span>
                        <span className="font-mono text-[10px] uppercase">
                          {active ? "Targeted" : "Skipped"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                        {hotspot.reason}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <Textarea
            id="topic"
            aria-label="Topic"
            value={topic}
            maxLength={100}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Series A GTM strategy, ML defense, Q3 board review"
            rows={2}
            className="rounded-xl border-[#232327] bg-[#0B0B0D] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {TOPIC_EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setTopic(example)}
                  className="rounded-lg border border-[#232327] bg-[#0B0B0D] px-2.5 py-1 text-[11px] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-white"
                >
                  {example.split(" — ")[0]}
                </button>
              ))}
            </div>
            <span className={cn("text-[11px] tabular-nums", topic.length >= 95 ? "font-medium text-amber-400" : "text-[var(--text-tertiary)]")}>
              {topic.length}/100
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function MoreOptionsSection({
  hasMaterial,
  materialTitle,
  setMaterialTitle,
  selectedDomain,
  onSelectDomain,
  selectedStance,
  onSelectStance,
  selectedAttackAngles,
  onToggleAttackAngle,
  customRoom,
  setCustomRoom,
}: {
  hasMaterial: boolean;
  materialTitle: string;
  setMaterialTitle: (v: string) => void;
  selectedDomain: DomainKey;
  onSelectDomain: (d: DomainKey) => void;
  selectedStance: StanceKey;
  onSelectStance: (s: StanceKey) => void;
  selectedAttackAngles: AttackAngleKey[];
  onToggleAttackAngle: (a: AttackAngleKey) => void;
  customRoom: string;
  setCustomRoom: (v: string) => void;
}) {
  return (
    <div className="mt-4 space-y-4 border-t border-[#232327] pt-4">
      {hasMaterial && (
        <div className="space-y-1.5">
          <Label
            htmlFor="material-title"
            className="text-[11px] font-medium text-[var(--text-secondary)]"
          >
            Title (optional)
          </Label>
          <Input
            id="material-title"
            value={materialTitle}
            onChange={(e) => setMaterialTitle(e.target.value)}
            placeholder="e.g. Dissertation Defense"
            className="rounded-xl border-[#232327] bg-[#0B0B0D] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
          />
        </div>
      )}

      {/* Subject Domain */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-[var(--text-secondary)]">
          Subject domain
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DOMAIN_PRESET_LIST.map((preset) => {
            const Icon = DOMAIN_ICONS[preset.key];
            const isSelected = selectedDomain === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => onSelectDomain(preset.key)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-medium transition-colors",
                  isSelected
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-white"
                    : "border-[#232327] bg-[#0B0B0D] text-[var(--text-secondary)] hover:border-white/20 hover:text-white",
                )}
              >
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 flex-shrink-0",
                    isSelected ? "text-[var(--accent-text)]" : "text-[var(--text-tertiary)]",
                  )}
                />
                <span className="truncate">{preset.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Your Stance */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-[var(--text-secondary)]">
          Your stance
        </p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
          {STANCE_PRESET_LIST.map((preset) => {
            const active = selectedStance === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => onSelectStance(preset.key)}
                title={preset.directive}
                className={cn(
                  "flex items-center justify-center rounded-lg border px-2.5 py-1.5 text-center text-xs transition-colors",
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-white"
                    : "border-[#232327] bg-[#0B0B0D] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-white",
                )}
              >
                {preset.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel Focus */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-[var(--text-secondary)]">
          Panel focus
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ATTACK_ANGLE_LIST.map((angle) => {
            const active = selectedAttackAngles.includes(angle.key);
            return (
              <button
                key={angle.key}
                type="button"
                onClick={() => onToggleAttackAngle(angle.key)}
                title={angle.directive}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs transition-colors",
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-white"
                    : "border-[#232327] bg-[#0B0B0D] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-white",
                )}
              >
                {angle.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Room Instruction */}
      <div className="space-y-1.5">
        <Label
          htmlFor="custom-room"
          className="text-[11px] font-medium text-[var(--text-secondary)]"
        >
          Room instruction (optional)
        </Label>
        <Textarea
          id="custom-room"
          value={customRoom}
          onChange={(e) => setCustomRoom(e.target.value)}
          placeholder="e.g. Focus on Section 2 or challenge unit economics"
          rows={2}
          className="resize-y rounded-xl border-[#232327] bg-[#0B0B0D] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
        />
      </div>
    </div>
  );
}

// ─── 02 Mode: Q&A / Drill ──────────────────────────────────────────────

function ModeSection({
  experience,
  selectExperience,
  drillTarget,
  setDrillTarget,
  drillStrictness,
  setDrillStrictness,
}: {
  experience: ExperienceKey;
  selectExperience: (key: ExperienceKey) => void;
  drillTarget: DrillTarget;
  setDrillTarget: (t: DrillTarget) => void;
  drillStrictness: DrillStrictnessKey;
  setDrillStrictness: (s: DrillStrictnessKey) => void;
}) {
  return (
    <div>
      <SectionHeader number="02" title="How will you spar?" />

      {/* Mode cards — side by side, Q&A first (default) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                "w-full cursor-pointer rounded-xl border p-4 sm:p-5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/20",
                isSelected
                  ? "border-[var(--accent)] bg-[#16161D]"
                  : "border-[#232327] bg-[#0B0B0D] hover:border-[var(--border-strong)] hover:bg-[#18181D]",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                    {exp.label}
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                    {exp.tagline}
                  </p>
                </div>
                <div
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition-colors",
                    isSelected
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                      : "border-white/15 bg-transparent",
                  )}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Drill target — expands under the cards when Drill is selected */}
      {experience === "drill" && (
        <div className="mt-3.5 space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold mb-2">
              What are you drilling?
            </p>
            <div className="flex flex-wrap gap-2">
              {DRILL_TARGETS.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => setDrillTarget(target.id)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-lg border transition-colors",
                    drillTarget === target.id
                      ? "bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-foreground)] font-semibold"
                      : "bg-[#0B0B0D] border-[#232327] text-zinc-400 hover:border-[#34343B] hover:text-white"
                  )}
                >
                  {target.label}
                </button>
              ))}
            </div>
            {(() => {
              const activeTarget = DRILL_TARGETS.find((t) => t.id === drillTarget);
              return activeTarget ? (
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  {activeTarget.description}
                </p>
              ) : null;
            })()}
          </div>

          <div className="pt-2.5 border-t border-[#232327]">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">
              Drill Strictness
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { key: "standard", label: "Standard" },
                  { key: "blitz", label: "Tournament Blitz" },
                  { key: "warmup", label: "Warm-Up" },
                ] as const
              ).map((opt) => {
                const active = drillStrictness === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setDrillStrictness(opt.key)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-lg border text-xs transition-colors text-center",
                      active
                        ? "bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-foreground)] font-semibold"
                        : "bg-[#0B0B0D] border-[#232327] text-zinc-400 hover:border-[#34343B] hover:text-white"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
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

      <div className="relative overflow-x-auto rounded-xl bg-[#0B0B0D]/80 p-5 sm:p-6">
        {/* "YOU" position */}
        <div className="mb-5 flex flex-col items-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--accent-border)] bg-[#16161D]">
            <span className="text-xs font-semibold text-white">YOU</span>
          </div>
          <ArrowRight className="mt-1.5 h-3.5 w-3.5 rotate-90 text-[var(--accent-text)]" />
        </div>

        {/* Seats row — spacious cards on desktop */}
        <div className="hidden sm:flex flex-wrap justify-center gap-3">
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
              type="button"
              onClick={() => {
                // Straight to the editor on the new seat — no empty-seat hop.
                const next = addSeat(seats);
                setSeats(next);
                onEditSeat(next.length - 1);
              }}
              className="flex min-h-[144px] w-[210px] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 bg-[#121215]/40 p-4 transition-colors hover:border-[var(--accent-border)] hover:bg-[#16161D]/60"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#16161D]">
                <Plus className="h-4 w-4 text-[var(--accent-text)]" />
              </div>
              <span className="text-xs font-medium text-[var(--text-primary)]">
                Add panelist
              </span>
              <span className="text-[11px] text-[var(--text-tertiary)]">
                Up to {MAX_SEATS}
              </span>
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
                type="button"
                onClick={() => onEditSeat(i)}
                className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[#16161D] px-3.5 py-2.5 text-left transition-colors hover:border-[var(--border-strong)]"
              >
                <span className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 rounded-full bg-[var(--accent)]"
                  />
                  {seat.name}
                  <span className="text-[var(--text-tertiary)]"> · {INTENSITY_LABELS[seat.intensity]}</span>
                </span>
                <span className="text-xs font-medium text-[var(--accent-text)]">
                  Edit
                </span>
              </button>
            ))}
          {seats.length < MAX_SEATS && (
            <button
              type="button"
              onClick={() => {
                const next = addSeat(seats);
                setSeats(next);
                onEditSeat(next.length - 1);
              }}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 px-3 py-2.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]"
            >
              <Plus className="h-3.5 w-3.5 text-[var(--accent-text)]" />
              Add panelist (up to {MAX_SEATS})
            </button>
          )}
        </div>
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
        type="button"
        onClick={onClick}
        className="flex min-h-[144px] w-[210px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/15 bg-[#16161D]/40 p-4 transition-colors hover:border-[var(--accent-border)] hover:bg-[#16161D]"
      >
        <span className="text-[11px] font-medium text-[var(--text-tertiary)]">
          Seat {index + 1}
        </span>
        <span className="text-xs font-medium text-[var(--text-secondary)]">Empty</span>
        <span className="text-[11px] text-[var(--text-tertiary)]">Click to assign</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex min-h-[144px] w-[210px] flex-col justify-between rounded-xl border border-[var(--border-subtle)] bg-[#16161D] p-4 text-left transition-colors hover:border-[var(--accent-border)] hover:bg-[#191922]"
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[var(--accent-border)] bg-[#1E1E28] text-xs font-semibold text-white"
              aria-hidden
            >
              {def.initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                {seat.name}
              </p>
              <p className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
                <span>Seat {index + 1}</span>
              </p>
            </div>
          </div>
          <Pencil className="h-3.5 w-3.5 flex-shrink-0 text-neutral-500 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>

        <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]">
          {def.tagline}
        </p>
      </div>

      <div className="mt-3.5 flex items-center justify-between border-t border-white/[0.06] pt-2.5">
        <div className="flex gap-1" aria-hidden>
          {[1, 2, 3].map((level) => (
            <span
              key={level}
              className={cn(
                "h-1 w-3 rounded-full transition-colors",
                level <= seat.intensity ? "bg-[var(--accent)]" : "bg-white/10",
              )}
            />
          ))}
        </div>
        <span className="text-[11px] font-medium text-[var(--text-secondary)]">
          {INTENSITY_LABELS[seat.intensity]}
        </span>
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
                      "relative cursor-pointer rounded-xl border p-3 text-center transition-colors focus-visible:outline-none",
                      isSelected
                        ? "border-[var(--accent)] bg-[#16161D]"
                        : "border-[var(--border-subtle)] bg-[#0A0A0E] hover:border-white/20 hover:bg-[#14141B]",
                    )}
                  >
                    {/* Selected check badge */}
                    {isSelected && (
                      <div className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)]">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                        isSelected
                          ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                          : "bg-white/[0.04] text-[var(--text-secondary)]",
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
                      ? "bg-[var(--accent)] text-[var(--accent-foreground)] shadow-sm"
                      : "text-[var(--text-secondary)] hover:text-white"
                  )}
                >
                  <span className="flex gap-0.5">
                    {[1, 2, 3].map((dot) => (
                      <span
                        key={dot}
                        className={cn(
                          "h-1 w-1 rounded-full",
                          dot <= level ? "bg-current" : "bg-current/30"
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
            className="ml-auto inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-xs font-medium text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)]"
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
    <div className="mb-4 flex items-baseline gap-2.5">
      <span
        aria-hidden
        className="select-none text-xs font-semibold tabular-nums text-[var(--accent-text)]"
      >
        {number}
      </span>
      <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
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
        "flex flex-1 items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium transition-colors",
        active
          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
          : "border-[var(--border-subtle)] bg-[#0A0A0E] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-white",
      )}
    >
      <span className={cn(active ? "text-[var(--accent-foreground)]" : "text-[var(--text-tertiary)]")}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

function intensityToBehavior(intensity: 1 | 2 | 3): BehaviorStyle {
  return intensity === 1 ? "gentle" : intensity === 2 ? "moderate" : "aggressive";
}

