"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Compass,
  Flame,
  Play,
  Radio,
  ShieldAlert,
  Sparkles,
  Swords,
  Target,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ARCHETYPES } from "@/lib/personas";
import { sessionLabel } from "@/lib/session-label";
import { readStoredUserPreferences } from "@/lib/user-preferences";
import type { ExperienceKey, DrillTarget } from "@/lib/experiences";
import {
  DEFAULT_COURSES,
  SPAR_SIGNATURE_HEADLINE,
  SPAR_SIGNATURE_MANIFESTO,
  buildLessonSessionPayload,
  getCourseLessons,
  getRealWorldChallenge,
  type Course,
  type CourseLesson,
  type DiagramPreset,
  type LessonCompletion,
  type SlidePracticeAttemptContext,
  type SlideVisualMedia,
} from "@/lib/courses";
import { CourseCatalog } from "./coach/course-catalog";
import { CourseRoadmap } from "./coach/course-roadmap";
import { LessonPlayer } from "./coach/lesson-player";
import { Kwesi } from "./kwesi-mascot";

export type BriefingSlideIndex = number;

// ─── Tactical Vector Diagrams & Custom Partner Visual Renderer ──────────────

function BuiltInTacticalDiagram({ preset }: { preset: DiagramPreset }) {
  switch (preset) {
    case "bluf-pyramid":
      return (
        <div
          role="img"
          aria-label="Comparison between chronological buildup and Bottom-Line Up Front pyramid"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 select-none"
        >
          {/* Trap side */}
          <div className="rounded-2xl border-2 border-[#FF5A1F]/45 bg-[#1B100C] p-4 space-y-2">
            <p className="font-display text-[11px] font-bold uppercase tracking-wider text-[#FF5A1F]">
              Chronological Trap
            </p>
            <div className="rounded-lg border border-white/10 bg-[#141418] px-3 py-2 text-xs text-neutral-300">
              0–20s · Backstory buildup
            </div>
            <div className="rounded-lg border border-white/10 bg-[#141418] px-3 py-2 text-xs text-neutral-300">
              20–35s · Process excuses
            </div>
            <div className="rounded-lg border border-dashed border-[#FF5A1F] bg-[#FF5A1F]/15 px-3 py-2 text-xs font-semibold text-[#FFB599]">
              Cut off before point lands
            </div>
          </div>

          {/* Winning Move side */}
          <div className="rounded-2xl border-2 border-[#C6FF3D]/60 bg-[#171A10] p-4 flex flex-col items-center space-y-2 shadow-[0_3px_0_0_#3A4A10]">
            <p className="self-start font-display text-[11px] font-bold uppercase tracking-wider text-[#C6FF3D]">
              Executive BLUF Pyramid
            </p>
            <div className="w-full rounded-xl border border-[#C6FF3D] bg-[#C6FF3D] px-3 py-2.5 text-center text-xs font-bold text-[#0B0D06]">
              0–5s · Verdict + Exact Metric
            </div>
            <div className="w-[86%] rounded-lg border border-[#C6FF3D]/40 bg-[#1F2612] px-3 py-2 text-center text-xs font-medium text-neutral-100">
              5–15s · 2 concrete drivers
            </div>
            <div className="w-[66%] rounded-lg border border-white/15 bg-[#141418] px-3 py-1.5 text-center text-[11px] text-neutral-400">
              15s · Full stop
            </div>
          </div>
        </div>
      );

    case "assumption-floor":
      return (
        <div
          role="img"
          aria-label="Break-even downside floor compared against live pilot baseline"
          className="space-y-3.5 select-none"
        >
          <p className="font-display text-[11px] font-bold uppercase tracking-wider text-[#C6FF3D]">
            Downside Buffer Geometry
          </p>

          <div className="space-y-2.5">
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium text-white">Live Pilot Cohort (n=40)</span>
                <span className="font-display font-bold text-[#C6FF3D] tabular-nums">34%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-[#1C1C22]">
                <div className="h-full w-[85%] rounded-full bg-[#C6FF3D]" />
              </div>
            </div>

            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-neutral-300">Plan Assumption</span>
                <span className="font-mono text-neutral-200 tabular-nums">30%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-[#1C1C22]">
                <div className="h-full w-[75%] rounded-full bg-white/70" />
              </div>
            </div>

            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium text-[#FFB599]">Break-Even Floor</span>
                <span className="font-display font-bold text-[#FF5A1F] tabular-nums">14%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-[#1C1C22]">
                <div className="h-full w-[35%] rounded-full bg-[#FF5A1F]" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-[#C6FF3D]/35 bg-[#171A10] px-3.5 py-2 text-xs">
            <span className="text-neutral-300">Safety headroom above break-even</span>
            <span className="font-display font-bold text-[#C6FF3D]">2.4× buffer</span>
          </div>
        </div>
      );

    case "stakeholder-delta":
      return (
        <div
          role="img"
          aria-label="Stakeholder value bridge translating technical features into quantified delta"
          className="grid grid-cols-1 gap-3 sm:grid-cols-3 select-none"
        >
          <div className="rounded-2xl border border-[#2C2C34] bg-[#141418] p-4">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              1 · Stakeholder
            </span>
            <p className="mt-1.5 font-display text-sm font-bold text-white">
              Bank Compliance
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              Mid-market audit lead
            </p>
          </div>

          <div className="rounded-2xl border border-[#FF5A1F]/45 bg-[#1B100C] p-4">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#FF5A1F]">
              2 · Baseline Pain
            </span>
            <p className="mt-1.5 font-display text-xl font-bold text-[#FFB599] tabular-nums">
              18 hrs/wk
            </p>
            <p className="mt-1 text-xs text-neutral-300">
              Manual wire review
            </p>
          </div>

          <div className="rounded-2xl border-2 border-[#C6FF3D]/60 bg-[#171A10] p-4 shadow-[0_3px_0_0_#3A4A10]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#C6FF3D]">
              3 · After Delta
            </span>
            <p className="mt-1.5 font-display text-xl font-bold text-[#C6FF3D] tabular-nums">
              20 mins
            </p>
            <p className="mt-1 text-xs text-neutral-100">
              0 false negatives
            </p>
          </div>
        </div>
      );

    case "zero-cushion":
      return (
        <div
          role="img"
          aria-label="Removing verbal qualifiers increases executive conviction"
          className="space-y-3 select-none"
        >
          <div className="rounded-2xl border border-[#FF5A1F]/45 bg-[#1B100C] p-4">
            <span className="font-display text-[11px] font-bold uppercase tracking-wider text-[#FF5A1F]">
              Before · Hedged opener
            </span>
            <p className="mt-1.5 text-sm text-[#FFB599] line-through">
              “I think we should probably be fine because we sort of tested…”
            </p>
          </div>

          <div className="rounded-2xl border-2 border-[#C6FF3D]/65 bg-[#171A10] p-4 shadow-[0_3px_0_0_#3A4A10]">
            <span className="font-display text-[11px] font-bold uppercase tracking-wider text-[#C6FF3D]">
              After · Clean declarative
            </span>
            <p className="mt-1.5 text-sm font-semibold text-white">
              “Yes. We load-tested all core endpoints at 15× peak volume with zero lag.”
            </p>
          </div>
        </div>
      );

    case "word-ceiling":
      return (
        <div
          role="img"
          aria-label="15-word executive attention ceiling curve"
          className="space-y-3 select-none"
        >
          <p className="font-display text-[11px] font-bold uppercase tracking-wider text-[#C6FF3D]">
            Executive Attention Window
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border-2 border-[#C6FF3D]/60 bg-[#171A10] p-4 shadow-[0_3px_0_0_#3A4A10]">
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-bold text-[#C6FF3D]">
                  1–15 words
                </span>
                <span className="rounded-full bg-[#C6FF3D] px-2 py-0.5 text-[10px] font-bold text-[#0B0D06]">
                  Peak
                </span>
              </div>
              <p className="mt-2 text-xs font-medium text-white">
                Subject → Verb → Metric
              </p>
              <p className="mt-1 text-xs text-neutral-300">
                Clean full stop invites pull questions
              </p>
            </div>

            <div className="rounded-2xl border border-[#FF5A1F]/45 bg-[#1B100C] p-4">
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-bold text-[#FF5A1F]">
                  25+ words
                </span>
                <span className="rounded-full bg-[#FF5A1F]/20 px-2 py-0.5 text-[10px] font-bold text-[#FFB599]">
                  Drift
                </span>
              </div>
              <p className="mt-2 text-xs font-medium text-[#FFB599]">
                Thinking out loud &amp; qualifiers
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                Panelist cuts off mid-sentence
              </p>
            </div>
          </div>
        </div>
      );

    case "steelman-moat":
      return (
        <div
          role="img"
          aria-label="Conceding surface layer to anchor on deep structural moat"
          className="space-y-3 select-none"
        >
          <div className="rounded-2xl border border-dashed border-[#3A3A44] bg-[#141418] p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              1 · Surface layer (concede fast)
            </span>
            <p className="mt-1 text-sm text-neutral-200">
              “The workflow UI is easy to copy in 60 days…”
            </p>
          </div>

          <div className="rounded-2xl border-2 border-[#C6FF3D]/65 bg-[#171A10] p-4 shadow-[0_3px_0_0_#3A4A10]">
            <span className="font-display text-[11px] font-bold uppercase tracking-wider text-[#C6FF3D]">
              2 · Structural moat (anchor here)
            </span>
            <p className="mt-1 text-sm font-semibold text-white">
              “…but our dataset comes from 400 exclusive clinics (18-month lock-in).”
            </p>
          </div>
        </div>
      );

    case "onset-latency":
      return (
        <div
          role="img"
          aria-label="Two-second vocal onset window timeline"
          className="space-y-3 select-none"
        >
          <p className="font-display text-[11px] font-bold uppercase tracking-wider text-[#C6FF3D]">
            2-Second Recovery Timeline
          </p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#2C2C34] bg-[#141418] p-3.5">
              <span className="font-mono text-[10px] text-neutral-400">0.0s – 1.0s</span>
              <p className="mt-1 font-display text-sm font-bold text-white">Silent breath</p>
            </div>
            <div className="rounded-2xl border-2 border-[#C6FF3D]/65 bg-[#171A10] p-3.5 shadow-[0_3px_0_0_#3A4A10]">
              <span className="font-mono text-[10px] font-bold text-[#C6FF3D]">1.0s – 2.0s · ONSET</span>
              <p className="mt-1 font-display text-sm font-bold text-white">Anchor noun</p>
            </div>
            <div className="rounded-2xl border border-[#FF5A1F]/45 bg-[#1B100C] p-3.5">
              <span className="font-mono text-[10px] font-bold text-[#FF5A1F]">&gt; 3.5s · DANGER</span>
              <p className="mt-1 text-xs font-medium text-[#FFB599]">“Um, great question…”</p>
            </div>
          </div>
        </div>
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

  const hiddenCore = useMemo(
    () => new Set(lesson.hiddenCoreSlides ?? []),
    [lesson.hiddenCoreSlides]
  );

  const deckSteps = useMemo(() => {
    const list: Array<{
      index: BriefingSlideIndex;
      stepNum: string;
      label: string;
      short: string;
      accent: string;
    }> = [];

    let num = 1;
    if (!hiddenCore.has("trap")) {
      list.push({
        index: 0,
        stepNum: `0${num++}`,
        label: "1. The Trap",
        short: "The Trap",
        accent: "text-neutral-300 border-white/20",
      });
    }
    if (!hiddenCore.has("mentalModel")) {
      list.push({
        index: 1,
        stepNum: `0${num++}`,
        label: "2. Mental Model",
        short: "The Rule",
        accent: "text-white border-white/30",
      });
    }
    if (!hiddenCore.has("tape")) {
      list.push({
        index: 2,
        stepNum: `0${num++}`,
        label: "3. The Tape",
        short: "The Tape",
        accent: "text-neutral-200 border-white/20",
      });
    }

    (lesson.extraSlides ?? []).forEach((extra, idx) => {
      list.push({
        index: 100 + idx,
        stepNum: `0${num++}`,
        label: extra.label || `Insight ${idx + 1}`,
        short: extra.label || `Slide ${num - 1}`,
        accent: "text-neutral-200 border-white/20",
      });
    });

    list.push({
      index: 3,
      stepNum: `0${num++}`,
      label: "4. Chamber Drill",
      short: "Chamber",
      accent: "text-white border-white/30",
    });

    if (lesson.realWorldTransfer?.enabled !== false) {
      list.push({
        index: 4,
        stepNum: "✦",
        label: "Real-World Transfer",
        short: "Real World",
        accent: "text-white border-white/40",
      });
    }

    return list;
  }, [hiddenCore, lesson.extraSlides, lesson.realWorldTransfer?.enabled]);

  function setSlide(next: BriefingSlideIndex) {
    const dir = next >= currentSlide ? 1 : -1;
    setSlideState({ lessonId: lesson.id, slide: next, direction: dir });
    onSlideChange?.(next);
  }

  const currentStepPos = Math.max(
    0,
    deckSteps.findIndex((s) => s.index === currentSlide)
  );
  const prevStep = currentStepPos > 0 ? deckSteps[currentStepPos - 1] : null;
  const nextStep =
    currentStepPos < deckSteps.length - 1 ? deckSteps[currentStepPos + 1] : null;

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
      ? "border-white/25 bg-gradient-to-br from-white/[0.08] via-[#121215] to-[#0e0e0f] text-white"
      : slides.mentalModel.ruleTheme === "cyan"
      ? "border-white/25 bg-gradient-to-br from-white/[0.08] via-[#121215] to-[#0e0e0f] text-white"
      : "border-white/25 bg-gradient-to-br from-white/[0.08] via-[#121215] to-[#0e0e0f] text-white";

  const activeExtraSlide =
    currentSlide >= 100
      ? (lesson.extraSlides ?? [])[currentSlide - 100] ?? null
      : null;

  return (
    <div className="spar-chunky-card w-full max-w-[1040px] h-[640px] flex flex-col overflow-hidden mx-auto">
      {/* Top Stage Header + Single Continuous Progress Bar */}
      <div className="border-b border-[#232327] bg-[#121216] px-5 py-4 sm:px-7 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-[#2C2C34] bg-[#18181D] px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.16em] text-neutral-300">
                {course.title}
              </span>
              <span className="text-[11px] font-mono text-neutral-500">
                · {lesson.durationMinutes} min masterclass
              </span>
              {isCompleted && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#C6FF3D]/40 bg-[#C6FF3D]/12 px-2.5 py-0.5 text-[10px] font-semibold text-[#C6FF3D]">
                  <CheckCircle2 className="h-3 w-3" />
                  Mastered
                </span>
              )}
            </div>
            <h3 className="mt-1 truncate font-display text-lg font-bold tracking-tight text-white sm:text-xl">
              {lesson.title}
            </h3>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#2C2C34] bg-[#18181D] px-3.5 py-2 text-xs font-medium text-neutral-300 transition-colors hover:border-[#3E3E4A] hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to roadmap
            </button>
          )}
        </div>

        {/* Single Continuous Undivided Electric Volt Progress Bar */}
        <div
          role="progressbar"
          aria-label="Lesson briefing progress"
          aria-valuenow={Math.round(((currentStepPos + 1) / Math.max(1, deckSteps.length)) * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 w-full overflow-hidden rounded-full border border-[#26262E] bg-[#0B0B0D]"
        >
          <div
            className="h-full rounded-full bg-[#C6FF3D] transition-all duration-300 ease-out"
            style={{
              width: `${Math.round(((currentStepPos + 1) / Math.max(1, deckSteps.length)) * 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Animated Stage Body (Scrollable inside fixed 640px stage) */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6 sm:p-8 flex flex-col justify-between bg-[#0E0E12]">
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
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.05] px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-300">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Slide 1 of 4 · The Executive Autopsy
                  </div>
                  {slides.trap.flaws && slides.trap.flaws.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {slides.trap.flaws.map((flaw) => (
                        <span
                          key={flaw}
                          className="rounded-md border border-white/15 bg-white/[0.03] px-2 py-0.5 text-[10px] font-mono text-neutral-300"
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
                      <div className="rounded-xl border border-white/10 bg-[#0e0e0e] p-4">
                        <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                          The Fatal Impulse (What Speakers Blurt Out)
                        </p>
                        <p className="mt-1.5 text-xs italic leading-relaxed text-neutral-300 sm:text-sm">
                          {slides.trap.instinctQuote}
                        </p>
                      </div>
                    )}

                    <div className="rounded-xl border border-white/15 bg-white/[0.03] p-4">
                      <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-300">
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
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.05] px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-300">
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
                  <div className="flex items-center gap-2 text-[10px] font-mono font-semibold uppercase tracking-[0.2em] text-neutral-400">
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
                        className="relative rounded-xl border border-white/10 bg-[#141414] p-4"
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
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.05] px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-300">
                    <BookOpen className="h-3.5 w-3.5" />
                    Slide 3 of 4 · Film Room Breakdown
                  </div>
                  <span className="text-[11px] font-mono text-neutral-400">
                    {slides.tape.headline}
                  </span>
                </div>

                {/* Incoming Hostile Prompt Banner */}
                <div className="rounded-xl border border-white/10 bg-[#0e0e0e] p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
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
                  <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#101010] p-5">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-300 line-through">
                          <XCircle className="h-4 w-4" />
                          Weak / Defensive Tape
                        </div>
                        <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[10px] font-mono text-neutral-400">
                          Loses Authority
                        </span>
                      </div>

                      {slides.tape.weakBadges && slides.tape.weakBadges.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {slides.tape.weakBadges.map((b) => (
                            <span
                              key={b}
                              className="rounded border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-mono text-neutral-400"
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

                    <div className="mt-4 border-t border-white/[0.06] pt-3 text-xs text-neutral-400">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                        Coach Critique:{" "}
                      </span>
                      {slides.tape.weakCritique}
                    </div>
                  </div>

                  {/* Executive Standard Tape */}
                  <div className="flex flex-col justify-between rounded-xl border border-white/20 bg-white/[0.03] p-5 shadow-sm">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                          <CheckCircle2 className="h-4 w-4" />
                          Executive Tape
                        </div>
                        <span className="rounded bg-white/[0.08] px-2 py-0.5 text-[10px] font-mono text-white">
                          Commands Room
                        </span>
                      </div>

                      {slides.tape.strongBadges && slides.tape.strongBadges.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {slides.tape.strongBadges.map((b) => (
                            <span
                              key={b}
                              className="rounded border border-white/20 bg-white/[0.06] px-2 py-0.5 text-[10px] font-mono text-white"
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

                    <div className="mt-4 border-t border-white/10 pt-3 text-xs text-neutral-200">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-white">
                        Why it works:{" "}
                      </span>
                      {slides.tape.strongWhy}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* EXTRA CUSTOM SLIDES (Creator-Added Insight Slides) */}
            {activeExtraSlide && (
              <div className="space-y-6">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.05] px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  {activeExtraSlide.label || "Executive Insight"}
                </div>

                <div>
                  <h4 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    {activeExtraSlide.headline}
                  </h4>
                  <p className="mt-2.5 text-sm leading-relaxed text-neutral-300 sm:text-base max-w-3xl">
                    {activeExtraSlide.body}
                  </p>
                </div>

                {activeExtraSlide.bullets && activeExtraSlide.bullets.length > 0 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {activeExtraSlide.bullets.map((b, bIdx) => (
                      <div
                        key={bIdx}
                        className="rounded-xl border border-white/10 bg-[#141414] p-4"
                      >
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.08] font-mono text-xs font-bold text-white">
                          0{bIdx + 1}
                        </span>
                        <p className="mt-2.5 text-xs font-medium leading-relaxed text-neutral-200">
                          {b}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {activeExtraSlide.takeaway && (
                  <div className="rounded-2xl border border-white/20 bg-white/[0.04] p-5">
                    <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.2em] text-neutral-300">
                      Key Takeaway
                    </p>
                    <p className="mt-1.5 text-sm font-semibold text-white sm:text-base">
                      “{activeExtraSlide.takeaway}”
                    </p>
                  </div>
                )}

                <SlideVisualBlock visual={activeExtraSlide.visual} />
              </div>
            )}

            {/* SLIDE 4: CHAMBER MISSION (ARENA PRE-FLIGHT) */}
            {currentSlide === 3 && (
              <div className="space-y-6">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.05] px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-300">
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
                  <div className="lg:col-span-5 rounded-xl border border-white/10 bg-[#141414] p-5 flex flex-col justify-between">
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
                      <p className="text-[10px] font-mono uppercase tracking-wider text-white font-semibold">
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
                                <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                    </div>
                  </div>

                  {/* Opening Attack Prompt Preview */}
                  <div className="lg:col-span-7 rounded-xl border border-white/10 bg-[#121212] p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-white">
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
                    <button
                      type="button"
                      onClick={() => onLaunchDrill(course, lesson)}
                      disabled={launching}
                      className="spar-volt-btn inline-flex items-center px-6 py-3 text-xs sm:text-sm"
                    >
                      <Play className="mr-2 h-4 w-4 fill-current" />
                      {launching
                        ? "Opening Sparring Chamber..."
                        : previewMode
                        ? "Test Drill in Chamber →"
                        : "Enter Drill Chamber →"}
                    </button>
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

            {/* SLIDE 5: SPAR SIGNATURE SLIDE — REAL-WORLD TRANSFER */}
            {currentSlide === 4 && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.05] px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-[0.18em] text-white">
                    <Sparkles className="h-3.5 w-3.5" />
                    Spar Signature Principle · Real-World Transfer
                  </div>
                  <span className="text-[11px] font-mono text-neutral-400">
                    Beyond the Simulator
                  </span>
                </div>

                <div>
                  <h4 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    {SPAR_SIGNATURE_HEADLINE}
                  </h4>
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-neutral-300 sm:text-base">
                    {SPAR_SIGNATURE_MANIFESTO}
                  </p>
                </div>

                {/* 3-Step Transfer Bridge */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-[#141414] p-4">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                      01 · Learn the Frame
                    </span>
                    <p className="mt-1.5 text-sm font-semibold text-white">
                      Spot the conversational trap
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                      Internalize the Golden Rule so you know what structure replaces rambling.
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#141414] p-4">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-300">
                      02 · Spar in the Room
                    </span>
                    <p className="mt-1.5 text-sm font-semibold text-white">
                      Wire the reflex under pressure
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                      Use the AI Sparring Room with {roomConfig.personaName} to practice until your first sentence is automatic.
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/15 bg-white/[0.03] p-4">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-white">
                      03 · Use It Live Today
                    </span>
                    <p className="mt-1.5 text-sm font-semibold text-white">
                      Deploy in a real conversation
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-200">
                      True confidence locks in the moment you hear yourself use this skill with real humans.
                    </p>
                  </div>
                </div>

                {/* 24-Hour Real-World Mission Callout */}
                <div className="rounded-2xl border border-white/20 bg-gradient-to-br from-white/[0.05] via-[#121212] to-[#0a0a0a] p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.2em] text-neutral-300">
                      Your 24-Hour Real-World Challenge
                    </span>
                    {lesson.realWorldTransfer?.contextHint && (
                      <span className="rounded bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-mono text-neutral-300">
                        {lesson.realWorldTransfer.contextHint}
                      </span>
                    )}
                  </div>
                  <p className="mt-2.5 text-base font-semibold leading-relaxed text-white sm:text-lg">
                    “{getRealWorldChallenge(lesson)}”
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Bottom Deck Navigation */}
        <div className="mt-8 flex items-center justify-between border-t border-white/[0.07] pt-4">
          <button
            type="button"
            disabled={!prevStep}
            onClick={() => prevStep && setSlide(prevStep.index)}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#2C2C34] bg-[#18181D] px-3.5 text-xs font-medium text-neutral-300 transition-colors hover:border-[#3E3E4A] hover:text-white disabled:opacity-30 disabled:pointer-events-none"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Previous slide
          </button>

          <span className="text-xs font-mono text-neutral-400 tabular-nums">
            {currentStepPos + 1} / {deckSteps.length}
          </span>

          {nextStep ? (
            <button
              type="button"
              onClick={() => setSlide(nextStep.index)}
              className="spar-volt-btn inline-flex h-10 items-center gap-1.5 px-5 text-xs"
            >
              Next: {nextStep.short}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span className="text-[11px] font-mono text-[#C6FF3D] font-semibold">
              Ready for Real World
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
  onDataSynced?: (courses: Course[], completions: LessonCompletion[]) => void;
}

let clientCoachCache: {
  courses: Course[];
  completions: LessonCompletion[];
} | null = null;

/** Clears cached Learn courses/progress on sign-out. */
export function clearCoachViewCache() {
  clientCoachCache = null;
}

export function CoachView({
  onSessionCreated,
  initialCourses,
  initialCompletions,
  initialScreen = "catalog",
  initialSelectedCourseId,
  initialActiveLessonId = null,
  onDataSynced,
}: CoachViewProps) {
  const isBrowser = typeof window !== "undefined";
  const seedCourses = initialCourses ?? (isBrowser ? clientCoachCache?.courses : DEFAULT_COURSES) ?? null;
  const seedCompletions = initialCompletions ?? (isBrowser ? clientCoachCache?.completions : []) ?? [];

  const [courses, setCourses] = useState<Course[] | null>(seedCourses);
  const [completions, setCompletions] = useState<LessonCompletion[]>(seedCompletions);
  const [screen, setScreen] = useState<CoachScreen>(initialScreen);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    initialSelectedCourseId ??
      seedCourses?.[0]?.id ??
      "boardroom-curveballs"
  );
  const [activeLessonId, setActiveLessonId] = useState<string | null>(
    initialActiveLessonId
  );
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const onDataSyncedRef = useRef(onDataSynced);
  useEffect(() => {
    onDataSyncedRef.current = onDataSynced;
  });

  const hasInitialSnapshotRef = useRef(
    Boolean(initialCourses && initialCompletions),
  );

  useEffect(() => {
    if (hasInitialSnapshotRef.current && !onDataSyncedRef.current) return;
    let cancelled = false;

    async function load() {
      try {
        const [coursesRes, progressRes] = await Promise.all([
          fetch("/api/coach/courses"),
          fetch("/api/coach/progress"),
        ]);
        if (cancelled) return;
        let nextCourses = clientCoachCache?.courses ?? DEFAULT_COURSES;
        let nextCompletions = clientCoachCache?.completions ?? [];

        if (coursesRes.ok) {
          const cData = await coursesRes.json();
          if (Array.isArray(cData.courses)) {
            nextCourses = cData.courses;
          }
        }
        if (progressRes.ok) {
          const pData = await progressRes.json();
          if (Array.isArray(pData.completions)) {
            nextCompletions = pData.completions;
          }
        }

        clientCoachCache = {
          courses: nextCourses,
          completions: nextCompletions,
        };
        setCourses(nextCourses);
        setCompletions(nextCompletions);
        onDataSyncedRef.current?.(nextCourses, nextCompletions);
      } catch {
        if (!cancelled) {
          setCourses((prev) => prev ?? DEFAULT_COURSES);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const completedLessonIds = useMemo(
    () => new Set(completions.map((c) => c.lessonId)),
    [completions]
  );

  const selectedCourse = useMemo(
    () => (courses ? courses.find((c) => c.id === selectedCourseId) ?? courses[0] ?? null : null),
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
        if (courses) {
          clientCoachCache = { courses, completions: data.completions };
          onDataSynced?.(courses, data.completions);
        }
      }
    } catch {
      const next = [
        ...completions,
        { courseId, lessonId, completedAt: new Date().toISOString() },
      ];
      setCompletions(next);
      if (courses) {
        clientCoachCache = { courses, completions: next };
        onDataSynced?.(courses, next);
      }
    }
  }

  async function handleLaunchDrill(
    course: Pick<Course, "id" | "title">,
    lesson: CourseLesson,
    slideAttempt?: SlidePracticeAttemptContext
  ) {
    setLaunching(true);
    setLaunchError(null);
    try {
      const prefs = readStoredUserPreferences();
      const basePayload = buildLessonSessionPayload(course, lesson, slideAttempt);
      const payload = {
        ...basePayload,
        voiceAccent: prefs.defaultAccent,
        voiceTone: prefs.voiceTone,
      };
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

  if (courses === null) {
    return (
      <div className="bg-[var(--bg-base)] text-[var(--text-primary)]">
        <div className="mx-auto max-w-5xl px-5 pb-16 pt-7 sm:px-8 sm:pt-10 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
              Learn
            </h1>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="spar-chunky-card h-44 animate-pulse" />
            <div className="spar-chunky-card h-44 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (courses.length === 0 || !selectedCourse) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16 text-center flex flex-col items-center">
        <Kwesi pose="hype" variant="cornerman" size="sm" />
        <h1 className="font-display mt-4 text-xl font-bold text-white">
          No courses published yet
        </h1>
        <p className="mt-1 text-xs text-neutral-400">
          Courses published to Learn will appear here.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        screen === "catalog"
          ? "mx-auto max-w-5xl px-5 pb-16 pt-7 sm:px-8 sm:pt-10 space-y-6"
          : screen === "roadmap"
            ? "mx-auto max-w-6xl space-y-6"
            : ""
      )}
    >
      {launchError && (
        <div
          role="alert"
          className="rounded-xl border border-white/20 bg-white/[0.05] px-4 py-3 text-xs text-neutral-300"
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
