"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getCourseLessons,
  getNextIncompleteLesson,
  type Course,
} from "@/lib/courses";
import { RoadmapNode, type NodeStatus } from "./roadmap-node";

export interface CourseRoadmapProps {
  course: Course;
  completedLessonIds: ReadonlySet<string>;
  onBackToCatalog: () => void;
  onStartLesson: (lessonId: string) => void;
}

const ZIGZAG_CYCLE: Array<"center" | "right" | "center" | "left"> = [
  "center",
  "right",
  "center",
  "left",
];

export function CourseRoadmap({
  course,
  completedLessonIds,
  onBackToCatalog,
  onStartLesson,
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
      {/* Top Breadcrumb Navigation (No course tabs/pills here) */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={onBackToCatalog}
          className="inline-flex items-center gap-1.5 font-medium text-neutral-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Learn
        </button>
        <span className="text-neutral-600">/</span>
        <span className="font-medium text-neutral-200 truncate">
          {course.title}
        </span>
      </nav>

      {/* Compact Top Course Overview Header */}
      <header className="rounded-2xl border border-white/10 bg-[#111113] p-6 sm:p-7">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-neutral-400">
              <span className="font-medium text-neutral-200">
                {course.category}
              </span>
              <span>·</span>
              <span>{course.difficulty}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-neutral-500" />
                {course.estimatedMinutes} min total
              </span>
            </div>

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

          {/* Right: Compact Progress & Primary Action */}
          <div className="flex shrink-0 flex-col gap-3 sm:min-w-[240px]">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-4 text-xs text-neutral-400">
                <span>
                  <strong className="text-white font-semibold">
                    {completedCount}
                  </strong>{" "}
                  of {totalCount} lessons mastered
                </span>
                <span className="font-mono tabular-nums text-neutral-200">
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
              <Button
                onClick={() => onStartLesson(nextLesson.id)}
                className="w-full min-w-max bg-white text-black hover:bg-neutral-200 text-xs sm:text-sm font-semibold px-5 py-2.5 h-auto"
              >
                <span>
                  {primaryCtaLabel}: {nextLesson.title}
                </span>
                <ArrowRight className="ml-1.5 h-4 w-4 shrink-0" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Central Spacious Learning Roadmap */}
      <section aria-label="Course learning roadmap" className="mx-auto max-w-3xl pt-2 space-y-12">
        {course.modules.map((mod, modIdx) => (
          <div key={mod.id} className="space-y-8">
            {/* Milestone Stage Divider */}
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-white/[0.08]" />
              <div className="text-center px-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-300">
                  {mod.title}
                </p>
                {mod.description && (
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {mod.description}
                  </p>
                )}
              </div>
              <div className="h-px flex-1 bg-white/[0.08]" />
            </div>

            {/* Connected Nodes along the Path */}
            <div className="flex flex-col items-center">
              {mod.lessons.map((lesson, lessonIdx) => {
                const num = lessonNumbers.get(lesson.id) ?? lessonIdx + 1;
                const isDone = completedLessonIds.has(lesson.id);
                const isCurrent = nextLesson?.id === lesson.id && !isDone;
                const status: NodeStatus = isDone
                  ? "completed"
                  : isCurrent
                  ? "current"
                  : "available";

                const isLastInCourse =
                  modIdx === course.modules.length - 1 &&
                  lessonIdx === mod.lessons.length - 1;

                const alignment =
                  ZIGZAG_CYCLE[(num - 1) % ZIGZAG_CYCLE.length];

                return (
                  <div key={lesson.id} className="w-full">
                    <RoadmapNode
                      lesson={lesson}
                      lessonNumber={num}
                      status={status}
                      isSelected={selectedNodeId === lesson.id}
                      isLast={isLastInCourse}
                      alignment={alignment}
                      onSelectNode={handleSelectNode}
                      onLaunchLesson={onStartLesson}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Final Course Completion Milestone Footer */}
        <div className="flex flex-col items-center pt-2 text-center">
          <div
            className={
              isAllDone
                ? "flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/50 bg-emerald-500/15 text-emerald-300"
                : "flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#121215] text-neutral-500"
            }
          >
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <p className="mt-2 text-xs font-medium text-neutral-400">
            {isAllDone
              ? `Course completed · All ${totalCount} activities mastered`
              : `Complete all ${totalCount} activities to finish ${course.title}`}
          </p>
        </div>
      </section>
    </div>
  );
}
