"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Compass, MessageSquare, RotateCcw, Shield, Swords, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getCourseLessons,
  getNextIncompleteLesson,
  type Course,
  type CourseLesson,
} from "@/lib/courses";
import { RoadmapNode, type NodeStatus } from "./roadmap-node";
import { CourseEmblem } from "./course-emblem";

export interface CourseRoadmapProps {
  course: Course;
  completedLessonIds: ReadonlySet<string>;
  launchingChamber?: boolean;
  onBackToCatalog: () => void;
  onStartLesson: (lessonId: string) => void;
  onLaunchChamber?: (
    course: Pick<Course, "id" | "title">,
    lesson: CourseLesson
  ) => void;
}

function getCourseBadgeIcon(category: string) {
  const lower = category.toLowerCase();
  if (lower.includes("pressure") || lower.includes("recovery")) {
    return <Zap className="h-6 w-6 text-white" />;
  }
  if (lower.includes("q&a") || lower.includes("defense")) {
    return <Shield className="h-6 w-6 text-white" />;
  }
  if (lower.includes("communication") || lower.includes("vocal")) {
    return <MessageSquare className="h-6 w-6 text-white" />;
  }
  return <Compass className="h-6 w-6 text-white" />;
}

export function CourseRoadmap({
  course,
  completedLessonIds,
  launchingChamber = false,
  onBackToCatalog,
  onStartLesson,
  onLaunchChamber,
}: CourseRoadmapProps) {
  const allLessons = getCourseLessons(course);
  const nextLesson = getNextIncompleteLesson(course, completedLessonIds);

  const [selectedNodeId, setSelectedNodeId] = useState<string>(
    nextLesson?.id ?? allLessons[0]?.id ?? ""
  );

  const selectedLesson =
    allLessons.find((l) => l.id === selectedNodeId) ?? allLessons[0];

  const completedCount = allLessons.filter((l) =>
    completedLessonIds.has(l.id)
  ).length;
  const totalCount = allLessons.length;
  const progressPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const isStarted = completedCount > 0;
  const isSelectedDone = selectedLesson
    ? completedLessonIds.has(selectedLesson.id)
    : false;

  const selectedLessonIndex = selectedLesson
    ? allLessons.findIndex((l) => l.id === selectedLesson.id) + 1
    : 1;

  function handleSelectNode(lessonId: string) {
    setSelectedNodeId(lessonId);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-6xl space-y-6 px-5 pb-16 pt-7 sm:px-8 sm:pt-10 lg:pb-20">
      {/* Top Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={onBackToCatalog}
          className="inline-flex items-center gap-1.5 font-medium text-neutral-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Learn
        </button>
        <span className="text-neutral-600">/</span>
        <span className="font-semibold text-white truncate">{course.title}</span>
      </nav>

      {/* Brilliant-Style 2-Column Split: Left Sticky Folio + Right Tactile Disc Journey */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12 items-start">
        {/* LEFT COLUMN: Pinned Course Card */}
        <aside className="lg:col-span-5 lg:sticky lg:top-24 space-y-4">
          <div className="spar-chunky-card space-y-5 p-6 sm:p-7">
            {/* Distinctive Illustration / Motif Icon */}
            <CourseEmblem category={course.category} size="lg" />

            {/* Title & Single-Sentence Clean Premise */}
            <div className="space-y-2">
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {course.title}
              </h1>
              <p className="text-sm leading-relaxed text-neutral-300 font-normal">
                {course.subtitle}
              </p>
            </div>

            {/* Minimal Stats Row matching Brilliant */}
            <div className="flex items-center gap-4 text-xs font-mono text-[var(--text-secondary)] pt-2 border-t border-white/[0.06]">
              <span className="inline-flex items-center gap-1.5">
                <span className="text-[#C6FF3D] font-semibold">◎</span>
                <span>{totalCount} Lessons</span>
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-[#C6FF3D] font-semibold">⚡</span>
                <span>{totalCount * 3} Exercises</span>
              </span>
            </div>

            {/* Progress Bar (Only when started) */}
            {isStarted && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span className="font-medium text-white">
                    {completedCount} of {totalCount} completed
                  </span>
                  <span className="font-mono text-[#C6FF3D] font-bold tabular-nums">
                    {progressPct}%
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#0B0B0D] border border-[#2C2C34]">
                  <div
                    className="h-full rounded-full bg-[#C6FF3D] transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* RIGHT COLUMN: Tactile Roadmap Path */}
        <main className="lg:col-span-7 flex flex-col items-center space-y-6">
          {/* Top Level Milestone Header Banner (Non-clickable, roadmap objects below are interactive) */}
          <div className="spar-chunky-card-volt w-full max-w-md px-6 py-4 text-center select-none">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#C6FF3D] block">
              LEVEL {selectedLessonIndex}
            </span>
            <h2 className="font-display text-base sm:text-lg font-bold text-white tracking-tight mt-0.5 truncate">
              {selectedLesson?.title}
            </h2>
          </div>

          {/* The Tactile Card Path */}
          <div className="w-full flex flex-col items-center py-2 sm:py-4">
            {allLessons.map((lesson, idx) => {
              const isDone = completedLessonIds.has(lesson.id);
              const isCurrent =
                (nextLesson?.id === lesson.id && !isDone) ||
                (!nextLesson && idx === 0);
              const status: NodeStatus = isDone
                ? "completed"
                : isCurrent
                ? "current"
                : "available";

              const isLast = idx === allLessons.length - 1;

              return (
                <RoadmapNode
                  key={lesson.id}
                  lesson={lesson}
                  lessonNumber={idx + 1}
                  status={status}
                  isSelected={selectedNodeId === lesson.id}
                  isLast={isLast}
                  offsetIndex={idx}
                  onSelectNode={handleSelectNode}
                  onLaunchLesson={onStartLesson}
                />
              );
            })}
          </div>

          {/* Bottom Selected Lesson Action Launcher */}
          {selectedLesson && (
            <div className="spar-chunky-card w-full max-w-md space-y-3.5 p-5 text-center sm:p-6">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400 block">
                {isSelectedDone ? "COMPLETED" : "UP NEXT"}
              </span>
              <h3 className="font-display text-lg sm:text-xl font-bold text-white tracking-tight">
                {selectedLesson.title}
              </h3>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
                {onLaunchChamber && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={launchingChamber}
                    onClick={() => onLaunchChamber(course, selectedLesson)}
                    className="h-11 w-full rounded-xl border-[#2C2C34] bg-[#18181D] px-5 text-xs font-semibold text-neutral-200 hover:border-[#3E3E4A] hover:text-white sm:w-auto"
                  >
                    <Swords className="mr-1.5 h-3.5 w-3.5" />
                    {launchingChamber ? "Opening room..." : "Apply in room"}
                  </Button>
                )}

                <button
                  type="button"
                  onClick={() => onStartLesson(selectedLesson.id)}
                  className="spar-volt-btn inline-flex h-11 w-full flex-1 items-center justify-center gap-2 px-6 text-sm sm:w-auto"
                >
                  {isSelectedDone ? (
                    <>
                      <RotateCcw className="h-4 w-4" />
                      Review
                    </>
                  ) : (
                    <>
                      Start
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
      </div>
    </div>
  );
}
