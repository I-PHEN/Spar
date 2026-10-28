"use client";

import { Check, Play } from "lucide-react";
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

// Gentle sine-wave stagger offsets matching Brilliant's meandering path
const DESKTOP_OFFSETS = [
  "lg:translate-x-0",
  "lg:translate-x-8",
  "lg:-translate-x-6",
  "lg:translate-x-5",
  "lg:-translate-x-4",
];

const MOBILE_OFFSETS = [
  "translate-x-0",
  "translate-x-3",
  "-translate-x-3",
  "translate-x-2",
  "-translate-x-2",
];

export function RoadmapNode({
  lesson,
  lessonNumber,
  status,
  isSelected,
  isLast,
  offsetIndex = 0,
  onSelectNode,
  onLaunchLesson,
}: RoadmapNodeProps) {
  const desktopOffset = DESKTOP_OFFSETS[offsetIndex % DESKTOP_OFFSETS.length];
  const mobileOffset = MOBILE_OFFSETS[offsetIndex % MOBILE_OFFSETS.length];

  const isCompleted = status === "completed";
  const isCurrent = status === "current";

  function handleClick() {
    onSelectNode?.(lesson.id);
    onLaunchLesson(lesson.id);
  }

  return (
    <div
      className={cn(
        "relative flex flex-col items-center transition-transform duration-300",
        desktopOffset,
        mobileOffset
      )}
    >
      {/* Meandering Node Unit: 3D Disc + Title Label */}
      <div className="flex items-center gap-4 sm:gap-6 py-3 sm:py-4 group">
        {/* 3D Tactile Concentric Disc (Click to open lesson straight away) */}
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
            "relative flex shrink-0 items-center justify-center rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-95 cursor-pointer",
            // 3D Physical Sizing
            "h-14 w-14 sm:h-16 sm:w-16 md:h-18 md:w-18",
            // Outer Concentric Ring & Bevel Depth
            isCurrent
              ? "p-2 rounded-full border-2 border-[var(--accent)] bg-[var(--surface-2)] shadow-[0_0_24px_rgba(47,101,246,0.45),0_8px_16px_rgba(0,0,0,0.6)] ring-4 ring-[var(--accent)]/30"
              : isSelected
              ? "p-1.5 rounded-full border border-[var(--accent)] bg-[var(--surface-1)] shadow-[0_0_16px_rgba(47,101,246,0.25)]"
              : "p-1 rounded-full bg-white/[0.04] shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
          )}
        >
          {/* Outer Bevel Ring (Concentric Grooved Pad) */}
          <div
            className={cn(
              "flex h-full w-full items-center justify-center rounded-full border transition-all duration-200",
              isCurrent
                ? "border-[var(--accent)] bg-gradient-to-b from-[var(--accent)] to-[#1E40AF] text-white shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),0_4px_10px_rgba(0,0,0,0.5)]"
                : isCompleted
                ? "border-emerald-500/40 bg-[#141d18] text-emerald-400 hover:border-emerald-500/70 shadow-[inset_0_1px_2px_rgba(255,255,255,0.1),0_2px_4px_rgba(0,0,0,0.4)]"
                : "border-white/10 bg-[#121218] text-neutral-400 hover:border-white/25 hover:text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_2px_4px_rgba(0,0,0,0.4)]"
            )}
          >
            {/* Inner Concentric Core */}
            <div
              className={cn(
                "flex h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-105",
                isCurrent
                  ? "border border-white/30 bg-white text-[var(--accent)] shadow-md"
                  : isCompleted
                  ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border border-white/10 bg-white/[0.02] text-neutral-400"
              )}
            >
              {isCompleted ? (
                <Check className="h-4 w-4 stroke-[2.5]" />
              ) : isCurrent ? (
                <Play className="h-4 w-4 fill-current ml-0.5" />
              ) : (
                <span className="font-mono text-xs font-semibold">
                  {lessonNumber}
                </span>
              )}
            </div>
          </div>
        </button>

        {/* Clean Label beside the disc (Click to open lesson straight away) */}
        <button
          type="button"
          onClick={handleClick}
          aria-label={`Open lesson ${lessonNumber}: ${lesson.title}`}
          className={cn(
            "min-w-0 max-w-[220px] sm:max-w-xs md:max-w-sm cursor-pointer select-none text-left transition-colors focus-visible:outline-none focus-visible:underline",
            isCurrent
              ? "text-white font-bold"
              : isSelected
              ? "text-white font-semibold"
              : "text-neutral-300 hover:text-white font-medium"
          )}
        >
          <span className="text-sm sm:text-base leading-snug line-clamp-2">
            {lesson.title}
          </span>
        </button>
      </div>

      {/* Hairline Continuous Connector joining to next node */}
      {!isLast && (
        <div
          className={cn(
            "h-6 sm:h-8 w-0.5 transition-colors duration-200",
            isCompleted ? "bg-white/30" : "bg-white/10"
          )}
        />
      )}
    </div>
  );
}
