"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Compass, Plus } from "lucide-react";
import { type Course } from "@/lib/courses";
import { useEnrolledCourses } from "@/lib/use-enrolled-courses";
import { MyCourseCard } from "./my-course-card";
import { BrowseCoursesPanel } from "./browse-courses-panel";

export interface CourseCatalogProps {
  courses: Course[];
  completedLessonIds: ReadonlySet<string>;
  recentCourseIds?: string[];
  onSelectCourse: (courseId: string) => void;
  onStartOrContinueLesson: (courseId: string, lessonId: string) => void;
}

export function CourseCatalog({
  courses,
  completedLessonIds,
  recentCourseIds = [],
  onSelectCourse,
  onStartOrContinueLesson,
}: CourseCatalogProps) {
  // Enrolled courses state (persisted to localStorage with automatic progress migration)
  const { enrolledIds, enrollCourse, unenrollCourse } = useEnrolledCourses({
    courses,
    completedLessonIds,
    recentCourseIds,
  });

  // Filter & sort enrolled courses
  const enrolledCourses = useMemo(() => {
    return enrolledIds
      .map((id) => courses.find((c) => c.id === id))
      .filter((c): c is Course => Boolean(c));
  }, [enrolledIds, courses]);

  // Browse drawer open state with URL sync (?browse=1)
  const [isBrowseOpen, setIsBrowseOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return new URLSearchParams(window.location.search).get("browse") === "1";
    } catch {
      return false;
    }
  });

  const handleOpenBrowse = useCallback(() => {
    setIsBrowseOpen(true);
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("browse", "1");
        window.history.pushState({}, "", url.toString());
      } catch {
        // Fallback for non-standard environments
      }
    }
  }, []);

  const handleCloseBrowse = useCallback(() => {
    setIsBrowseOpen(false);
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("browse");
        window.history.pushState({}, "", url.toString());
      } catch {
        // Fallback
      }
    }
  }, []);

  // Listen to browser popstate for back/forward navigation with ?browse=1
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePopState = () => {
      try {
        const hasBrowse =
          new URLSearchParams(window.location.search).get("browse") === "1";
        setIsBrowseOpen(hasBrowse);
      } catch {
        // Fallback
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 pb-32 sm:px-6 sm:py-10 md:pb-16 space-y-10">
      {/* 1. Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-white/[0.06] pb-6">
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
            Executive Academy · Learn
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl">
            Build your presence.
          </h1>
          <p className="max-w-2xl text-sm text-[var(--text-secondary)] sm:text-base">
            Practise the skills that help you think clearly and speak with
            confidence.
          </p>
        </div>

        {/* Primary Header Browse Button */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={handleOpenBrowse}
            aria-label="Browse full course catalog"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.04] px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:border-white/40 hover:bg-white/[0.08] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <Compass className="h-4 w-4 text-[var(--accent)]" />
            <span>Browse courses</span>
          </button>
        </div>
      </header>

      {/* 2. My courses (The Primary Content) */}
      <section aria-label="Continue learning" className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
              Continue learning
            </h2>
            <p className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
              My courses
            </p>
          </div>
          {enrolledCourses.length > 0 && (
            <span className="text-xs text-[var(--text-secondary)]">
              {enrolledCourses.length}{" "}
              {enrolledCourses.length === 1 ? "course" : "courses"} in training plan
            </span>
          )}
        </div>

        {/* Empty State */}
        {enrolledCourses.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-1)] px-6 py-12 text-center shadow-lg">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[var(--accent)] mb-4">
              <Compass className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-white">
              Pick your first course to begin training.
            </h3>
            <p className="mt-1.5 max-w-md text-xs sm:text-sm text-[var(--text-secondary)]">
              Browse interactive courses on high-stakes communication, defending under pressure, and executive presence.
            </p>
            <button
              type="button"
              onClick={handleOpenBrowse}
              className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full px-7 text-xs font-bold text-white transition-all spar-tactile-btn shadow-md active:scale-95"
            >
              <Compass className="h-4 w-4" />
              <span>Browse courses</span>
            </button>

            {/* Quick suggested course pills */}
            {courses.length > 0 && (
              <div className="mt-8 pt-6 border-t border-white/[0.06] w-full max-w-md">
                <p className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-tertiary)] mb-3">
                  Recommended starters
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {courses.slice(0, 3).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => enrollCourse(c.id)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs text-neutral-300 transition-colors hover:border-white/30 hover:bg-white/[0.07] hover:text-white"
                    >
                      <Plus className="h-3 w-3 text-[var(--accent)]" />
                      <span>{c.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Vertically stacked full-width course cards */}
            {enrolledCourses.map((course, idx) => (
              <MyCourseCard
                key={course.id}
                course={course}
                completedLessonIds={completedLessonIds}
                isHeroCourse={idx === 0}
                defaultExpanded={idx === 0}
                onStartOrContinueLesson={onStartOrContinueLesson}
                onStartLesson={onStartOrContinueLesson}
                onRemoveCourse={unenrollCourse}
              />
            ))}

            {/* End-of-list card */}
            <button
              type="button"
              onClick={handleOpenBrowse}
              className="group flex w-full items-center justify-center gap-3 rounded-[20px] border-2 border-dashed border-white/15 bg-white/[0.015] py-5 px-6 text-sm font-semibold text-[var(--text-secondary)] transition-all duration-200 hover:border-white/30 hover:bg-white/[0.04] hover:text-white"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-neutral-400 transition-colors group-hover:border-white/30 group-hover:text-white">
                <Plus className="h-4 w-4" />
              </div>
              <span>Add another course</span>
            </button>
          </div>
        )}
      </section>

      {/* 3. In-Page Browse Courses Slide-Over Drawer / Bottom Sheet */}
      <BrowseCoursesPanel
        open={isBrowseOpen}
        onClose={handleCloseBrowse}
        courses={courses}
        enrolledCourseIds={enrolledIds}
        onEnrollCourse={enrollCourse}
        onSelectCourse={(courseId) => {
          handleCloseBrowse();
          onSelectCourse(courseId);
        }}
      />
    </div>
  );
}
