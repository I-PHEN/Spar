"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flame,
  GraduationCap,
  Play,
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
  getNextIncompleteLesson,
  type Course,
  type CourseLesson,
  type LessonCompletion,
} from "@/lib/courses";

export type BriefingSlideIndex = 0 | 1 | 2 | 3;

const SLIDE_STEPS: Array<{ index: BriefingSlideIndex; label: string; short: string }> = [
  { index: 0, label: "1. The Trap", short: "The Trap" },
  { index: 1, label: "2. Mental Model", short: "The Rule" },
  { index: 2, label: "3. The Tape", short: "The Tape" },
  { index: 3, label: "4. Chamber Drill", short: "Chamber" },
];

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

/**
 * 4-Card Interactive Executive Briefing Deck:
 *   Slide 0: The Trap (What fails under pressure)
 *   Slide 1: The Mental Model (The tactical rule)
 *   Slide 2: The Tape (Weak vs. Executive side-by-side)
 *   Slide 3: Chamber Mission (Opponent + Opening attack + Launch button)
 */
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
  const [slideState, setSlideState] = useState<{
    lessonId: string;
    slide: BriefingSlideIndex;
  }>({ lessonId: lesson.id, slide: 0 });
  const internalSlide: BriefingSlideIndex =
    slideState.lessonId === lesson.id ? slideState.slide : 0;
  const currentSlide = controlledSlide ?? internalSlide;

  function setSlide(next: BriefingSlideIndex) {
    setSlideState({ lessonId: lesson.id, slide: next });
    onSlideChange?.(next);
  }

  const { slides, roomConfig } = lesson;
  const archetypeDef = ARCHETYPES[roomConfig.archetype] ?? ARCHETYPES.skeptic;
  const modeLabel = sessionLabel(roomConfig.experience);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#111111] overflow-hidden shadow-2xl">
      {/* Top Deck Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] bg-[#141414] px-5 py-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
              {course.title}
            </span>
            {isCompleted && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Mastered
              </span>
            )}
          </div>
          <h3 className="truncate text-base font-semibold tracking-tight text-white sm:text-lg">
            {lesson.title}
          </h3>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            Back to syllabus
          </button>
        )}
      </div>

      {/* 4-Step Progress Stepper */}
      <div
        role="tablist"
        aria-label="Lesson briefing slides"
        className="grid grid-cols-4 border-b border-white/[0.06] bg-[#0d0d0d]"
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
                "relative flex items-center justify-center gap-1.5 px-2 py-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40",
                active
                  ? "bg-white/[0.05] text-white font-semibold"
                  : passed
                  ? "text-neutral-300 hover:bg-white/[0.02]"
                  : "text-neutral-500 hover:bg-white/[0.02] hover:text-neutral-300"
              )}
            >
              <span className="hidden sm:inline">{step.label}</span>
              <span className="sm:hidden">{step.short}</span>
              {active && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-white" />
              )}
            </button>
          );
        })}
      </div>

      {/* Active Slide Content */}
      <div className="p-6 sm:p-8 min-h-[320px] flex flex-col justify-between">
        {currentSlide === 0 && (
          <div className="space-y-5">
            <div className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
              <ShieldAlert className="h-3.5 w-3.5" />
              Slide 1 of 4 · The Common Trap
            </div>

            <div>
              <h4 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                {slides.trap.headline}
              </h4>
              <p className="mt-3 text-sm leading-relaxed text-neutral-300 sm:text-base">
                {slides.trap.body}
              </p>
            </div>

            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-red-300">
                Why this costs you the room
              </p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-200 sm:text-sm">
                {slides.trap.costOfFailure}
              </p>
            </div>
          </div>
        )}

        {currentSlide === 1 && (
          <div className="space-y-5">
            <div className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-blue-300">
              <Sparkles className="h-3.5 w-3.5" />
              Slide 2 of 4 · The Mental Model
            </div>

            <div>
              <h4 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                {slides.mentalModel.headline}
              </h4>
              <p className="mt-3 text-sm leading-relaxed text-neutral-300 sm:text-base">
                {slides.mentalModel.body}
              </p>
            </div>

            <div className="rounded-xl border border-white/15 bg-white/[0.04] p-4 sm:p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
                The Golden Rule
              </p>
              <p className="mt-1.5 text-sm font-semibold leading-relaxed text-white sm:text-base">
                “{slides.mentalModel.goldenRule}”
              </p>
            </div>
          </div>
        )}

        {currentSlide === 2 && (
          <div className="space-y-5">
            <div className="inline-flex items-center gap-1.5 rounded-md border border-purple-500/20 bg-purple-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-purple-300">
              <BookOpen className="h-3.5 w-3.5" />
              Slide 3 of 4 · The Tape Breakdown
            </div>

            <div>
              <h4 className="text-lg font-bold tracking-tight text-white sm:text-xl">
                {slides.tape.headline}
              </h4>
              <div className="mt-2 rounded-lg border border-white/10 bg-[#0c0c0c] px-3.5 py-2.5 text-xs text-neutral-300">
                <span className="font-semibold text-neutral-400">Panelist Question: </span>
                “{slides.tape.prompt}”
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Weak Tape */}
              <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
                  <XCircle className="h-4 w-4" />
                  Weak / Defensive Tape
                </div>
                <p className="mt-2 text-xs italic leading-relaxed text-neutral-300 sm:text-sm">
                  “{slides.tape.weakResponse}”
                </p>
                <p className="mt-2.5 border-t border-red-500/15 pt-2 text-[11px] text-neutral-400">
                  <span className="font-semibold text-red-300">Critique: </span>
                  {slides.tape.weakCritique}
                </p>
              </div>

              {/* Strong Tape */}
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05] p-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Executive Tape
                </div>
                <p className="mt-2 text-xs leading-relaxed text-white font-medium sm:text-sm">
                  “{slides.tape.strongResponse}”
                </p>
                <p className="mt-2.5 border-t border-emerald-500/15 pt-2 text-[11px] text-neutral-300">
                  <span className="font-semibold text-emerald-400">Why it works: </span>
                  {slides.tape.strongWhy}
                </p>
              </div>
            </div>
          </div>
        )}

        {currentSlide === 3 && (
          <div className="space-y-5">
            <div className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
              <Swords className="h-3.5 w-3.5" />
              Slide 4 of 4 · Chamber Mission
            </div>

            <div>
              <h4 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                Put It on the Tape
              </h4>
              <p className="mt-2 text-xs leading-relaxed text-neutral-300 sm:text-sm">
                {slides.mission.briefing}
              </p>
            </div>

            {/* Opponent & Opening Attack Card */}
            <div className="rounded-xl border border-white/10 bg-[#161616] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ring-1 ring-white/20"
                    style={{ backgroundColor: archetypeDef.accentHue }}
                  >
                    {roomConfig.personaName.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-white">
                      {roomConfig.personaName}{" "}
                      <span className="font-normal text-neutral-400">
                        · {archetypeDef.tagline}
                      </span>
                    </p>
                    <p className="text-[11px] text-neutral-400 capitalize">
                      Mode: {modeLabel}
                      {roomConfig.drillTarget ? ` (${roomConfig.drillTarget})` : ""} · Tone:{" "}
                      {roomConfig.behaviorStyle}
                    </p>
                  </div>
                </div>
                <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-300">
                  {modeLabel}
                </span>
              </div>

              <div className="rounded-lg border border-white/[0.06] bg-black/40 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  Opening Attack Line
                </p>
                <p className="mt-1 text-xs font-medium leading-relaxed text-white sm:text-sm">
                  “{slides.mission.openingAttack}”
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <Target className="h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  <strong className="font-semibold">Pass Criteria:</strong>{" "}
                  {slides.mission.passCriteria}
                </span>
              </div>
            </div>

            {/* Launch & Complete Controls */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {onLaunchDrill && (
                <Button
                  onClick={() => onLaunchDrill(course, lesson)}
                  disabled={launching}
                  className="bg-white text-black hover:bg-neutral-200 font-semibold text-xs sm:text-sm px-5 py-2.5 h-auto"
                >
                  <Play className="mr-1.5 h-3.5 w-3.5 fill-black" />
                  {launching
                    ? "Opening Sparring Chamber..."
                    : previewMode
                    ? "Test Drill in Chamber →"
                    : "Enter Drill Chamber →"}
                </Button>
              )}

              {onMarkComplete && !isCompleted && !previewMode && (
                <Button
                  variant="outline"
                  onClick={() => onMarkComplete(course.id, lesson.id)}
                  className="border-white/15 bg-white/[0.03] text-xs text-neutral-200 hover:bg-white/[0.08]"
                >
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                  Mark Lesson Mastered
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Footer Slide Navigation */}
        <div className="mt-8 flex items-center justify-between border-t border-white/[0.06] pt-4">
          <button
            type="button"
            onClick={() =>
              setSlide(Math.max(0, currentSlide - 1) as BriefingSlideIndex)
            }
            disabled={currentSlide === 0}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-400 transition-colors hover:text-white disabled:opacity-30 disabled:pointer-events-none"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Previous card
          </button>

          <span className="text-[11px] font-mono text-neutral-500 tabular-nums">
            Card {currentSlide + 1} / 4
          </span>

          {currentSlide < 3 ? (
            <button
              type="button"
              onClick={() =>
                setSlide(Math.min(3, currentSlide + 1) as BriefingSlideIndex)
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-neutral-200"
            >
              Next card
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span className="text-xs font-medium text-emerald-400">
              Ready for chamber
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Learner Coach View ─────────────────────────────────────────────────────

export interface CoachViewProps {
  onSessionCreated: (
    sessionId: string,
    exp: ExperienceKey,
    target: DrillTarget | null,
    lessonMeta?: { courseId: string; lessonId: string }
  ) => void;
  initialCourses?: Course[];
  initialCompletions?: LessonCompletion[];
}

export function CoachView({
  onSessionCreated,
  initialCourses = DEFAULT_COURSES,
  initialCompletions = [],
}: CoachViewProps) {
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [completions, setCompletions] =
    useState<LessonCompletion[]>(initialCompletions);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    initialCourses[0]?.id ?? ""
  );
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/coach/courses")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.courses) && data.courses.length > 0) {
          setCourses(data.courses);
          setSelectedCourseId((prev) =>
            data.courses.some((c: Course) => c.id === prev)
              ? prev
              : data.courses[0].id
          );
        }
        if (Array.isArray(data.completions)) {
          setCompletions(data.completions);
        }
      })
      .catch(() => {});
  }, []);

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

  const nextLesson = useMemo(
    () =>
      selectedCourse
        ? getNextIncompleteLesson(selectedCourse, completedLessonIds)
        : null,
    [selectedCourse, completedLessonIds]
  );

  const activeLesson = useMemo(
    () =>
      activeLessonId
        ? allCourseLessons.find((l) => l.id === activeLessonId) ?? null
        : null,
    [allCourseLessons, activeLessonId]
  );

  const masteredInCourse = useMemo(
    () => allCourseLessons.filter((l) => completedLessonIds.has(l.id)).length,
    [allCourseLessons, completedLessonIds]
  );

  const progressPct =
    allCourseLessons.length > 0
      ? Math.round((masteredInCourse / allCourseLessons.length) * 100)
      : 0;

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
        { courseId: course.id, lessonId: lesson.id }
      );
    } catch (err) {
      setLaunchError(
        err instanceof Error ? err.message : "Failed to launch drill chamber"
      );
      setLaunching(false);
    }
  }

  if (!selectedCourse) {
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
    <div className="mx-auto max-w-5xl px-4 py-8 pb-32 sm:px-6 sm:py-12 md:pb-16 space-y-8">
      {/* Academy Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
            Executive Academy · Structured Mastery
          </p>
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Coach
        </h1>
        <p className="mt-1.5 text-xs text-neutral-400 sm:text-sm max-w-2xl">
          Study tactical communication frameworks in 90-second briefing decks, then test them immediately in a linked Sparring Chamber.
        </p>
      </div>

      {launchError && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300"
        >
          {launchError}
        </div>
      )}

      {/* Active Lesson Briefing Deck (When a learner opens a lesson) */}
      {activeLesson ? (
        <ExecutiveBriefingDeck
          course={selectedCourse}
          lesson={activeLesson}
          isCompleted={completedLessonIds.has(activeLesson.id)}
          launching={launching}
          onLaunchDrill={handleLaunchDrill}
          onMarkComplete={handleMarkComplete}
          onClose={() => setActiveLessonId(null)}
        />
      ) : (
        <>
          {/* Active Course Hero Banner */}
          <div className="rounded-2xl border border-white/10 bg-[#121212] p-6 sm:p-7">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
              <div className="space-y-2 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-300">
                    {selectedCourse.category}
                  </span>
                  <span className="rounded border border-white/10 px-2 py-0.5 text-[10px] font-medium text-neutral-400">
                    {selectedCourse.difficulty}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-neutral-400">
                    <Clock className="h-3 w-3" />
                    {selectedCourse.estimatedMinutes} min
                  </span>
                </div>

                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {selectedCourse.title}
                </h2>
                <p className="text-xs leading-relaxed text-neutral-400 sm:text-sm">
                  {selectedCourse.description}
                </p>

                {/* Progress Bar */}
                <div className="pt-2">
                  <div className="flex items-center justify-between text-xs text-neutral-400 mb-1.5">
                    <span>
                      <strong className="text-white font-semibold">
                        {masteredInCourse}
                      </strong>{" "}
                      of {allCourseLessons.length} lessons mastered
                    </span>
                    <span className="font-mono tabular-nums text-neutral-300">
                      {progressPct}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {nextLesson && (
                <div className="flex-shrink-0">
                  <Button
                    onClick={() => setActiveLessonId(nextLesson.id)}
                    className="w-full lg:w-auto bg-white text-black hover:bg-neutral-200 font-semibold text-xs sm:text-sm px-5 py-3 h-auto"
                  >
                    {masteredInCourse === 0
                      ? `Start Lesson 1: ${nextLesson.title}`
                      : masteredInCourse === allCourseLessons.length
                      ? `Review Course: ${nextLesson.title}`
                      : `Continue: ${nextLesson.title}`}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Course Track Selector (All Published Courses) */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-300">
                Training Tracks ({courses.length})
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {courses.map((course) => {
                const lessons = getCourseLessons(course);
                const done = lessons.filter((l) =>
                  completedLessonIds.has(l.id)
                ).length;
                const isSelected = course.id === selectedCourse.id;
                return (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => {
                      setSelectedCourseId(course.id);
                      setActiveLessonId(null);
                    }}
                    className={cn(
                      "group flex flex-col justify-between rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40",
                      isSelected
                        ? "border-white/30 bg-[#171717]"
                        : "border-white/[0.08] bg-[#111111] hover:border-white/20 hover:bg-[#141414]"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                          {course.category}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-400 tabular-nums">
                          {done}/{lessons.length}
                        </span>
                      </div>
                      <h3 className="mt-1.5 text-sm font-semibold text-white">
                        {course.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-xs text-neutral-400">
                        {course.subtitle}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2.5 text-[11px] text-neutral-400">
                      <span>{course.difficulty}</span>
                      {done === lessons.length && lessons.length > 0 ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Mastered
                        </span>
                      ) : (
                        <span className="group-hover:text-white transition-colors">
                          View syllabus →
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Syllabus & Lesson Progression Tree */}
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-300">
              Course Syllabus · {selectedCourse.title}
            </p>

            {selectedCourse.modules.map((mod, modIdx) => (
              <div
                key={mod.id}
                className="rounded-2xl border border-white/[0.08] bg-[#111111] overflow-hidden"
              >
                <div className="border-b border-white/[0.06] bg-white/[0.02] px-5 py-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    Module {modIdx + 1}
                  </p>
                  <h3 className="text-sm font-semibold text-white sm:text-base">
                    {mod.title}
                  </h3>
                  {mod.description && (
                    <p className="mt-0.5 text-xs text-neutral-400">
                      {mod.description}
                    </p>
                  )}
                </div>

                <div className="divide-y divide-white/[0.06]">
                  {mod.lessons.map((lesson, lessonIdx) => {
                    const isDone = completedLessonIds.has(lesson.id);
                    const isUpNext = nextLesson?.id === lesson.id && !isDone;
                    const modeLabel = sessionLabel(lesson.roomConfig.experience);

                    return (
                      <div
                        key={lesson.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setActiveLessonId(lesson.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setActiveLessonId(lesson.id);
                          }
                        }}
                        aria-label={`Open lesson ${lesson.title}`}
                        className="group flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-white/[0.03] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                      >
                        <div className="flex items-start gap-3.5 min-w-0 flex-1">
                          {/* Step Status Node */}
                          <div
                            className={cn(
                              "mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                              isDone
                                ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
                                : isUpNext
                                ? "bg-white text-black"
                                : "bg-white/[0.06] text-neutral-400"
                            )}
                          >
                            {isDone ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              lessonIdx + 1
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="truncate text-sm font-semibold text-white sm:text-base">
                                {lesson.title}
                              </h4>
                              {isUpNext && (
                                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                                  Up next
                                </span>
                              )}
                            </div>

                            <p className="mt-0.5 truncate text-xs text-neutral-400">
                              {lesson.tagline}
                            </p>

                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
                              <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-300">
                                {modeLabel}
                              </span>
                              <span>·</span>
                              <span>
                                Opponent: {lesson.roomConfig.personaName} (
                                {lesson.roomConfig.behaviorStyle})
                              </span>
                              <span>·</span>
                              <span>{lesson.durationMinutes} min</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-shrink-0 items-center gap-3">
                          {isDone ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400">
                              Mastered
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-neutral-400 group-hover:text-white transition-colors">
                              Open briefing
                            </span>
                          )}
                          <ChevronRight className="h-4 w-4 text-neutral-500 transition-transform group-hover:translate-x-0.5 group-hover:text-white" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
