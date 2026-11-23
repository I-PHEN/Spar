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
  isHeroCourse = false,
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
    <div
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-[24px] p-5 transition-transform",
        isHeroCourse
          ? "spar-chunky-card-volt"
          : "spar-chunky-card spar-chunky-card-interactive",
      )}
    >
      {/* Three-dot context menu */}
      <div className="absolute right-3.5 top-3.5 z-20">
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
                className="absolute right-0 top-8 z-40 w-52 rounded-2xl border-2 border-[var(--border-strong)] bg-[#141418] p-1.5 shadow-[0_6px_0_0_#060608]"
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
      <div className="flex flex-1 flex-col justify-between">
        <div className="space-y-3.5">
          {/* Header row: compact icon + title + 1-line description */}
          <div className="flex items-start gap-3 pr-8">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-[#C6FF3D]/40 bg-[#1B210D] text-[#C6FF3D]">
              {getCourseEmblemIcon(course.category, "h-4.5 w-4.5 text-[#C6FF3D]")}
            </div>

            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onSelectCourse(course.id)}
                className="block w-full truncate text-left font-display text-base font-bold tracking-tight text-[var(--text-primary)] hover:underline focus-visible:outline-none sm:text-lg"
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
              <span className="font-mono tabular-nums font-bold text-[#C6FF3D]">
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
        </div>

        {/* Compact Horizontal Actions */}
        <div className="mt-4 flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleContinue}
            className="spar-white-btn inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl px-4 text-xs sm:flex-initial"
          >
            <Play className="h-3 w-3 fill-current" />
            {completedCount === 0 ? "Start" : "Continue"}
          </button>

          <button
            type="button"
            onClick={() => onSelectCourse(course.id)}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#2C2C34] bg-[#18181D] px-3.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[#3E3E4A] hover:text-white focus-visible:outline-none sm:flex-initial"
          >
            <span>Roadmap</span>
            <ArrowRight className="h-3 w-3 text-[var(--text-tertiary)]" />
          </button>
        </div>
      </div>
    </div>
  );
}
