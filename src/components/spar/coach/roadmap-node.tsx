"use client";

import { ArrowRight, Check, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CourseLesson } from "@/lib/courses";

export type NodeStatus = "completed" | "current" | "available";

export interface RoadmapNodeProps {
  lesson: CourseLesson;
  lessonNumber: number;
  status: NodeStatus;
  isSelected: boolean;
  isLast: boolean;
  offsetIndex?: number;
  launchingChamber?: boolean;
  onSelectNode: (lessonId: string) => void;
  onLaunchLesson: (lessonId: string) => void;
  onApplyInRoom?: (lesson: CourseLesson) => void;
}

export function RoadmapNode({
  lesson,
  lessonNumber,
  status,
  isSelected,
  isLast,
  onSelectNode,
  onLaunchLesson,
}: RoadmapNodeProps) {
  const isCompleted = status === "completed";
  const isCurrent = status === "current";

  function handleClick() {
    onSelectNode?.(lesson.id);
    onLaunchLesson(lesson.id);
  }

  return (
    <div className="relative flex flex-col items-center w-full max-w-md">
      {/* Clickable Lesson Card — Tap or Click Anywhere to Open Slides Directly */}
      <button
        type="button"
        onClick={handleClick}
        aria-label={`Open lesson ${lessonNumber}: ${lesson.title} (${
          isCompleted
            ? "Completed, click to review"
            : isCurrent
            ? "Current lesson, click to start"
            : "Available, click to start"
        })`}
        className={cn(
          "group relative flex w-full items-center justify-between gap-3.5 sm:gap-4 rounded-2xl border p-3.5 sm:p-4 text-left transition-all duration-200 cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
          isCurrent
            ? "border-white/30 bg-[#141414] shadow-[0_0_24px_rgba(255,255,255,0.08),0_8px_20px_rgba(0,0,0,0.6)] hover:border-white/50 hover:bg-[#161616]"
            : isCompleted
            ? "border-white/10 bg-[#121212] hover:border-white/25 hover:bg-[#161616] shadow-md"
            : "border-white/10 bg-[#121212] hover:border-white/20 hover:bg-[#141414] shadow-md",
          isSelected && !isCurrent && "border-white/25"
        )}
      >
        <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
          {/* 3D Tactile Concentric Disc */}
          <div
            className={cn(
              "relative flex shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-105",
              "h-12 w-12 sm:h-14 sm:w-14",
              isCurrent
                ? "p-1 bg-gradient-to-b from-white/40 via-white/15 to-transparent shadow-[0_0_16px_rgba(255,255,255,0.35)]"
                : isCompleted
                ? "p-0.5 bg-white/20"
                : "p-0.5 bg-white/[0.04]"
            )}
          >
            <div
              className={cn(
                "flex h-full w-full items-center justify-center rounded-full border transition-all duration-200",
                isCurrent
                  ? "border-white bg-gradient-to-b from-white via-neutral-100 to-neutral-300 text-black shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),inset_0_-2px_4px_rgba(0,0,0,0.4)]"
                  : isCompleted
                  ? "border-white/30 bg-[#181818] text-white"
                  : "border-white/10 bg-[#101010] text-neutral-400 group-hover:border-white/25 group-hover:text-white"
              )}
            >
              <div
                className={cn(
                  "flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full transition-transform duration-200",
                  isCurrent
                    ? "border border-black/10 bg-white text-black shadow-inner"
                    : isCompleted
                    ? "border border-white/20 bg-white/[0.08] text-white"
                    : "border border-white/10 bg-white/[0.02] text-neutral-400"
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4 stroke-[2.5]" />
                ) : isCurrent ? (
                  <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                ) : (
                  <span className="font-mono text-xs font-semibold">
                    {lessonNumber}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Title & Level Indicator */}
          <div className="min-w-0">
            <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 block">
              Level {lessonNumber}
            </span>
            <h3
              className={cn(
                "text-sm sm:text-base font-bold leading-snug line-clamp-2 transition-colors",
                isCurrent
                  ? "text-white"
                  : "text-neutral-200 group-hover:text-white"
              )}
            >
              {lesson.title}
            </h3>
          </div>
        </div>

        {/* Action Button Indicator */}
        <div className="shrink-0 flex items-center">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200",
              isCurrent
                ? "bg-white text-black shadow-md group-hover:bg-neutral-200"
                : isCompleted
                ? "bg-white/10 text-neutral-300 group-hover:bg-white/20 group-hover:text-white"
                : "bg-white/[0.06] text-neutral-300 group-hover:bg-white/15 group-hover:text-white"
            )}
          >
            {isCompleted ? (
              <>
                <RotateCcw className="h-3 w-3" />
                <span>Review</span>
              </>
            ) : (
              <>
                <span>Start</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </span>
        </div>
      </button>

      {/* Hairline Continuous Connector joining to next node */}
      {!isLast && (
        <div
          className={cn(
            "h-4 sm:h-5 w-0.5 my-1 transition-colors duration-200",
            isCompleted ? "bg-white/30" : "bg-white/10"
          )}
        />
      )}
    </div>
  );
}
