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
      {/* Meandering Node Unit: Solid 3D Disc + Title Label */}
      <div className="flex items-center gap-4 sm:gap-6 py-3 sm:py-4 group">
        {/* Solid Tactile 3D Disc (Click to open lesson straight away) */}
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
            "relative flex shrink-0 items-center justify-center rounded-full border-[3px] font-display font-extrabold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C6FF3D]/70 active:translate-y-[3px] cursor-pointer",
            "h-15 w-15 sm:h-16 sm:w-16 md:h-18 md:w-18",
            isCurrent
              ? "border-[#D9FF73] bg-[#C6FF3D] text-[#0B0D06] shadow-[0_4px_0_0_#6B8E1A,0_0_0_6px_rgba(198,255,61,0.18)] hover:bg-[#D4FF66]"
              : isCompleted
                ? "border-[#C6FF3D]/65 bg-[#1B210D] text-[#C6FF3D] shadow-[0_4px_0_0_#0A0D04] hover:border-[#C6FF3D]"
                : isSelected
                  ? "border-[#C6FF3D]/60 bg-[#1B210D] text-[#C6FF3D] shadow-[0_4px_0_0_#060608]"
                  : "border-[#32323E] bg-[#181820] text-neutral-300 shadow-[0_4px_0_0_#060608] hover:border-[#4A4A5A] hover:text-white"
          )}
        >
          {isCompleted ? (
            <Check className="h-5 w-5 stroke-[3]" />
          ) : isCurrent ? (
            <Play className="h-5 w-5 fill-current ml-0.5" />
          ) : (
            <span className="font-display text-base font-bold tabular-nums">
              {lessonNumber}
            </span>
          )}
        </button>

        {/* Clean Label beside the disc (Click to open lesson straight away) */}
        <button
          type="button"
          onClick={handleClick}
          aria-label={`Open lesson ${lessonNumber}: ${lesson.title}`}
          className={cn(
            "min-w-0 max-w-[220px] sm:max-w-xs md:max-w-sm cursor-pointer select-none text-left transition-colors focus-visible:outline-none focus-visible:underline",
            isCurrent
              ? "font-display text-white font-bold"
              : isSelected
              ? "font-display text-white font-semibold"
              : "text-neutral-300 hover:text-white font-medium"
          )}
        >
          <span className="text-sm sm:text-base leading-snug line-clamp-2">
            {lesson.title}
          </span>
        </button>
      </div>

      {/* Continuous Tactile Connector joining to next node */}
      {!isLast && (
        <div
          className={cn(
            "h-6 sm:h-8 w-1 rounded-full transition-colors duration-200",
            isCompleted ? "bg-[#C6FF3D]/45" : "bg-[#262630]"
          )}
        />
      )}
    </div>
  );
}
