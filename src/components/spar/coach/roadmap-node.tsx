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
    <div className="relative flex items-stretch gap-4 sm:gap-5">
      {/* Left Straight Vertical Timeline Axis (Circle + Continuous Connector) */}
      <div className="flex flex-col items-center shrink-0">
        <button
          type="button"
          onClick={() => onSelectNode(lesson.id)}
          aria-label={`${lessonNumber}. ${lesson.title} (${statusLabel})`}
          aria-expanded={isSelected}
          className={cn(
            "relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 font-mono text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
            status === "completed"
              ? "border-emerald-400 bg-emerald-500/15 text-emerald-300"
              : status === "current"
              ? "border-white bg-white text-black ring-4 ring-white/10"
              : "border-white/20 bg-[#141418] text-neutral-300 hover:border-white/40 hover:text-white"
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

        {/* Continuous straight vertical connector joining this circle to the next */}
        {!isLast && (
          <div
            className={cn(
              "w-0.5 flex-1 my-1.5 transition-colors",
              status === "completed" ? "bg-emerald-400/60" : "bg-white/15"
            )}
          />
        )}
      </div>

      {/* Right Full-Width Lesson Card */}
      <div className={cn("min-w-0 flex-1", !isLast ? "pb-6" : "pb-1")}>
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
            "w-full rounded-2xl border p-5 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
            status === "current"
              ? "border-white/30 bg-[#141418]"
              : status === "completed"
              ? "border-emerald-500/25 bg-[#111413] hover:border-emerald-500/40"
              : isSelected
              ? "border-white/25 bg-[#131317]"
              : "border-white/10 bg-[#111114] hover:border-white/20 hover:bg-[#141418]"
          )}
        >
          {/* Top Metadata Row: Activity Chip · Duration · Status Badge */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <span className="font-mono font-medium text-neutral-300">
                0{lessonNumber}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.04] px-2.5 py-0.5 text-xs font-medium text-neutral-200">
                {getActivityIcon(activityType)}
                {activityLabel}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-neutral-300">
                <Clock className="h-3.5 w-3.5 text-neutral-400" />
                {lesson.durationMinutes} min
              </span>
            </div>

            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                status === "completed"
                  ? "border border-emerald-500/35 bg-emerald-500/15 text-emerald-300"
                  : status === "current"
                  ? "bg-white font-semibold text-black"
                  : "border border-white/10 bg-white/[0.03] text-neutral-300"
              )}
            >
              {statusLabel}
            </span>
          </div>

          {/* Lesson Title & Concise Skill Purpose */}
          <h4 className="mt-2.5 text-base font-semibold tracking-tight text-white sm:text-lg">
            {lesson.title}
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-neutral-300 sm:text-sm">
            {lesson.tagline}
          </p>

          {/* Consistent 1-Line Room / Skill Preview across all nodes */}
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-3 text-xs text-neutral-300">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                <span className="text-neutral-400">Partner in room: </span>
                <strong className="font-semibold text-white">
                  {lesson.roomConfig.personaName}
                </strong>{" "}
                <span className="text-neutral-300">({archetype.tagline})</span>
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

          {/* Expanded Actions when Node is Selected / Current */}
          {isSelected && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="mt-3.5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0c0c0e] px-4 py-3"
            >
              <p className="text-xs text-neutral-300 max-w-md">
                <span className="font-medium text-white">Core rule: </span>“
                {lesson.slides.mentalModel.goldenRule}”
              </p>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {onApplyInRoom && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={launchingChamber}
                    onClick={() => onApplyInRoom(lesson)}
                    className="border-white/15 bg-white/[0.03] text-xs font-medium text-neutral-200 hover:bg-white/[0.08] hover:text-white"
                  >
                    <Swords className="mr-1.5 h-3.5 w-3.5" />
                    {launchingChamber ? "Opening room..." : "Apply in the room"}
                  </Button>
                )}

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
    </div>
  );
}
