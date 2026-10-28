"use client";

import React, { useRef } from "react";
import {
  Check,
  Flag,
  Lock,
  Mic,
  Play,
  Radio,
  Sparkles,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getCourseLessons,
  getNextIncompleteLesson,
  type Course,
  type CourseLesson,
} from "@/lib/courses";

export interface InlineRoadmapTrackProps {
  course: Course;
  completedLessonIds: ReadonlySet<string>;
  onStartLesson: (lessonId: string) => void;
  className?: string;
}

export type RoadmapTileState = "mastered" | "up_next" | "in_progress" | "not_started" | "locked";

function getTileIcon(lesson: CourseLesson, isCheckpoint: boolean, isDrill: boolean) {
  if (isCheckpoint) {
    return <Trophy className="h-5 w-5 text-amber-400" />;
  }
  if (isDrill) {
    return <Mic className="h-5 w-5 text-white" />;
  }
  return <Radio className="h-5 w-5 text-white" />;
}

export function InlineRoadmapTrack({
  course,
  completedLessonIds,
  onStartLesson,
  className,
}: InlineRoadmapTrackProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lessons = getCourseLessons(course);
  const nextLesson = getNextIncompleteLesson(course, completedLessonIds);

  return (
    <div
      className={cn(
        "relative rounded-2xl border border-[var(--border-subtle)] bg-[#0d0d12] p-5 sm:p-6 overflow-hidden",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]",
        className
      )}
    >
      {/* Track Guide Wire running behind all node tiles */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-8 right-8 top-[68px] h-[2px] bg-white/[0.07] z-0"
      />

      {/* Horizontally scrollable row with scroll snap */}
      <div
        ref={scrollRef}
        role="region"
        aria-label={`${course.title} lessons roadmap`}
        className="relative z-10 flex items-start gap-4 sm:gap-6 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory"
        style={{
          maskImage:
            "linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent 100%)",
        }}
      >
        {lessons.map((lesson, idx) => {
          const isMastered = completedLessonIds.has(lesson.id);
          const isUpNext = !isMastered && lesson.id === nextLesson?.id;
          const isCheckpoint = idx === lessons.length - 1 && lessons.length > 2;
          const isDrill = lesson.tagline?.toLowerCase().includes("drill") || lesson.title.toLowerCase().includes("drill");

          let state: RoadmapTileState = "not_started";
          if (isMastered) state = "mastered";
          else if (isUpNext) state = "up_next";

          const eyebrow = isCheckpoint
            ? "CHECKPOINT"
            : isDrill
            ? `DRILL ${idx + 1}`
            : `LESSON ${idx + 1}`;

          return (
            <div
              key={lesson.id}
              className="flex shrink-0 flex-col items-center w-[124px] sm:w-[136px] snap-start select-none"
            >
              {/* Tactile Node Tile */}
              <button
                type="button"
                onClick={() => onStartLesson(lesson.id)}
                aria-label={`Open lesson ${idx + 1}: ${lesson.title} (${
                  isMastered ? "Mastered" : isUpNext ? "Up next" : "Available"
                })`}
                className={cn(
                  "group relative flex flex-col justify-between h-[134px] w-full rounded-[16px] border p-3 text-left transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                  // State Styles
                  state === "up_next" && [
                    "border-[var(--accent)] bg-[var(--surface-2)]",
                    "shadow-[0_0_16px_var(--accent-soft),inset_0_1px_0_0_rgba(255,255,255,0.15)]",
                    "hover:scale-[1.02]",
                  ],
                  state === "mastered" && [
                    "border-white/15 bg-white/[0.04]",
                    "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_4px_12px_rgba(0,0,0,0.4)]",
                    "hover:border-white/30 hover:bg-white/[0.07]",
                  ],
                  state === "not_started" && [
                    "border-white/10 bg-[#121218]",
                    "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04),0_4px_10px_rgba(0,0,0,0.4)]",
                    "hover:border-white/20 hover:bg-[#161620]",
                  ]
                )}
                style={{
                  boxShadow:
                    state === "up_next"
                      ? "0 4px 0 var(--accent-dark), 0 0 16px var(--accent-soft)"
                      : "0 4px 0 rgba(0,0,0,0.5)",
                }}
              >
                {/* Mastered Badge */}
                {state === "mastered" && (
                  <div className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-black shadow-md">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </div>
                )}

                {/* Up Next Pill */}
                {state === "up_next" && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[9px] font-bold tracking-wider text-white uppercase shadow-sm">
                    Up next
                  </div>
                )}

                {/* Eyebrow */}
                <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)] pt-0.5">
                  {eyebrow}
                </div>

                {/* Centered Tactical Icon */}
                <div className="my-auto flex items-center justify-center">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-xl transition-transform group-hover:scale-110",
                      state === "up_next"
                        ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                        : state === "mastered"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-white/[0.05] text-neutral-400"
                    )}
                  >
                    {getTileIcon(lesson, isCheckpoint, isDrill)}
                  </div>
                </div>

                {/* Bottom Micro Progress Bar */}
                <div className="w-full">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        state === "mastered"
                          ? "w-full bg-emerald-400"
                          : state === "up_next"
                          ? "w-1/3 bg-[var(--accent)]"
                          : "w-0"
                      )}
                    />
                  </div>
                </div>
              </button>

              {/* Lesson Title Beneath Tile */}
              <p
                title={lesson.title}
                className={cn(
                  "mt-2.5 text-center text-xs font-medium leading-snug line-clamp-2 transition-colors",
                  state === "up_next"
                    ? "text-white font-semibold"
                    : state === "mastered"
                    ? "text-neutral-300"
                    : "text-neutral-400"
                )}
              >
                {lesson.title}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
