"use client";

import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Flag,
  Mic,
  Play,
  RotateCcw,
  Swords,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ACTIVITY_TYPE_LABELS,
  type ActivityType,
  type CourseLesson,
} from "@/lib/courses";

export type NodeStatus = "completed" | "current" | "available";

export interface RoadmapNodeProps {
  lesson: CourseLesson;
  lessonNumber: number;
  status: NodeStatus;
  isSelected: boolean;
  isLast: boolean;
  alignment: "left" | "center" | "right";
  onSelectNode: (lessonId: string) => void;
  onLaunchLesson: (lessonId: string) => void;
}

function getActivityIcon(type: ActivityType = "lesson") {
  switch (type) {
    case "drill":
      return <Mic className="h-3.5 w-3.5" />;
    case "simulation":
      return <Swords className="h-3.5 w-3.5" />;
    case "checkpoint":
    case "final_challenge":
      return <Flag className="h-3.5 w-3.5" />;
    default:
      return <BookOpen className="h-3.5 w-3.5" />;
  }
}

export function RoadmapNode({
  lesson,
  lessonNumber,
  status,
  isSelected,
  isLast,
  alignment,
  onSelectNode,
  onLaunchLesson,
}: RoadmapNodeProps) {
  const activityType: ActivityType = lesson.activityType ?? "lesson";
  const activityLabel = ACTIVITY_TYPE_LABELS[activityType];

  const statusLabel =
    status === "completed"
      ? "Mastered"
      : status === "current"
      ? "Up next"
      : "Available";

  const actionLabel =
    status === "completed"
      ? "Review"
      : status === "current"
      ? "Start"
      : "Practice";

  // Gentle desktop zigzag offset while staying strictly single-column vertical on mobile
  const alignmentOffsetClass =
    alignment === "left"
      ? "md:-translate-x-10"
      : alignment === "right"
      ? "md:translate-x-10"
      : "md:translate-x-0";

  return (
    <div className="relative flex flex-col items-center">
      {/* Node + Label Cluster (No heavy rectangular card wrapper around every node) */}
      <div
        className={cn(
          "relative z-10 flex w-full max-w-xl items-start gap-5 transition-transform",
          alignmentOffsetClass
        )}
      >
        {/* Medallion Node Button */}
        <div className="relative flex flex-col items-center">
          <button
            type="button"
            onClick={() => onSelectNode(lesson.id)}
            aria-label={`${lessonNumber}. ${lesson.title} (${statusLabel})`}
            aria-expanded={isSelected}
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 font-mono text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
              status === "completed"
                ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-300"
                : status === "current"
                ? "border-white bg-white text-black ring-4 ring-white/15"
                : "border-white/20 bg-[#141418] text-neutral-300 hover:border-white/45 hover:text-white"
            )}
          >
            {status === "completed" ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : status === "current" ? (
              <Play className="h-5 w-5 fill-current ml-0.5" />
            ) : (
              <span>{lessonNumber}</span>
            )}
          </button>
        </div>

        {/* Open, Lightweight Node Text & Compact Expandable Action */}
        <div className="min-w-0 flex-1 pt-0.5">
          <div
            role="button"
            tabIndex={0}
            onClick={() => onSelectNode(lesson.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectNode(lesson.id);
              }
            }}
            className="group cursor-pointer text-left focus-visible:outline-none"
          >
            {/* Metadata Line: Number · Activity Type · Duration · Status */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono text-neutral-400">
                0{lessonNumber}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] font-medium text-neutral-300">
                {getActivityIcon(activityType)}
                {activityLabel}
              </span>
              <span className="inline-flex items-center gap-1 text-neutral-400">
                <Clock className="h-3 w-3 text-neutral-500" />
                {lesson.durationMinutes} min
              </span>
              <span>·</span>
              <span
                className={cn(
                  "text-[11px] font-semibold",
                  status === "completed"
                    ? "text-emerald-400"
                    : status === "current"
                    ? "text-white"
                    : "text-neutral-400"
                )}
              >
                {statusLabel}
              </span>
            </div>

            {/* Lesson Title */}
            <h4 className="mt-1.5 text-lg font-semibold tracking-tight text-white group-hover:underline">
              {lesson.title}
            </h4>

            {/* Concise One-Line Purpose */}
            <p className="mt-0.5 text-sm text-neutral-400">
              {lesson.tagline}
            </p>
          </div>

          {/* Compact Detail Drawer (Shown when node is active/selected or is 'current') */}
          {isSelected && (
            <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/12 bg-[#141418] px-4 py-3">
              <div className="text-xs text-neutral-300">
                <span className="text-neutral-400">Partner in room: </span>
                <strong className="text-white">
                  {lesson.roomConfig.personaName}
                </strong>{" "}
                ·{" "}
                <span className="text-neutral-400">
                  “{lesson.slides.mentalModel.goldenRule}”
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => onLaunchLesson(lesson.id)}
                  className="bg-white text-black hover:bg-neutral-200 text-xs font-semibold"
                >
                  {status === "completed" ? (
                    <>
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                      {actionLabel}
                    </>
                  ) : (
                    <>
                      {actionLabel}
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Connecting Vertical Path Line between Nodes */}
      {!isLast && (
        <div className="my-2 flex w-full max-w-xl justify-start">
          <div
            className={cn(
              "ml-7 h-12 w-0.5 transition-colors",
              alignmentOffsetClass,
              status === "completed"
                ? "bg-emerald-400/60"
                : "bg-white/15"
            )}
          />
        </div>
      )}
    </div>
  );
}
