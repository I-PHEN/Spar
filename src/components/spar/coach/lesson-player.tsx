"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Keyboard,
  Mic,
  RotateCcw,
  Square,
  Swords,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ARCHETYPES } from "@/lib/personas";
import {
  ACTIVITY_TYPE_LABELS,
  evaluatePracticeAttempt,
  type Course,
  type CourseLesson,
  type SlideVisualMedia,
  type PracticeEvaluationResult,
  type SlidePracticeAttemptContext,
} from "@/lib/courses";

export type LessonStageIndex = 0 | 1 | 2 | 3;

const LESSON_STAGES: Array<{
  index: LessonStageIndex;
  stepNum: string;
  label: string;
  short: string;
}> = [
  { index: 0, stepNum: "01", label: "1. Reflex Check", short: "1. Reflex" },
  { index: 1, stepNum: "02", label: "2. Tactical Model", short: "2. Model" },
  { index: 2, stepNum: "03", label: "3. Speaking Drill", short: "3. Drill" },
  { index: 3, stepNum: "04", label: "4. Breakdown", short: "4. Score" },
];

type MicStatus = "ready" | "listening" | "processing" | "finished" | "error";

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export interface LessonPlayerProps {
  course: Course;
  lesson: CourseLesson;
  isCompleted: boolean;
  launchingChamber: boolean;
  renderVisual?: (visual?: SlideVisualMedia) => React.ReactNode;
  onBackToRoadmap: () => void;
  onLaunchChamber: (
    course: Pick<Course, "id" | "title">,
    lesson: CourseLesson,
    slideAttempt?: SlidePracticeAttemptContext
  ) => void;
  onCompleteLesson: (courseId: string, lessonId: string) => void;
}

export function LessonPlayer({
  course,
  lesson,
  isCompleted,
  launchingChamber,
  renderVisual,
  onBackToRoadmap,
  onLaunchChamber,
  onCompleteLesson,
}: LessonPlayerProps) {
  const [stageState, setStageState] = useState<{
    lessonId: string;
    stage: LessonStageIndex;
  }>({ lessonId: lesson.id, stage: 0 });

  const stage: LessonStageIndex =
    stageState.lessonId === lesson.id ? stageState.stage : 0;

  function setStage(next: LessonStageIndex) {
    setStageState({ lessonId: lesson.id, stage: next });
  }

  // Stage 0: Instinct Choice
  const [selectedInstinct, setSelectedInstinct] = useState<"weak" | "strong" | null>(null);

  // Stage 2: Speaking Drill Response & Mic
  const [drillResponse, setDrillResponse] = useState("");
  const [showTypeInput, setShowTypeInput] = useState(false);
  const [micStatus, setMicStatus] = useState<MicStatus>("ready");
  const [micError, setMicError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Stage 3: Evaluation State
  const [evaluation, setEvaluation] = useState<PracticeEvaluationResult | null>(null);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {}
    };
  }, []);

  const { slides, roomConfig, practice } = lesson;
  const archetypeDef = ARCHETYPES[roomConfig.archetype] ?? ARCHETYPES.skeptic;
  const activityLabel =
    ACTIVITY_TYPE_LABELS[lesson.activityType ?? "lesson"];

  const hookPrompt = practice?.hookPrompt || slides.tape.prompt;
  const retryPrompt = practice?.retryPrompt || slides.mission.openingAttack;
  const targetMaxWords = practice?.targetMaxWords ?? 30;
  const currentWordCount = drillResponse.trim()
    ? drillResponse.trim().split(/\s+/).length
    : 0;
  const wordBudgetRatio = Math.min(
    100,
    Math.round((currentWordCount / Math.max(1, targetMaxWords)) * 100)
  );
  const isOverWordBudget = currentWordCount > targetMaxWords;

  function startMicRecording() {
    setMicError(null);
    const win =
      typeof window !== "undefined"
        ? (window as unknown as Record<string, unknown>)
        : null;
    const SpeechRecCtor = (win?.SpeechRecognition ||
      win?.webkitSpeechRecognition) as
      | (new () => SpeechRecognitionInstance)
      | undefined;

    if (!SpeechRecCtor) {
      setMicStatus("error");
      setMicError("Voice input is not supported in this browser. Type your response below.");
      setShowTypeInput(true);
      return;
    }

    try {
      const rec = new SpeechRecCtor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onresult = (event) => {
        const parts: string[] = [];
        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i];
          if (item && item[0]?.transcript) {
            parts.push(item[0].transcript);
          }
        }
        const text = parts.join(" ").trim();
        if (text) {
          setDrillResponse(text);
          setMicStatus("listening");
        }
      };

      rec.onerror = (event) => {
        setMicStatus("error");
        if (event?.error === "not-allowed") {
          setMicError("Microphone permission was denied. Type your response below.");
        } else {
          setMicError("Could not capture audio. Type your response below.");
        }
        setShowTypeInput(true);
      };

      rec.onend = () => {
        setMicStatus((prev) => (prev === "listening" ? "finished" : prev));
      };

      recognitionRef.current = rec;
      setMicStatus("listening");
      rec.start();
    } catch {
      setMicStatus("error");
      setMicError("Microphone could not be started. Type your response below.");
      setShowTypeInput(true);
    }
  }

  function stopMicRecording() {
    setMicStatus("processing");
    try {
      recognitionRef.current?.stop();
    } catch {}
    setMicStatus("finished");
  }

  function handleCheckDrillResponse() {
    stopMicRecording();
    const evaluated = evaluatePracticeAttempt(drillResponse, lesson);
    setEvaluation(evaluated);
    setStage(3);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-[var(--bg-base)] text-[var(--text-primary)] select-none overflow-hidden">
      {/* Overhead Electric Cobalt Arena Lighting Dome */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        <div
          className="absolute -top-36 left-1/2 -translate-x-1/2 w-[780px] h-[480px] rounded-full blur-[110px] opacity-40"
          style={{
            background:
              "radial-gradient(circle, var(--accent-soft) 0%, rgba(47,101,246,0.03) 45%, transparent 70%)",
          }}
        />
      </div>

      {/* Top Theater Bar & 4-Stage Progress Rail */}
      <header className="relative z-10 border-b border-[var(--border-subtle)] bg-[var(--surface-1)]/85 backdrop-blur-xl px-4 py-3 sm:px-8 shrink-0">
        <div className="mx-auto max-w-4xl space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={onBackToRoadmap}
                aria-label="Exit to roadmap"
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)]/80 px-3.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-white/25 hover:text-white active:scale-95"
              >
                <X className="h-3.5 w-3.5" />
                <span>Exit to roadmap</span>
              </button>

              <nav
                aria-label="Breadcrumb"
                className="hidden sm:flex items-center gap-2 text-xs min-w-0"
              >
                <span className="text-[var(--text-tertiary)] truncate">
                  {course.title}
                </span>
                <span className="text-white/20">/</span>
                <span className="font-semibold text-white truncate">
                  {lesson.title}
                </span>
              </nav>
            </div>

            <div className="flex items-center gap-2.5 text-xs">
              <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider text-[var(--text-secondary)]">
                {activityLabel}
              </span>
              <span className="inline-flex items-center gap-1 text-[var(--text-tertiary)] font-mono text-[11px]">
                <Clock className="h-3.5 w-3.5" />
                {lesson.durationMinutes}m
              </span>
              {isCompleted && (
                <span className="inline-flex items-center gap-1 text-emerald-400 font-medium text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Completed</span>
                </span>
              )}
            </div>
          </div>

          {/* 4-Stage Architectural Progress Rail */}
          <div
            role="tablist"
            aria-label="Lesson stages"
            className="grid grid-cols-4 gap-2 sm:gap-3"
          >
            {LESSON_STAGES.map((s) => {
              const active = stage === s.index;
              const passed = stage > s.index;
              return (
                <button
                  key={s.index}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStage(s.index)}
                  className={cn(
                    "flex flex-col gap-1.5 text-left transition-colors focus-visible:outline-none group py-0.5",
                    active
                      ? "text-white"
                      : passed
                      ? "text-[var(--text-secondary)] hover:text-white"
                      : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                  )}
                >
                  <div
                    className={cn(
                      "h-1.5 w-full rounded-full transition-all duration-200",
                      active
                        ? "bg-[var(--accent)] shadow-[0_0_12px_var(--accent-soft)]"
                        : passed
                        ? "bg-white/75"
                        : "bg-white/10 group-hover:bg-white/20"
                    )}
                  />
                  <span className="text-[11px] font-mono tracking-tight hidden sm:inline">
                    {s.label}
                  </span>
                  <span className="text-[10px] font-mono tracking-tight sm:hidden">
                    {s.short}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Full-Bleed Editorial Stage (No nested outer box) */}
      <main className="relative z-10 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-10 flex flex-col justify-center">
        <div className="mx-auto w-full max-w-4xl">
          {/* ─── STAGE 0: 1. REFLEX CHECK (The Pressure Test) ──────────────── */}
          {stage === 0 && (
            <section className="space-y-7 sm:space-y-8">
              {/* Editorial Challenge Quote Block */}
              <div className="space-y-4 border-l-2 border-[var(--accent)] pl-5 sm:pl-7">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-bold text-white">
                    {archetypeDef.initials}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-white">
                    {roomConfig.personaName}
                  </span>
                  <span className="text-white/25">·</span>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {archetypeDef.tagline}
                  </span>
                </div>

                <h1 className="text-xl sm:text-3xl font-bold leading-snug tracking-tight text-white">
                  “{hookPrompt}”
                </h1>

                <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                  Which instinct is fatal here? Compare the two responses below and lock in your read.
                </p>
              </div>

              {/* Two Heavyweight Architectural Slabs (A vs B) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Approach A Slab */}
                <button
                  type="button"
                  onClick={() => setSelectedInstinct("weak")}
                  className={cn(
                    "group relative rounded-2xl border p-5 sm:p-6 text-left transition-all duration-150 cursor-pointer flex flex-col justify-between gap-4",
                    selectedInstinct === "weak"
                      ? "border-amber-500/60 bg-[#14110B] shadow-[0_12px_32px_-12px_rgba(245,158,11,0.25)]"
                      : "border-[var(--border-subtle)] bg-[var(--surface-1)] hover:border-white/20 hover:bg-[var(--surface-2)]/80"
                  )}
                >
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-lg border font-mono text-xs font-bold transition-colors",
                            selectedInstinct === "weak"
                              ? "border-amber-400/50 bg-amber-500/20 text-amber-300"
                              : "border-white/15 bg-white/[0.04] text-[var(--text-secondary)] group-hover:text-white"
                          )}
                        >
                          A
                        </span>
                        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                          Approach A · {slides.tape.weakBadges?.[0] || "Instinctive Defense"}
                        </span>
                      </div>
                      {selectedInstinct === "weak" && (
                        <span className="rounded-md border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-300">
                          Amateur Trap
                        </span>
                      )}
                    </div>

                    <p className="text-sm sm:text-base leading-relaxed text-neutral-200">
                      “{slides.tape.weakResponse}”
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs">
                    <span className="text-[var(--text-tertiary)] font-mono">
                      {selectedInstinct === "weak" ? "● Selected" : "Tap to inspect"}
                    </span>
                    {slides.tape.weakBadges?.[1] && (
                      <span className="text-[11px] font-mono text-[var(--text-tertiary)]">
                        {slides.tape.weakBadges[1]}
                      </span>
                    )}
                  </div>
                </button>

                {/* Approach B Slab */}
                <button
                  type="button"
                  onClick={() => setSelectedInstinct("strong")}
                  className={cn(
                    "group relative rounded-2xl border p-5 sm:p-6 text-left transition-all duration-150 cursor-pointer flex flex-col justify-between gap-4",
                    selectedInstinct === "strong"
                      ? "border-[var(--accent)] bg-[#0B1326] shadow-[0_12px_32px_-12px_rgba(47,101,246,0.35)]"
                      : "border-[var(--border-subtle)] bg-[var(--surface-1)] hover:border-white/20 hover:bg-[var(--surface-2)]/80"
                  )}
                >
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-lg border font-mono text-xs font-bold transition-colors",
                            selectedInstinct === "strong"
                              ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                              : "border-white/15 bg-white/[0.04] text-[var(--text-secondary)] group-hover:text-white"
                          )}
                        >
                          B
                        </span>
                        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                          Approach B · {slides.tape.strongBadges?.[0] || "Executive Anchor"}
                        </span>
                      </div>
                      {selectedInstinct === "strong" && (
                        <span className="rounded-md border border-[var(--accent)] bg-[var(--accent)] px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
                          Executive Move
                        </span>
                      )}
                    </div>

                    <p className="text-sm sm:text-base font-medium leading-relaxed text-white">
                      “{slides.tape.strongResponse}”
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs">
                    <span className="text-[var(--text-tertiary)] font-mono">
                      {selectedInstinct === "strong" ? "● Selected" : "Tap to inspect"}
                    </span>
                    {slides.tape.strongBadges?.[1] && (
                      <span className="text-[11px] font-mono text-[var(--text-tertiary)]">
                        {slides.tape.strongBadges[1]}
                      </span>
                    )}
                  </div>
                </button>
              </div>

              {/* Editorial Verdict Reveal Strip */}
              {selectedInstinct === "weak" ? (
                <div className="rounded-2xl border border-amber-500/30 border-l-4 border-l-amber-400 bg-[var(--surface-1)] px-5 py-4 space-y-1">
                  <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-amber-300">
                    Why Approach A Fails Under Pressure
                  </p>
                  <p className="text-sm leading-relaxed text-neutral-200">
                    {slides.tape.weakCritique}
                  </p>
                </div>
              ) : selectedInstinct === "strong" ? (
                <div className="rounded-2xl border border-[var(--accent)]/40 border-l-4 border-l-[var(--accent)] bg-[var(--surface-1)] px-5 py-4 space-y-1">
                  <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">
                    Why Approach B Commands the Room
                  </p>
                  <p className="text-sm leading-relaxed text-white">
                    {slides.tape.strongWhy}
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-1)]/40 px-5 py-3.5 text-center font-mono text-xs text-[var(--text-tertiary)]">
                  Select Approach A or Approach B above to reveal the coach&apos;s tape read
                </div>
              )}
            </section>
          )}

          {/* ─── STAGE 1: 2. TACTICAL MODEL (Golden Rule & Execution Steps) ─── */}
          {stage === 1 && (
            <section className="space-y-7">
              {/* Top Hero: The Golden Rule Editorial Statement */}
              <div className="rounded-2xl border border-[var(--border-subtle)] border-l-4 border-l-[var(--accent)] bg-[var(--surface-1)] p-6 sm:p-7 space-y-2.5 shadow-lg">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
                    THE GOLDEN RULE · {slides.mentalModel.headline}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold leading-snug tracking-tight text-white">
                  “{slides.mentalModel.goldenRule}”
                </h2>
                {slides.mentalModel.body && (
                  <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                    {slides.mentalModel.body}
                  </p>
                )}
              </div>

              {/* Asymmetric Split: Visual Diagram Frame + 3 Execution Steps */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                {/* Left: Architectural Diagram Stage */}
                <div className="lg:col-span-7 rounded-2xl border border-[var(--border-subtle)] bg-[#07090E] p-4 sm:p-6 flex flex-col justify-center">
                  {renderVisual ? (
                    renderVisual(slides.mentalModel.visual || slides.trap.visual)
                  ) : (
                    <div className="py-12 text-center font-mono text-xs text-[var(--text-tertiary)]">
                      Tactical Diagram Stage
                    </div>
                  )}
                </div>

                {/* Right: 3 Numbered Execution Milestones */}
                <div className="lg:col-span-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 sm:p-6 flex flex-col justify-between space-y-4">
                  <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                    How to Execute It
                  </p>

                  <div className="space-y-4 flex-1 flex flex-col justify-center">
                    {(slides.mentalModel.steps ?? []).map((step, idx) => (
                      <div
                        key={step.step ?? idx}
                        className="flex items-start gap-3.5 border-b border-white/[0.06] pb-3.5 last:border-b-0 last:pb-0"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--accent)]/40 bg-[var(--accent-soft)]/20 font-mono text-xs font-bold text-[var(--accent)]">
                          0{idx + 1}
                        </span>
                        <div className="space-y-0.5 min-w-0">
                          <p className="text-sm font-semibold text-white">
                            {step.label}
                          </p>
                          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                            {step.detail}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ─── STAGE 2: 3. SPEAKING DRILL (Recessed Studio Console) ──────── */}
          {stage === 2 && (
            <section className="space-y-6">
              {/* Challenge Teleprompter Header */}
              <div className="space-y-3 border-l-2 border-[var(--accent)] pl-5 sm:pl-7">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
                    CHAMBER WARM-UP REP
                  </span>
                  <span className="text-white/20">·</span>
                  <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2.5 py-0.5 font-mono text-[11px] text-white">
                    TARGET ≤ {targetMaxWords} WORDS
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-bold leading-snug tracking-tight text-white">
                  “{retryPrompt}”
                </h2>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                  Rule in effect: <span className="text-white font-medium">{slides.mentalModel.goldenRule}</span>
                </p>
              </div>

              {/* Recessed Studio Recording Console */}
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[#07090E] p-5 sm:p-7 space-y-6 shadow-2xl">
                {/* Top Console Bar: Status + Live Word Budget Bar */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span
                      className={cn(
                        "inline-flex items-center gap-2 font-semibold uppercase tracking-wider",
                        micStatus === "listening"
                          ? "text-[var(--accent)]"
                          : "text-[var(--text-secondary)]"
                      )}
                    >
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          micStatus === "listening"
                            ? "bg-[var(--accent)] animate-ping"
                            : drillResponse
                            ? "bg-emerald-400"
                            : "bg-white/25"
                        )}
                      />
                      {micStatus === "listening"
                        ? "Recording Live Audio..."
                        : drillResponse
                        ? "Response Captured"
                        : "Studio Mic Ready"}
                    </span>

                    <span
                      className={cn(
                        "tabular-nums font-semibold",
                        isOverWordBudget ? "text-amber-400" : "text-white"
                      )}
                    >
                      {currentWordCount} / {targetMaxWords} words
                    </span>
                  </div>

                  {/* Live Word Economy Gauge */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-200",
                        isOverWordBudget
                          ? "bg-amber-400"
                          : "bg-[var(--accent)] shadow-[0_0_10px_var(--accent-soft)]"
                      )}
                      style={{ width: `${wordBudgetRatio}%` }}
                    />
                  </div>
                </div>

                {/* Center Teleprompter Transcript Surface */}
                <div className="min-h-[104px] rounded-xl border border-white/[0.07] bg-[var(--surface-1)]/80 p-4 sm:p-5 flex flex-col justify-center">
                  {showTypeInput ? (
                    <textarea
                      rows={3}
                      value={drillResponse}
                      onChange={(e) => setDrillResponse(e.target.value)}
                      placeholder={`Deliver your response in ${targetMaxWords} words or fewer...`}
                      className="w-full resize-none bg-transparent text-sm sm:text-base text-white placeholder:text-[var(--text-tertiary)] focus:outline-none leading-relaxed"
                    />
                  ) : drillResponse ? (
                    <p className="text-base sm:text-lg font-medium leading-relaxed text-white">
                      “{drillResponse}”
                    </p>
                  ) : (
                    <p className="text-center text-sm text-[var(--text-tertiary)]">
                      Tap the microphone below and speak your response aloud. Your live transcript will appear here.
                    </p>
                  )}
                </div>

                {/* Bottom Studio Control Deck */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowTypeInput((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--text-secondary)] hover:text-white transition-colors"
                  >
                    <Keyboard className="h-3.5 w-3.5" />
                    {showTypeInput ? "Hide keyboard input" : "Or type response manually"}
                  </button>

                  <div className="flex items-center gap-3">
                    {drillResponse && micStatus !== "listening" && (
                      <button
                        type="button"
                        onClick={() => setDrillResponse("")}
                        className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3.5 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-white transition-colors"
                      >
                        Clear
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={micStatus === "listening" ? stopMicRecording : startMicRecording}
                      aria-label={micStatus === "listening" ? "Stop recording" : "Speak response"}
                      className={cn(
                        "inline-flex items-center gap-2.5 rounded-full px-6 py-3 text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95",
                        micStatus === "listening"
                          ? "bg-[var(--accent)] text-white shadow-[0_0_28px_rgba(47,101,246,0.55)] ring-4 ring-[var(--accent)]/30"
                          : "bg-white text-[#0A0D14] hover:bg-neutral-200"
                      )}
                    >
                      {micStatus === "listening" ? (
                        <>
                          <Square className="h-4 w-4 fill-current" />
                          <span>Stop Recording</span>
                        </>
                      ) : (
                        <>
                          <Mic className="h-4 w-4" />
                          <span>{drillResponse ? "Re-Record Voice" : "Tap to Speak"}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {micError && (
                  <p className="text-center text-xs text-amber-300 font-mono">
                    {micError}
                  </p>
                )}
              </div>
            </section>
          )}

          {/* ─── STAGE 3: 4. BREAKDOWN (Executive Tape Dossier) ────────────── */}
          {stage === 3 && (
            <section className="space-y-6">
              {/* Dossier Header */}
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
                <div>
                  <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
                    TAPE EVALUATION DOSSIER
                  </span>
                  <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-white">
                    {evaluation?.passedCriteriaCount === evaluation?.totalCriteriaCount
                      ? "Lesson Mastered"
                      : "Attempt Completed"}
                  </h2>
                </div>

                {/* 3 Precision Telemetry Chips */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3.5 py-2">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] block">
                      Directness
                    </span>
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        evaluation?.hasDirectOpening ? "text-emerald-400" : "text-amber-400"
                      )}
                    >
                      {evaluation?.hasDirectOpening ? "Direct Start" : "Stalled Opener"}
                    </span>
                  </div>

                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3.5 py-2">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] block">
                      Word Economy
                    </span>
                    <span className="text-xs font-semibold font-mono text-white tabular-nums">
                      {evaluation?.wordCount ?? 0} / {targetMaxWords}w
                    </span>
                  </div>

                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3.5 py-2">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] block">
                      Clean Speech
                    </span>
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        (evaluation?.detectedHedges.length ?? 0) === 0
                          ? "text-emerald-400"
                          : "text-amber-400"
                      )}
                    >
                      {(evaluation?.detectedHedges.length ?? 0) === 0
                        ? "0 Hedges"
                        : `${evaluation?.detectedHedges.length} Hedges`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Side-by-Side Tape Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 space-y-2.5">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
                    Your Recorded Tape
                  </span>
                  <p className="text-sm sm:text-base leading-relaxed text-neutral-200 italic">
                    “{drillResponse || "No response provided"}”
                  </p>
                </div>

                <div className="rounded-2xl border border-[var(--accent)]/40 bg-[#0B1326] p-5 space-y-2.5">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] block">
                    Executive Benchmark
                  </span>
                  <p className="text-sm sm:text-base font-medium leading-relaxed text-white">
                    “{evaluation?.suggestedRewrite || slides.tape.strongResponse}”
                  </p>
                </div>
              </div>

              {/* Coach Takeaway & Live Chamber Handoff */}
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="rounded-md bg-[var(--accent-soft)]/25 border border-[var(--accent)]/40 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] shrink-0 mt-0.5">
                    Coach Note
                  </span>
                  <p className="text-sm text-neutral-200 leading-relaxed">
                    {evaluation?.toImprove || evaluation?.didWell || "Keep delivery sharp and direct."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-xs text-[var(--text-secondary)]">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                    <span className="font-mono text-[11px] uppercase tracking-wider text-white font-semibold">
                      {roomConfig.experience === "drill"
                        ? `Live Drill Chamber · ${roomConfig.drillTarget?.replace(/-/g, " ") || "Precision"}`
                        : "Live Q&A Chamber · Multi-Turn Defense"}
                    </span>
                  </div>
                  <span>
                    Ready to test this live against {roomConfig.personaName}?
                  </span>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Bottom Sticky Action Deck */}
      <footer className="relative z-10 border-t border-[var(--border-subtle)] bg-[var(--surface-1)]/90 backdrop-blur-xl px-4 py-3.5 sm:px-8 shrink-0">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          {stage === 0 && (
            <>
              <button
                type="button"
                onClick={() => setStage(1)}
                className="text-xs font-medium text-[var(--text-secondary)] hover:text-white transition-colors"
              >
                Skip reflex →
              </button>

              <Button
                type="button"
                onClick={() => setStage(1)}
                className="rounded-full bg-white px-7 h-10 text-[#0A0D14] text-xs sm:text-sm font-bold hover:bg-neutral-200 active:translate-y-[3px] transition-all"
                style={{ boxShadow: "0 4px 0 #CBD5E1" }}
              >
                Continue
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </>
          )}

          {stage === 1 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStage(0)}
                className="rounded-full border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs text-[var(--text-secondary)] hover:text-white px-4 h-10"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Back
              </Button>

              <Button
                onClick={() => setStage(2)}
                className="rounded-full bg-white px-7 h-10 text-[#0A0D14] text-xs sm:text-sm font-bold hover:bg-neutral-200 active:translate-y-[3px] transition-all"
                style={{ boxShadow: "0 4px 0 #CBD5E1" }}
              >
                Try Speaking Drill
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </>
          )}

          {stage === 2 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStage(1)}
                className="rounded-full border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs text-[var(--text-secondary)] hover:text-white px-4 h-10"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Back
              </Button>

              <Button
                disabled={drillResponse.trim().length === 0}
                onClick={handleCheckDrillResponse}
                className="rounded-full bg-white px-7 h-10 text-[#0A0D14] text-xs sm:text-sm font-bold hover:bg-neutral-200 disabled:opacity-40 active:translate-y-[3px] transition-all"
                style={{ boxShadow: "0 4px 0 #CBD5E1" }}
              >
                Check Response
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </>
          )}

          {stage === 3 && (
            <>
              <div className="flex items-center gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDrillResponse("");
                    setStage(2);
                  }}
                  className="rounded-full border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs text-[var(--text-secondary)] hover:text-white px-4 h-10"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Try Another Rep
                </Button>

                {onLaunchChamber && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={launchingChamber}
                    onClick={() =>
                      onLaunchChamber(course, lesson, {
                        responseText: drillResponse,
                        passedCriteriaCount: evaluation?.passedCriteriaCount,
                        totalCriteriaCount: evaluation?.totalCriteriaCount,
                      })
                    }
                    className="rounded-full border-[var(--accent)]/50 bg-[var(--accent-soft)]/20 text-xs font-semibold text-white hover:bg-[var(--accent-soft)]/35 px-4 h-10"
                  >
                    <Swords className="mr-1.5 h-3.5 w-3.5 text-[var(--accent)]" />
                    Live Chamber
                  </Button>
                )}
              </div>

              <Button
                onClick={() => {
                  onCompleteLesson(course.id, lesson.id);
                  onBackToRoadmap();
                }}
                className="rounded-full bg-white px-7 h-10 text-[#0A0D14] text-xs sm:text-sm font-bold hover:bg-neutral-200 active:translate-y-[3px] transition-all"
                style={{ boxShadow: "0 4px 0 #CBD5E1" }}
              >
                Complete Lesson
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
