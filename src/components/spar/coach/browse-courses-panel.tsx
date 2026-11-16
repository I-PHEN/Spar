"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Plus,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getCourseLessons, type Course } from "@/lib/courses";
import { getCourseEmblemIcon } from "./course-emblem";

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
  const [expandedPreviewIds, setExpandedPreviewIds] = useState<Set<string>>(new Set());
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Manage body scroll locking and keyboard Escape handler
  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus search input on open without scrolling the drawer container
    const timer = setTimeout(() => {
      searchInputRef.current?.focus({ preventScroll: true });
    }, 60);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(timer);
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
  }, [courses, searchQuery, selectedCategory]);

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

  const dialogMarkup = open ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="browse-courses-title"
      className="fixed inset-0 z-[70] flex overflow-hidden sm:justify-end"
    >
      {/* Dimmed backdrop (desktop only, clicks to close) */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 hidden cursor-pointer bg-black/75 sm:block"
      />

      {/* Drawer / Full-screen mobile panel */}
      <div
        ref={panelRef}
        className={cn(
          "relative z-10 flex w-full flex-col overflow-hidden bg-[#0B0B0D] text-[var(--text-primary)]",
          "h-full h-[100dvh] max-w-full rounded-none border-0",
          "sm:max-w-xl sm:border-l sm:border-[var(--border-subtle)]"
        )}
      >
        {/* Header */}
        <header className="shrink-0 space-y-3 border-b border-[#232327] bg-[#121215] px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <h2
              id="browse-courses-title"
              className="text-lg font-semibold tracking-tight text-[var(--text-primary)] sm:text-xl"
            >
              Browse courses
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close browse courses panel"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#232327] bg-[#18181D] text-neutral-400 transition-colors hover:border-[#34343B] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Search */}
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search courses"
              aria-label="Search courses"
              className="w-full rounded-xl border border-[#232327] bg-[#0B0B0D] py-2 pl-10 pr-9 text-xs text-white placeholder:text-neutral-500 focus:border-[#34343B] focus:outline-none sm:text-sm"
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

          {/* Single Category Filter Row */}
          {categories.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {categories.map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "rounded-lg border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]/50",
                      active
                        ? "border-[var(--accent)] bg-[var(--accent)] font-semibold text-[var(--accent-foreground)]"
                        : "border-[#232327] bg-[#18181D] text-neutral-400 hover:border-[#34343B] hover:text-white"
                    )}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          )}
        </header>

        {/* Scrollable Flat Course List */}
        <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {filteredCourses.length === 0 ? (
            <div className="space-y-3 rounded-xl border border-dashed border-[#232327] bg-[#121215] p-6 text-center">
              <Compass className="mx-auto h-6 w-6 text-neutral-500" />
              <p className="text-sm font-medium text-white">No courses match</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All");
                }}
                className="rounded-lg border border-[#232327] bg-[#18181D] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:border-[#34343B]"
              >
                Clear filters
              </button>
            </div>
          ) : (
            filteredCourses.map((c) => {
              const lessons = getCourseLessons(c);
              const isEnrolled = enrolledCourseIds.includes(c.id);
              const isJustAdded = justAddedId === c.id;
              const isExpanded = expandedPreviewIds.has(c.id);

              return (
                <div
                  key={c.id}
                  className="rounded-xl border border-[#232327] bg-[#121215] p-3.5 transition-colors hover:border-[#34343B] sm:p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#232327] bg-[#18181D]">
                      {getCourseEmblemIcon(c.category, "h-4 w-4 text-[var(--accent-text)]")}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="truncate text-sm font-semibold tracking-tight text-[var(--text-primary)] sm:text-base">
                          {c.title}
                        </h3>
                        <button
                          type="button"
                          onClick={() => togglePreview(c.id)}
                          aria-expanded={isExpanded}
                          aria-label={`Preview lessons for ${c.title}`}
                          className="shrink-0 text-neutral-400 transition-colors hover:text-white"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                      </div>

                      <p className="line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                        {c.subtitle || c.description}
                      </p>

                      <p className="text-[11px] text-[var(--text-tertiary)]">
                        {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"} · {c.estimatedMinutes} min
                      </p>
                    </div>

                    {/* Single Clear Row Action */}
                    <div className="shrink-0 pt-0.5">
                      {isJustAdded ? (
                        <span className="inline-flex h-8 items-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-400">
                          <Check className="h-3.5 w-3.5" />
                          Added
                        </span>
                      ) : isEnrolled ? (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onSelectCourse(c.id);
                          }}
                          className="inline-flex h-8 items-center justify-center rounded-xl border border-[#232327] bg-[#18181D] px-3.5 text-xs font-semibold text-white transition-colors hover:border-[#34343B]"
                        >
                          Open
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAdd(c)}
                          className="inline-flex h-8 items-center gap-1 rounded-xl bg-[var(--accent)] px-3.5 text-xs font-semibold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] active:scale-[0.98]"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <ul className="mt-3 space-y-1 border-t border-[#232327] pt-2.5 text-xs text-neutral-300">
                      {lessons.map((l, lIdx) => (
                        <li key={l.id} className="flex items-center gap-2 py-0.5">
                          <span className="font-mono text-[10px] text-neutral-500">
                            {String(lIdx + 1).padStart(2, "0")}
                          </span>
                          <span className="truncate">{l.title}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <footer className="sticky bottom-0 z-20 flex items-center justify-between border-t border-[#232327] bg-[#121215] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <span className="text-xs text-[var(--text-tertiary)]">
            {enrolledCourseIds.length} active
          </span>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-xl bg-[var(--accent)] px-5 text-xs font-semibold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] active:scale-[0.98]"
          >
            Done
          </button>
        </footer>

        {/* Toast */}
        {toastMessage && (
          <div className="absolute bottom-16 left-4 right-4 z-30 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-[#0e1a14] px-4 py-2.5 sm:left-6 sm:right-6">
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-300">
              <Check className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{toastMessage}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ml-3 shrink-0 text-xs font-semibold text-white underline hover:text-emerald-200"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* Accessible semantic catalog registry for screen readers & SSR discovery */}
      <div
        role="region"
        aria-label="Explore courses"
        className="sr-only"
      >
        <h2>Explore courses</h2>
        <ul>
          {courses.map((c) => (
            <li key={c.id}>
              <span>{c.title}</span>
              <span>{c.subtitle || c.description}</span>
            </li>
          ))}
        </ul>
      </div>

      {dialogMarkup &&
        (typeof document !== "undefined"
          ? createPortal(dialogMarkup, document.body)
          : dialogMarkup)}
    </>
  );
}
