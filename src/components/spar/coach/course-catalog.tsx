"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Compass, Plus } from "lucide-react";
import { type Course } from "@/lib/courses";
import {
  readStoredUserPreferences,
  type DefaultDomainKey,
} from "@/lib/user-preferences";
import { useEnrolledCourses } from "@/lib/use-enrolled-courses";
import { Kwesi } from "../kwesi-mascot";
import { MyCourseCard } from "./my-course-card";
import { BrowseCoursesPanel } from "./browse-courses-panel";

function coursePriorityScore(course: Course, domain: DefaultDomainKey): number {
  if (domain === "commercial") {
    if (course.id === "boardroom-curveballs" || course.category === "Pressure practice") return 0;
    if (course.id === "defending-under-fire") return 1;
    return 2;
  }
  if (domain === "interview") {
    if (course.id === "zero-hedge-concision" || course.category === "Communication") return 0;
    if (course.id === "defending-under-fire") return 1;
    return 2;
  }
  return 0;
}

function sortCoursesByDomain(courses: Course[], domain: DefaultDomainKey): Course[] {
  if (domain === "sparring" || domain === "academic") return courses;
  return [...courses].sort(
    (a, b) => coursePriorityScore(a, domain) - coursePriorityScore(b, domain),
  );
}

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
  const orderedCourses = useMemo(() => {
    const prefs = readStoredUserPreferences();
    return sortCoursesByDomain(courses, prefs.defaultDomain);
  }, [courses]);

  // Enrolled courses state (persisted to localStorage with automatic progress migration)
  const { enrolledIds, enrollCourse, unenrollCourse } = useEnrolledCourses({
    courses: orderedCourses,
    completedLessonIds,
    recentCourseIds,
  });

  // Filter & sort enrolled courses
  const enrolledCourses = useMemo(() => {
    return enrolledIds
      .map((id) => orderedCourses.find((c) => c.id === id))
      .filter((c): c is Course => Boolean(c));
  }, [enrolledIds, orderedCourses]);

  const activeEnrolledIds = useMemo(
    () => enrolledCourses.map((c) => c.id),
    [enrolledCourses]
  );

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
    <div className="bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* 1. Minimal Header */}
        <header className="flex items-center justify-between gap-4">
          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            Learn
          </h1>

          {/* Primary Header Browse Button */}
          <button
            type="button"
            onClick={handleOpenBrowse}
            aria-label="Browse full course catalog"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#26262E] bg-[#18181D] px-3.5 text-xs font-semibold text-white transition-colors hover:border-[#3A3A44] hover:bg-[#202026] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C6FF3D]/60"
          >
            <Compass className="h-4 w-4 text-[#C6FF3D]" />
            <span>Browse courses</span>
          </button>
        </header>

        {/* 2. My courses */}
        <section aria-label="My courses" className="space-y-4">
          {/* Empty State */}
          {enrolledCourses.length === 0 ? (
            <div className="spar-chunky-card flex flex-col items-center justify-center px-5 py-10 text-center">
              <Kwesi pose="hype" variant="cornerman" size="sm" className="mb-3" />
              <h2 className="font-display text-lg font-bold text-white">
                No courses added yet
              </h2>
              <button
                type="button"
                onClick={handleOpenBrowse}
                className="spar-white-btn mt-4 inline-flex h-10 items-center justify-center gap-2 px-4 text-xs"
              >
                <Compass className="h-4 w-4" />
                <span>Browse courses</span>
              </button>

              {orderedCourses.length > 0 && (
                <div className="mt-6 flex w-full max-w-md flex-wrap justify-center gap-2 border-t border-[#232327] pt-5">
                  {orderedCourses.slice(0, 3).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => enrollCourse(c.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#26262E] bg-[#18181D] px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:border-[#C6FF3D]/50 hover:text-white"
                    >
                      <Plus className="h-3 w-3 text-[#C6FF3D]" />
                      <span>{c.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {enrolledCourses.map((course, idx) => (
                <MyCourseCard
                  key={course.id}
                  course={course}
                  isHeroCourse={idx === 0}
                  completedLessonIds={completedLessonIds}
                  onSelectCourse={onSelectCourse}
                  onStartOrContinueLesson={onStartOrContinueLesson}
                  onRemoveCourse={unenrollCourse}
                />
              ))}
            </div>
          )}
        </section>

        {/* 3. Browse Courses Slide-Over Drawer / Bottom Sheet */}
        <BrowseCoursesPanel
          open={isBrowseOpen}
          onClose={handleCloseBrowse}
          courses={orderedCourses}
          enrolledCourseIds={activeEnrolledIds}
          onEnrollCourse={enrollCourse}
          onSelectCourse={(courseId) => {
            handleCloseBrowse();
            onSelectCourse(courseId);
          }}
        />
      </div>
    </div>
  );
}
