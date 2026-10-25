"use client";

import { ArrowRight, CheckCircle2, Clock, Compass, MessageSquare, Shield, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCourseLessons, type Course } from "@/lib/courses";

export interface CourseCardProps {
  course: Course;
  completedLessonIds: ReadonlySet<string>;
  onSelectCourse: (courseId: string) => void;
  onInspectDetails?: (course: Course) => void;
}

function getCategoryIcon(category: string) {
  const lower = category.toLowerCase();
  if (lower.includes("pressure") || lower.includes("recovery")) {
    return <Zap className="h-4 w-4 text-neutral-300" />;
  }
  if (lower.includes("q&a") || lower.includes("defense")) {
    return <Shield className="h-4 w-4 text-neutral-300" />;
  }
  if (lower.includes("communication") || lower.includes("vocal")) {
    return <MessageSquare className="h-4 w-4 text-neutral-300" />;
  }
  return <Compass className="h-4 w-4 text-neutral-300" />;
}

export function CourseCard({
  course,
  completedLessonIds,
  onSelectCourse,
  onInspectDetails,
}: CourseCardProps) {
  const lessons = getCourseLessons(course);
  const totalCount = lessons.length;
  const completedCount = lessons.filter((l) =>
    completedLessonIds.has(l.id)
  ).length;

  const isStarted = completedCount > 0 && completedCount < totalCount;
  const isCompleted = totalCount > 0 && completedCount === totalCount;
  const progressPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const actionLabel = isCompleted
    ? "Review"
    : isStarted
    ? "Continue"
    : "Start";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelectCourse(course.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectCourse(course.id);
        }
      }}
      className="group relative flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#111113] p-6 text-left transition-colors hover:border-white/25 hover:bg-[#141417] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 cursor-pointer"
    >
      <div>
        {/* Top Row: Restrained motif + Category + Difficulty */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
              {getCategoryIcon(course.category)}
            </span>
            <span className="text-xs font-medium text-neutral-400">
              {course.category}
            </span>
          </div>
          <span className="rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-0.5 text-[11px] text-neutral-400">
            {course.difficulty}
          </span>
        </div>

        {/* Course Title */}
        <h3 className="mt-4 text-lg font-semibold tracking-tight text-white group-hover:text-white">
          {course.title}
        </h3>

        {/* Prominent One-Sentence Outcome */}
        <p className="mt-1.5 text-sm leading-relaxed text-neutral-200 font-medium">
          {course.subtitle}
        </p>

        {/* Progress shown ONLY when started or completed */}
        {(isStarted || isCompleted) && (
          <div className="mt-4 pt-3 border-t border-white/[0.06]">
            <div className="flex items-center justify-between text-xs text-neutral-400 mb-1.5">
              <span>
                {isCompleted ? (
                  <span className="inline-flex items-center gap-1 text-white font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Completed ({completedCount}/{totalCount})
                  </span>
                ) : (
                  <span>
                    {completedCount} of {totalCount} completed
                  </span>
                )}
              </span>
              <span className="font-mono tabular-nums text-neutral-300">
                {progressPct}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer: Secondary Metadata + Clear Action */}
      <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/[0.06] pt-4">
        <div className="flex items-center gap-1.5 whitespace-nowrap text-xs text-neutral-400">
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <Clock className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
            {course.estimatedMinutes} min
          </span>
          <span className="text-neutral-600">·</span>
          <span className="whitespace-nowrap">
            {totalCount} {totalCount === 1 ? "lesson" : "lessons"}
          </span>
          {onInspectDetails && (
            <>
              <span className="text-neutral-600">·</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onInspectDetails(course);
                }}
                className="whitespace-nowrap text-xs text-neutral-400 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50 rounded"
              >
                Details
              </button>
            </>
          )}
        </div>

        <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-semibold text-white group-hover:text-neutral-200 transition-colors">
          {actionLabel}
          <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </div>
  );
}
