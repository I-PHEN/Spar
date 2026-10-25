"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Play,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getCourseLessons,
  getNextIncompleteLesson,
  type Course,
  type CourseDifficulty,
} from "@/lib/courses";
import { CourseCard } from "./course-card";

export interface CourseCatalogProps {
  courses: Course[];
  completedLessonIds: ReadonlySet<string>;
  recentCourseIds?: string[];
  onSelectCourse: (courseId: string) => void;
  onStartOrContinueLesson: (courseId: string, lessonId: string) => void;
}

type SortOption = "recommended" | "shortest" | "newest";

export function CourseCatalog({
  courses,
  completedLessonIds,
  recentCourseIds = [],
  onSelectCourse,
  onStartOrContinueLesson,
}: CourseCatalogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedDifficulty, setSelectedDifficulty] = useState<
    "All" | CourseDifficulty
  >("All");
  const [sortBy, setSortBy] = useState<SortOption>("recommended");
  const [inspectedCourse, setInspectedCourse] = useState<Course | null>(null);

  // Extract unique categories dynamically so the catalog scales to any library size
  const categories = useMemo(() => {
    const set = new Set<string>(["All"]);
    for (const c of courses) {
      if (c.category?.trim()) set.add(c.category.trim());
    }
    return Array.from(set);
  }, [courses]);

  // Courses currently in progress (started or recently visited)
  const continueCourses = useMemo(() => {
    const started = courses.filter((course) => {
      const lessons = getCourseLessons(course);
      const done = lessons.filter((l) => completedLessonIds.has(l.id)).length;
      return (
        (done > 0 && done < lessons.length) ||
        recentCourseIds.includes(course.id)
      );
    });
    return started.slice(0, 2);
  }, [courses, completedLessonIds, recentCourseIds]);

  // Filtered and sorted catalogue
  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = courses.filter((course) => {
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

    return [...list].sort((a, b) => {
      if (sortBy === "shortest") {
        return a.estimatedMinutes - b.estimatedMinutes;
      }
      if (sortBy === "newest") {
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      }
      return 0;
    });
  }, [courses, searchQuery, selectedCategory, selectedDifficulty, sortBy]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 pb-32 sm:px-6 sm:py-10 md:pb-16 space-y-10">
      {/* Page Header */}
      <header className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-400">
          Executive Academy · Learn
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Build your presence.
        </h1>
        <p className="max-w-2xl text-sm text-neutral-400 sm:text-base">
          Practise the skills that help you think clearly and speak with
          confidence.
        </p>
      </header>

      {/* Continue Learning (Only shown when the learner has courses in progress) */}
      {continueCourses.length > 0 && (
        <section aria-label="Continue learning" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-300">
              Continue learning
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {continueCourses.map((course) => {
              const lessons = getCourseLessons(course);
              const done = lessons.filter((l) =>
                completedLessonIds.has(l.id)
              ).length;
              const pct =
                lessons.length > 0
                  ? Math.round((done / lessons.length) * 100)
                  : 0;
              const nextLesson = getNextIncompleteLesson(
                course,
                completedLessonIds
              );

              return (
                <div
                  key={course.id}
                  className="flex flex-col justify-between gap-4 rounded-2xl border border-white/12 bg-[#131316] p-5 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-neutral-400">
                      <span className="font-medium text-neutral-300">
                        {course.category}
                      </span>
                      <span>·</span>
                      <span>
                        <strong className="text-white">{done}</strong> of{" "}
                        {lessons.length} lessons mastered ({pct}%)
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectCourse(course.id)}
                      className="block text-left text-base font-semibold text-white hover:underline focus-visible:outline-none"
                    >
                      {course.title}
                    </button>

                    {done > 0 && (
                      <p className="truncate text-xs text-neutral-400">
                        Mastered:{" "}
                        <span className="text-neutral-200">
                          {lessons.filter((l) => completedLessonIds.has(l.id)).at(-1)?.title}
                        </span>
                      </p>
                    )}

                    {nextLesson && (
                      <p className="truncate text-xs text-neutral-400">
                        Up next: <span className="text-neutral-200">{nextLesson.title}</span>
                      </p>
                    )}

                    <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/[0.08]">
                      <div
                        className="h-full rounded-full bg-white transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectCourse(course.id)}
                      className="border-white/12 bg-transparent text-xs text-neutral-200 hover:bg-white/[0.06] hover:text-white"
                    >
                      Roadmap
                    </Button>
                    {nextLesson && (
                      <Button
                        size="sm"
                        onClick={() =>
                          onStartOrContinueLesson(course.id, nextLesson.id)
                        }
                        className="bg-white text-black hover:bg-neutral-200 text-xs font-semibold"
                      >
                        <Play className="mr-1.5 h-3 w-3 fill-current" />
                        Continue
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Search, Category Filters & Sorting */}
      <section aria-label="Explore courses" className="space-y-5">
        <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-5 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Input */}
          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search courses and skills"
              aria-label="Search courses and skills"
              className="w-full rounded-xl border border-white/10 bg-[#111113] py-2 pl-10 pr-8 text-xs text-white placeholder:text-neutral-500 focus:border-white/30 focus:outline-none sm:text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter Pills + Difficulty & Sort */}
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Filter by skill category"
              className="flex flex-wrap items-center gap-1.5"
            >
              {categories.map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50",
                      active
                        ? "border-white bg-white text-black font-semibold"
                        : "border-white/[0.08] bg-[#111113] text-neutral-300 hover:border-white/20 hover:text-white"
                    )}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            <select
              aria-label="Filter by difficulty"
              value={selectedDifficulty}
              onChange={(e) =>
                setSelectedDifficulty(
                  e.target.value as "All" | CourseDifficulty
                )
              }
              className="rounded-lg border border-white/[0.08] bg-[#111113] px-2.5 py-1.5 text-xs text-neutral-300 focus:border-white/30 focus:outline-none"
            >
              <option value="All">All levels</option>
              <option value="Foundation">Foundation</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>

            <select
              aria-label="Sort courses"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="rounded-lg border border-white/[0.08] bg-[#111113] px-2.5 py-1.5 text-xs text-neutral-300 focus:border-white/30 focus:outline-none"
            >
              <option value="recommended">Sort: Recommended</option>
              <option value="shortest">Sort: Shortest</option>
              <option value="newest">Sort: Newest</option>
            </select>
          </div>
        </div>

        {/* Explore Courses Grid */}
        {filteredCourses.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#111113] px-6 py-12 text-center">
            <p className="text-sm font-medium text-white">
              No courses match your current search or filters.
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              Try clearing your search query or switching to All categories.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("All");
                setSelectedDifficulty("All");
              }}
              className="mt-4 border-white/15 bg-transparent text-xs text-white hover:bg-white/[0.06]"
            >
              Reset filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filteredCourses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                completedLessonIds={completedLessonIds}
                onSelectCourse={onSelectCourse}
                onInspectDetails={(c) => setInspectedCourse(c)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Course Detail Preview Modal (Before Starting) */}
      {inspectedCourse && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${inspectedCourse.title} details`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          onClick={() => setInspectedCourse(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-2xl border border-white/15 bg-[#121215] p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  <span>{inspectedCourse.category}</span>
                  <span>·</span>
                  <span>{inspectedCourse.difficulty}</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {inspectedCourse.estimatedMinutes} min
                  </span>
                </div>
                <h3 className="mt-1.5 text-xl font-bold text-white">
                  {inspectedCourse.title}
                </h3>
                <p className="mt-1 text-sm font-medium text-neutral-200">
                  {inspectedCourse.subtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedCourse(null)}
                aria-label="Close course details"
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-white/[0.08] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs leading-relaxed text-neutral-400 sm:text-sm">
              {inspectedCourse.description}
            </p>

            {inspectedCourse.learningOutcomes &&
              inspectedCourse.learningOutcomes.length > 0 && (
                <div className="space-y-2 border-t border-white/[0.07] pt-4">
                  <p className="text-xs font-semibold text-neutral-300">
                    What you will practise
                  </p>
                  <ul className="space-y-1.5">
                    {inspectedCourse.learningOutcomes.map((outcome) => (
                      <li
                        key={outcome}
                        className="flex items-start gap-2 text-xs text-neutral-300"
                      >
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white" />
                        <span>{outcome}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            <div className="space-y-2 border-t border-white/[0.07] pt-4">
              <p className="text-xs font-semibold text-neutral-300">
                Course path ({getCourseLessons(inspectedCourse).length} activities)
              </p>
              <div className="space-y-1.5">
                {getCourseLessons(inspectedCourse).map((les, idx) => (
                  <div
                    key={les.id}
                    className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-xs"
                  >
                    <span className="font-medium text-neutral-200">
                      {idx + 1}. {les.title}
                    </span>
                    <span className="text-neutral-500">
                      {les.durationMinutes} min
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/[0.07] pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInspectedCourse(null)}
                className="border-white/10 bg-transparent text-xs text-neutral-300"
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const id = inspectedCourse.id;
                  setInspectedCourse(null);
                  onSelectCourse(id);
                }}
                className="bg-white text-black hover:bg-neutral-200 text-xs font-semibold"
              >
                Open roadmap
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
