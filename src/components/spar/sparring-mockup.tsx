"use client";

import { useEffect, useState } from "react";
import {
  Mic,
  FileText,
  ShieldAlert,
  AlertTriangle,
  Play,
  Pause,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Animated 4-Stage Sparring Room Showcase — the TRUTH mockup.
 *
 * Mirrors the complete real Spar loop end-to-end:
 *   01 · Attach & Scan (Pre-Flight claim & hotspot extractor)
 *   02 · Hands-Free Q&A (Ada's accent-edged challenges + Auto-Mic voice loop)
 *   03 · Drill Buzzer (Live interim hedge/filler buzzer)
 *   04 · Debrief Dossier (The Moment + One Thing to Practice + 5 skill baselines)
 *
 * Respects prefers-reduced-motion (freezes animations on a calm still frame).
 */

const ADA_ACCENT = "oklch(0.68 0.13 250)";

const CHALLENGE = "Hold on. Drop the qualifier. Say it directly.";

const USER_LINE = "I think maybe our market is roughly 50 billion...";

const PHASES = {
  PRESENCE_LANDS: 0,
  GATHERING: 1100,
  SPEAKING: 1900,
  TYPING_CAPTION: 2400,
  USER_SPEAKS: 4400,
  RESET: 6600,
} as const;

export interface SparringMockupStage {
  id: "attach" | "qa" | "drill" | "debrief";
  num: string;
  label: string;
  modeChip: string;
  summary: string;
}

export const SPARRING_MOCKUP_STAGES: SparringMockupStage[] = [
  {
    id: "attach",
    num: "01",
    label: "Attach & Scan",
    modeChip: "PRE-FLIGHT",
    summary:
      "Drop a debate case, paper, or resume — Spar extracts your claims and attack hotspots.",
  },
  {
    id: "qa",
    num: "02",
    label: "Hands-Free Q&A",
    modeChip: "Q&A",
    summary:
      "Ada challenges your specific claims. Auto-Mic re-arms automatically so you just talk.",
  },
  {
    id: "drill",
    num: "03",
    label: "Drill Buzzer",
    modeChip: "DRILL",
    summary:
      "Pick one weakness (e.g. No Hedging). An instant live buzzer catches qualifiers mid-sentence.",
  },
  {
    id: "debrief",
    num: "04",
    label: "Debrief Dossier",
    modeChip: "DOSSIER",
    summary:
      "Get a narrative readout on The Moment, your recurring pattern, and 5 skill baselines.",
  },
];

const ATTACH_HOTSPOTS = [
  {
    id: "01",
    title: "Attribution Gap in Contention 1",
    detail: "Claims automated retaliation speed without verification mechanism.",
  },
  {
    id: "02",
    title: "Unverified 78% Deterrence Stat",
    detail: "Cites a broad projection without baseline methodology or timeframe.",
  },
  {
    id: "03",
    title: "Asymmetric Compliance Trade-off",
    detail: "Assumes treaty signatories abide while rogue actors ignore restrictions.",
  },
];

const DEBRIEF_SKILLS = [
  { name: "Clarity", score: 84 },
  { name: "Recovery", score: 88 },
  { name: "Concision", score: 79 },
  { name: "Presence", score: 86 },
  { name: "Evidence", score: 82 },
];

export function SparringMockup({ initialStage = 1 }: { initialStage?: number } = {}) {
  const safeInitial =
    initialStage >= 0 && initialStage < SPARRING_MOCKUP_STAGES.length
      ? initialStage
      : 1;
  const [activeStageIdx, setActiveStageIdx] = useState<number>(safeInitial);
  const [autoCycle, setAutoCycle] = useState<boolean>(false);
  const [phase, setPhase] = useState<number>(PHASES.PRESENCE_LANDS);
  const [typedText, setTypedText] = useState("");

  const activeStage = SPARRING_MOCKUP_STAGES[activeStageIdx] ?? SPARRING_MOCKUP_STAGES[1];

  // Auto-cycle stages when enabled (off on initial render for calm focus unless toggled)
  useEffect(() => {
    if (!autoCycle) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const timer = setInterval(() => {
      setActiveStageIdx((prev) => (prev + 1) % SPARRING_MOCKUP_STAGES.length);
    }, 6800);
    return () => clearInterval(timer);
  }, [autoCycle]);

  // Master loop for Q&A stage. Under prefers-reduced-motion the mock rests on the
  // speaking still frame — calm, no rAF churn.
  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const frame = requestAnimationFrame(() => {
        setPhase(PHASES.SPEAKING);
        setTypedText(CHALLENGE);
      });
      return () => cancelAnimationFrame(frame);
    }

    const startTime = Date.now();
    let animationFrame: number;
    const update = () => {
      const cycleTime = (Date.now() - startTime) % PHASES.RESET;
      if (cycleTime < PHASES.GATHERING) {
        setPhase(PHASES.PRESENCE_LANDS);
        setTypedText("");
      } else if (cycleTime < PHASES.SPEAKING) {
        setPhase(PHASES.GATHERING);
        setTypedText("");
      } else if (cycleTime < PHASES.TYPING_CAPTION) {
        setPhase(PHASES.SPEAKING);
        setTypedText("");
      } else if (cycleTime < PHASES.USER_SPEAKS) {
        setPhase(PHASES.TYPING_CAPTION);
        setTypedText(
          CHALLENGE.slice(0, Math.floor((cycleTime - PHASES.TYPING_CAPTION) / 28))
        );
      } else {
        setPhase(PHASES.USER_SPEAKS);
        setTypedText(CHALLENGE);
      }
      animationFrame = requestAnimationFrame(update);
    };
    animationFrame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  const gathering =
    activeStage.id === "qa" &&
    phase >= PHASES.GATHERING &&
    phase < PHASES.SPEAKING;
  const speaking =
    (activeStage.id === "qa" && phase >= PHASES.SPEAKING) ||
    activeStage.id === "drill";
  const userSpeaking =
    activeStage.id === "qa" && phase >= PHASES.USER_SPEAKS;

  const statusWord = userSpeaking
    ? "Listening"
    : speaking
    ? "Speaking"
    : gathering
    ? "Gathering…"
    : "Listening";

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-[#1a1a1a] bg-[#080808]">
      {/* Ambient glow inside the mockup */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 h-32 w-64 -translate-x-1/2 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.06) 0%, transparent 70%)",
        }}
      />

      {/* Interactive 4-stage showcase strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#141414] bg-[#0b0b0b] px-3 py-2">
        <div
          role="tablist"
          aria-label="Sparring room walkthrough stages"
          className="flex flex-wrap items-center gap-1"
        >
          {SPARRING_MOCKUP_STAGES.map((stage, idx) => {
            const isActive = idx === activeStageIdx;
            return (
              <button
                key={stage.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setActiveStageIdx(idx);
                  setAutoCycle(false);
                }}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[10px] font-medium transition-all",
                  isActive
                    ? "border border-[var(--accent-border)] bg-[var(--accent-soft)] text-white"
                    : "border border-transparent text-neutral-500 hover:bg-[#141414] hover:text-neutral-300"
                )}
              >
                <span className="font-mono text-[9px] opacity-70">{stage.num}</span>
                {" · "}
                {stage.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setAutoCycle((prev) => !prev)}
          className="inline-flex items-center gap-1 rounded-md border border-[#222] bg-[#121212] px-2 py-1 text-[10px] text-neutral-400 transition-colors hover:border-[#333] hover:text-white"
          title={autoCycle ? "Pause auto-cycle" : "Auto-cycle all 4 stages"}
        >
          {autoCycle ? (
            <>
              <Pause className="h-2.5 w-2.5 text-[var(--accent-text)]" /> Auto-Cycle
            </>
          ) : (
            <>
              <Play className="h-2.5 w-2.5 text-neutral-400" /> Auto-Cycle
            </>
          )}
        </button>
      </div>

      {/* Stage summary caption */}
      <div className="border-b border-[#141414] bg-[#090909] px-4 py-1.5 text-left text-[11px] text-neutral-400">
        {activeStage.summary}
      </div>

      {/* Top bar — the real mode chip + engine chip, like the room */}
      <div
        aria-hidden
        className="flex items-center justify-between border-b border-[#141414] px-4 py-2.5"
      >
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="h-2.5 w-2.5 rounded-full bg-[#2a2a2a]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#2a2a2a]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#2a2a2a]" />
          </div>
          <span className="ml-2 text-[11px] text-neutral-500">Sparring Room</span>
          <span className="rounded border border-[#2a2a2a] bg-[#171717] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-neutral-200">
            {activeStage.modeChip}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            data-engine="classic"
            className="rounded border border-[#2a2a2a] bg-[#171717] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-neutral-400"
          >
            Classic
          </span>
          <span className="font-mono text-[11px] text-neutral-500">02:14</span>
        </div>
      </div>

      {/* Body — conversation column + presence rail, like the room */}
      <div aria-hidden className="flex h-[280px] sm:h-[320px]">
        {/* Stage 01: Attach & Scan */}
        {activeStage.id === "attach" && (
          <div className="flex flex-1 flex-col justify-center gap-2.5 px-4 py-4 sm:px-5 text-left">
            <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-3.5 w-3.5 text-[var(--accent-text)] flex-shrink-0" />
                <span className="truncate text-xs font-medium text-white">
                  WUDC_Debate_Case.pdf
                </span>
              </div>
              <span className="rounded bg-[#141418] px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-[var(--accent-text)]">
                Sparring / Debate Lens
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
              3 Attack Hotspots Extracted
            </div>

            <div className="space-y-1.5">
              {ATTACH_HOTSPOTS.map((hs) => (
                <div
                  key={hs.id}
                  className="rounded-md border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-amber-200">
                      {hs.id} · {hs.title}
                    </span>
                    <span className="font-mono text-[9px] uppercase text-amber-400">
                      Targeted
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-neutral-400">
                    {hs.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stage 02: Hands-Free Q&A (default) */}
        {activeStage.id === "qa" && (
          <div className="flex flex-1 flex-col justify-end gap-3 px-4 py-4 sm:px-5 text-left">
            {/* Ada's challenge — accent-edged, typed live */}
            {(speaking || typedText) && (
              <div className="spar-fade-up max-w-[85%]">
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                  Ada
                </div>
                <div
                  className="rounded-md rounded-bl-sm border border-[#1a1a1a] bg-[#0f0f0f] px-3.5 py-2.5 text-xs leading-relaxed text-neutral-200"
                  style={{
                    borderLeft: `2px solid color-mix(in oklab, ${ADA_ACCENT} 45%, transparent)`,
                  }}
                >
                  {typedText}
                  {speaking && !typedText && (
                    <span className="text-neutral-600">…</span>
                  )}
                </div>
              </div>
            )}

            {/* The user answers — ghost interim bubble */}
            {userSpeaking && (
              <div className="spar-fade-up flex justify-end">
                <div className="max-w-[85%] text-right">
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-neutral-500">
                    Speaking...
                  </div>
                  <div className="rounded-md rounded-br-sm border border-[#1a1a1a] bg-[#0a0a0a] px-3.5 py-2.5 text-xs text-neutral-300 italic">
                    {USER_LINE}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stage 03: Drill Buzzer */}
        {activeStage.id === "drill" && (
          <div className="flex flex-1 flex-col justify-between px-4 py-4 sm:px-5 text-left">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                Drill: No Hedging · Attempt 1 of 3
              </span>
              <span className="font-mono text-[10px] text-neutral-500">
                Recovery timer: 1.4s
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-end">
                <div className="max-w-[88%] rounded-md rounded-br-sm border border-[#1a1a1a] bg-[#0a0a0a] px-3.5 py-2.5 text-xs text-neutral-300">
                  <span className="rounded bg-amber-500/20 px-1 text-amber-300 line-through">
                    I think maybe
                  </span>{" "}
                  a treaty ban lowers autonomous escalation risk across every theatre.
                </div>
              </div>

              <div className="rounded-md border border-amber-500/40 bg-amber-500/15 px-3.5 py-2.5">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                  LIVE BUZZER
                </div>
                <p className="mt-1 text-xs leading-relaxed text-amber-100">
                  &ldquo;I think maybe&rdquo; — drop the qualifier and state the claim directly.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stage 04: Debrief Dossier */}
        {activeStage.id === "debrief" && (
          <div className="flex flex-1 flex-col justify-between gap-2.5 px-4 py-4 sm:px-5 text-left">
            <div className="rounded-md border border-[#222] bg-[#0f0f0f] px-3.5 py-2.5">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-text)]">
                <span>01 The Moment</span>
                <span className="font-mono text-neutral-500">Executive Dossier</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-neutral-200">
                When Ada pressed on treaty enforcement verification, you tightened your second rebuttal into a direct 18-second claim.
              </p>
            </div>

            <div className="rounded-md border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3.5 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-text)]">
                02 One Thing to Practice
              </div>
              <p className="mt-0.5 text-xs font-medium text-white">
                Lead with the exact number before providing strategic context.
              </p>
            </div>

            <div className="rounded-md border border-[#1a1a1a] bg-[#0b0b0b] px-3.5 py-2">
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-neutral-400">
                <BarChart3 className="h-3 w-3 text-[var(--accent-text)]" />
                Skill Baseline
              </div>
              <div className="grid grid-cols-5 gap-2">
                {DEBRIEF_SKILLS.map((s) => (
                  <div key={s.name} className="text-center">
                    <div className="mx-auto h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[var(--accent)]"
                        style={{ width: `${s.score}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[9px] text-neutral-400">{s.name}</p>
                    <p className="font-mono text-[10px] font-semibold text-white">
                      {s.score}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Presence rail — one equal circular presence: the true default */}
        <div className="hidden w-[130px] flex-col items-center justify-center gap-3 border-l border-[#141414] bg-[#0a0a0a] px-3 py-4 sm:flex sm:w-[150px]">
          <div
            className={cn(
              "flex h-20 w-20 select-none items-center justify-center rounded-full text-lg font-semibold tracking-wide",
              speaking && "spar-presence-speaking"
            )}
            style={{
              background: `color-mix(in oklab, ${ADA_ACCENT} 14%, oklch(0.16 0 0))`,
              color: `color-mix(in oklab, ${ADA_ACCENT} 55%, oklch(0.92 0 0))`,
              boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${ADA_ACCENT} 22%, transparent)`,
            }}
          >
            A
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white">Ada</p>
            <div className="mt-1.5 flex items-center justify-center gap-1.5">
              {gathering ? (
                <span className="flex gap-0.5">
                  <span className="spar-thinking-dot inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <span className="spar-thinking-dot inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <span className="spar-thinking-dot inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                </span>
              ) : (
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: speaking ? ADA_ACCENT : "#525252" }}
                />
              )}
              <span className="text-[9px] uppercase tracking-wider text-neutral-500">
                {statusWord}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar — the classic mic + Auto-Mic indicator */}
      <div
        aria-hidden
        className="flex flex-wrap items-center justify-between gap-2 border-t border-[#141414] px-4 py-2.5"
      >
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-colors",
              speaking ? "animate-pulse bg-white" : "bg-[#2a2a2a]"
            )}
          />
          <span className="text-[9px] uppercase tracking-wider text-neutral-500">
            {userSpeaking
              ? "Listening to you"
              : statusWord === "Speaking"
              ? "Ada is speaking"
              : "Panel is ready"}
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2 py-0.5 text-[9px] text-[var(--accent-text)]">
            Auto-Mic On · Space to send
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Mic className="h-3 w-3 text-neutral-400" />
          <span className="text-[9px] uppercase tracking-wider text-neutral-500">
            Start speaking
          </span>
        </div>
      </div>
    </div>
  );
}
