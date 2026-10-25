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
    <div className="mx-auto max-w-6xl px-4 py-6 pb-16 sm:px-6 sm:py-8 lg:pb-20 space-y-6">
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
          <div className="rounded-3xl border border-white/10 bg-[#121212] p-6 sm:p-7 shadow-2xl space-y-5">
            {/* Distinctive Illustration / Motif Icon */}
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.05] shadow-inner">
              {getCourseBadgeIcon(course.category)}
            </div>

            {/* Title & Single-Sentence Clean Premise */}
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {course.title}
              </h1>
              <p className="text-sm leading-relaxed text-neutral-300 font-normal">
                {course.subtitle}
              </p>
            </div>

            {/* Minimal Stats Row matching Brilliant (36 Lessons · 434 Exercises) */}
            <div className="flex items-center gap-4 text-xs font-mono text-neutral-400 pt-2 border-t border-white/[0.06]">
              <span className="inline-flex items-center gap-1.5">
                <span className="text-white">◎</span>
                <span>{totalCount} Lessons</span>
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-white">⚡</span>
                <span>{totalCount * 3} Exercises</span>
              </span>
            </div>

            {/* Progress Bar (Only when started) */}
            {isStarted && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span className="font-medium text-white">
                    {completedCount} of {totalCount} completed
                  </span>
                  <span className="font-mono text-neutral-300 tabular-nums">
                    {progressPct}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* RIGHT COLUMN: Tactile Roadmap Path */}
        <main className="lg:col-span-7 flex flex-col items-center space-y-6">
          {/* Top Level Header Pill (Clickable directly to open current lesson) */}
          <button
            type="button"
            onClick={() => selectedLesson && onStartLesson(selectedLesson.id)}
            aria-label={`Level ${selectedLessonIndex}: ${selectedLesson?.title}. Click to start.`}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141414] px-6 py-3.5 text-center shadow-lg hover:border-white/25 hover:bg-[#161616] transition-all cursor-pointer group"
          >
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400 block group-hover:text-neutral-300">
              LEVEL {selectedLessonIndex}
            </span>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight mt-0.5 truncate flex items-center justify-center gap-1.5">
              <span>{selectedLesson?.title}</span>
              <ArrowRight className="h-4 w-4 text-neutral-400 group-hover:text-white group-hover:translate-x-0.5 transition-transform" />
            </h2>
          </button>

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
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121212] p-5 sm:p-6 text-center space-y-3.5 shadow-2xl">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400 block">
                {isSelectedDone ? "COMPLETED" : "UP NEXT"}
              </span>
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                {selectedLesson.title}
              </h3>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
                {onLaunchChamber && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={launchingChamber}
                    onClick={() => onLaunchChamber(course, selectedLesson)}
                    className="w-full sm:w-auto border-white/20 bg-white/[0.04] text-xs font-semibold text-neutral-200 hover:bg-white/[0.08] hover:text-white h-11 px-5 rounded-xl"
                  >
                    <Swords className="mr-1.5 h-3.5 w-3.5" />
                    {launchingChamber ? "Opening room..." : "Apply in room"}
                  </Button>
                )}

                <Button
                  type="button"
                  onClick={() => onStartLesson(selectedLesson.id)}
                  className="w-full sm:w-auto flex-1 bg-white text-black hover:bg-neutral-200 font-bold text-sm h-11 px-8 rounded-xl shadow-lg transition-transform active:scale-[0.98]"
                >
                  {isSelectedDone ? (
                    <>
                      <RotateCcw className="mr-1.5 h-4 w-4" />
                      Review
                    </>
                  ) : (
                    <>
                      Start
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
