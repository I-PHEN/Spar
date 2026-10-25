"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Compass,
  Flame,
  GraduationCap,
  Play,
  Radio,
  ShieldAlert,
  Sparkles,
  Swords,
  Target,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ARCHETYPES } from "@/lib/personas";
import { sessionLabel } from "@/lib/session-label";
import type { ExperienceKey, DrillTarget } from "@/lib/experiences";
import {
  DEFAULT_COURSES,
  buildLessonSessionPayload,
  getCourseLessons,
  type Course,
  type CourseLesson,
  type DiagramPreset,
  type LessonCompletion,
  type SlideVisualMedia,
} from "@/lib/courses";
import { CourseCatalog } from "./coach/course-catalog";
import { CourseRoadmap } from "./coach/course-roadmap";
import { LessonPlayer } from "./coach/lesson-player";

export type BriefingSlideIndex = 0 | 1 | 2 | 3;

const SLIDE_STEPS: Array<{
  index: BriefingSlideIndex;
  stepNum: string;
  label: string;
  short: string;
  accent: string;
}> = [
  {
    index: 0,
    stepNum: "01",
    label: "1. The Trap",
    short: "The Trap",
    accent: "text-rose-400 border-rose-500/40",
  },
  {
    index: 1,
    stepNum: "02",
    label: "2. Mental Model",
    short: "The Rule",
    accent: "text-emerald-400 border-emerald-500/40",
  },
  {
    index: 2,
    stepNum: "03",
    label: "3. The Tape",
    short: "The Tape",
    accent: "text-sky-400 border-sky-500/40",
  },
  {
    index: 3,
    stepNum: "04",
    label: "4. Chamber Drill",
    short: "Chamber",
    accent: "text-amber-400 border-amber-500/40",
  },
];

// ─── Tactical Vector Diagrams & Custom Partner Visual Renderer ──────────────

function BuiltInTacticalDiagram({ preset }: { preset: DiagramPreset }) {
  switch (preset) {
    case "bluf-pyramid":
      return (
        <svg
          viewBox="0 0 520 190"
          className="w-full h-auto select-none"
          role="img"
          aria-label="Comparison between chronological buildup and Bottom-Line Up Front pyramid"
        >
          <defs>
            <pattern id="bluf-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="rgba(255,255,255,0.03)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="520" height="190" rx="12" fill="#0b0b0c" />
          <rect width="520" height="190" rx="12" fill="url(#bluf-grid)" />

          {/* Left: The Backstory Spiral */}
          <g transform="translate(24, 22)">
            <text x="0" y="12" fill="#f87171" fontSize="10" fontFamily="monospace" fontWeight="700">
              ✕ CHRONOLOGICAL TRAP
            </text>
            <rect
              x="0"
              y="24"
              width="210"
              height="28"
              rx="6"
              fill="rgba(239,68,68,0.08)"
              stroke="rgba(239,68,68,0.25)"
            />
            <text x="12" y="42" fill="#d4d4d8" fontSize="11">
              0–20s: Historical backstory...
            </text>

            <rect
              x="0"
              y="60"
              width="210"
              height="28"
              rx="6"
              fill="rgba(239,68,68,0.08)"
              stroke="rgba(239,68,68,0.25)"
            />
            <text x="12" y="78" fill="#d4d4d8" fontSize="11">
              20–35s: Process excuses...
            </text>

            <rect
              x="0"
              y="96"
              width="210"
              height="32"
              rx="6"
              fill="rgba(239,68,68,0.18)"
              stroke="#ef4444"
              strokeDasharray="4 3"
            />
            <text x="12" y="116" fill="#fca5a5" fontSize="11" fontWeight="600">
              ⚡ Interrupted before point lands
            </text>
          </g>

          {/* Divider */}
          <line x1="260" y1="20" x2="260" y2="170" stroke="rgba(255,255,255,0.08)" />

          {/* Right: BLUF Executive Structure */}
          <g transform="translate(284, 22)">
            <text x="0" y="12" fill="#34d399" fontSize="10" fontFamily="monospace" fontWeight="700">
              ✓ EXECUTIVE BLUF PROTOCOL
            </text>
            <rect
              x="0"
              y="24"
              width="212"
              height="34"
              rx="6"
              fill="rgba(16,185,129,0.16)"
              stroke="#10b981"
            />
            <text x="12" y="45" fill="#ffffff" fontSize="11" fontWeight="700">
              0–5s: Direct Verdict + Exact Metric
            </text>

            <rect
              x="16"
              y="66"
              width="180"
              height="28"
              rx="6"
              fill="rgba(16,185,129,0.08)"
              stroke="rgba(16,185,129,0.35)"
            />
            <text x="28" y="84" fill="#d1fae5" fontSize="11">
              5–15s: Two concrete drivers
            </text>

            <rect
              x="42"
              y="102"
              width="128"
              height="26"
              rx="6"
              fill="rgba(255,255,255,0.04)"
              stroke="rgba(255,255,255,0.18)"
            />
            <text x="58" y="119" fill="#a1a1aa" fontSize="10" fontFamily="monospace">
              15s: Full Stop (Yield)
            </text>
          </g>
        </svg>
      );

    case "assumption-floor":
      return (
        <svg
          viewBox="0 0 520 185"
          className="w-full h-auto select-none"
          role="img"
          aria-label="Break-even downside floor compared against live pilot baseline"
        >
          <rect width="520" height="185" rx="12" fill="#0b0b0c" />
          <g transform="translate(28, 24)">
            <text x="0" y="10" fill="#38bdf8" fontSize="10" fontFamily="monospace" fontWeight="700">
              DOWNSIDE BUFFER GEOMETRY · ENTERPRISE CONVERSION
            </text>

            {/* Pilot Baseline Bar */}
            <text x="0" y="44" fill="#e4e4e7" fontSize="11" fontWeight="600">
              Live Pilot Cohort (n=40)
            </text>
            <rect x="165" y="30" width="260" height="22" rx="4" fill="rgba(16,185,129,0.2)" stroke="#10b981" />
            <text x="435" y="45" fill="#34d399" fontSize="12" fontFamily="monospace" fontWeight="700">
              34%
            </text>

            {/* Model Target Bar */}
            <text x="0" y="82" fill="#a1a1aa" fontSize="11">
              Plan Assumption
            </text>
            <rect x="165" y="68" width="225" height="22" rx="4" fill="rgba(56,189,248,0.15)" stroke="#38bdf8" />
            <text x="400" y="83" fill="#7dd3fc" fontSize="12" fontFamily="monospace">
              30%
            </text>

            {/* Break-Even Floor Bar */}
            <text x="0" y="120" fill="#fca5a5" fontSize="11" fontWeight="600">
              Break-Even Downside Floor
            </text>
            <rect x="165" y="106" width="108" height="22" rx="4" fill="rgba(244,63,94,0.18)" stroke="#f43f5e" />
            <text x="282" y="121" fill="#fda4af" fontSize="12" fontFamily="monospace" fontWeight="700">
              14% (Floor)
            </text>

            {/* Safety Buffer Bracket */}
            <path d="M 273 136 L 425 136" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 3" />
            <text x="305" y="150" fill="#34d399" fontSize="10" fontFamily="monospace">
              ▲ 2.4x Safety Buffer Above Floor
            </text>
          </g>
        </svg>
      );

    case "stakeholder-delta":
      return (
        <svg
          viewBox="0 0 520 175"
          className="w-full h-auto select-none"
          role="img"
          aria-label="Stakeholder value bridge translating technical features into quantified delta"
        >
          <rect width="520" height="175" rx="12" fill="#0b0b0c" />
          <g transform="translate(22, 26)">
            <rect x="0" y="16" width="142" height="96" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.12)" />
            <text x="14" y="40" fill="#a1a1aa" fontSize="9" fontFamily="monospace">
              01 · STAKEHOLDER
            </text>
            <text x="14" y="64" fill="#ffffff" fontSize="13" fontWeight="700">
              Bank Compliance
            </text>
            <text x="14" y="82" fill="#d4d4d8" fontSize="11">
              Mid-market audit lead
            </text>

            <path d="M 148 64 L 178 64" stroke="#f59e0b" strokeWidth="2" />

            <rect x="184" y="16" width="142" height="96" rx="10" fill="rgba(239,68,68,0.07)" stroke="rgba(239,68,68,0.3)" />
            <text x="198" y="40" fill="#fca5a5" fontSize="9" fontFamily="monospace">
              02 · BASELINE PAIN
            </text>
            <text x="198" y="66" fill="#f87171" fontSize="18" fontFamily="monospace" fontWeight="700">
              18 hrs/wk
            </text>
            <text x="198" y="86" fill="#d4d4d8" fontSize="11">
              Manual wire log review
            </text>

            <path d="M 332 64 L 362 64" stroke="#10b981" strokeWidth="2" />

            <rect x="368" y="16" width="130" height="96" rx="10" fill="rgba(16,185,129,0.12)" stroke="#10b981" />
            <text x="382" y="40" fill="#6ee7b7" fontSize="9" fontFamily="monospace">
              03 · AFTER DELTA
            </text>
            <text x="382" y="66" fill="#34d399" fontSize="18" fontFamily="monospace" fontWeight="700">
              20 mins
            </text>
            <text x="382" y="86" fill="#e4e4e7" fontSize="11">
              0 false negatives
            </text>
          </g>
        </svg>
      );

    case "zero-cushion":
      return (
        <svg
          viewBox="0 0 520 170"
          className="w-full h-auto select-none"
          role="img"
          aria-label="Removing verbal qualifiers increases executive conviction"
        >
          <rect width="520" height="170" rx="12" fill="#0b0b0c" />
          <g transform="translate(24, 24)">
            <text x="0" y="12" fill="#f87171" fontSize="10" fontFamily="monospace" fontWeight="700">
              BEFORE · HEDGED SIGNAL (CREDIBILITY LOSS)
            </text>
            <rect x="0" y="22" width="472" height="38" rx="8" fill="rgba(239,68,68,0.08)" stroke="rgba(239,68,68,0.25)" />
            <text x="14" y="45" fill="#fca5a5" fontSize="12" textDecoration="line-through">
              “I think we should probably be fine because we sort of tested...”
            </text>

            <text x="0" y="86" fill="#34d399" fontSize="10" fontFamily="monospace" fontWeight="700">
              AFTER · SURGICAL DECLARATIVE
            </text>
            <rect x="0" y="96" width="472" height="40" rx="8" fill="rgba(16,185,129,0.14)" stroke="#10b981" />
            <text x="14" y="121" fill="#ffffff" fontSize="12" fontWeight="700">
              “Yes. We load-tested all core endpoints at 15x peak volume with zero lag.”
            </text>
          </g>
        </svg>
      );

    case "word-ceiling":
      return (
        <svg
          viewBox="0 0 520 175"
          className="w-full h-auto select-none"
          role="img"
          aria-label="15-word executive attention ceiling curve"
        >
          <rect width="520" height="175" rx="12" fill="#0b0b0c" />
          <g transform="translate(28, 22)">
            <text x="0" y="12" fill="#fbbf24" fontSize="10" fontFamily="monospace" fontWeight="700">
              BOARDROOM ATTENTION DECAY BY WORD COUNT
            </text>
            {/* Optimal Zone */}
            <rect x="0" y="26" width="215" height="98" rx="8" fill="rgba(16,185,129,0.09)" stroke="rgba(16,185,129,0.35)" />
            <text x="14" y="48" fill="#34d399" fontSize="11" fontFamily="monospace" fontWeight="700">
              1–15 WORDS · PEAK AUTHORITY
            </text>
            <text x="14" y="70" fill="#e4e4e7" fontSize="11">
              Subject → Active Verb → Metric
            </text>
            <text x="14" y="92" fill="#a1a1aa" fontSize="10">
              Clean full stop invites pull questions
            </text>

            {/* Ramble Zone */}
            <rect x="230" y="26" width="234" height="98" rx="8" fill="rgba(239,68,68,0.08)" stroke="rgba(239,68,68,0.28)" />
            <text x="244" y="48" fill="#f87171" fontSize="11" fontFamily="monospace" fontWeight="700">
              25+ WORDS · INTERRUPTION ZONE
            </text>
            <text x="244" y="70" fill="#d4d4d8" fontSize="11">
              Thinking out loud &amp; multi-topic drift
            </text>
            <text x="244" y="92" fill="#fca5a5" fontSize="10">
              Timekeeper cuts mic &amp; resets frame
            </text>
          </g>
        </svg>
      );

    case "steelman-moat":
      return (
        <svg
          viewBox="0 0 520 175"
          className="w-full h-auto select-none"
          role="img"
          aria-label="Conceding surface layer to anchor on deep structural moat"
        >
          <rect width="520" height="175" rx="12" fill="#0b0b0c" />
          <g transform="translate(24, 22)">
            <rect x="0" y="14" width="472" height="44" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.15)" strokeDasharray="4 3" />
            <text x="16" y="34" fill="#a1a1aa" fontSize="10" fontFamily="monospace">
              SURFACE LAYER (CONCEDE QUICKLY)
            </text>
            <text x="16" y="50" fill="#e4e4e7" fontSize="12">
              “The workflow UI is easy to copy in 60 days...”
            </text>

            <rect x="0" y="70" width="472" height="62" rx="8" fill="rgba(56,189,248,0.12)" stroke="#38bdf8" />
            <text x="16" y="92" fill="#7dd3fc" fontSize="10" fontFamily="monospace" fontWeight="700">
              STRUCTURAL MOAT (IRREPLACEABLE ASSET)
            </text>
            <text x="16" y="114" fill="#ffffff" fontSize="12" fontWeight="700">
              “...but our dataset comes from 400 exclusive clinics (18-month lock-in).”
            </text>
          </g>
        </svg>
      );

    case "onset-latency":
      return (
        <svg
          viewBox="0 0 520 165"
          className="w-full h-auto select-none"
          role="img"
          aria-label="Two-second vocal onset window timeline"
        >
          <rect width="520" height="165" rx="12" fill="#0b0b0c" />
          <g transform="translate(24, 24)">
            <text x="0" y="12" fill="#34d399" fontSize="10" fontFamily="monospace" fontWeight="700">
              VOCAL ONSET LATENCY WINDOW
            </text>
            <rect x="0" y="28" width="120" height="54" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.15)" />
            <text x="14" y="50" fill="#a1a1aa" fontSize="10" fontFamily="monospace">
              0.0s – 1.0s
            </text>
            <text x="14" y="68" fill="#ffffff" fontSize="12" fontWeight="600">
              Silent Breath
            </text>

            <rect x="132" y="28" width="175" height="54" rx="8" fill="rgba(16,185,129,0.16)" stroke="#10b981" />
            <text x="146" y="50" fill="#6ee7b7" fontSize="10" fontFamily="monospace" fontWeight="700">
              1.0s – 2.0s · ONSET
            </text>
            <text x="146" y="68" fill="#ffffff" fontSize="12" fontWeight="700">
              Lead with Anchor Noun
            </text>

            <rect x="319" y="28" width="153" height="54" rx="8" fill="rgba(239,68,68,0.1)" stroke="rgba(239,68,68,0.3)" />
            <text x="331" y="50" fill="#fca5a5" fontSize="10" fontFamily="monospace">
              &gt; 3.5s · DANGER
            </text>
            <text x="331" y="68" fill="#f87171" fontSize="11">
              “Um, great question...”
            </text>
          </g>
        </svg>
      );

    default:
      return null;
  }
}

export function SlideVisualBlock({ visual }: { visual?: SlideVisualMedia }) {
  const hasUrl = Boolean(visual?.url && visual.url.trim().length > 0);
  const hasPreset = Boolean(
    visual?.preset && visual.preset !== "none"
  );

  if (!hasUrl && !hasPreset) return null;

  return (
    <figure className="overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0b] shadow-inner">
      <div className="p-3 sm:p-4">
        {hasUrl ? (
          <img
            src={visual!.url!.trim()}
            alt={visual?.altText || visual?.caption || "Lesson tactical diagram"}
            className="max-h-[260px] w-full rounded-lg object-contain bg-[#080809]"
          />
        ) : (
          <BuiltInTacticalDiagram preset={visual!.preset!} />
        )}
      </div>
      {visual?.caption && (
        <figcaption className="border-t border-white/[0.06] bg-white/[0.02] px-4 py-2 text-[11px] font-mono text-neutral-400">
          {visual.caption}
        </figcaption>
      )}
    </figure>
  );
}

// ─── 4-Stage Executive Briefing Deck ────────────────────────────────────────

export interface ExecutiveBriefingDeckProps {
  course: Pick<Course, "id" | "title" | "category">;
  lesson: CourseLesson;
  activeSlide?: BriefingSlideIndex;
  onSlideChange?: (slide: BriefingSlideIndex) => void;
  isCompleted?: boolean;
  launching?: boolean;
  onLaunchDrill?: (course: Pick<Course, "id" | "title">, lesson: CourseLesson) => void;
  onMarkComplete?: (courseId: string, lessonId: string) => void;
  onClose?: () => void;
  previewMode?: boolean;
}

export function ExecutiveBriefingDeck({
  course,
  lesson,
  activeSlide: controlledSlide,
  onSlideChange,
  isCompleted = false,
  launching = false,
  onLaunchDrill,
  onMarkComplete,
  onClose,
  previewMode = false,
}: ExecutiveBriefingDeckProps) {
  const prefersReducedMotion = useReducedMotion();
  const [slideState, setSlideState] = useState<{
    lessonId: string;
    slide: BriefingSlideIndex;
    direction: number;
  }>({ lessonId: lesson.id, slide: 0, direction: 1 });

  const internalSlide: BriefingSlideIndex =
    slideState.lessonId === lesson.id ? slideState.slide : 0;
  const currentSlide = controlledSlide ?? internalSlide;

  function setSlide(next: BriefingSlideIndex) {
    const dir = next >= currentSlide ? 1 : -1;
    setSlideState({ lessonId: lesson.id, slide: next, direction: dir });
    onSlideChange?.(next);
  }

  const { slides, roomConfig } = lesson;
  const archetypeDef = ARCHETYPES[roomConfig.archetype] ?? ARCHETYPES.skeptic;
  const modeLabel = sessionLabel(roomConfig.experience);

  const trapVisualLayout = slides.trap.visual?.layout ?? "split";
  const modelVisualLayout = slides.mentalModel.visual?.layout ?? "hero";
  const hasTrapVisual = Boolean(
    slides.trap.visual?.url?.trim() ||
      (slides.trap.visual?.preset && slides.trap.visual.preset !== "none")
  );

  const ruleThemeClasses =
    slides.mentalModel.ruleTheme === "amber"
      ? "border-amber-500/35 bg-gradient-to-br from-amber-500/[0.12] via-[#131210] to-[#0e0e0f] text-amber-300"
      : slides.mentalModel.ruleTheme === "cyan"
      ? "border-sky-500/35 bg-gradient-to-br from-sky-500/[0.12] via-[#101316] to-[#0e0e0f] text-sky-300"
      : "border-emerald-500/35 bg-gradient-to-br from-emerald-500/[0.12] via-[#101513] to-[#0e0e0f] text-emerald-300";

  return (
    <div className="rounded-2xl border border-white/12 bg-[#0e0e10] overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
      {/* Top Stage Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] bg-[#131316] px-5 py-4 sm:px-7">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.16em] text-neutral-300">
              {course.title}
            </span>
            <span className="text-[11px] font-mono text-neutral-500">
              · {lesson.durationMinutes} min masterclass
            </span>
            {isCompleted && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Mastered
              </span>
            )}
          </div>
          <h3 className="mt-1 truncate text-lg font-bold tracking-tight text-white sm:text-xl">
            {lesson.title}
          </h3>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-neutral-300 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to roadmap
          </button>
        )}
      </div>

      {/* 4-Stage Interactive Stepper */}
      <div
        role="tablist"
        aria-label="Lesson briefing slides"
        className="grid grid-cols-4 border-b border-white/[0.07] bg-[#0a0a0c]"
      >
        {SLIDE_STEPS.map((step) => {
          const active = currentSlide === step.index;
          const passed = currentSlide > step.index;
          return (
            <button
              key={step.index}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSlide(step.index)}
              className={cn(
                "group relative flex items-center justify-center gap-2 px-2 py-3.5 text-xs transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40",
                active
                  ? "bg-white/[0.04] text-white font-semibold"
                  : passed
                  ? "text-neutral-300 hover:bg-white/[0.02]"
                  : "text-neutral-500 hover:bg-white/[0.02] hover:text-neutral-300"
              )}
            >
              <span
                className={cn(
                  "hidden h-5 w-5 items-center justify-center rounded-full border text-[10px] font-mono sm:inline-flex",
                  active
                    ? step.accent
                    : passed
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-white/10 text-neutral-500"
                )}
              >
                {passed ? "✓" : step.stepNum}
              </span>
              <span className="hidden md:inline">{step.label}</span>
              <span className="md:hidden">{step.short}</span>
              {active && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-white" />
              )}
            </button>
          );
        })}
      </div>

      {/* Animated Stage Body */}
      <div className="p-6 sm:p-8 min-h-[380px] flex flex-col justify-between bg-gradient-to-b from-[#111114] to-[#0c0c0e]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${lesson.id}-slide-${currentSlide}`}
            initial={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 0, x: slideState.direction * 18 }
            }
            animate={{ opacity: 1, x: 0 }}
            exit={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 0, x: slideState.direction * -18 }
            }
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* SLIDE 1: THE TRAP */}
            {currentSlide === 0 && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-rose-300">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Slide 1 of 4 · The Executive Autopsy
                  </div>
                  {slides.trap.flaws && slides.trap.flaws.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {slides.trap.flaws.map((flaw) => (
                        <span
                          key={flaw}
                          className="rounded-md border border-rose-500/20 bg-rose-500/[0.06] px-2 py-0.5 text-[10px] font-mono text-rose-300"
                        >
                          ✕ {flaw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {trapVisualLayout === "hero" && hasTrapVisual && (
                  <SlideVisualBlock visual={slides.trap.visual} />
                )}

                <div
                  className={cn(
                    "grid gap-6 items-start",
                    trapVisualLayout === "split" && hasTrapVisual
                      ? "grid-cols-1 lg:grid-cols-12"
                      : "grid-cols-1"
                  )}
                >
                  <div
                    className={cn(
                      "space-y-4",
                      trapVisualLayout === "split" && hasTrapVisual
                        ? "lg:col-span-6"
                        : ""
                    )}
                  >
                    <div>
                      <h4 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                        {slides.trap.headline}
                      </h4>
                      <p className="mt-3 text-sm leading-relaxed text-neutral-300 sm:text-base">
                        {slides.trap.body}
                      </p>
                    </div>

                    {slides.trap.instinctQuote && (
                      <div className="rounded-xl border border-white/10 bg-[#09090b] p-4">
                        <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                          The Fatal Impulse (What Speakers Blurt Out)
                        </p>
                        <p className="mt-1.5 text-xs italic leading-relaxed text-neutral-300 sm:text-sm">
                          {slides.trap.instinctQuote}
                        </p>
                      </div>
                    )}

                    <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.07] p-4">
                      <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-rose-300">
                        Why this costs you the room
                      </p>
                      <p className="mt-1.5 text-xs leading-relaxed text-neutral-100 sm:text-sm">
                        {slides.trap.costOfFailure}
                      </p>
                    </div>
                  </div>

                  {trapVisualLayout === "split" && hasTrapVisual && (
                    <div className="lg:col-span-6">
                      <SlideVisualBlock visual={slides.trap.visual} />
                    </div>
                  )}
                </div>

                {trapVisualLayout === "card" && hasTrapVisual && (
                  <SlideVisualBlock visual={slides.trap.visual} />
                )}
              </div>
            )}

            {/* SLIDE 2: THE MENTAL MODEL */}
            {currentSlide === 1 && (
              <div className="space-y-6">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-emerald-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  Slide 2 of 4 · The Tactical Law
                </div>

                <div>
                  <h4 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    {slides.mentalModel.headline}
                  </h4>
                  <p className="mt-2.5 text-sm leading-relaxed text-neutral-300 sm:text-base max-w-3xl">
                    {slides.mentalModel.body}
                  </p>
                </div>

                {/* Embossed Golden Rule Law Card */}
                <div
                  className={cn(
                    "rounded-2xl border p-5 sm:p-6 shadow-lg",
                    ruleThemeClasses
                  )}
                >
                  <div className="flex items-center gap-2 text-[10px] font-mono font-semibold uppercase tracking-[0.2em]">
                    <Compass className="h-3.5 w-3.5" />
                    The Golden Rule
                  </div>
                  <p className="mt-2 text-base font-bold leading-snug text-white sm:text-xl">
                    “{slides.mentalModel.goldenRule}”
                  </p>
                </div>

                {/* 3-Step Tactical Pipeline */}
                {slides.mentalModel.steps && slides.mentalModel.steps.length > 0 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {slides.mentalModel.steps.map((s) => (
                      <div
                        key={s.step}
                        className="relative rounded-xl border border-white/10 bg-[#141418] p-4"
                      >
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.07] font-mono text-xs font-bold text-white">
                          0{s.step}
                        </span>
                        <h5 className="mt-2.5 text-xs font-bold text-white sm:text-sm">
                          {s.label}
                        </h5>
                        <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                          {s.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {modelVisualLayout && (
                  <SlideVisualBlock visual={slides.mentalModel.visual} />
                )}
              </div>
            )}

            {/* SLIDE 3: THE TAPE BREAKDOWN */}
            {currentSlide === 2 && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-sky-300">
                    <BookOpen className="h-3.5 w-3.5" />
                    Slide 3 of 4 · Film Room Breakdown
                  </div>
                  <span className="text-[11px] font-mono text-neutral-400">
                    {slides.tape.headline}
                  </span>
                </div>

                {/* Incoming Hostile Prompt Banner */}
                <div className="rounded-xl border border-white/12 bg-[#09090b] p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-amber-400">
                      <Radio className="h-3.5 w-3.5" />
                      Incoming Prompt · {slides.tape.speakerName || `${roomConfig.personaName} (${archetypeDef.tagline})`}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white sm:text-base">
                    “{slides.tape.prompt}”
                  </p>
                </div>

                <SlideVisualBlock visual={slides.tape.visual} />

                {/* Side-by-Side Split Film Comparison */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {/* Amateur / Weak Tape */}
                  <div className="flex flex-col justify-between rounded-xl border border-rose-500/25 bg-rose-500/[0.04] p-5">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                          <XCircle className="h-4 w-4" />
                          Weak / Defensive Tape
                        </div>
                        <span className="rounded bg-rose-500/15 px-2 py-0.5 text-[10px] font-mono text-rose-300">
                          Loses Authority
                        </span>
                      </div>

                      {slides.tape.weakBadges && slides.tape.weakBadges.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {slides.tape.weakBadges.map((b) => (
                            <span
                              key={b}
                              className="rounded border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[10px] font-mono text-rose-200"
                            >
                              ✕ {b}
                            </span>
                          ))}
                        </div>
                      )}

                      <p className="mt-3.5 text-xs italic leading-relaxed text-neutral-300 sm:text-sm">
                        “{slides.tape.weakResponse}”
                      </p>
                    </div>

                    <div className="mt-4 border-t border-rose-500/15 pt-3 text-xs text-neutral-300">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-rose-300">
                        Coach Critique:{" "}
                      </span>
                      {slides.tape.weakCritique}
                    </div>
                  </div>

                  {/* Executive Standard Tape */}
                  <div className="flex flex-col justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-5">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" />
                          Executive Tape
                        </div>
                        <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                          Commands Room
                        </span>
                      </div>

                      {slides.tape.strongBadges && slides.tape.strongBadges.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {slides.tape.strongBadges.map((b) => (
                            <span
                              key={b}
                              className="rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-200"
                            >
                              ✓ {b}
                            </span>
                          ))}
                        </div>
                      )}

                      <p className="mt-3.5 text-xs font-medium leading-relaxed text-white sm:text-sm">
                        “{slides.tape.strongResponse}”
                      </p>
                    </div>

                    <div className="mt-4 border-t border-emerald-500/20 pt-3 text-xs text-neutral-200">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                        Why it works:{" "}
                      </span>
                      {slides.tape.strongWhy}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SLIDE 4: CHAMBER MISSION (ARENA PRE-FLIGHT) */}
            {currentSlide === 3 && (
              <div className="space-y-6">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-amber-300">
                  <Swords className="h-3.5 w-3.5" />
                  Slide 4 of 4 · Chamber Mission Pre-Flight
                </div>

                <div>
                  <h4 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    Prove It Live Against {roomConfig.personaName}
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                    {slides.mission.briefing}
                  </p>
                </div>

                <SlideVisualBlock visual={slides.mission.visual} />

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                  {/* Opponent Fighter Dossier */}
                  <div className="lg:col-span-5 rounded-xl border border-white/12 bg-[#141418] p-5 flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-400">
                        Assigned Panelist
                      </p>
                      <div className="mt-3 flex items-center gap-3.5">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-lg font-bold text-white">
                          {roomConfig.personaName.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-base font-bold text-white">
                            {roomConfig.personaName} · {archetypeDef.tagline}
                          </p>
                          <p className="text-xs text-neutral-400 capitalize">
                            {modeLabel} · {roomConfig.behaviorStyle} demeanor
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 border-t border-white/[0.07] pt-3">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                        Pass Directives
                      </p>
                      <p className="mt-1.5 text-xs font-medium text-white">
                        {slides.mission.passCriteria}
                      </p>
                      {slides.mission.passCriteriaList &&
                        slides.mission.passCriteriaList.length > 0 && (
                          <ul className="mt-2.5 space-y-1.5 border-t border-white/[0.06] pt-2">
                            {slides.mission.passCriteriaList.map((item) => (
                              <li
                                key={item}
                                className="flex items-start gap-2 text-xs text-neutral-300"
                              >
                                <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                    </div>
                  </div>

                  {/* Opening Attack Prompt Preview */}
                  <div className="lg:col-span-7 rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.08] via-[#131316] to-[#0d0d0f] p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-amber-300">
                          <Flame className="h-3.5 w-3.5" />
                          Opening Challenge Line
                        </span>
                        <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[10px] font-mono text-neutral-400">
                          Round 1 Audio Prompt
                        </span>
                      </div>
                      <p className="mt-4 text-base font-semibold italic leading-relaxed text-white sm:text-lg">
                        “{slides.mission.openingAttack}”
                      </p>
                    </div>

                    <div className="mt-5 rounded-lg border border-white/[0.08] bg-black/40 px-3.5 py-2.5 text-[11px] font-mono text-neutral-300">
                      Rule in play: “{slides.mentalModel.goldenRule}”
                    </div>
                  </div>
                </div>

                {/* Launch Chamber CTA Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  {onLaunchDrill && (
                    <Button
                      onClick={() => onLaunchDrill(course, lesson)}
                      disabled={launching}
                      className="bg-white text-black hover:bg-neutral-200 font-bold text-xs sm:text-sm px-6 py-3 h-auto shadow-[0_0_25px_rgba(255,255,255,0.2)]"
                    >
                      <Play className="mr-2 h-4 w-4 fill-current" />
                      {launching
                        ? "Opening Sparring Chamber..."
                        : previewMode
                        ? "Test Drill in Chamber →"
                        : "Enter Drill Chamber →"}
                    </Button>
                  )}

                  {!previewMode && onMarkComplete && !isCompleted && (
                    <button
                      type="button"
                      onClick={() => onMarkComplete(course.id, lesson.id)}
                      className="text-xs font-medium text-neutral-400 underline-offset-4 hover:text-white hover:underline"
                    >
                      Mark lesson mastered without drill
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Bottom Deck Navigation */}
        <div className="mt-8 flex items-center justify-between border-t border-white/[0.07] pt-4">
          <button
            type="button"
            disabled={currentSlide === 0}
            onClick={() =>
              setSlide(Math.max(0, currentSlide - 1) as BriefingSlideIndex)
            }
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-30 disabled:pointer-events-none"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Previous slide
          </button>

          <div className="flex items-center gap-2">
            {SLIDE_STEPS.map((s) => (
              <button
                key={s.index}
                type="button"
                aria-label={`Go to ${s.label}`}
                onClick={() => setSlide(s.index)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  currentSlide === s.index
                    ? "w-6 bg-white"
                    : currentSlide > s.index
                    ? "w-2 bg-emerald-400/60"
                    : "w-2 bg-white/20"
                )}
              />
            ))}
          </div>

          {currentSlide < 3 ? (
            <button
              type="button"
              onClick={() =>
                setSlide(Math.min(3, currentSlide + 1) as BriefingSlideIndex)
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-neutral-200"
            >
              Next: {SLIDE_STEPS[currentSlide + 1].short}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span className="text-[11px] font-mono text-emerald-400">
              Ready for Chamber
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Learner-Facing Coach View (3-Screen SPA Architecture) ──────────────────

export type CoachScreen = "catalog" | "roadmap" | "lesson";

export interface ActiveCourseLessonContext {
  courseId: string;
  lessonId: string;
  courseTitle?: string;
  lessonTitle?: string;
  passCriteria?: string;
}

export interface CoachViewProps {
  onSessionCreated: (
    sessionId: string,
    experience: ExperienceKey,
    drillTarget: DrillTarget | null,
    courseLesson?: ActiveCourseLessonContext
  ) => void;
  initialCourses?: Course[];
  initialCompletions?: LessonCompletion[];
  initialScreen?: CoachScreen;
  initialSelectedCourseId?: string;
  initialActiveLessonId?: string | null;
}

export function CoachView({
  onSessionCreated,
  initialCourses,
  initialCompletions,
  initialScreen = "catalog",
  initialSelectedCourseId,
  initialActiveLessonId = null,
}: CoachViewProps) {
  const [courses, setCourses] = useState<Course[]>(
    initialCourses ?? DEFAULT_COURSES
  );
  const [completions, setCompletions] = useState<LessonCompletion[]>(
    initialCompletions ?? []
  );
  const [screen, setScreen] = useState<CoachScreen>(initialScreen);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    initialSelectedCourseId ??
      (initialCourses ?? DEFAULT_COURSES)[0]?.id ??
      "boardroom-curveballs"
  );
  const [activeLessonId, setActiveLessonId] = useState<string | null>(
    initialActiveLessonId
  );
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  useEffect(() => {
    if (initialCourses && initialCompletions) return;
    let cancelled = false;

    async function load() {
      try {
        const [coursesRes, progressRes] = await Promise.all([
          fetch("/api/coach/courses"),
          fetch("/api/coach/progress"),
        ]);
        if (cancelled) return;
        if (coursesRes.ok) {
          const cData = await coursesRes.json();
          if (Array.isArray(cData.courses) && cData.courses.length > 0) {
            setCourses(cData.courses);
          }
        }
        if (progressRes.ok) {
          const pData = await progressRes.json();
          if (Array.isArray(pData.completions)) {
            setCompletions(pData.completions);
          }
        }
      } catch {
        // Fallback to seeded DEFAULT_COURSES
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [initialCourses, initialCompletions]);

  const completedLessonIds = useMemo(
    () => new Set(completions.map((c) => c.lessonId)),
    [completions]
  );

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === selectedCourseId) ?? courses[0] ?? null,
    [courses, selectedCourseId]
  );

  const allCourseLessons = useMemo(
    () => (selectedCourse ? getCourseLessons(selectedCourse) : []),
    [selectedCourse]
  );

  const activeLesson = useMemo(
    () =>
      activeLessonId
        ? allCourseLessons.find((l) => l.id === activeLessonId) ?? null
        : null,
    [allCourseLessons, activeLessonId]
  );

  async function handleMarkComplete(courseId: string, lessonId: string) {
    try {
      const res = await fetch("/api/coach/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, lessonId }),
      });
      const data = await res.json();
      if (Array.isArray(data.completions)) {
        setCompletions(data.completions);
      }
    } catch {
      setCompletions((prev) => [
        ...prev,
        { courseId, lessonId, completedAt: new Date().toISOString() },
      ]);
    }
  }

  async function handleLaunchDrill(
    course: Pick<Course, "id" | "title">,
    lesson: CourseLesson
  ) {
    setLaunching(true);
    setLaunchError(null);
    try {
      const payload = buildLessonSessionPayload(course, lesson);
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.session?.id) {
        throw new Error(data?.error || "Could not create drill session");
      }
      onSessionCreated(
        data.session.id,
        payload.experience,
        payload.drillTarget,
        {
          courseId: course.id,
          lessonId: lesson.id,
          courseTitle: course.title,
          lessonTitle: lesson.title,
          passCriteria: lesson.slides.mission.passCriteria,
        }
      );
    } catch (err) {
      setLaunchError(
        err instanceof Error ? err.message : "Failed to launch drill chamber"
      );
      setLaunching(false);
    }
  }

  if (courses.length === 0 || !selectedCourse) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16 text-center">
        <GraduationCap className="mx-auto h-8 w-8 text-neutral-500" />
        <h1 className="mt-4 text-xl font-semibold text-white">
          No courses published yet
        </h1>
        <p className="mt-1 text-xs text-neutral-400">
          Courses published by your coaching team will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-32 sm:px-6 sm:py-10 md:pb-16 space-y-6">
      {launchError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300"
        >
          {launchError}
        </div>
      )}

      {screen === "lesson" && activeLesson ? (
        <LessonPlayer
          course={selectedCourse}
          lesson={activeLesson}
          isCompleted={completedLessonIds.has(activeLesson.id)}
          launchingChamber={launching}
          onBackToRoadmap={() => {
            setActiveLessonId(null);
            setScreen("roadmap");
          }}
          onLaunchChamber={handleLaunchDrill}
          onCompleteLesson={handleMarkComplete}
          renderVisual={(visual) => <SlideVisualBlock visual={visual} />}
        />
      ) : screen === "roadmap" ? (
        <CourseRoadmap
          course={selectedCourse}
          completedLessonIds={completedLessonIds}
          launchingChamber={launching}
          onBackToCatalog={() => {
            setActiveLessonId(null);
            setScreen("catalog");
          }}
          onStartLesson={(lessonId) => {
            setActiveLessonId(lessonId);
            setScreen("lesson");
          }}
          onLaunchChamber={handleLaunchDrill}
        />
      ) : (
        <CourseCatalog
          courses={courses}
          completedLessonIds={completedLessonIds}
          onSelectCourse={(courseId) => {
            setSelectedCourseId(courseId);
            setActiveLessonId(null);
            setScreen("roadmap");
          }}
          onStartOrContinueLesson={(courseId, lessonId) => {
            setSelectedCourseId(courseId);
            setActiveLessonId(lessonId);
            setScreen("lesson");
          }}
        />
      )}
    </div>
  );
}
