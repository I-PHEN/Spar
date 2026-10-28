"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Play,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  getCourseLessons,
  getNextIncompleteLesson,
  type Course,
} from "@/lib/courses";
import { CourseEmblem } from "./course-emblem";
import { InlineRoadmapTrack } from "./inline-roadmap-track";

export interface MyCourseCardProps {
  course: Course;
  completedLessonIds: ReadonlySet<string>;
  isHeroCourse?: boolean;
  defaultExpanded?: boolean;
  onStartOrContinueLesson: (courseId: string, lessonId: string) => void;
  onStartLesson: (courseId: string, lessonId: string) => void;
  onRemoveCourse: (courseId: string) => void;
}

export function MyCourseCard({
  course,
  completedLessonIds,
  isHeroCourse = false,
  defaultExpanded = false,
  onStartOrContinueLesson,
  onStartLesson,
  onRemoveCourse,
}: MyCourseCardProps) {
  const [isRoadmapOpen, setIsRoadmapOpen] = useState(defaultExpanded);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const lessons = getCourseLessons(course);
  const completedCount = lessons.filter((l) =>
    completedLessonIds.has(l.id)
  ).length;
  const totalCount = lessons.length;
  const progressPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const nextLesson = getNextIncompleteLesson(course, completedLessonIds);

  const eyebrow = `${course.difficulty.toUpperCase()} · ${course.category.toUpperCase()}`;

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
        "group relative rounded-[20px] border transition-all duration-200 overflow-hidden",
        isHeroCourse
          ? "border-[var(--border-strong)] bg-[var(--surface-2)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_16px_36px_-16px_rgba(0,0,0,0.7)]"
          : "border-[var(--border-subtle)] bg-[var(--surface-1)] hover:border-[var(--border-strong)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_8px_24px_-12px_rgba(0,0,0,0.6)]"
      )}
      style={
        isHeroCourse
          ? {
              backgroundImage:
                "radial-gradient(circle 380px at 100% 0%, var(--accent-soft), transparent 70%), linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01))",
            }
          : {
              backgroundImage:
                "linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.01))",
            }
      }
    >
      {/* Three-dot context menu */}
      <div className="absolute top-4 right-4 z-20">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label={`Options for ${course.title}`}
            aria-expanded={isMenuOpen}
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
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
                className="absolute right-0 top-9 z-40 w-52 rounded-xl border border-white/10 bg-[#16161e] p-1.5 shadow-2xl backdrop-blur-md"
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
      <div className="p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          {/* Left: Emblem */}
          <div className="shrink-0 pt-0.5">
            <CourseEmblem category={course.category} size="md" />
          </div>

          {/* Middle: Info, Progress & Up Next */}
          <div className="min-w-0 flex-1 space-y-3">
            {/* Single-line truncated eyebrow */}
            <p className="truncate text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
              {eyebrow}
            </p>

            <div>
              <h3 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--text-primary)]">
                {course.title}
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-[var(--text-secondary)] line-clamp-1">
                {course.subtitle || course.description}
              </p>
            </div>

            {/* Progress Bar & Stats */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span>
                  <strong className="text-[var(--text-primary)] font-semibold">
                    {completedCount}
                  </strong>{" "}
                  of {totalCount} lessons mastered
                  <span className="sr-only"> ({completedCount} of {totalCount} completed)</span>
                </span>
                <span className="font-mono tabular-nums text-[var(--accent)] font-semibold">
                  {progressPct}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-all duration-500 shadow-[0_0_8px_var(--accent-soft)]"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* Up Next Preview */}
            {nextLesson ? (
              <p className="truncate text-xs text-[var(--text-secondary)]">
                <span className="text-[var(--text-tertiary)]">Up next: </span>
                <span className="font-medium text-[var(--text-primary)]">
                  {nextLesson.title}
                </span>
              </p>
            ) : (
              <p className="text-xs text-emerald-400 font-medium">
                All lessons mastered! Click below to review.
              </p>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex flex-col sm:items-end gap-2.5 shrink-0 pt-1">
            <button
              type="button"
              onClick={handleContinue}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-xs font-bold text-white transition-all spar-tactile-btn active:scale-95 shadow-md w-full sm:w-auto"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              {completedCount === 0 ? "Start" : "Continue"}
            </button>

            <button
              type="button"
              onClick={() => setIsRoadmapOpen((prev) => !prev)}
              aria-expanded={isRoadmapOpen}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-white py-1 px-2 focus-visible:outline-none"
            >
              <span>Roadmap</span>
              {isRoadmapOpen ? (
                <ChevronUp className="h-3.5 w-3.5 text-neutral-400" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Inline Roadmap Track */}
        <AnimatePresence initial={false}>
          {isRoadmapOpen && (
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="mt-6 pt-5 border-t border-white/[0.06] overflow-hidden"
            >
              <InlineRoadmapTrack
                course={course}
                completedLessonIds={completedLessonIds}
                onStartLesson={(lessonId) => onStartLesson(course.id, lessonId)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
