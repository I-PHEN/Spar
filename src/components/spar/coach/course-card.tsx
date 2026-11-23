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
    return <Zap className="h-4 w-4 text-[#C6FF3D]" />;
  }
  if (lower.includes("q&a") || lower.includes("defense")) {
    return <Shield className="h-4 w-4 text-[#C6FF3D]" />;
  }
  if (lower.includes("communication") || lower.includes("vocal")) {
    return <MessageSquare className="h-4 w-4 text-[#C6FF3D]" />;
  }
  return <Compass className="h-4 w-4 text-[#C6FF3D]" />;
}

export function CourseCard({
  course,
  completedLessonIds,
  onSelectCourse,
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
      className="spar-chunky-card spar-chunky-card-interactive group relative flex flex-col justify-between p-5 sm:p-6 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C6FF3D]/60 cursor-pointer"
    >
      <div>
        {/* Top Row: Clean tactile icon badge + Difficulty pill */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#C6FF3D]/40 bg-[#1B210D]">
            {getCategoryIcon(course.category)}
          </div>
          <span className="rounded-md border border-[#2C2C34] bg-[#18181D] px-2.5 py-0.5 text-[11px] font-mono text-neutral-300">
            {course.difficulty}
          </span>
        </div>

        {/* Course Title */}
        <h3 className="mt-4 font-display text-base sm:text-lg font-bold tracking-tight text-white">
          {course.title}
        </h3>

        {/* Concise One-Sentence Description */}
        <p className="mt-1 text-xs sm:text-sm leading-relaxed text-neutral-300 font-normal line-clamp-2">
          {course.subtitle}
        </p>

        {/* Progress Bar (Only when course is in progress or done) */}
        {(isStarted || isCompleted) && (
          <div className="mt-3 pt-2.5 border-t border-white/[0.06]">
            <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
              <span>
                {isCompleted ? (
                  <span className="inline-flex items-center gap-1 text-[#C6FF3D] font-medium text-xs">
                    <CheckCircle2 className="h-3 w-3" />
                    Completed
                  </span>
                ) : (
                  <span>
                    {completedCount} of {totalCount} completed
                  </span>
                )}
              </span>
              <span className="font-mono tabular-nums text-[#C6FF3D] font-bold text-xs">
                {progressPct}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full border border-[#2C2C34] bg-[#0B0B0D]">
              <div
                className="h-full rounded-full bg-[#C6FF3D] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer: Simple metadata stats + Action */}
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3.5 text-xs text-neutral-400">
        <div className="flex items-center gap-1.5 whitespace-nowrap text-xs text-neutral-400">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3 text-neutral-400" />
            {course.estimatedMinutes} min
          </span>
          <span className="text-neutral-600">·</span>
          <span>
            {totalCount} {totalCount === 1 ? "lesson" : "lessons"}
          </span>
        </div>

        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[#C6FF3D] transition-colors group-hover:text-white">
          {actionLabel}
          <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </div>
  );
}
