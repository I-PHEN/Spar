"use client";

import React, { useState } from "react";
import { ArrowRight, MoreHorizontal, Play, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getCourseLessons,
  getNextIncompleteLesson,
  type Course,
} from "@/lib/courses";
import { getCourseEmblemIcon } from "./course-emblem";

export interface MyCourseCardProps {
  course: Course;
  completedLessonIds: ReadonlySet<string>;
  isHeroCourse?: boolean;
  onSelectCourse: (courseId: string) => void;
  onStartOrContinueLesson: (courseId: string, lessonId: string) => void;
  onRemoveCourse: (courseId: string) => void;
}

export function MyCourseCard({
  course,
  completedLessonIds,
  onSelectCourse,
  onStartOrContinueLesson,
  onRemoveCourse,
}: MyCourseCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const lessons = getCourseLessons(course);
  const completedCount = lessons.filter((l) =>
    completedLessonIds.has(l.id)
  ).length;
  const totalCount = lessons.length;
  const progressPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const nextLesson = getNextIncompleteLesson(course, completedLessonIds);

  function handleContinue() {
    if (nextLesson) {
      onStartOrContinueLesson(course.id, nextLesson.id);
    } else if (lessons.length > 0) {
      onStartOrContinueLesson(course.id, lessons[0].id);
    }
  }

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-[#232327] bg-[#121215] transition-colors hover:border-[#34343B]">
      {/* Three-dot context menu */}
      <div className="absolute right-2.5 top-2.5 z-20">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label={`Options for ${course.title}`}
            aria-expanded={isMenuOpen}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-[#1C1C26] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {isMenuOpen && (
            <>
              {/* Backdrop closer */}
              <div
                className="fixed inset-0 z-30"
                onClick={() => setIsMenuOpen(false)}
              />
              <div
                role="menu"
                className="absolute right-0 top-8 z-40 w-52 rounded-xl border border-[#232327] bg-[#18181D] p-1.5"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onRemoveCourse(course.id);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove from my courses
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Primary Card Body */}
      <div className="flex flex-1 flex-col justify-between p-4">
        <div className="space-y-3">
          {/* Header row: compact icon + title + 1-line description */}
          <div className="flex items-start gap-3 pr-7">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#232327] bg-[#18181D]">
              {getCourseEmblemIcon(course.category, "h-4 w-4 text-[var(--accent-text)]")}
            </div>

            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onSelectCourse(course.id)}
                className="block w-full truncate text-left text-sm font-semibold tracking-tight text-[var(--text-primary)] hover:underline focus-visible:outline-none sm:text-base"
              >
                {course.title}
              </button>
              <p className="mt-0.5 line-clamp-1 text-xs text-[var(--text-secondary)]">
                {course.subtitle || course.description}
              </p>
            </div>
          </div>

          {/* Solid Progress Bar & Stats */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span className="font-mono tabular-nums">
                <strong className="font-semibold text-[var(--text-primary)]">
                  {completedCount}/{totalCount}
                </strong>
                <span className="sr-only"> ({completedCount} of {totalCount} completed)</span>
              </span>
              <span
                className={cn(
                  "font-mono tabular-nums font-semibold",
                  progressPct === 100 ? "text-emerald-400" : "text-white"
                )}
              >
                {progressPct}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full border border-[#232327] bg-[#0B0B0D]">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  progressPct === 100 ? "bg-emerald-400" : "bg-[var(--accent)]"
                )}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Compact Horizontal Actions */}
        <div className="mt-3.5 flex items-center gap-2">
          <button
            type="button"
            onClick={handleContinue}
            className="inline-flex h-8.5 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 text-xs font-semibold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] active:scale-[0.98] sm:flex-initial"
          >
            <Play className="h-3 w-3 fill-current" />
            {completedCount === 0 ? "Start" : "Continue"}
          </button>

          <button
            type="button"
            onClick={() => onSelectCourse(course.id)}
            className="inline-flex h-8.5 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#232327] bg-[#18181D] px-3.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[#34343B] hover:text-white focus-visible:outline-none sm:flex-initial"
          >
            <span>Roadmap</span>
            <ArrowRight className="h-3 w-3 text-[var(--text-tertiary)]" />
          </button>
        </div>
      </div>
    </div>
  );
}
