"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { getCourseLessons, type Course } from "./courses";

const STORAGE_KEY = "spar_enrolled_courses";

export interface UseEnrolledCoursesOptions {
  courses: Course[];
  completedLessonIds: ReadonlySet<string>;
  recentCourseIds?: string[];
}

export function useEnrolledCourses({
  courses,
  completedLessonIds,
  recentCourseIds = [],
}: UseEnrolledCoursesOptions) {
  // Compute which courses have actual progress (migration baseline)
  const inProgressCourseIds = useMemo(() => {
    return courses
      .filter((c) => {
        const lessons = getCourseLessons(c);
        const hasCompleted = lessons.some((l) => completedLessonIds.has(l.id));
        return hasCompleted || recentCourseIds.includes(c.id);
      })
      .map((c) => c.id);
  }, [courses, completedLessonIds, recentCourseIds]);

  const [enrolledIds, setEnrolledIds] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      // In SSR, return in-progress courses or the first 2 default courses
      const initial = inProgressCourseIds.length > 0
        ? inProgressCourseIds
        : courses.slice(0, 2).map((c) => c.id);
      return Array.from(new Set(initial));
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Merge with any in-progress courses so progress is never lost
          const merged = new Set([...parsed, ...inProgressCourseIds]);
          return Array.from(merged);
        }
      }
    } catch {
      // Fallback below
    }

    // Default migration baseline: courses with progress, or first 2 courses
    const fallback = inProgressCourseIds.length > 0
      ? inProgressCourseIds
      : courses.slice(0, 2).map((c) => c.id);
    return Array.from(new Set(fallback));
  });

  const effectiveEnrolledIds = useMemo(() => {
    if (inProgressCourseIds.length === 0) return enrolledIds;
    const missing = inProgressCourseIds.filter((id) => !enrolledIds.includes(id));
    if (missing.length === 0) return enrolledIds;
    return [...missing, ...enrolledIds];
  }, [enrolledIds, inProgressCourseIds]);

  // Sync state to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(effectiveEnrolledIds));
    } catch {
      // Ignore quota errors
    }
  }, [effectiveEnrolledIds]);

  const enrollCourse = useCallback((courseId: string) => {
    setEnrolledIds((prev) => {
      if (prev.includes(courseId)) return prev;
      return [courseId, ...prev];
    });
  }, []);

  const unenrollCourse = useCallback((courseId: string) => {
    setEnrolledIds((prev) => prev.filter((id) => id !== courseId));
  }, []);

  const isEnrolled = useCallback(
    (courseId: string) => effectiveEnrolledIds.includes(courseId),
    [effectiveEnrolledIds]
  );

  return {
    enrolledIds: effectiveEnrolledIds,
    enrollCourse,
    unenrollCourse,
    isEnrolled,
  };
}
