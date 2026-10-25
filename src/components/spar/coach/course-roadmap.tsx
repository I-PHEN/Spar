"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getCourseLessons,
  getNextIncompleteLesson,
  type Course,
  type CourseLesson,
} from "@/lib/courses";
import { RoadmapNode, type NodeStatus } from "./roadmap-node";

export interface CourseRoadmapProps {
  course: Course;
  completedLessonIds: ReadonlySet<string>;
  launchingChamber?: boolean;
  onBackToCatalog: () => void;
  onStartLesson: (lessonId: string) => void;
  onLaunchChamber?: (
    course: Pick<Course, "id" | "title">,
    lesson: CourseLesson
  ) => void;
}

export function CourseRoadmap({
  course,
  completedLessonIds,
  launchingChamber = false,
  onBackToCatalog,
  onStartLesson,
  onLaunchChamber,
}: CourseRoadmapProps) {
  const allLessons = getCourseLessons(course);
  const nextLesson = getNextIncompleteLesson(course, completedLessonIds);

  const [selectedNodeId, setSelectedNodeId] = useState<string>(
    nextLesson?.id ?? allLessons[0]?.id ?? ""
  );

  const completedCount = allLessons.filter((l) =>
    completedLessonIds.has(l.id)
  ).length;
  const totalCount = allLessons.length;
  const progressPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const isStarted = completedCount > 0 && completedCount < totalCount;
  const isAllDone = totalCount > 0 && completedCount === totalCount;

  const primaryCtaLabel = isAllDone
    ? "Review course"
    : isStarted
    ? "Continue"
    : "Start course";

  const lessonNumbers = new Map<string, number>(
    allLessons.map((lesson, idx) => [lesson.id, idx + 1])
  );

  function handleSelectNode(lessonId: string) {
    if (selectedNodeId === lessonId) {
      onStartLesson(lessonId);
    } else {
      setSelectedNodeId(lessonId);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 pb-32 sm:px-6 sm:py-10 md:pb-16 space-y-10">
      {/* Top Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={onBackToCatalog}
          className="inline-flex items-center gap-1.5 font-medium text-neutral-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Learn
        </button>
        <span className="text-neutral-500">/</span>
        <span className="font-medium text-white truncate">{course.title}</span>
      </nav>

      {/* Course Overview Header with Upfront Outcomes & Clean CTA */}
      <header className="rounded-2xl border border-white/10 bg-[#111113] p-6 sm:p-7">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-neutral-300">
              <span className="rounded-md bg-white/[0.06] px-2.5 py-0.5 font-medium text-white">
                {course.category}
              </span>
              <span>·</span>
              <span>{course.difficulty}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-neutral-400" />
                {course.estimatedMinutes} min total
              </span>
              <span>·</span>
              <span>{totalCount} lessons</span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {course.title}
            </h1>

            <p className="text-sm font-medium text-neutral-200">
              {course.subtitle}
            </p>

            <p className="text-xs leading-relaxed text-neutral-300 sm:text-sm">
              {course.description}
            </p>

            {/* Frame Outcomes Up Front */}
            {course.learningOutcomes && course.learningOutcomes.length > 0 && (
              <div className="pt-2 space-y-2">
                <p className="text-xs font-semibold text-neutral-200">
                  By the end you&apos;ll be able to:
                </p>
                <ul className="space-y-1.5">
                  {course.learningOutcomes.map((outcome) => (
                    <li
                      key={outcome}
                      className="flex items-start gap-2 text-xs text-neutral-300 sm:text-sm"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span>{outcome}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right: Compact Progress & Short Primary CTA + Up Next Caption */}
          <div className="flex w-full shrink-0 flex-col gap-3 rounded-xl border border-white/[0.08] bg-[#0b0b0d] p-4 lg:w-72">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-4 text-xs text-neutral-300">
                <span>
                  <strong className="text-white font-semibold">
                    {completedCount}
                  </strong>{" "}
                  of {totalCount} completed
                </span>
                <span className="font-mono font-semibold tabular-nums text-emerald-400">
                  {progressPct}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {nextLesson && (
              <div className="space-y-2 pt-1">
                <Button
                  onClick={() => onStartLesson(nextLesson.id)}
                  className="w-full bg-white text-black hover:bg-neutral-200 text-xs sm:text-sm font-semibold px-4 py-2.5 h-auto"
                >
                  <span>{primaryCtaLabel}</span>
                  <ArrowRight className="ml-1.5 h-4 w-4 shrink-0" />
                </Button>
                <p className="text-xs text-neutral-300 leading-snug">
                  <span className="text-neutral-400">Up next: </span>
                  <span className="font-medium text-white">
                    {nextLesson.title}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Straight-Axis Vertical Learning Roadmap (Uses Full Column Width) */}
      <section aria-label="Course learning roadmap" className="space-y-10">
        {course.modules.map((mod) => (
          <div key={mod.id} className="space-y-5">
            {/* Module Header with High-Contrast Outcome */}
            <div className="border-b border-white/[0.08] pb-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-white">
                {mod.title}
              </h2>
              {mod.description && (
                <p className="mt-1 text-xs text-neutral-300 sm:text-sm">
                  {mod.description}
                </p>
              )}
            </div>

            {/* Straight Vertical Timeline + Full-Width Right Cards */}
            <div className="flex flex-col">
              {mod.lessons.map((lesson, lessonIdx) => {
                const num = lessonNumbers.get(lesson.id) ?? lessonIdx + 1;
                const isDone = completedLessonIds.has(lesson.id);
                const isCurrent = nextLesson?.id === lesson.id && !isDone;
                const status: NodeStatus = isDone
                  ? "completed"
                  : isCurrent
                  ? "current"
                  : "available";

                const isLastInModule = lessonIdx === mod.lessons.length - 1;

                return (
                  <RoadmapNode
                    key={lesson.id}
                    lesson={lesson}
                    lessonNumber={num}
                    status={status}
                    isSelected={selectedNodeId === lesson.id}
                    isLast={isLastInModule}
                    launchingChamber={launchingChamber}
                    onSelectNode={handleSelectNode}
                    onLaunchLesson={onStartLesson}
                    onApplyInRoom={
                      onLaunchChamber
                        ? (les) => onLaunchChamber(course, les)
                        : undefined
                    }
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* Final Course Completion Milestone Footer */}
        <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#111113] px-5 py-4">
          <div
            className={
              isAllDone
                ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-400/50 bg-emerald-500/15 text-emerald-300"
                : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-[#141418] text-neutral-400"
            }
          >
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <p className="text-xs font-medium text-neutral-300 sm:text-sm">
            {isAllDone
              ? `Course completed · All ${totalCount} activities finished`
              : `Complete all ${totalCount} activities to finish ${course.title}`}
          </p>
        </div>
      </section>
    </div>
  );
}
