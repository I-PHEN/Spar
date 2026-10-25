"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
    <div className="mx-auto max-w-6xl px-4 py-8 pb-32 sm:px-6 sm:py-10 md:pb-16 space-y-6">
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

      {/* Brilliant-Style Split Layout: Left Pinned Card + Right Interactive Path */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10 items-start">
        {/* LEFT COLUMN: Pinned Course Dossier Card (Desktop Sticky) */}
        <aside className="lg:col-span-5 lg:sticky lg:top-24 space-y-4">
          <div className="rounded-2xl border border-white/12 bg-[#0d0d11] p-6 sm:p-7 shadow-xl space-y-5">
            {/* Tactile Course Badge & Meta */}
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.07] pb-4">
              <span className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-300">
                {course.category} · {course.difficulty}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-neutral-400">
                <Clock className="h-3 w-3 text-neutral-500" />
                ~{course.estimatedMinutes} min total
              </span>
            </div>

            {/* Title & Tight Premise */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {course.title}
              </h1>
              <p className="text-sm font-medium text-neutral-200">
                {course.subtitle}
              </p>
              <p className="text-xs leading-relaxed text-neutral-400 sm:text-sm">
                {course.description}
              </p>
            </div>

            {/* Progress & Primary CTA Bar */}
            <div className="rounded-xl border border-white/[0.08] bg-[#09090c] p-4 space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-neutral-300">
                  <span className="font-medium text-white">
                    {completedCount} of {totalCount} completed
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-white">
                    {progressPct}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {nextLesson && (
                <div className="space-y-2 pt-1">
                  <Button
                    onClick={() => onStartLesson(nextLesson.id)}
                    className="w-full bg-white text-black hover:bg-neutral-200 text-xs sm:text-sm font-bold px-4 py-2.5 h-10 shadow-md"
                  >
                    <span>{primaryCtaLabel}</span>
                    <ArrowRight className="ml-1.5 h-4 w-4 shrink-0" />
                  </Button>
                  <p className="text-[11px] text-neutral-400 leading-snug">
                    <span className="text-neutral-500">Up next: </span>
                    <span className="font-medium text-white">
                      {nextLesson.title}
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Collapsible Outcomes Section (Keeps UI clean without text walls) */}
            {course.learningOutcomes && course.learningOutcomes.length > 0 && (
              <details className="group border-t border-white/[0.07] pt-3 text-xs">
                <summary className="flex cursor-pointer items-center justify-between font-semibold text-neutral-300 hover:text-white select-none">
                  <span>By the end you&apos;ll be able to:</span>
                  <span className="font-mono text-neutral-500 group-open:rotate-180 transition-transform">
                    ▾
                  </span>
                </summary>
                <ul className="mt-3 space-y-2 text-neutral-300 pl-1">
                  {course.learningOutcomes.map((outcome) => (
                    <li
                      key={outcome}
                      className="flex items-start gap-2 text-xs text-neutral-400"
                    >
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white" />
                      <span>{outcome}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </aside>

        {/* RIGHT COLUMN: The Interactive Learning Roadmap Path */}
        <main className="lg:col-span-7 space-y-8">
          {course.modules.map((mod, modIdx) => (
            <div key={mod.id} className="space-y-4">
              {/* Module Header */}
              <div className="border-b border-white/[0.08] pb-2.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono tracking-widest uppercase text-neutral-500">
                    STAGE 0{modIdx + 1}
                  </span>
                  <h2 className="text-sm font-bold tracking-wide text-white uppercase">
                    {mod.title}
                  </h2>
                </div>
                {mod.description && (
                  <p className="hidden sm:block text-xs text-neutral-400 max-w-xs truncate text-right">
                    {mod.description}
                  </p>
                )}
              </div>

              {/* Vertical Tactile Timeline Path */}
              <div className="flex flex-col pt-1">
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

          {/* Final Course Completion Status */}
          <div className="flex items-center gap-3.5 rounded-2xl border border-white/10 bg-[#0d0d11] p-4 text-xs sm:text-sm">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
                isAllDone
                  ? "border-white bg-white text-black"
                  : "border-white/15 bg-white/[0.04] text-neutral-500"
              )}
            >
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <p className="text-neutral-300">
              {isAllDone
                ? `Course completed · All ${totalCount} masterclass activities finished.`
                : `Complete all ${totalCount} activities to master ${course.title}.`}
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
