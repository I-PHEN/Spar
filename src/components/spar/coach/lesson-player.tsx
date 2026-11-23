"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Keyboard,
  Loader2,
  Mic,
  RotateCcw,
  Square,
  Swords,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ARCHETYPES } from "@/lib/personas";
import { VoltBurst } from "../volt-burst";
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

const TOTAL_SLIDE_STAGES = 4;

type MicStatus = "ready" | "listening" | "processing" | "finished" | "error";

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { resultIndex?: number; results: ArrayLike<{ isFinal?: boolean; 0?: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
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
  const prefersReducedMotion = useReducedMotion();
  const [slideDir, setSlideDir] = useState<1 | -1>(1);
  const [stageState, setStageState] = useState<{
    lessonId: string;
    stage: LessonStageIndex;
  }>({ lessonId: lesson.id, stage: 0 });

  const stage: LessonStageIndex =
    stageState.lessonId === lesson.id ? stageState.stage : 0;

  function goToStage(next: LessonStageIndex) {
    setSlideDir(next >= stage ? 1 : -1);
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
  const isListeningRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const finalizedSpeechRef = useRef("");

  // Stage 3: Evaluation State
  const [evaluation, setEvaluation] = useState<PracticeEvaluationResult | null>(null);

  const cleanupMediaTracks = useCallback(() => {
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  }, []);

  const stopAllCapture = useCallback(() => {
    isListeningRef.current = false;
    try {
      recognitionRef.current?.abort?.();
    } catch {}
    try {
      recognitionRef.current?.stop();
    } catch {}
    recognitionRef.current = null;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    cleanupMediaTracks();
  }, [cleanupMediaTracks]);

  useEffect(() => {
    return () => {
      stopAllCapture();
    };
  }, [stopAllCapture]);

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

  async function transcribeAudioBlob(blob: Blob) {
    if (blob.size === 0) {
      setMicStatus("ready");
      return;
    }
    setMicStatus("processing");
    try {
      const form = new FormData();
      form.append("audio", blob, "drill-recording.webm");
      const res = await fetch("/api/coach/transcribe", {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => null)) as {
        transcript?: string;
        error?: string;
      } | null;
      if (res.ok && data?.transcript) {
        setDrillResponse(data.transcript.trim());
        setMicStatus("finished");
      } else {
        setMicStatus("error");
        setMicError(
          data?.error ||
            "Speech recognition is unavailable here. Type your response below.",
        );
        setShowTypeInput(true);
      }
    } catch {
      setMicStatus("error");
      setMicError("Could not transcribe audio. Type your response below.");
      setShowTypeInput(true);
    }
  }

  function startMediaRecorderStream(stream: MediaStream) {
    if (typeof MediaRecorder === "undefined") {
      stream.getTracks().forEach((t) => t.stop());
      isListeningRef.current = false;
      setMicStatus("error");
      setMicError("Voice recording is not supported in this browser. Type your response below.");
      setShowTypeInput(true);
      return;
    }

    mediaStreamRef.current = stream;
    audioChunksRef.current = [];

    const mimeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    const mimeType =
      mimeCandidates.find((m) => MediaRecorder.isTypeSupported?.(m)) || "";
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        audioChunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const chunks = audioChunksRef.current;
      const recordedType = mimeType || "audio/webm";
      cleanupMediaTracks();
      const blob = new Blob(chunks, { type: recordedType });
      void transcribeAudioBlob(blob);
    };

    recorder.onerror = () => {
      isListeningRef.current = false;
      cleanupMediaTracks();
      setMicStatus("error");
      setMicError("Audio recorder failed. Type your response below.");
      setShowTypeInput(true);
    };

    mediaRecorderRef.current = recorder;
    recorder.start(250);
    setMicStatus("listening");
  }

  async function startAudioRecorderFallback() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      isListeningRef.current = false;
      setMicStatus("error");
      setMicError("Microphone access is unavailable here. Type your response below.");
      setShowTypeInput(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!isListeningRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      startMediaRecorderStream(stream);
    } catch {
      isListeningRef.current = false;
      setMicStatus("error");
      setMicError("Could not capture audio from your microphone. Type your response below.");
      setShowTypeInput(true);
    }
  }

  async function startMicRecording() {
    if (micStatus === "processing") return;
    stopAllCapture();
    setMicError(null);
    finalizedSpeechRef.current = "";

    const win =
      typeof window !== "undefined"
        ? (window as unknown as Record<string, unknown>)
        : null;
    const SpeechRecCtor = (win?.SpeechRecognition ||
      win?.webkitSpeechRecognition) as
      | (new () => SpeechRecognitionInstance)
      | undefined;

    let unlockedStream: MediaStream | null = null;
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      try {
        unlockedStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        isListeningRef.current = false;
        setMicStatus("error");
        const errName = err instanceof DOMException ? err.name : "";
        if (
          errName === "NotAllowedError" ||
          errName === "PermissionDeniedError" ||
          errName === "SecurityError"
        ) {
          setMicError(
            "Microphone permission was denied. Allow mic access in your browser or type below.",
          );
        } else if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
          setMicError("No microphone was detected. Connect a mic or type below.");
        } else {
          setMicError(
            "Microphone could not be started (check system mic permissions or type below).",
          );
        }
        setShowTypeInput(true);
        return;
      }
    }

    isListeningRef.current = true;

    // Prefer native browser SpeechRecognition when available cleanly
    if (SpeechRecCtor) {
      // Release hardware probe stream before Web Speech claims the microphone
      if (unlockedStream) {
        unlockedStream.getTracks().forEach((t) => t.stop());
        unlockedStream = null;
      }

      try {
        const rec = new SpeechRecCtor();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = "en-US";

        rec.onresult = (event) => {
          let interim = "";
          let addedFinal = "";
          const startIdx = event.resultIndex ?? 0;
          for (let i = startIdx; i < event.results.length; i++) {
            const item = event.results[i];
            const transcript = item?.[0]?.transcript ?? "";
            if (item?.isFinal) {
              addedFinal += transcript;
            } else {
              interim += transcript;
            }
          }
          if (addedFinal) {
            finalizedSpeechRef.current = `${finalizedSpeechRef.current} ${addedFinal}`.trim();
          }
          const combined = `${finalizedSpeechRef.current} ${interim}`.trim();
          if (combined) {
            setDrillResponse(combined);
          }
          setMicStatus("listening");
        };

        rec.onerror = (event) => {
          const code = event?.error;
          // Transient silence or user stop should never break the mic UI
          if (code === "no-speech" || code === "aborted") {
            return;
          }
          if (code === "not-allowed") {
            isListeningRef.current = false;
            setMicStatus("error");
            setMicError("Microphone permission was denied. Type your response below.");
            setShowTypeInput(true);
            return;
          }
          // Embedded/Chromium builds often block cloud Web Speech ("network" / "audio-capture" / "service-not-allowed"):
          // silently fall back to MediaRecorder + server transcription while keeping listening active.
          if (isListeningRef.current && typeof MediaRecorder !== "undefined") {
            try {
              rec.abort?.();
            } catch {}
            recognitionRef.current = null;
            void startAudioRecorderFallback();
            return;
          }

          isListeningRef.current = false;
          setMicStatus("error");
          setMicError("Could not capture audio. Type your response below.");
          setShowTypeInput(true);
        };

        rec.onend = () => {
          if (isListeningRef.current && recognitionRef.current === rec) {
            try {
              rec.start();
              return;
            } catch {
              // Fall through to finished state
            }
          }
          if (recognitionRef.current === rec) {
            recognitionRef.current = null;
            setMicStatus((prev) => (prev === "listening" ? "finished" : prev));
          }
        };

        recognitionRef.current = rec;
        setMicStatus("listening");
        rec.start();
        return;
      } catch {
        recognitionRef.current = null;
        if (typeof MediaRecorder !== "undefined") {
          void startAudioRecorderFallback();
          return;
        }
        isListeningRef.current = false;
        setMicStatus("error");
        setMicError("Microphone could not be started. Type your response below.");
        setShowTypeInput(true);
        return;
      }
    }

    if (unlockedStream) {
      startMediaRecorderStream(unlockedStream);
      return;
    }

    isListeningRef.current = false;
    setMicStatus("error");
    setMicError("Voice input is not supported in this browser. Type your response below.");
    setShowTypeInput(true);
  }

  function stopMicRecording() {
    isListeningRef.current = false;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        cleanupMediaTracks();
        setMicStatus("finished");
      }
      return;
    }

    setMicStatus("processing");
    try {
      recognitionRef.current?.stop();
    } catch {}
    recognitionRef.current = null;
    setMicStatus("finished");
  }

  function handleCheckDrillResponse() {
    stopAllCapture();
    const evaluated = evaluatePracticeAttempt(drillResponse, lesson);
    setEvaluation(evaluated);
    goToStage(3);
  }

  const progressPct = Math.round(((stage + 1) / TOTAL_SLIDE_STAGES) * 100);

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[var(--bg-base)] text-[var(--text-primary)] select-none">
      {/* Top Theater Bar + Single Undivided Progress Bar */}
      <header className="relative z-10 shrink-0 border-b border-[#232327] bg-[#0B0B0D] px-5 py-3 sm:px-8">
        <div className="mx-auto max-w-3xl space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={onBackToRoadmap}
                aria-label="Exit to roadmap"
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#26262E] bg-[#18181D] px-3 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[#3A3A44] hover:text-white active:scale-[0.98]"
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
                <span className="font-display font-bold text-white truncate">
                  {lesson.title}
                </span>
              </nav>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#26262E] bg-[#141418] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
                <Clock className="h-3 w-3 text-[#C6FF3D]" />
                {activityLabel} · {lesson.durationMinutes}m
              </span>
              {isCompleted && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#C6FF3D]/35 bg-[#C6FF3D]/12 px-2.5 py-1 text-[#C6FF3D] font-medium text-[11px]">
                  <CheckCircle2 className="h-3 w-3" />
                  <span className="hidden sm:inline">Completed</span>
                </span>
              )}
            </div>
          </div>

          {/* Single Continuous Undivided Progress Bar */}
          <div
            role="progressbar"
            aria-label="Lesson progress"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2 w-full overflow-hidden rounded-full border border-[#26262E] bg-[#141418]"
          >
            <div
              className="h-full rounded-full bg-[#C6FF3D] transition-all duration-300 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </header>

      {/* Main Stage — uses my-auto instead of justify-center so tall slides never clip the top */}
      <main className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden px-5 py-5 sm:px-8 sm:py-7 flex flex-col">
        <div className="mx-auto my-auto w-full max-w-3xl">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${lesson.id}-stage-${stage}`}
              initial={
                prefersReducedMotion
                  ? { opacity: 1, x: 0 }
                  : { opacity: 0, x: slideDir * 24 }
              }
              animate={{ opacity: 1, x: 0 }}
              exit={
                prefersReducedMotion
                  ? { opacity: 1, x: 0 }
                  : { opacity: 0, x: slideDir * -24 }
              }
              transition={{
                duration: prefersReducedMotion ? 0 : 0.2,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {/* ─── STAGE 0: REFLEX CHECK ────────────────────────────────────── */}
              {stage === 0 && (
                <section className="space-y-5 sm:space-y-6">
                  {/* Spacious Challenge Prompt */}
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#26262E] bg-[#141418] px-3 py-1">
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 font-display text-[10px] font-extrabold text-[#0B0B0D]"
                        style={{ backgroundColor: archetypeDef.accentHue }}
                      >
                        {archetypeDef.initials}
                      </span>
                      <span className="text-xs font-semibold text-white">
                        {roomConfig.personaName}
                      </span>
                      <span className="text-white/20">·</span>
                      <span className="text-xs text-[var(--text-secondary)]">
                        {archetypeDef.tagline}
                      </span>
                    </div>

                    <h1 className="font-display text-xl sm:text-2xl font-bold leading-snug tracking-tight text-white">
                      “{hookPrompt}”
                    </h1>

                    <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                      Which instinct is fatal here? Pick Approach A or Approach B below.
                    </p>
                  </div>

                  {/* Two Simple Tactile Choice Cards (A vs B) */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* Approach A */}
                    <motion.button
                      type="button"
                      onClick={() => setSelectedInstinct("weak")}
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.985 }}
                      transition={{ type: "spring", stiffness: 460, damping: 28 }}
                      className={cn(
                        "group relative flex cursor-pointer flex-col justify-between gap-3 rounded-[22px] p-4 sm:p-5 text-left transition-all",
                        selectedInstinct === "weak"
                          ? "border-2 border-[#FF5A1F] bg-[#1E100B] shadow-[0_4px_0_0_#992B07]"
                          : "spar-chunky-card spar-chunky-card-interactive"
                      )}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={cn(
                                "flex h-7 w-7 items-center justify-center rounded-lg border font-display text-xs font-bold transition-colors",
                                selectedInstinct === "weak"
                                  ? "border-[#FF5A1F] bg-[#FF5A1F] text-[#0B0B0D]"
                                  : "border-white/15 bg-white/[0.04] text-[var(--text-secondary)] group-hover:text-white"
                              )}
                            >
                              A
                            </span>
                            <span className="text-xs font-semibold text-[var(--text-secondary)]">
                              Approach A
                            </span>
                          </div>
                          {selectedInstinct === "weak" && (
                            <span className="rounded-full bg-[#FF5A1F] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0B0B0D]">
                              Trap
                            </span>
                          )}
                        </div>

                        <p className="text-sm leading-relaxed text-neutral-100">
                          “{slides.tape.weakResponse}”
                        </p>
                      </div>

                      <div className="border-t border-white/[0.06] pt-2.5 text-xs text-[var(--text-tertiary)]">
                        {selectedInstinct === "weak" ? "Selected" : "Tap to choose"}
                      </div>
                    </motion.button>

                    {/* Approach B */}
                    <motion.button
                      type="button"
                      onClick={() => setSelectedInstinct("strong")}
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.985 }}
                      transition={{ type: "spring", stiffness: 460, damping: 28 }}
                      className={cn(
                        "group relative flex cursor-pointer flex-col justify-between gap-3 rounded-[22px] p-4 sm:p-5 text-left transition-all",
                        selectedInstinct === "strong"
                          ? "spar-chunky-card-volt"
                          : "spar-chunky-card spar-chunky-card-interactive"
                      )}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={cn(
                                "flex h-7 w-7 items-center justify-center rounded-lg border font-display text-xs font-bold transition-colors",
                                selectedInstinct === "strong"
                                  ? "border-[#C6FF3D] bg-[#C6FF3D] text-[#0B0D06]"
                                  : "border-white/15 bg-white/[0.04] text-[var(--text-secondary)] group-hover:text-white"
                              )}
                            >
                              B
                            </span>
                            <span className="text-xs font-semibold text-[var(--text-secondary)]">
                              Approach B
                            </span>
                          </div>
                          {selectedInstinct === "strong" && (
                            <span className="rounded-full bg-[#C6FF3D] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0B0D06]">
                              Winning Move
                            </span>
                          )}
                        </div>

                        <p className="text-sm font-medium leading-relaxed text-white">
                          “{slides.tape.strongResponse}”
                        </p>
                      </div>

                      <div className="border-t border-white/[0.06] pt-2.5 text-xs text-[var(--text-tertiary)]">
                        {selectedInstinct === "strong" ? "Selected" : "Tap to choose"}
                      </div>
                    </motion.button>
                  </div>

                  {/* Clean Verdict Reveal (Zero left stripes) */}
                  {selectedInstinct === "weak" || selectedInstinct === "strong" ? (
                    <motion.div
                      key={selectedInstinct}
                      initial={
                        prefersReducedMotion
                          ? false
                          : { opacity: 0, y: 8, scale: 0.98 }
                      }
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 26,
                      }}
                    >
                      {selectedInstinct === "weak" ? (
                        <div className="rounded-[20px] border-2 border-[#FF5A1F]/70 bg-[#1B100C] px-5 py-3.5 space-y-1">
                          <p className="font-display text-xs font-bold uppercase tracking-wider text-[#FF5A1F]">
                            Why Approach A fails under pressure
                          </p>
                          <p className="text-sm leading-relaxed text-neutral-100">
                            {slides.tape.weakCritique}
                          </p>
                        </div>
                      ) : (
                        <div className="spar-chunky-card-volt px-5 py-3.5 space-y-1">
                          <p className="font-display text-xs font-bold uppercase tracking-wider text-[#C6FF3D]">
                            Why Approach B commands the room
                          </p>
                          <p className="text-sm leading-relaxed text-white">
                            {slides.tape.strongWhy}
                          </p>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <p className="text-center text-xs text-[var(--text-tertiary)]">
                      Select Approach A or Approach B to see why it works.
                    </p>
                  )}
                </section>
              )}

              {/* ─── STAGE 1: TACTICAL MODEL & DIAGRAM ────────────────────────── */}
              {stage === 1 && (
                <section className="space-y-4 sm:space-y-5">
                  {/* Golden Rule Card */}
                  <div className="spar-chunky-card-volt p-4 sm:p-5 space-y-1.5">
                    <span className="font-display text-[11px] font-bold uppercase tracking-wider text-[#C6FF3D] block">
                      {slides.mentalModel.headline}
                    </span>
                    <h2 className="font-display text-lg sm:text-xl font-bold leading-snug tracking-tight text-white">
                      “{slides.mentalModel.goldenRule}”
                    </h2>
                    {slides.mentalModel.body && (
                      <p className="text-xs sm:text-sm leading-relaxed text-[var(--text-secondary)]">
                        {slides.mentalModel.body}
                      </p>
                    )}
                  </div>

                  {/* Spacious Split: Tactical Visual + 3 Steps */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                    <div className="lg:col-span-7 spar-chunky-card bg-[#0B0B0D] p-4 sm:p-5 flex flex-col justify-center">
                      {renderVisual ? (
                        renderVisual(slides.mentalModel.visual || slides.trap.visual)
                      ) : (
                        <div className="py-10 text-center text-xs text-[var(--text-tertiary)]">
                          Visual Diagram
                        </div>
                      )}
                    </div>

                    <div className="lg:col-span-5 spar-chunky-card p-4 sm:p-5 flex flex-col justify-between space-y-3">
                      <p className="font-display text-sm font-bold text-white">
                        How to run it
                      </p>

                      <div className="space-y-3 flex-1 flex flex-col justify-center">
                        {(slides.mentalModel.steps ?? []).map((step, idx) => (
                          <div
                            key={step.step ?? idx}
                            className="flex items-start gap-3 border-b border-white/[0.06] pb-2.5 last:border-b-0 last:pb-0"
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#C6FF3D] font-display text-xs font-extrabold text-[#0B0D06]">
                              {idx + 1}
                            </span>
                            <div className="space-y-0.5 min-w-0">
                              <p className="text-xs sm:text-sm font-semibold text-white">
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

              {/* ─── STAGE 2: SPEAKING DRILL ─────────────────────────────────── */}
              {stage === 2 && (
                <section className="space-y-5 sm:space-y-6">
                  <div className="space-y-2.5">
                    <span className="inline-flex items-center rounded-full border border-[#C6FF3D]/45 bg-[#C6FF3D]/12 px-3 py-1 text-xs font-semibold text-[#C6FF3D]">
                      Target under {targetMaxWords} words
                    </span>

                    <h2 className="font-display text-xl sm:text-2xl font-bold leading-snug tracking-tight text-white">
                      “{retryPrompt}”
                    </h2>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Keep this rule in play:{" "}
                      <span className="text-white font-medium">
                        {slides.mentalModel.goldenRule}
                      </span>
                    </p>
                  </div>

                  {/* Clean Studio Console */}
                  <div className="spar-chunky-card p-5 sm:p-6 space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span
                          className={cn(
                            "inline-flex items-center gap-2 font-semibold",
                            micStatus === "listening"
                              ? "text-[#C6FF3D]"
                              : micStatus === "processing"
                                ? "text-[#C6FF3D]"
                                : "text-[var(--text-secondary)]"
                          )}
                        >
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full",
                              micStatus === "listening"
                                ? "bg-[#C6FF3D] animate-ping"
                                : micStatus === "processing"
                                  ? "bg-[#C6FF3D] animate-pulse"
                                  : drillResponse
                                    ? "bg-[#C6FF3D]"
                                    : "bg-white/25"
                            )}
                          />
                          {micStatus === "listening"
                            ? "Listening…"
                            : micStatus === "processing"
                              ? "Transcribing…"
                              : drillResponse
                                ? "Response captured"
                                : "Mic ready"}
                        </span>

                        <span
                          className={cn(
                            "font-mono tabular-nums font-semibold",
                            isOverWordBudget ? "text-[#FF5A1F]" : "text-white"
                          )}
                        >
                          {currentWordCount} / {targetMaxWords} words
                        </span>
                      </div>

                      <div className="h-2 w-full overflow-hidden rounded-full bg-[#1C1C22]">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-200",
                            isOverWordBudget ? "bg-[#FF5A1F]" : "bg-[#C6FF3D]"
                          )}
                          style={{ width: `${wordBudgetRatio}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex min-h-[100px] flex-col justify-center rounded-2xl border border-[#26262E] bg-[#0B0B0D] p-4 sm:p-5">
                      {showTypeInput ? (
                        <textarea
                          rows={3}
                          value={drillResponse}
                          onChange={(e) => setDrillResponse(e.target.value)}
                          placeholder={`Deliver your answer in ${targetMaxWords} words or fewer...`}
                          className="w-full resize-none bg-transparent text-sm sm:text-base text-white placeholder:text-[var(--text-tertiary)] focus:outline-none leading-relaxed"
                        />
                      ) : drillResponse ? (
                        <p className="text-base sm:text-lg font-medium leading-relaxed text-white">
                          “{drillResponse}”
                        </p>
                      ) : (
                        <p className="text-center text-sm text-[var(--text-tertiary)]">
                          Tap the mic below and say your opening sentence out loud.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowTypeInput((v) => !v)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-white transition-colors"
                      >
                        <Keyboard className="h-3.5 w-3.5" />
                        {showTypeInput ? "Hide keyboard" : "Type instead"}
                      </button>

                      <div className="flex items-center gap-3">
                        {drillResponse && micStatus !== "listening" && micStatus !== "processing" && (
                          <button
                            type="button"
                            onClick={() => setDrillResponse("")}
                            className="rounded-xl border border-[#2C2C34] bg-[#18181D] px-3.5 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[#3E3E4A] hover:text-white"
                          >
                            Clear
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={micStatus === "processing"}
                          onClick={
                            micStatus === "listening"
                              ? stopMicRecording
                              : () => void startMicRecording()
                          }
                          aria-label={micStatus === "listening" ? "Stop recording" : "Speak response"}
                          className={cn(
                            "inline-flex cursor-pointer items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold transition-colors active:scale-[0.98] disabled:opacity-60 sm:text-sm",
                            micStatus === "listening"
                              ? "bg-[#C6FF3D] text-[#0B0D06] ring-2 ring-[#C6FF3D]/40"
                              : "spar-white-btn"
                          )}
                        >
                          {micStatus === "processing" ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Transcribing...</span>
                            </>
                          ) : micStatus === "listening" ? (
                            <>
                              <Square className="h-4 w-4 fill-current" />
                              <span>Stop Recording</span>
                            </>
                          ) : (
                            <>
                              <Mic className="h-4 w-4" />
                              <span>{drillResponse ? "Re-Record" : "Tap to Speak"}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {micError && (
                      <p className="text-center text-xs text-[#FF5A1F]">
                        {micError}
                      </p>
                    )}
                  </div>
                </section>
              )}

              {/* ─── STAGE 3: CLEAN REVIEW BREAKDOWN ──────────────────────────── */}
              {stage === 3 && (
                <section className="space-y-5 sm:space-y-6">
                  <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#232327] pb-4">
                    <div className="relative">
                      <VoltBurst
                        active={
                          evaluation?.passedCriteriaCount ===
                          evaluation?.totalCriteriaCount
                        }
                        className="left-12 top-3"
                      />
                      <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                        {evaluation?.passedCriteriaCount === evaluation?.totalCriteriaCount
                          ? "Lesson Mastered"
                          : "Here’s how that landed"}
                      </h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-semibold",
                          evaluation?.hasDirectOpening
                            ? "border-[#C6FF3D]/45 bg-[#C6FF3D]/12 text-[#C6FF3D]"
                            : "border-[#FF5A1F]/45 bg-[#FF5A1F]/12 text-[#FF5A1F]"
                        )}
                      >
                        {evaluation?.hasDirectOpening ? "Direct opener" : "Slow opener"}
                      </span>

                      <span className="rounded-full border border-[#2C2C34] bg-[#18181D] px-3 py-1 text-xs font-mono font-semibold text-white tabular-nums">
                        {evaluation?.wordCount ?? 0} / {targetMaxWords} words
                      </span>

                      <span
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-semibold",
                          (evaluation?.detectedHedges.length ?? 0) === 0
                            ? "border-[#C6FF3D]/45 bg-[#C6FF3D]/12 text-[#C6FF3D]"
                            : "border-[#FF5A1F]/45 bg-[#FF5A1F]/12 text-[#FF5A1F]"
                        )}
                      >
                        {(evaluation?.detectedHedges.length ?? 0) === 0
                          ? "Zero hedges"
                          : `${evaluation?.detectedHedges.length} hedges`}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="spar-chunky-card p-4 sm:p-5 space-y-2">
                      <span className="text-xs font-semibold text-[var(--text-tertiary)] block">
                        Your take
                      </span>
                      <p className="text-sm sm:text-base leading-relaxed text-neutral-200 italic">
                        “{drillResponse || "No response provided"}”
                      </p>
                    </div>

                    <div className="spar-chunky-card-volt p-4 sm:p-5 space-y-2">
                      <span className="font-display text-xs font-bold uppercase tracking-wider text-[#C6FF3D] block">
                        Sharp benchmark
                      </span>
                      <p className="text-sm sm:text-base font-medium leading-relaxed text-white">
                        “{evaluation?.suggestedRewrite || slides.tape.strongResponse}”
                      </p>
                    </div>
                  </div>

                  <div className="spar-chunky-card p-4 sm:p-5 space-y-2.5">
                    <p className="text-sm text-neutral-100 leading-relaxed">
                      <span className="mr-2 font-display font-bold text-[#C6FF3D]">
                        Coach Note:
                      </span>
                      {evaluation?.toImprove || evaluation?.didWell || "Keep delivery sharp and direct."}
                    </p>
                    <p className="border-t border-white/[0.06] pt-2.5 text-xs text-[var(--text-secondary)]">
                      Want live pressure? Jump into a round against {roomConfig.personaName}.
                    </p>
                  </div>
                </section>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Bottom Sticky Action Deck — 2.5D Tactile Volt Continue */}
      <footer className="relative z-10 shrink-0 border-t border-[#232327] bg-[#0B0B0D] px-5 py-3 sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          {stage === 0 && (
            <>
              <button
                type="button"
                onClick={() => goToStage(1)}
                className="text-xs font-medium text-[var(--text-secondary)] hover:text-white transition-colors"
              >
                Skip reflex →
              </button>

              <button
                type="button"
                onClick={() => goToStage(1)}
                className="spar-volt-btn inline-flex h-10 items-center justify-center gap-2 px-6 text-sm"
              >
                <span>Continue</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </>
          )}

          {stage === 1 && (
            <>
              <button
                type="button"
                onClick={() => goToStage(0)}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#2C2C34] bg-[#18181D] px-4 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[#3E3E4A] hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={() => goToStage(2)}
                className="spar-volt-btn inline-flex h-10 items-center justify-center gap-2 px-6 text-sm"
              >
                <span>Continue</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </>
          )}

          {stage === 2 && (
            <>
              <button
                type="button"
                onClick={() => goToStage(1)}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#2C2C34] bg-[#18181D] px-4 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[#3E3E4A] hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>

              <button
                type="button"
                disabled={drillResponse.trim().length === 0 || micStatus === "processing"}
                onClick={handleCheckDrillResponse}
                className="spar-volt-btn inline-flex h-10 items-center justify-center gap-2 px-6 text-sm disabled:opacity-40 disabled:pointer-events-none"
              >
                <span>Check &amp; Continue</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </>
          )}

          {stage === 3 && (
            <>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setDrillResponse("");
                    goToStage(2);
                  }}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#2C2C34] bg-[#18181D] px-4 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[#3E3E4A] hover:text-white"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Try Again</span>
                </button>

                {onLaunchChamber && (
                  <button
                    type="button"
                    disabled={launchingChamber}
                    onClick={() =>
                      onLaunchChamber(course, lesson, {
                        responseText: drillResponse,
                        passedCriteriaCount: evaluation?.passedCriteriaCount,
                        totalCriteriaCount: evaluation?.totalCriteriaCount,
                      })
                    }
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#C6FF3D]/45 bg-[#C6FF3D]/10 px-4 text-xs font-semibold text-[#C6FF3D] transition-colors hover:bg-[#C6FF3D]/20"
                  >
                    <Swords className="h-3.5 w-3.5" />
                    <span>Live Chamber</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  onCompleteLesson(course.id, lesson.id);
                  onBackToRoadmap();
                }}
                className="spar-volt-btn inline-flex h-10 items-center justify-center gap-2 px-6 text-sm"
              >
                <span>Complete Lesson</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
