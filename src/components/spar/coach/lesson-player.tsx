"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Mic,
  MicOff,
  Play,
  Square,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ARCHETYPES } from "@/lib/personas";
import {
  ACTIVITY_TYPE_LABELS,
  SPAR_SIGNATURE_HEADLINE,
  SPAR_SIGNATURE_MANIFESTO,
  evaluatePracticeAttempt,
  getRealWorldChallenge,
  type Course,
  type CourseLesson,
  type SlideVisualMedia,
} from "@/lib/courses";
import { LessonFeedback } from "./lesson-feedback";

export type LessonStageIndex = 0 | 1 | 2 | 3;

const LESSON_STAGES: Array<{
  index: LessonStageIndex;
  label: string;
  short: string;
}> = [
  { index: 0, label: "1. Scenario & Attempt", short: "1. Attempt" },
  { index: 1, label: "2. Core Principle", short: "2. Principle" },
  { index: 2, label: "3. Demonstration", short: "3. Demo" },
  { index: 3, label: "4. Retry & Feedback", short: "4. Feedback" },
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

  const [initialAttempt, setInitialAttempt] = useState("");
  const [retryAttempt, setRetryAttempt] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);

  // Microphone recording state
  const [micStatus, setMicStatus] = useState<MicStatus>("ready");
  const [micError, setMicError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

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

  const hookContext =
    practice?.hookContext ||
    `${course.title} · Scenario with ${roomConfig.personaName}`;
  const hookSpeaker =
    practice?.hookSpeaker ||
    slides.tape.speakerName ||
    `${roomConfig.personaName} · ${archetypeDef.tagline}`;
  const hookPrompt = practice?.hookPrompt || slides.tape.prompt;
  const timeLimitSeconds = practice?.timeLimitSeconds ?? 30;

  const retryContext =
    practice?.retryContext ||
    `New Situation · Apply ${slides.mentalModel.headline}`;
  const retryPrompt = practice?.retryPrompt || slides.mission.openingAttack;
  const differenceSummary =
    practice?.differenceSummary ||
    slides.tape.differenceSummary ||
    slides.tape.strongWhy;

  function startMicRecording(target: "initial" | "retry") {
    setMicError(null);
    const win = typeof window !== "undefined" ? (window as unknown as Record<string, unknown>) : null;
    const SpeechRecCtor = (win?.SpeechRecognition ||
      win?.webkitSpeechRecognition) as (new () => SpeechRecognitionInstance) | undefined;

    if (!SpeechRecCtor) {
      setMicStatus("error");
      setMicError(
        "Browser speech recognition is unavailable in this browser. Type your response below."
      );
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
        if (target === "initial") {
          setInitialAttempt(text);
        } else {
          setRetryAttempt(text);
        }
      };

      rec.onerror = (event) => {
        setMicStatus("error");
        if (event.error === "not-allowed") {
          setMicError(
            "Microphone permission was denied. Type your response below."
          );
        } else {
          setMicError(
            "Could not capture audio. You can type your response directly below."
          );
        }
      };

      rec.onend = () => {
        setMicStatus((prev) => (prev === "listening" ? "finished" : prev));
      };

      recognitionRef.current = rec;
      setMicStatus("listening");
      rec.start();
    } catch {
      setMicStatus("error");
      setMicError(
        "Microphone could not be started. Type your response below."
      );
    }
  }

  function stopMicRecording() {
    setMicStatus("processing");
    try {
      recognitionRef.current?.stop();
    } catch {}
    setMicStatus("finished");
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onBackToRoadmap();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBackToRoadmap]);

  const activeResponseToEvaluate =
    retryAttempt.trim() || initialAttempt.trim();
  const evaluation = evaluatePracticeAttempt(activeResponseToEvaluate, lesson);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={lesson.title}
      className="fixed inset-0 z-50 flex flex-col bg-[#070707] overflow-hidden"
    >
      {/* Full-Screen Sticky Theater Top Bar */}
      <header className="sticky top-0 z-20 border-b border-[#1a1a1a] bg-[#0a0a0a]/95 backdrop-blur-md shrink-0">
        <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6 space-y-2.5">
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
        <div className="w-full h-full max-h-[620px] rounded-3xl border border-white/10 bg-[#121212] p-5 sm:p-7 flex flex-col justify-between relative shadow-2xl overflow-hidden">
          {/* Zero-Scroll Stage Body */}
          <div className="flex-1 flex flex-col justify-between overflow-hidden pb-3">
            {/* STAGE 0: HOOK & INITIAL ATTEMPT (Think & Speak First) */}
            {stage === 0 && (
              <section className="flex-1 flex flex-col justify-between space-y-3">
                {/* Context & Main Question */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                      {hookContext} · {hookSpeaker}
                    </span>
                    <span className="text-[11px] font-mono text-neutral-400">
                      Target: ≤ {practice?.targetMaxWords ?? 35} words
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold leading-snug tracking-tight text-white line-clamp-2">
                    “{hookPrompt}”
                  </h1>
                  <p className="text-xs sm:text-sm text-neutral-300">
                    How would you answer right now? Pick an approach or speak your response.
                  </p>
                </div>

                {/* Optional Quick Reflex Starters */}
                {slides.tape.weakResponse && slides.tape.strongResponse && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                      Choose your reflex (or speak custom below):
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setInitialAttempt(slides.tape.weakResponse)}
                        className={cn(
                          "rounded-xl border p-3 text-left text-xs transition-all",
                          initialAttempt === slides.tape.weakResponse
                            ? "border-white bg-white/10 text-white font-medium"
                            : "border-white/10 bg-[#101010] text-neutral-300 hover:border-white/20 hover:bg-[#141414] hover:text-white"
                        )}
                      >
                        <span className="font-mono text-[9px] text-neutral-400 block mb-0.5">
                          Approach A
                        </span>
                        <p className="line-clamp-2">
                          “{slides.tape.weakResponse}”
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setInitialAttempt(slides.tape.strongResponse)}
                        className={cn(
                          "rounded-xl border p-3 text-left text-xs transition-all",
                          initialAttempt === slides.tape.strongResponse
                            ? "border-white bg-white/10 text-white font-medium"
                            : "border-white/10 bg-[#101010] text-neutral-300 hover:border-white/20 hover:bg-[#141414] hover:text-white"
                        )}
                      >
                        <span className="font-mono text-[9px] text-neutral-400 block mb-0.5">
                          Approach B
                        </span>
                        <p className="line-clamp-2">
                          “{slides.tape.strongResponse}”
                        </p>
                      </button>
                    </div>
                  </div>
                )}

                {/* Learner Action: Microphone + Response Input */}
                <div className="space-y-2 rounded-xl border border-white/10 bg-[#101010] p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {micStatus === "listening" ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={stopMicRecording}
                          className="rounded-full bg-white text-black hover:bg-neutral-200 text-xs font-semibold px-3.5 h-7"
                        >
                          <Square className="mr-1.5 h-3 w-3 fill-current" />
                          Stop
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => startMicRecording("initial")}
                          className="rounded-full border-white/15 bg-white/[0.04] text-xs text-white hover:bg-white/[0.08] px-3.5 h-7"
                        >
                          <Mic className="mr-1.5 h-3 w-3" />
                          Speak response
                        </Button>
                      )}

                      <span className="text-[11px] font-mono text-neutral-400">
                        {micStatus === "listening" && "● Listening..."}
                        {micStatus === "processing" && "Processing..."}
                        {micStatus === "finished" && "Audio captured"}
                        {micStatus === "ready" && "Mic ready or type below"}
                      </span>
                    </div>
                  </div>

                  {micError && (
                    <div className="flex items-start gap-1.5 rounded-lg border border-white/15 bg-white/[0.03] px-2.5 py-1 text-[11px] text-neutral-300">
                      <MicOff className="h-3 w-3 shrink-0 text-neutral-400 mt-0.5" />
                      <span>{micError}</span>
                    </div>
                  )}

                  <Textarea
                    value={initialAttempt}
                    onChange={(e) => setInitialAttempt(e.target.value)}
                    rows={2}
                    placeholder="Speak with microphone or type your immediate answer..."
                    aria-label="Your initial response"
                    className="border-white/10 bg-[#0a0a0a] text-xs sm:text-sm text-white placeholder:text-neutral-500 rounded-lg resize-none"
                  />
                </div>
              </section>
            )}

            {/* STAGE 1: DEBRIEF (Teach One Principle at a Time) */}
            {stage === 1 && (
              <section className="flex-1 flex flex-col justify-between space-y-3">
                {/* Attempt Recap Pill (if provided) */}
                {initialAttempt.trim().length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-[#101010] px-3.5 py-2">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                      Your Initial Attempt
                    </p>
                    <p className="text-xs text-neutral-200 line-clamp-1 italic">
                      “{initialAttempt.trim()}”
                    </p>
                  </div>
                )}

                {/* Core Principle Headline */}
                <div className="space-y-1">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                    Core Operational Model
                  </p>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white line-clamp-1">
                    {slides.mentalModel.headline}
                  </h2>
                  <p className="text-xs sm:text-sm text-neutral-300 line-clamp-2">
                    {slides.mentalModel.body}
                  </p>
                </div>

                {/* Highlighted Golden Rule */}
                <div className="rounded-xl border border-white/20 bg-white/[0.03] p-4">
                  <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.2em] text-neutral-400">
                    The Golden Rule
                  </p>
                  <p className="mt-1 text-sm sm:text-base font-bold text-white">
                    “{slides.mentalModel.goldenRule}”
                  </p>
                </div>

                {/* 3 Concise Steps */}
                {slides.mentalModel.steps && slides.mentalModel.steps.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {slides.mentalModel.steps.map((s) => (
                      <div
                        key={s.step}
                        className="rounded-xl border border-white/10 bg-[#141414] p-3 space-y-0.5"
                      >
                        <span className="font-mono text-[10px] text-neutral-400">
                          0{s.step}
                        </span>
                        <h3 className="text-xs font-semibold text-white truncate">
                          {s.label}
                        </h3>
                        <p className="text-[11px] text-neutral-400 line-clamp-2">
                          {s.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Common Trap Note */}
                <div className="rounded-xl border border-white/10 bg-[#101010] px-3.5 py-2 text-xs">
                  <span className="font-mono uppercase tracking-wider text-neutral-300 font-semibold mr-1.5">
                    Trap to avoid:
                  </span>
                  <span className="text-neutral-400 line-clamp-1">
                    {slides.trap.headline} — {slides.trap.costOfFailure}
                  </span>
                </div>
              </section>
            )}

            {/* STAGE 2: DEMONSTRATION (Show What Good Looks Like) */}
            {stage === 2 && (
              <section className="flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                    Demonstration Film Breakdown
                  </p>
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white line-clamp-2">
                    “{slides.tape.prompt}”
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Ineffective Response */}
                  <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#101010] p-4 space-y-2">
                    <div>
                      <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 line-through">
                        Ineffective response
                      </span>
                      <p className="mt-1 text-xs italic text-neutral-300 line-clamp-3">
                        “{slides.tape.weakResponse}”
                      </p>
                    </div>
                    <p className="border-t border-white/[0.06] pt-2 text-[11px] text-neutral-400">
                      <strong className="text-neutral-300">Why it fails: </strong>
                      <span className="line-clamp-2">{slides.tape.weakCritique}</span>
                    </p>
                  </div>

                  {/* Stronger Response */}
                  <div className="flex flex-col justify-between rounded-xl border border-white/20 bg-white/[0.03] p-4 space-y-2 shadow-sm">
                    <div>
                      <span className="text-[11px] font-mono uppercase tracking-wider text-white font-semibold">
                        Stronger response
                      </span>
                      <p className="mt-1 text-xs font-medium text-white line-clamp-3">
                        “{slides.tape.strongResponse}”
                      </p>
                    </div>
                    <p className="border-t border-white/10 pt-2 text-[11px] text-neutral-300">
                      <strong className="text-white">Why it works: </strong>
                      <span className="line-clamp-2">{slides.tape.strongWhy}</span>
                    </p>
                  </div>
                </div>

                {/* Specific Difference Callout */}
                <div className="rounded-xl border border-white/10 bg-[#141414] px-4 py-2.5">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                    The Critical Distinction
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-200 line-clamp-2">
                    {differenceSummary}
                  </p>
                </div>
              </section>
            )}

            {/* STAGE 3: RETRY IN A NEW SITUATION & EVIDENCE-BASED FEEDBACK */}
            {stage === 3 && (
              <section className="flex-1 flex flex-col justify-between space-y-3">
                {!showFeedback ? (
                  <>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                          {retryContext}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-400">
                          Target: ≤ {practice?.targetMaxWords ?? 35}w
                        </span>
                      </div>
                      <h2 className="text-lg sm:text-xl font-bold leading-snug tracking-tight text-white line-clamp-2">
                        “{retryPrompt}”
                      </h2>
                    </div>

                    <div className="space-y-3 rounded-xl border border-white/10 bg-[#101010] p-3.5">
                      {/* In-Situ Sparring Partner Pill */}
                      <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#0a0a0a] p-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-white/10 font-mono text-[11px] font-bold text-white">
                            {roomConfig.personaName.slice(0, 1)}
                          </div>
                          <span className="text-xs font-semibold text-white">
                            {roomConfig.personaName}
                          </span>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={launchingChamber}
                          onClick={() => onLaunchChamber(course, lesson)}
                          className="rounded-full border-white/15 bg-white/[0.04] text-[11px] text-white hover:bg-white/[0.09] px-3 h-6"
                        >
                          <Play className="mr-1 h-2.5 w-2.5 fill-current" />
                          Live Room
                        </Button>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {micStatus === "listening" ? (
                            <Button
                              type="button"
                              size="sm"
                              onClick={stopMicRecording}
                              className="rounded-full bg-white text-black hover:bg-neutral-200 text-xs font-semibold px-3 h-7"
                            >
                              <Square className="mr-1 h-3 w-3 fill-current" />
                              Stop
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => startMicRecording("retry")}
                              className="rounded-full border-white/15 bg-white/[0.04] text-xs text-white hover:bg-white/[0.08] px-3 h-7"
                            >
                              <Mic className="mr-1 h-3 w-3" />
                              Record
                            </Button>
                          )}
                          <span className="text-[11px] font-mono text-neutral-400">
                            {micStatus === "listening"
                              ? "● Listening..."
                              : "Speak or type your answer"}
                          </span>
                        </div>
                      </div>

                      <Textarea
                        value={retryAttempt}
                        onChange={(e) => setRetryAttempt(e.target.value)}
                        rows={2}
                        placeholder="Deliver your response applying the principle..."
                        aria-label="Your retry response"
                        className="border-white/10 bg-[#0a0a0a] text-xs sm:text-sm text-white placeholder:text-neutral-500 rounded-lg resize-none"
                      />
                    </div>

                    {/* Spar Signature 24-Hour Transfer Card */}
                    <div className="rounded-xl border border-white/15 bg-white/[0.02] p-3 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
                        <span>SPAR 24-HOUR FIELD CHALLENGE</span>
                      </div>
                      <p className="text-xs text-white font-medium line-clamp-2">
                        “{getRealWorldChallenge(lesson)}”
                      </p>
                    </div>
                  </>
                ) : (
                  <LessonFeedback
                    learnerResponse={activeResponseToEvaluate}
                    evaluation={evaluation}
                    launchingChamber={launchingChamber}
                    onRetry={() => {
                      setShowFeedback(false);
                    }}
                    onLaunchChamber={() => onLaunchChamber(course, lesson)}
                    onCompleteLesson={() => {
                      onCompleteLesson(course.id, lesson.id);
                      onBackToRoadmap();
                    }}
                  />
                )}
              </section>
            )}
          </div>

          {/* Pinned Bottom Action Footer Inside Folio (Zero-Scroll Controls) */}
          <footer className="border-t border-white/[0.08] pt-3 shrink-0">
            {stage === 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStage(1)}
                  className="text-xs font-medium text-neutral-400 hover:text-white transition-colors"
                >
                  Skip to principle →
                </button>

                <Button
                  onClick={() => setStage(1)}
                  className="rounded-full bg-white text-black hover:bg-neutral-200 text-xs sm:text-sm font-semibold px-6 py-2.5 h-10 shadow-md"
                >
                  Submit attempt &amp; see principle
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            )}

            {stage === 1 && (
              <div className="flex items-center justify-between">
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
                  See demonstration
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            )}

            {stage === 2 && (
              <div className="flex items-center justify-between">
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
                  onClick={() => {
                    setShowFeedback(false);
                    setStage(3);
                  }}
                  className="rounded-full bg-white text-black hover:bg-neutral-200 text-xs sm:text-sm font-semibold px-6 h-9 shadow-md"
                >
                  Practise new situation
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            )}

            {stage === 3 && !showFeedback && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStage(2)}
                  className="rounded-full border-white/15 bg-transparent text-xs text-neutral-300 px-4 h-9"
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Back
                </Button>

                <Button
                  size="sm"
                  disabled={
                    retryAttempt.trim().length === 0 &&
                    initialAttempt.trim().length === 0
                  }
                  onClick={() => setShowFeedback(true)}
                  className="rounded-full bg-white text-black hover:bg-neutral-200 text-xs sm:text-sm font-semibold px-6 h-9 shadow-md disabled:opacity-40"
                >
                  Evaluate my response
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            )}
          </footer>
        </div>
      </div>
    </div>
  );
}
