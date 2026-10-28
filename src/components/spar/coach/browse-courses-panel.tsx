"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Plus,
  Search,
  X,
  ArrowRight,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  getCourseLessons,
  type Course,
  type CourseDifficulty,
} from "@/lib/courses";
import { CourseEmblem } from "./course-emblem";

export interface BrowseCoursesPanelProps {
  open: boolean;
  onClose: () => void;
  courses: Course[];
  enrolledCourseIds: string[];
  onEnrollCourse: (courseId: string) => void;
  onSelectCourse: (courseId: string) => void;
}

export function BrowseCoursesPanel({
  open,
  onClose,
  courses,
  enrolledCourseIds,
  onEnrollCourse,
  onSelectCourse,
}: BrowseCoursesPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedDifficulty, setSelectedDifficulty] = useState<"All" | CourseDifficulty>("All");
  const [expandedPreviewIds, setExpandedPreviewIds] = useState<Set<string>>(new Set());
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const shouldReduceMotion = useReducedMotion();

  // Manage body scroll locking and keyboard Escape handler
  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus search input on open
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  // Extract unique categories for filter chips
  const categories = useMemo(() => {
    const set = new Set<string>(["All"]);
    for (const c of courses) {
      if (c.category?.trim()) set.add(c.category.trim());
    }
    return Array.from(set);
  }, [courses]);

  // Filtered course catalog
  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return courses.filter((course) => {
      if (
        selectedCategory !== "All" &&
        course.category.toLowerCase() !== selectedCategory.toLowerCase()
      ) {
        return false;
      }
      if (
        selectedDifficulty !== "All" &&
        course.difficulty !== selectedDifficulty
      ) {
        return false;
      }
      if (!q) return true;
      const lessons = getCourseLessons(course);
      const inCourse =
        course.title.toLowerCase().includes(q) ||
        course.subtitle.toLowerCase().includes(q) ||
        course.description.toLowerCase().includes(q) ||
        course.category.toLowerCase().includes(q);
      const inLessons = lessons.some(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.tagline.toLowerCase().includes(q)
      );
      return inCourse || inLessons;
    });
  }, [courses, searchQuery, selectedCategory, selectedDifficulty]);

  // Group filtered courses by category
  const groupedCourses = useMemo(() => {
    const map = new Map<string, Course[]>();
    for (const c of filteredCourses) {
      const cat = c.category || "General";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(c);
    }
    return map;
  }, [filteredCourses]);

  function togglePreview(courseId: string) {
    setExpandedPreviewIds((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  }

  function handleAdd(course: Course) {
    onEnrollCourse(course.id);
    setJustAddedId(course.id);
    setToastMessage(`Added "${course.title}" to My courses`);
    setTimeout(() => {
      setJustAddedId(null);
    }, 2400);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }

  return (
    <>
      {/* Accessible semantic catalog registry for screen readers & SSR discovery */}
      <div
        role="region"
        aria-label="Explore courses"
        className="sr-only"
      >
        <h2>Explore courses</h2>
        <p>Choose a course to add to your training plan.</p>
        <ul>
          {courses.map((c) => (
            <li key={c.id}>
              <span>{c.title}</span>
              <span>{c.subtitle || c.description}</span>
            </li>
          ))}
        </ul>
      </div>

      <AnimatePresence>
        {open && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="browse-courses-title"
            className="fixed inset-0 z-50 flex justify-end"
          >
            {/* Dimmed backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              aria-hidden="true"
              className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            />

            {/* Drawer / Bottom sheet panel container */}
            <motion.div
              ref={panelRef}
              initial={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { x: "100%", opacity: 0.8 }
              }
              animate={
                shouldReduceMotion
                  ? { opacity: 1 }
                  : { x: "0%", opacity: 1 }
              }
              exit={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { x: "100%", opacity: 0.8 }
              }
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className={cn(
                "relative z-10 flex flex-col w-full bg-[#101016] text-[var(--text-primary)] border-l border-[var(--border-subtle)] shadow-2xl",
                // Desktop: right drawer; Mobile: full-width
                "max-w-full sm:max-w-2xl md:max-w-[680px] h-full overflow-hidden"
              )}
              style={{
                backgroundImage:
                  "linear-gradient(180deg, rgba(255, 255, 255, 0.02) 0%, transparent 100%)",
              }}
            >
              {/* Sticky Header */}
              <header className="sticky top-0 z-20 border-b border-[var(--border-subtle)] bg-[#101016]/95 px-6 py-5 backdrop-blur-md space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2
                      id="browse-courses-title"
                      className="text-xl font-bold tracking-tight text-[var(--text-primary)]"
                    >
                      Explore courses
                    </h2>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      Choose a course to add to your training plan.
                    </p>
                  </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close browse courses panel"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Search Field */}
              <div className="relative w-full">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search courses, lessons, and topics"
                  aria-label="Search courses"
                  className="w-full rounded-xl border border-white/10 bg-[#161620] py-2.5 pl-10 pr-9 text-xs text-white placeholder:text-neutral-500 focus:border-white/30 focus:outline-none sm:text-sm"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Category Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {categories.map((cat) => {
                  const active = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50",
                        active
                          ? "border-[var(--accent)] bg-[var(--accent)] text-white font-semibold shadow-sm"
                          : "border-white/10 bg-[#161620] text-neutral-400 hover:border-white/20 hover:text-white"
                      )}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              {/* Level Filter Chips */}
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] pt-0.5">
                <span>Level:</span>
                {(["All", "Foundation", "Intermediate", "Advanced"] as const).map((lvl) => {
                  const active = selectedDifficulty === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setSelectedDifficulty(lvl)}
                      className={cn(
                        "rounded-md border px-2 py-0.5 transition-colors focus-visible:outline-none",
                        active
                          ? "border-white/30 bg-white/15 text-white font-semibold"
                          : "border-white/5 bg-transparent text-neutral-500 hover:text-neutral-300"
                      )}
                    >
                      {lvl === "All" ? "All levels" : lvl}
                    </button>
                  );
                })}
              </div>
            </header>

            {/* Scrollable Body: Courses grouped by category */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
              {filteredCourses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center space-y-3">
                  <Compass className="mx-auto h-8 w-8 text-neutral-500" />
                  <p className="text-sm font-semibold text-white">No courses match your filter</p>
                  <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                    Try clearing your search query or choosing a different skill category.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("All");
                      setSelectedDifficulty("All");
                    }}
                    className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                Array.from(groupedCourses.entries()).map(([cat, courseList]) => (
                  <section key={cat} aria-label={`${cat} courses`} className="space-y-3.5">
                    {/* Category Section Header with Count */}
                    <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                        {cat}
                      </h3>
                      <span className="text-[10px] font-mono text-[var(--text-tertiary)]">
                        {courseList.length} {courseList.length === 1 ? "course" : "courses"}
                      </span>
                    </div>

                    {/* Category Courses List */}
                    <div className="space-y-3">
                      {courseList.map((c) => {
                        const lessons = getCourseLessons(c);
                        const isEnrolled = enrolledCourseIds.includes(c.id);
                        const isJustAdded = justAddedId === c.id;
                        const isExpanded = expandedPreviewIds.has(c.id);

                        const eyebrow = `${c.difficulty.toUpperCase()} · ${lessons.length} LESSONS · ~${c.estimatedMinutes} MIN`;

                        return (
                          <div
                            key={c.id}
                            className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 sm:p-5 transition-all hover:border-[var(--border-strong)]"
                          >
                            <div className="flex items-start gap-4">
                              {/* Emblem */}
                              <CourseEmblem category={c.category} size="lg" className="hidden sm:block" />

                              {/* Info */}
                              <div className="min-w-0 flex-1 space-y-1.5">
                                <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                                  {eyebrow}
                                </p>

                                <div className="flex items-center gap-2">
                                  <h4 className="text-base font-bold tracking-tight text-[var(--text-primary)]">
                                    {c.title}
                                  </h4>
                                  <button
                                    type="button"
                                    onClick={() => togglePreview(c.id)}
                                    aria-expanded={isExpanded}
                                    aria-label={`Preview lessons for ${c.title}`}
                                    className="text-neutral-400 hover:text-white transition-colors"
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                  </button>
                                </div>

                                <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                                  {c.subtitle || c.description}
                                </p>
                              </div>

                              {/* Right Action Button */}
                              <div className="shrink-0 pt-1">
                                {isJustAdded ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400">
                                    <Check className="h-3.5 w-3.5" />
                                    Added ✓
                                  </span>
                                ) : isEnrolled ? (
                                  <div className="flex flex-col sm:items-end gap-1">
                                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-medium text-neutral-400">
                                      In your courses
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onClose();
                                        onSelectCourse(c.id);
                                      }}
                                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
                                    >
                                      <span>Open</span>
                                      <ArrowRight className="h-3 w-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleAdd(c)}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.06] hover:bg-white/[0.14] hover:border-white/40 px-3.5 py-1.5 text-xs font-bold text-white transition-all active:scale-95 shadow-sm"
                                  >
                                    <Plus className="h-3.5 w-3.5 text-[var(--accent)]" />
                                    Add
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Expandable Lessons Preview (Lightweight preview) */}
                            {isExpanded && (
                              <div className="mt-3.5 pt-3 border-t border-white/[0.06] space-y-1.5">
                                <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
                                  Included lessons:
                                </p>
                                <ul className="divide-y divide-white/[0.03] text-xs text-neutral-300">
                                  {lessons.map((l, lIdx) => (
                                    <li key={l.id} className="py-1.5 flex items-center gap-2">
                                      <span className="font-mono text-[10px] text-neutral-500">
                                        {String(lIdx + 1).padStart(2, "0")}
                                      </span>
                                      <span className="truncate">{l.title}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))
              )}
            </div>

            {/* Footer */}
            <footer className="sticky bottom-0 z-20 border-t border-[var(--border-subtle)] bg-[#101016]/95 px-6 py-4 backdrop-blur-md flex items-center justify-between">
              <span className="text-xs text-[var(--text-tertiary)]">
                {enrolledCourseIds.length} active in My courses
              </span>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-white px-5 py-2 text-xs font-bold text-black transition-transform hover:bg-neutral-200 active:scale-95 shadow-md"
              >
                Done
              </button>
            </footer>

            {/* Floating Toast Notification */}
            <AnimatePresence>
              {toastMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 16 }}
                  className="absolute bottom-16 left-6 right-6 z-30 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-[#0e1a14] px-4 py-3 shadow-2xl"
                >
                  <div className="flex items-center gap-2 text-xs font-medium text-emerald-300">
                    <Check className="h-4 w-4 text-emerald-400" />
                    <span>{toastMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-xs font-semibold text-white underline hover:text-emerald-200 ml-3"
                  >
                    View
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  </>
);
}
