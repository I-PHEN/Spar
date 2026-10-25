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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ARCHETYPES } from "@/lib/personas";
import {
  ACTIVITY_TYPE_LABELS,
  evaluatePracticeAttempt,
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
        "Browser speech recognition is unavailable in this browser. Type your response below or launch the live voice Chamber."
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
            "Microphone permission was denied. Enable microphone access in your browser settings or type your response below."
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

  const activeResponseToEvaluate =
    retryAttempt.trim() || initialAttempt.trim();
  const evaluation = evaluatePracticeAttempt(activeResponseToEvaluate, lesson);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-32 sm:px-6 sm:py-10 md:pb-16 space-y-8">
      {/* Top Breadcrumb & Lesson Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={onBackToRoadmap}
            className="inline-flex items-center gap-1.5 font-medium text-neutral-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {course.title}
          </button>
          <span className="text-neutral-600">/</span>
          <span className="font-medium text-neutral-200 truncate">
            {lesson.title}
          </span>
        </nav>

        <div className="flex items-center gap-2.5 text-xs text-neutral-400">
          <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-neutral-300">
            {activityLabel}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3 text-neutral-500" />
            {lesson.durationMinutes} min
          </span>
          {isCompleted && (
            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mastered
            </span>
          )}
        </div>
      </div>

      {/* Predictable 4-Step Lesson Progress Bar */}
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
                "flex flex-col gap-1.5 text-left transition-colors focus-visible:outline-none",
                active
                  ? "text-white font-semibold"
                  : passed
                  ? "text-neutral-300"
                  : "text-neutral-500 hover:text-neutral-300"
              )}
            >
              <div
                className={cn(
                  "h-1 w-full rounded-full transition-colors",
                  active
                    ? "bg-white"
                    : passed
                    ? "bg-emerald-400/70"
                    : "bg-white/10"
                )}
              />
              <span className="text-xs hidden sm:inline">{s.label}</span>
              <span className="text-xs sm:hidden">{s.short}</span>
            </button>
          );
        })}
      </div>

      {/* STAGE 0: HOOK & INITIAL ATTEMPT (Think & Speak First) */}
      {stage === 0 && (
        <section className="space-y-8 pt-2">
          {/* Context & Main Prompt */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-neutral-400">
              {hookContext} · {hookSpeaker}
            </p>
            <h1 className="text-2xl font-bold leading-snug tracking-tight text-white sm:text-3xl">
              “{hookPrompt}”
            </h1>
            <p className="text-sm text-neutral-400">
              How would you answer right now? Speak or type a {timeLimitSeconds}
              -second response before viewing the debrief.
            </p>
          </div>

          {/* Learner Action: Microphone + Response Input */}
          <div className="space-y-4 rounded-2xl border border-white/10 bg-[#111114] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {micStatus === "listening" ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={stopMicRecording}
                    className="bg-rose-500 text-white hover:bg-rose-600 text-xs font-semibold"
                  >
                    <Square className="mr-1.5 h-3 w-3 fill-current" />
                    Stop recording
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => startMicRecording("initial")}
                    className="border-white/15 bg-white/[0.04] text-xs text-white hover:bg-white/[0.08]"
                  >
                    <Mic className="mr-1.5 h-3.5 w-3.5" />
                    Speak response
                  </Button>
                )}

                <span
                  aria-live="polite"
                  className={cn(
                    "text-xs font-mono",
                    micStatus === "listening"
                      ? "text-emerald-400"
                      : micStatus === "error"
                      ? "text-amber-300"
                      : "text-neutral-400"
                  )}
                >
                  {micStatus === "ready" && "Mic ready"}
                  {micStatus === "listening" && "● Listening... speak naturally"}
                  {micStatus === "processing" && "Processing audio..."}
                  {micStatus === "finished" && "Recording captured"}
                  {micStatus === "error" && "Using text input"}
                </span>
              </div>

              <span className="text-xs font-mono text-neutral-400">
                Target: ≤ {practice?.targetMaxWords ?? 35} words
              </span>
            </div>

            {micError && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-200">
                <MicOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{micError}</span>
              </div>
            )}

            <Textarea
              value={initialAttempt}
              onChange={(e) => setInitialAttempt(e.target.value)}
              rows={4}
              placeholder="Speak with the microphone or type how you would answer this question..."
              aria-label="Your initial response"
              className="border-white/10 bg-[#0b0b0d] text-sm text-white placeholder:text-neutral-500"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => setStage(1)}
                className="text-xs font-medium text-neutral-400 hover:text-white"
              >
                Skip straight to principle →
              </button>

              <Button
                onClick={() => setStage(1)}
                className="bg-white text-black hover:bg-neutral-200 text-xs sm:text-sm font-semibold px-5 py-2.5 h-auto"
              >
                Submit attempt &amp; see principle
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* STAGE 1: DEBRIEF (Teach One Principle at a Time) */}
      {stage === 1 && (
        <section className="space-y-8 pt-2">
          {/* Show Learner's Initial Attempt if Provided */}
          {initialAttempt.trim().length > 0 && (
            <div className="rounded-xl border border-white/10 bg-[#111114] p-4 space-y-1">
              <p className="text-xs text-neutral-400">Your initial attempt</p>
              <p className="text-sm text-neutral-200">
                “{initialAttempt.trim()}”
              </p>
            </div>
          )}

          {/* Core Principle */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-emerald-400">
              Key Principle · {lesson.title}
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {slides.mentalModel.headline}
            </h2>
            <p className="text-sm leading-relaxed text-neutral-300 sm:text-base">
              {slides.mentalModel.body}
            </p>
          </div>

          {/* Highlighted Golden Rule */}
          <div className="border-l-2 border-emerald-400 pl-4 py-1">
            <p className="text-xs font-medium text-neutral-400">
              Rule to remember
            </p>
            <p className="mt-1 text-base font-semibold text-white sm:text-lg">
              “{slides.mentalModel.goldenRule}”
            </p>
          </div>

          {/* 3 Concise Steps */}
          {slides.mentalModel.steps && slides.mentalModel.steps.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {slides.mentalModel.steps.map((s) => (
                <div
                  key={s.step}
                  className="rounded-xl border border-white/[0.08] bg-[#111114] p-4 space-y-1.5"
                >
                  <span className="font-mono text-xs text-neutral-400">
                    Step {s.step}
                  </span>
                  <h3 className="text-sm font-semibold text-white">
                    {s.label}
                  </h3>
                  <p className="text-xs leading-relaxed text-neutral-400">
                    {s.detail}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Optional Diagram when it clarifies the principle */}
          {renderVisual && renderVisual(slides.mentalModel.visual)}

          {/* Common Trap Note */}
          <div className="rounded-xl border border-white/[0.08] bg-[#111114] p-4 space-y-1">
            <p className="text-xs font-medium text-amber-300">
              Trap to avoid: {slides.trap.headline}
            </p>
            <p className="text-xs leading-relaxed text-neutral-300">
              {slides.trap.costOfFailure}
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-white/[0.08] pt-6">
            <Button
              variant="outline"
              onClick={() => setStage(0)}
              className="border-white/12 bg-transparent text-xs text-neutral-300"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back to scenario
            </Button>

            <Button
              onClick={() => setStage(2)}
              className="bg-white text-black hover:bg-neutral-200 text-xs sm:text-sm font-semibold px-5 py-2.5 h-auto"
            >
              See demonstration
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </section>
      )}

      {/* STAGE 2: DEMONSTRATION (Show What Good Looks Like) */}
      {stage === 2 && (
        <section className="space-y-8 pt-2">
          <div className="space-y-2">
            <p className="text-xs font-medium text-neutral-400">
              Demonstration · Comparing responses
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              “{slides.tape.prompt}”
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Ineffective Response */}
            <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#111114] p-5 space-y-4">
              <div className="space-y-2">
                <span className="text-xs font-semibold text-rose-400">
                  Ineffective response
                </span>
                <p className="text-sm italic leading-relaxed text-neutral-300">
                  “{slides.tape.weakResponse}”
                </p>
              </div>
              <p className="border-t border-white/[0.06] pt-3 text-xs text-neutral-400">
                <strong className="text-neutral-200">Why it fails: </strong>
                {slides.tape.weakCritique}
              </p>
            </div>

            {/* Stronger Response */}
            <div className="flex flex-col justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-5 space-y-4">
              <div className="space-y-2">
                <span className="text-xs font-semibold text-emerald-400">
                  Stronger response
                </span>
                <p className="text-sm font-medium leading-relaxed text-white">
                  “{slides.tape.strongResponse}”
                </p>
              </div>
              <p className="border-t border-emerald-500/15 pt-3 text-xs text-neutral-300">
                <strong className="text-white">Why it works: </strong>
                {slides.tape.strongWhy}
              </p>
            </div>
          </div>

          {/* Specific Difference Callout */}
          <div className="rounded-xl border border-white/10 bg-[#121215] p-5 space-y-1.5">
            <p className="text-xs font-semibold text-neutral-300">
              The specific difference
            </p>
            <p className="text-sm leading-relaxed text-neutral-200">
              {differenceSummary}
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-white/[0.08] pt-6">
            <Button
              variant="outline"
              onClick={() => setStage(1)}
              className="border-white/12 bg-transparent text-xs text-neutral-300"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back to principle
            </Button>

            <Button
              onClick={() => {
                setShowFeedback(false);
                setStage(3);
              }}
              className="bg-white text-black hover:bg-neutral-200 text-xs sm:text-sm font-semibold px-5 py-2.5 h-auto"
            >
              Practise in a new situation
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </section>
      )}

      {/* STAGE 3: RETRY IN A NEW SITUATION & EVIDENCE-BASED FEEDBACK */}
      {stage === 3 && (
        <section className="space-y-8 pt-2">
          <div className="space-y-3">
            <p className="text-xs font-medium text-neutral-400">
              {retryContext} · {roomConfig.personaName} ({archetypeDef.tagline})
            </p>
            <h2 className="text-2xl font-bold leading-snug tracking-tight text-white sm:text-3xl">
              “{retryPrompt}”
            </h2>
            <p className="text-sm text-neutral-400">
              Apply <strong className="text-neutral-200">{slides.mentalModel.headline}</strong>{" "}
              to this new challenge. Goal: {slides.mission.passCriteria}
            </p>
          </div>

          {!showFeedback ? (
            <div className="space-y-4 rounded-2xl border border-white/10 bg-[#111114] p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {micStatus === "listening" ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={stopMicRecording}
                      className="bg-rose-500 text-white hover:bg-rose-600 text-xs font-semibold"
                    >
                      <Square className="mr-1.5 h-3 w-3 fill-current" />
                      Stop recording
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => startMicRecording("retry")}
                      className="border-white/15 bg-white/[0.04] text-xs text-white hover:bg-white/[0.08]"
                    >
                      <Mic className="mr-1.5 h-3.5 w-3.5" />
                      Record response
                    </Button>
                  )}

                  <span className="text-xs font-mono text-neutral-400">
                    {micStatus === "listening"
                      ? "● Listening..."
                      : "Speak or type your response"}
                  </span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={launchingChamber}
                  onClick={() => onLaunchChamber(course, lesson)}
                  className="border-white/15 bg-white/[0.04] text-xs text-white hover:bg-white/[0.09]"
                >
                  <Play className="mr-1.5 h-3 w-3 fill-current" />
                  {launchingChamber
                    ? "Opening Chamber..."
                    : `Live AI Role-Play vs. ${roomConfig.personaName} →`}
                </Button>
              </div>

              <Textarea
                value={retryAttempt}
                onChange={(e) => setRetryAttempt(e.target.value)}
                rows={4}
                placeholder="Deliver your response applying the principle..."
                aria-label="Your retry response"
                className="border-white/10 bg-[#0b0b0d] text-sm text-white placeholder:text-neutral-500"
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <Button
                  variant="outline"
                  onClick={() => setStage(2)}
                  className="border-white/12 bg-transparent text-xs text-neutral-300"
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Back to demonstration
                </Button>

                <Button
                  disabled={
                    retryAttempt.trim().length === 0 &&
                    initialAttempt.trim().length === 0
                  }
                  onClick={() => setShowFeedback(true)}
                  className="bg-white text-black hover:bg-neutral-200 text-xs sm:text-sm font-semibold px-5 py-2.5 h-auto"
                >
                  Evaluate my response
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            </div>
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
  );
}
