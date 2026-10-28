"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Mic,
  Play,
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
} from "@/lib/courses";

export type LessonStageIndex = 0 | 1 | 2 | 3;

const LESSON_STAGES: Array<{
  index: LessonStageIndex;
  label: string;
  short: string;
}> = [
  { index: 0, label: "1. Reflex Check", short: "1. Reflex" },
  { index: 1, label: "2. Tactical Model", short: "2. Model" },
  { index: 2, label: "3. Speaking Drill", short: "3. Drill" },
  { index: 3, label: "4. Breakdown", short: "4. Score" },
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
    lesson: CourseLesson
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

  // Slide 1 Instinct Choice
  const [selectedInstinct, setSelectedInstinct] = useState<"weak" | "strong" | null>(null);

  // Slide 3 Speaking Drill Response & Mic
  const [drillResponse, setDrillResponse] = useState("");
  const [showTypeInput, setShowTypeInput] = useState(false);
  const [micStatus, setMicStatus] = useState<MicStatus>("ready");
  const [micError, setMicError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Slide 4 Evaluation State
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
      setMicError("Voice input is not supported in this browser. Please type below.");
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
          setMicError("Microphone permission was denied. Please type below.");
        } else {
          setMicError("Could not capture audio. Please type below.");
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
      setMicError("Microphone could not be started. Please type below.");
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
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-[#070707] text-white select-none overflow-hidden">
      {/* Top Theater Header (Compact) */}
      <header className="border-b border-[#1a1a1a] bg-[#0a0a0a]/95 backdrop-blur-xl px-4 py-3 sm:px-6 shrink-0">
        <div className="mx-auto max-w-4xl space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={onBackToRoadmap}
                aria-label="Exit to roadmap"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:border-white/25 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <X className="h-3.5 w-3.5" />
                <span>Exit to roadmap</span>
              </button>

              <nav
                aria-label="Breadcrumb"
                className="hidden sm:flex items-center gap-2 text-xs min-w-0"
              >
                <span className="text-neutral-400 truncate">
                  {course.title}
                </span>
                <span className="text-neutral-600">/</span>
                <span className="font-semibold text-white truncate">
                  {lesson.title}
                </span>
              </nav>
            </div>

            <div className="flex items-center gap-2.5 text-xs text-neutral-300">
              <span className="rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-0.5 text-xs font-mono text-neutral-300">
                {activityLabel}
              </span>
              <span className="inline-flex items-center gap-1 text-neutral-400">
                <Clock className="h-3.5 w-3.5 text-neutral-400" />
                {lesson.durationMinutes} min
              </span>
              {isCompleted && (
                <span className="inline-flex items-center gap-1 text-white font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Completed
                </span>
              )}
            </div>
          </div>

          {/* Brilliant-Style Segmented Progress Bar */}
          <div
            role="tablist"
            aria-label="Lesson stages"
            className="grid grid-cols-4 gap-2"
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
                    "flex flex-col gap-1 text-left transition-colors focus-visible:outline-none",
                    active
                      ? "text-white font-semibold"
                      : passed
                      ? "text-neutral-300"
                      : "text-neutral-500 hover:text-neutral-300"
                  )}
                >
                  <div
                    className={cn(
                      "h-1.5 w-full rounded-full transition-colors",
                      active
                        ? "bg-white"
                        : passed
                        ? "bg-white/60"
                        : "bg-white/10"
                    )}
                  />
                  <span className="text-[11px] hidden sm:inline">{s.label}</span>
                  <span className="text-[11px] sm:hidden">{s.short}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Centered Presentation Folio with Zero-Scroll Sizing */}
      <div className="mx-auto flex w-full max-w-4xl flex-1 items-center justify-center p-3 sm:p-6 overflow-hidden">
        <div className="w-full h-full max-h-[580px] rounded-3xl border border-white/10 bg-[#121212] p-5 sm:p-7 flex flex-col justify-between relative shadow-2xl overflow-hidden">
          {/* Zero-Scroll Stage Body */}
          <div className="flex-1 flex flex-col justify-between overflow-hidden pb-3">
            {/* SLIDE 1: THE PRESSURE TEST (Hook & Reflex Check) */}
            {stage === 0 && (
              <section className="flex-1 flex flex-col justify-between py-1">
                {/* Header: Panelist prompt */}
                <div className="space-y-2 text-center max-w-xl mx-auto">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-1 text-xs text-neutral-300">
                    <span className="font-semibold text-white">{roomConfig.personaName}</span>
                    <span className="text-neutral-500">·</span>
                    <span className="text-neutral-400">{archetypeDef.tagline}</span>
                  </div>

                  <h1 className="text-xl sm:text-2xl font-bold leading-snug tracking-tight text-white line-clamp-2">
                    “{hookPrompt}”
                  </h1>
                  <p className="text-xs sm:text-sm text-neutral-400 font-medium">
                    Which instinct is fatal here? Pick one to test your intuition.
                  </p>
                </div>

                {/* 2 Bite-Sized Choice Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto w-full py-2">
                  {/* Option A: Weak */}
                  <button
                    type="button"
                    onClick={() => setSelectedInstinct("weak")}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer active:scale-[0.98] flex flex-col justify-between space-y-2 shadow-lg",
                      selectedInstinct === "weak"
                        ? "border-white/50 bg-[#161616] ring-1 ring-white/30"
                        : "border-white/10 bg-[#121212] hover:border-white/25 hover:bg-[#141414]"
                    )}
                  >
                    <div className="space-y-1">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block">
                        Approach A · {slides.tape.weakBadges?.[0] || "Defend with Optimism"}
                      </span>
                      <p className="text-xs sm:text-sm text-neutral-200 line-clamp-2">
                        “{slides.tape.weakResponse}”
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold text-neutral-400">
                      {selectedInstinct === "weak" ? "Amateur Trap" : "Select this reflex"}
                    </span>
                  </button>

                  {/* Option B: Strong */}
                  <button
                    type="button"
                    onClick={() => setSelectedInstinct("strong")}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer active:scale-[0.98] flex flex-col justify-between space-y-2 shadow-lg",
                      selectedInstinct === "strong"
                        ? "border-white bg-[#181818] ring-1 ring-white/50 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                        : "border-white/10 bg-[#121212] hover:border-white/25 hover:bg-[#141414]"
                    )}
                  >
                    <div className="space-y-1">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-neutral-300 block">
                        Approach B · {slides.tape.strongBadges?.[0] || "Anchor on the Floor"}
                      </span>
                      <p className="text-xs sm:text-sm text-white font-medium line-clamp-2">
                        “{slides.tape.strongResponse}”
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold text-neutral-300">
                      {selectedInstinct === "strong" ? "Executive Move" : "Select this reflex"}
                    </span>
                  </button>
                </div>

                {/* Instant Micro-Feedback Callout */}
                <div className="min-h-[56px] max-w-2xl mx-auto w-full flex items-center">
                  {selectedInstinct === "weak" ? (
                    <div className="w-full rounded-xl border border-white/20 bg-white/[0.04] p-3 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 font-bold shrink-0 mt-0.5">
                        AMATEUR TRAP:
                      </span>
                      <span className="text-neutral-200">{slides.tape.weakCritique}</span>
                    </div>
                  ) : selectedInstinct === "strong" ? (
                    <div className="w-full rounded-xl border border-white/30 bg-white/[0.06] p-3 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-white font-bold shrink-0 mt-0.5">
                        EXECUTIVE MOVE:
                      </span>
                      <span className="text-white">{slides.tape.strongWhy}</span>
                    </div>
                  ) : (
                    <div className="w-full text-center text-xs text-neutral-500 font-mono">
                      Tap Approach A or B to test your reflex before continuing
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* SLIDE 2: TACTICAL GEOMETRY (Visual Mental Model) */}
            {stage === 1 && (
              <section className="flex-1 flex flex-col justify-between py-1">
                {/* Header */}
                <div className="space-y-1 text-center max-w-xl mx-auto">
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-400 font-semibold">
                    TACTICAL GEOMETRY
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white line-clamp-1">
                    {slides.mentalModel.headline}
                  </h2>
                </div>

                {/* Centerpiece: Tactical Visual SVG Diagram */}
                <div className="w-full max-w-lg mx-auto py-1 flex items-center justify-center">
                  {renderVisual ? (
                    renderVisual(slides.mentalModel.visual || slides.trap.visual)
                  ) : (
                    <div className="rounded-xl border border-white/10 bg-[#0e0e0e] p-6 text-center text-xs text-neutral-400">
                      Tactical Framework Diagram
                    </div>
                  )}
                </div>

                {/* Golden Rule Card */}
                <div className="max-w-xl mx-auto w-full rounded-2xl border border-white/15 bg-white/[0.04] p-4 text-center space-y-1 shadow-md">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                    THE GOLDEN RULE
                  </p>
                  <p className="text-sm sm:text-base font-bold text-white leading-snug">
                    “{slides.mentalModel.goldenRule}”
                  </p>
                </div>
              </section>
            )}

            {/* SLIDE 3: SPEAKING DRILL (Voice / Text Practice Rep) */}
            {stage === 2 && (
              <section className="flex-1 flex flex-col justify-between py-1">
                {/* Header & Prompt */}
                <div className="space-y-2 text-center max-w-xl mx-auto">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-400 font-semibold">
                      SPEAKING DRILL · TARGET ≤ {targetMaxWords} WORDS
                    </span>
                  </div>

                  <h2 className="text-lg sm:text-xl font-bold leading-snug tracking-tight text-white line-clamp-2">
                    “{retryPrompt}”
                  </h2>
                  <p className="text-xs text-neutral-400">
                    Deliver your answer applying the Golden Rule.
                  </p>
                </div>

                {/* Centerpiece: Tactile Pulsing Mic Button */}
                <div className="flex flex-col items-center justify-center space-y-3 py-2">
                  <button
                    type="button"
                    onClick={micStatus === "listening" ? stopMicRecording : startMicRecording}
                    aria-label={micStatus === "listening" ? "Stop recording" : "Speak response"}
                    className={cn(
                      "relative flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full border transition-all duration-300 active:scale-95 cursor-pointer shadow-2xl",
                      micStatus === "listening"
                        ? "border-white bg-white text-black shadow-[0_0_35px_rgba(255,255,255,0.45)] animate-pulse"
                        : "border-white/20 bg-white/[0.06] text-white hover:border-white/40 hover:bg-white/[0.1] shadow-lg"
                    )}
                  >
                    {micStatus === "listening" ? (
                      <Square className="h-8 w-8 fill-current" />
                    ) : (
                      <Mic className="h-8 w-8" />
                    )}
                  </button>

                  <div className="text-center space-y-1">
                    <p className="font-mono text-xs font-semibold text-neutral-300">
                      {micStatus === "listening"
                        ? "● Listening... tap when finished"
                        : micStatus === "processing"
                        ? "Processing audio..."
                        : drillResponse
                        ? "Tap mic to re-record"
                        : "Tap mic to speak response"}
                    </p>

                    {/* Word Counter Badge */}
                    <div className="inline-flex items-center gap-1.5 font-mono text-xs text-neutral-400">
                      <span>{drillResponse.trim() ? drillResponse.trim().split(/\s+/).length : 0}</span>
                      <span>/</span>
                      <span>{targetMaxWords} words</span>
                    </div>
                  </div>

                  {/* Display Captured Response */}
                  {drillResponse ? (
                    <div className="w-full max-w-lg rounded-xl border border-white/10 bg-[#0a0a0a] p-3 text-center">
                      <p className="text-xs sm:text-sm text-neutral-200 italic line-clamp-2">
                        “{drillResponse}”
                      </p>
                    </div>
                  ) : null}

                  {/* Type Toggle or Input */}
                  {showTypeInput ? (
                    <div className="w-full max-w-lg">
                      <input
                        type="text"
                        value={drillResponse}
                        onChange={(e) => setDrillResponse(e.target.value)}
                        placeholder={`Deliver answer under ${targetMaxWords} words...`}
                        className="w-full rounded-xl border border-white/15 bg-[#0a0a0a] px-4 py-2.5 text-xs sm:text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-white/40"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowTypeInput(true)}
                      className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors underline-offset-4 hover:underline"
                    >
                      Or type your response
                    </button>
                  )}
                </div>

                {/* Mic Error Callout */}
                {micError && (
                  <div className="max-w-lg mx-auto w-full text-center text-xs text-neutral-400">
                    {micError}
                  </div>
                )}
              </section>
            )}

            {/* SLIDE 4: INSTANT BREAKDOWN & SCORE */}
            {stage === 3 && (
              <section className="flex-1 flex flex-col justify-between py-1">
                {/* Header */}
                <div className="text-center space-y-1 max-w-xl mx-auto">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-bold">
                    PERFORMANCE BREAKDOWN
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                    {evaluation?.passedCriteriaCount === evaluation?.totalCriteriaCount
                      ? "Lesson Mastered"
                      : "Attempt Completed"}
                  </h2>
                </div>

                {/* 3 Metric Pills */}
                <div className="grid grid-cols-3 gap-2.5 max-w-xl mx-auto w-full">
                  {/* Directness */}
                  <div className="rounded-xl border border-white/10 bg-[#141414] p-3 text-center">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-400 block">
                      Directness
                    </span>
                    <span className={cn(
                      "text-xs sm:text-sm font-semibold truncate block mt-0.5",
                      evaluation?.hasDirectOpening ? "text-white" : "text-neutral-400"
                    )}>
                      {evaluation?.hasDirectOpening ? "Direct Start" : "Stalled Opener"}
                    </span>
                  </div>

                  {/* Concision */}
                  <div className="rounded-xl border border-white/10 bg-[#141414] p-3 text-center">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-400 block">
                      Concision
                    </span>
                    <span className="text-xs sm:text-sm font-semibold font-mono text-white truncate block mt-0.5 tabular-nums">
                      {evaluation?.wordCount ?? 0}/{targetMaxWords}w
                    </span>
                  </div>

                  {/* Clean Speech */}
                  <div className="rounded-xl border border-white/10 bg-[#141414] p-3 text-center">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-400 block">
                      Clean Speech
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-white truncate block mt-0.5">
                      {(evaluation?.detectedHedges.length ?? 0) === 0 ? "0 Hedges" : `${evaluation?.detectedHedges.length} Hedges`}
                    </span>
                  </div>
                </div>

                {/* Side-by-Side Comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto w-full">
                  <div className="rounded-xl border border-white/10 bg-[#0e0e0e] p-3 space-y-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 block">
                      Your Delivery
                    </span>
                    <p className="text-xs text-neutral-300 italic line-clamp-2">
                      “{drillResponse || "No response provided"}”
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/20 bg-white/[0.04] p-3 space-y-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-white font-semibold block">
                      Executive Benchmark
                    </span>
                    <p className="text-xs text-white font-medium line-clamp-2">
                      “{evaluation?.suggestedRewrite || slides.tape.strongResponse}”
                    </p>
                  </div>
                </div>

                {/* Takeaway Insight */}
                <div className="max-w-xl mx-auto w-full rounded-xl border border-white/10 bg-[#141414] p-3 text-xs text-neutral-300 flex items-start gap-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-neutral-400 shrink-0 mt-0.5">
                    TAKEAWAY:
                  </span>
                  <span className="line-clamp-2">
                    {evaluation?.toImprove || evaluation?.didWell || "Keep delivery sharp and direct."}
                  </span>
                </div>
              </section>
            )}
          </div>

          {/* Pinned Bottom Action Footer Inside Folio (Zero-Scroll Controls) */}
          <footer className="border-t border-white/[0.08] pt-3 shrink-0 flex items-center justify-between">
            {stage === 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setStage(1)}
                  className="text-xs font-medium text-neutral-400 hover:text-white transition-colors"
                >
                  Skip reflex →
                </button>

                <Button
                  type="button"
                  onClick={() => setStage(1)}
                  className="rounded-full bg-white text-black hover:bg-neutral-200 text-xs sm:text-sm font-semibold px-6 py-2.5 h-10 shadow-md"
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
                  className="rounded-full border-white/15 bg-transparent text-xs text-neutral-300 px-4 h-9"
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Back
                </Button>

                <Button
                  size="sm"
                  onClick={() => setStage(2)}
                  className="rounded-full bg-white text-black hover:bg-neutral-200 text-xs sm:text-sm font-semibold px-6 h-9 shadow-md"
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
                  className="rounded-full border-white/15 bg-transparent text-xs text-neutral-300 px-4 h-9"
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Back
                </Button>

                <Button
                  size="sm"
                  disabled={drillResponse.trim().length === 0}
                  onClick={handleCheckDrillResponse}
                  className="rounded-full bg-white text-black hover:bg-neutral-200 text-xs sm:text-sm font-semibold px-6 h-9 shadow-md disabled:opacity-40"
                >
                  Check Response
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </>
            )}

            {stage === 3 && (
              <>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDrillResponse("");
                      setStage(2);
                    }}
                    className="rounded-full border-white/15 bg-transparent text-xs text-neutral-300 px-4 h-9"
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Try Another Rep
                  </Button>

                  {onLaunchChamber && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={launchingChamber}
                      onClick={() => onLaunchChamber(course, lesson)}
                      className="rounded-full border-white/15 bg-white/[0.04] text-xs text-neutral-200 hover:text-white px-3.5 h-9"
                    >
                      <Swords className="mr-1.5 h-3.5 w-3.5" />
                      Live Chamber
                    </Button>
                  )}
                </div>

                <Button
                  size="sm"
                  onClick={() => {
                    onCompleteLesson(course.id, lesson.id);
                    onBackToRoadmap();
                  }}
                  className="rounded-full bg-white text-black hover:bg-neutral-200 text-xs sm:text-sm font-semibold px-6 h-9 shadow-md"
                >
                  Complete Lesson
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </>
            )}
          </footer>
        </div>
      </div>
    </div>
  );
}
