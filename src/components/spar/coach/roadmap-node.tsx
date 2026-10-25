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
import { ARCHETYPES } from "@/lib/personas";
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
  launchingChamber?: boolean;
  onSelectNode: (lessonId: string) => void;
  onLaunchLesson: (lessonId: string) => void;
  onApplyInRoom?: (lesson: CourseLesson) => void;
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
  launchingChamber = false,
  onSelectNode,
  onLaunchLesson,
  onApplyInRoom,
}: RoadmapNodeProps) {
  const activityType: ActivityType = lesson.activityType ?? "lesson";
  const activityLabel = ACTIVITY_TYPE_LABELS[activityType];
  const archetype =
    ARCHETYPES[lesson.roomConfig.archetype] ?? ARCHETYPES.skeptic;

  const statusLabel =
    status === "completed"
      ? "Completed"
      : status === "current"
      ? "Up next"
      : "Available";

  const actionLabel =
    status === "completed"
      ? "Redo"
      : status === "current"
      ? "Start lesson"
      : "Open lesson";

  const isCheckpointOrDrill =
    activityType === "checkpoint" ||
    activityType === "final_challenge" ||
    activityType === "drill" ||
    activityType === "simulation";

  return (
    <div className="relative flex items-stretch gap-4 sm:gap-6">
      {/* Left Vertical Timeline Axis (Tactile Circle + Continuous Hairline Connector) */}
      <div className="flex flex-col items-center shrink-0">
        <button
          type="button"
          onClick={() => onSelectNode(lesson.id)}
          aria-label={`${lessonNumber}. ${lesson.title} (${statusLabel})`}
          aria-expanded={isSelected}
          className={cn(
            "relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white shadow-lg",
            status === "completed"
              ? "border border-white/25 bg-[#16161a] text-white hover:border-white/40"
              : status === "current"
              ? "border-2 border-white bg-white text-black ring-4 ring-white/10 scale-105"
              : "border border-white/10 bg-[#0e0e12] text-neutral-400 hover:border-white/25 hover:text-white"
          )}
        >
          {status === "completed" ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : status === "current" ? (
            <Play className="h-4 w-4 fill-current ml-0.5" />
          ) : (
            <span>0{lessonNumber}</span>
          )}
        </button>

        {/* Continuous hairline connector joining this circle to the next */}
        {!isLast && (
          <div
            className={cn(
              "w-0.5 flex-1 my-2 transition-colors",
              status === "completed" ? "bg-white/30" : "bg-white/10"
            )}
          />
        )}
      </div>

      {/* Right Lesson Card (Brilliant-Style Minimalist Floating Panel) */}
      <div className={cn("min-w-0 flex-1", !isLast ? "pb-8" : "pb-2")}>
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
          className={cn(
            "w-full rounded-2xl border p-5 text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40",
            status === "current"
              ? "border-white/30 bg-[#121216] shadow-md"
              : status === "completed"
              ? "border-white/15 bg-[#0f0f13] hover:border-white/25"
              : isSelected
              ? "border-white/25 bg-[#121216]"
              : "border-white/[0.08] bg-[#0c0c10] hover:border-white/15 hover:bg-[#101014]"
          )}
        >
          {/* Top Metadata Row: Activity Badge · Duration · Status */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <span className="font-mono font-medium text-neutral-400">
                LEVEL 0{lessonNumber}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-neutral-300">
                {getActivityIcon(activityType)}
                {activityLabel}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-neutral-400">
                <Clock className="h-3 w-3 text-neutral-500" />
                {lesson.durationMinutes} min
              </span>
            </div>

            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider",
                status === "completed"
                  ? "border border-white/20 bg-white/[0.06] text-neutral-200"
                  : status === "current"
                  ? "bg-white font-semibold text-black"
                  : "border border-white/10 bg-white/[0.02] text-neutral-400"
              )}
            >
              {statusLabel}
            </span>
          </div>

          {/* Lesson Title & Concise Tagline */}
          <h4 className="mt-2 text-base font-semibold tracking-tight text-white sm:text-lg">
            {lesson.title}
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-neutral-300 sm:text-sm">
            {lesson.tagline}
          </p>

          {/* Partner & Target Info */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3 text-xs text-neutral-300">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                <span className="text-neutral-400">Partner in room: </span>
                <strong className="font-semibold text-white">
                  {lesson.roomConfig.personaName}
                </strong>{" "}
                <span className="text-neutral-400">({archetype.tagline})</span>
              </span>
              {isCheckpointOrDrill && lesson.slides.mission.passCriteria && (
                <span className="text-neutral-300">
                  ·{" "}
                  <span className="text-neutral-400">Target: </span>
                  {lesson.slides.mission.passCriteria}
                </span>
              )}
            </div>

            {!isSelected && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-200">
                {actionLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            )}
          </div>

          {/* Floating Action Popover when Node is Selected / Current (Brilliant Screenshot 2 Style) */}
          {isSelected && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/12 bg-[#09090c] p-4 shadow-inner"
            >
              <div className="min-w-0 max-w-md space-y-0.5">
                <span className="text-[10px] font-mono tracking-wider uppercase text-neutral-400">
                  Operational Law
                </span>
                <p className="text-xs text-white font-medium leading-relaxed">
                  “{lesson.slides.mentalModel.goldenRule}”
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {onApplyInRoom && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={launchingChamber}
                    onClick={() => onApplyInRoom(lesson)}
                    className="border-white/15 bg-white/[0.04] text-xs font-medium text-neutral-200 hover:bg-white/[0.08] hover:text-white h-9"
                  >
                    <Swords className="mr-1.5 h-3.5 w-3.5" />
                    {launchingChamber ? "Opening room..." : "Apply in the room"}
                  </Button>
                )}

                <Button
                  size="sm"
                  onClick={() => onLaunchLesson(lesson.id)}
                  className="bg-white text-black hover:bg-neutral-200 text-xs font-bold px-4 h-9 shadow-md"
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
    </div>
  );
}
