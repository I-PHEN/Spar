"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  FileEdit,
  Globe,
  Lock,
  Plus,
  Save,
  Sparkles,
  Swords,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ARCHETYPE_LIST, ARCHETYPES } from "@/lib/personas";
import { DRILL_TARGETS, type DrillTarget, type ExperienceKey } from "@/lib/experiences";
import type { ArchetypeKey, BehaviorStyle } from "@/lib/types";
import {
  DEFAULT_COURSES,
  buildLessonSessionPayload,
  createEmptyCourse,
  createEmptyLesson,
  createEmptyModule,
  type Course,
  type CourseDifficulty,
  type CourseLesson,
} from "@/lib/courses";
import {
  CoachView,
  ExecutiveBriefingDeck,
  type BriefingSlideIndex,
} from "./coach-view";

export interface CourseStudioProps {
  initialCourses?: Course[];
  initialUnlocked?: boolean;
  onLaunchTestSession?: (
    sessionId: string,
    exp: ExperienceKey,
    target: DrillTarget | null
  ) => void;
}

const DIFFICULTIES: CourseDifficulty[] = [
  "Foundation",
  "Intermediate",
  "Advanced",
];

const BEHAVIORS: BehaviorStyle[] = ["gentle", "moderate", "aggressive"];

export function CourseStudio({
  initialCourses = DEFAULT_COURSES,
  initialUnlocked = false,
  onLaunchTestSession,
}: CourseStudioProps) {
  const [unlocked, setUnlocked] = useState(initialUnlocked);
  const [passkey, setPasskey] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    initialCourses[0]?.id ?? ""
  );
  const [selectedModuleIdx, setSelectedModuleIdx] = useState(0);
  const [selectedLessonIdx, setSelectedLessonIdx] = useState(0);
  const [activeSlide, setActiveSlide] = useState<BriefingSlideIndex>(0);
  const [fullPreview, setFullPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);
  const [launchingTest, setLaunchingTest] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("spar_creator_unlocked") === "1") {
        setUnlocked(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    fetch("/api/coach/courses?studio=1")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.courses) && data.courses.length > 0) {
          setCourses(data.courses);
          setSelectedCourseId((prev) =>
            data.courses.some((c: Course) => c.id === prev)
              ? prev
              : data.courses[0].id
          );
        }
      })
      .catch(() => {});
  }, [unlocked]);

  const activeCourse = useMemo(
    () => courses.find((c) => c.id === selectedCourseId) ?? courses[0] ?? null,
    [courses, selectedCourseId]
  );

  const activeModule =
    activeCourse?.modules[selectedModuleIdx] ?? activeCourse?.modules[0] ?? null;

  const activeLesson =
    activeModule?.lessons[selectedLessonIdx] ?? activeModule?.lessons[0] ?? null;

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!passkey.trim()) return;
    setVerifying(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/coach/verify-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passkey: passkey.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setAuthError(data.error || "Invalid creator passkey");
      } else {
        setUnlocked(true);
        try {
          sessionStorage.setItem("spar_creator_unlocked", "1");
        } catch {}
      }
    } catch {
      setAuthError("Could not verify passkey. Try again.");
    } finally {
      setVerifying(false);
    }
  }

  function updateActiveCourse(updater: (course: Course) => Course) {
    if (!activeCourse) return;
    setCourses((prev) =>
      prev.map((c) => (c.id === activeCourse.id ? updater(c) : c))
    );
  }

  function updateActiveLesson(updater: (lesson: CourseLesson) => CourseLesson) {
    if (!activeCourse || !activeModule || !activeLesson) return;
    updateActiveCourse((course) => ({
      ...course,
      modules: course.modules.map((mod, mIdx) =>
        mIdx !== selectedModuleIdx
          ? mod
          : {
              ...mod,
              lessons: mod.lessons.map((les, lIdx) =>
                lIdx !== selectedLessonIdx ? les : updater(les)
              ),
            }
      ),
    }));
  }

  async function persistCourse(nextStatus?: "draft" | "published") {
    if (!activeCourse) return;
    setSaving(true);
    setSaveBanner(null);
    const courseToSave: Course = {
      ...activeCourse,
      status: nextStatus ?? activeCourse.status,
      updatedAt: new Date().toISOString(),
    };
    updateActiveCourse(() => courseToSave);

    try {
      const res = await fetch("/api/coach/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course: courseToSave }),
      });
      const data = await res.json();
      if (res.ok && data.course) {
        setCourses((prev) =>
          prev.map((c) => (c.id === data.course.id ? data.course : c))
        );
        setSaveBanner(
          courseToSave.status === "published"
            ? "Course published — now live in the Learner Coach tab."
            : "Draft saved."
        );
      }
    } catch {
      setSaveBanner("Saved locally.");
    } finally {
      setSaving(false);
    }
  }

  function handleCreateCourse() {
    const fresh = createEmptyCourse();
    setCourses((prev) => [fresh, ...prev]);
    setSelectedCourseId(fresh.id);
    setSelectedModuleIdx(0);
    setSelectedLessonIdx(0);
    setActiveSlide(0);
    setSaveBanner("New draft course created.");
  }

  function handleAddModule() {
    if (!activeCourse) return;
    const nextIdx = activeCourse.modules.length;
    const mod = createEmptyModule(nextIdx + 1);
    updateActiveCourse((course) => ({
      ...course,
      modules: [...course.modules, mod],
    }));
    setSelectedModuleIdx(nextIdx);
    setSelectedLessonIdx(0);
  }

  function handleAddLesson() {
    if (!activeModule) return;
    const nextIdx = activeModule.lessons.length;
    const les = createEmptyLesson(nextIdx + 1);
    updateActiveCourse((course) => ({
      ...course,
      modules: course.modules.map((m, idx) =>
        idx !== selectedModuleIdx
          ? m
          : { ...m, lessons: [...m.lessons, les] }
      ),
    }));
    setSelectedLessonIdx(nextIdx);
    setActiveSlide(0);
  }

  function handleDeleteLesson(lessonIdx: number) {
    if (!activeModule || activeModule.lessons.length <= 1) return;
    updateActiveCourse((course) => ({
      ...course,
      modules: course.modules.map((m, idx) =>
        idx !== selectedModuleIdx
          ? m
          : {
              ...m,
              lessons: m.lessons.filter((_, i) => i !== lessonIdx),
            }
      ),
    }));
    setSelectedLessonIdx(Math.max(0, lessonIdx - 1));
  }

  async function handleTestDrill(
    course: Pick<Course, "id" | "title">,
    lesson: CourseLesson
  ) {
    if (!onLaunchTestSession) return;
    setLaunchingTest(true);
    try {
      const payload = buildLessonSessionPayload(course, lesson);
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data?.session?.id) {
        onLaunchTestSession(
          data.session.id,
          payload.experience,
          payload.drillTarget
        );
      }
    } finally {
      setLaunchingTest(false);
    }
  }

  // ─── Creator Passkey Gate (Locks out regular learners) ────────────────────
  if (!unlocked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-4 py-16">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121212] p-7 shadow-2xl">
          <div className="flex items-center gap-2 text-neutral-400">
            <Lock className="h-4 w-4 text-amber-400" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">
              Creator Portal · Restricted Access
            </span>
          </div>

          <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">
            Spar Course Studio
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">
            This authoring workspace is restricted to course creators. Enter the creator passkey to design lessons, preview briefing decks, and publish to learners.
          </p>

          <form onSubmit={handleUnlock} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="creator-passkey" className="text-xs text-neutral-300">
                Creator Passkey
              </Label>
              <Input
                id="creator-passkey"
                type="password"
                value={passkey}
                onChange={(e) => setPasskey(e.target.value)}
                placeholder="Enter creator passkey (default: spar-studio)"
                className="border-white/10 bg-[#0c0c0c] text-white placeholder:text-neutral-500"
              />
            </div>

            {authError && (
              <p role="alert" className="text-xs font-medium text-red-400">
                {authError}
              </p>
            )}

            <Button
              type="submit"
              disabled={verifying || !passkey.trim()}
              className="w-full bg-white text-black hover:bg-neutral-200 font-semibold text-xs"
            >
              {verifying ? "Verifying..." : "Unlock Course Studio"}
            </Button>
          </form>

          <div className="mt-6 border-t border-white/[0.06] pt-4 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Return to Learner App
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!activeCourse || !activeModule || !activeLesson) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Studio Top Bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#101010]/95 backdrop-blur px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-white/[0.08] hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Learner App
            </Link>

            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-semibold tracking-tight text-white">
                Course Studio
              </span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  activeCourse.status === "published"
                    ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                    : "border border-amber-500/25 bg-amber-500/10 text-amber-300"
                )}
              >
                {activeCourse.status}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Course Switcher */}
            <select
              aria-label="Select course to edit"
              value={activeCourse.id}
              onChange={(e) => {
                setSelectedCourseId(e.target.value);
                setSelectedModuleIdx(0);
                setSelectedLessonIdx(0);
              }}
              className="rounded-lg border border-white/10 bg-[#161616] px-3 py-1.5 text-xs font-medium text-white"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.status})
                </option>
              ))}
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateCourse}
              className="border-white/10 bg-white/[0.03] text-xs text-white hover:bg-white/[0.08]"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              New Course
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setFullPreview((p) => !p)}
              className="border-white/10 bg-white/[0.03] text-xs text-white hover:bg-white/[0.08]"
            >
              {fullPreview ? (
                <>
                  <FileEdit className="mr-1.5 h-3.5 w-3.5" />
                  Back to Split Editor
                </>
              ) : (
                <>
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                  Full Learner Preview
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => persistCourse("draft")}
              className="border-white/10 bg-white/[0.03] text-xs text-neutral-200 hover:bg-white/[0.08]"
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              Save Draft
            </Button>

            <Button
              size="sm"
              disabled={saving}
              onClick={() =>
                persistCourse(
                  activeCourse.status === "published" ? "draft" : "published"
                )
              }
              className="bg-white text-black hover:bg-neutral-200 text-xs font-semibold"
            >
              <Globe className="mr-1.5 h-3.5 w-3.5" />
              {activeCourse.status === "published"
                ? "Update & Keep Published"
                : "Publish Course"}
            </Button>
          </div>
        </div>
      </header>

      {saveBanner && (
        <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-6 py-2 text-center text-xs font-medium text-emerald-300">
          <CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5" />
          {saveBanner}
        </div>
      )}

      {/* Full Learner Preview Mode */}
      {fullPreview ? (
        <div className="py-4">
          <CoachView
            initialCourses={[activeCourse]}
            onSessionCreated={(id, exp, target) => {
              onLaunchTestSession?.(id, exp, target);
            }}
          />
        </div>
      ) : (
        /* Split-Screen Visual Studio: Editor Left, Live Preview Right */
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-12">
          {/* LEFT COLUMN: Non-Technical Form Builder (7 cols) */}
          <div className="space-y-6 lg:col-span-7">
            {/* 1. Course Metadata Card */}
            <section className="rounded-2xl border border-white/10 bg-[#121212] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                  1. Course Settings
                </p>
                <span className="text-[11px] text-neutral-500">
                  No coding required — edits preview live on the right
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="course-title" className="text-xs text-neutral-300">
                    Course Title
                  </Label>
                  <Input
                    id="course-title"
                    value={activeCourse.title}
                    onChange={(e) =>
                      updateActiveCourse((c) => ({ ...c, title: e.target.value }))
                    }
                    className="border-white/10 bg-[#0c0c0c] text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="course-category" className="text-xs text-neutral-300">
                    Category Tag
                  </Label>
                  <Input
                    id="course-category"
                    value={activeCourse.category}
                    onChange={(e) =>
                      updateActiveCourse((c) => ({
                        ...c,
                        category: e.target.value,
                      }))
                    }
                    placeholder="e.g., Executive Defense, Vocal Authority"
                    className="border-white/10 bg-[#0c0c0c] text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="course-subtitle" className="text-xs text-neutral-300">
                    One-Line Subtitle
                  </Label>
                  <Input
                    id="course-subtitle"
                    value={activeCourse.subtitle}
                    onChange={(e) =>
                      updateActiveCourse((c) => ({
                        ...c,
                        subtitle: e.target.value,
                      }))
                    }
                    className="border-white/10 bg-[#0c0c0c] text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="course-difficulty" className="text-xs text-neutral-300">
                    Difficulty
                  </Label>
                  <select
                    id="course-difficulty"
                    value={activeCourse.difficulty}
                    onChange={(e) =>
                      updateActiveCourse((c) => ({
                        ...c,
                        difficulty: e.target.value as CourseDifficulty,
                      }))
                    }
                    className="w-full rounded-md border border-white/10 bg-[#0c0c0c] px-3 py-2 text-xs text-white"
                  >
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="course-desc" className="text-xs text-neutral-300">
                  Course Overview Description
                </Label>
                <Textarea
                  id="course-desc"
                  rows={2}
                  value={activeCourse.description}
                  onChange={(e) =>
                    updateActiveCourse((c) => ({
                      ...c,
                      description: e.target.value,
                    }))
                  }
                  className="border-white/10 bg-[#0c0c0c] text-white"
                />
              </div>
            </section>

            {/* 2. Modules & Lessons Selector */}
            <section className="rounded-2xl border border-white/10 bg-[#121212] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                  2. Syllabus Structure (Modules & Lessons)
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddModule}
                    className="h-7 border-white/10 bg-white/[0.03] text-xs text-white"
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add Module
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddLesson}
                    className="h-7 border-white/10 bg-white/[0.03] text-xs text-white"
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add Lesson
                  </Button>
                </div>
              </div>

              {/* Module Tabs */}
              <div className="flex flex-wrap gap-2">
                {activeCourse.modules.map((mod, mIdx) => (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => {
                      setSelectedModuleIdx(mIdx);
                      setSelectedLessonIdx(0);
                    }}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                      mIdx === selectedModuleIdx
                        ? "border-white bg-white text-black font-semibold"
                        : "border-white/10 bg-[#0c0c0c] text-neutral-300 hover:border-white/25"
                    )}
                  >
                    {mod.title}
                  </button>
                ))}
              </div>

              {/* Active Module Title */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="module-title" className="text-xs text-neutral-400">
                    Module Title
                  </Label>
                  <Input
                    id="module-title"
                    value={activeModule.title}
                    onChange={(e) =>
                      updateActiveCourse((course) => ({
                        ...course,
                        modules: course.modules.map((m, idx) =>
                          idx === selectedModuleIdx
                            ? { ...m, title: e.target.value }
                            : m
                        ),
                      }))
                    }
                    className="border-white/10 bg-[#0c0c0c] text-white text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="module-desc" className="text-xs text-neutral-400">
                    Module Objective
                  </Label>
                  <Input
                    id="module-desc"
                    value={activeModule.description}
                    onChange={(e) =>
                      updateActiveCourse((course) => ({
                        ...course,
                        modules: course.modules.map((m, idx) =>
                          idx === selectedModuleIdx
                            ? { ...m, description: e.target.value }
                            : m
                        ),
                      }))
                    }
                    className="border-white/10 bg-[#0c0c0c] text-white text-xs"
                  />
                </div>
              </div>

              {/* Lesson Pills inside Active Module */}
              <div className="space-y-2 border-t border-white/[0.06] pt-3">
                <p className="text-xs font-medium text-neutral-400">
                  Lessons in {activeModule.title}:
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeModule.lessons.map((les, lIdx) => (
                    <div
                      key={les.id}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors",
                        lIdx === selectedLessonIdx
                          ? "border-emerald-400/50 bg-emerald-500/15 text-white font-semibold"
                          : "border-white/10 bg-[#0c0c0c] text-neutral-300"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedLessonIdx(lIdx)}
                        className="text-left"
                      >
                        {lIdx + 1}. {les.title}
                      </button>
                      {activeModule.lessons.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteLesson(lIdx)}
                          aria-label={`Delete ${les.title}`}
                          className="ml-1 text-neutral-500 hover:text-red-400"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* 3. Lesson & 4-Slide Deck Editor */}
            <section className="rounded-2xl border border-white/10 bg-[#121212] p-5 space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                  3. Edit Lesson Slides & Linked Chamber
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="lesson-title" className="text-xs text-neutral-300">
                    Lesson Title
                  </Label>
                  <Input
                    id="lesson-title"
                    value={activeLesson.title}
                    onChange={(e) =>
                      updateActiveLesson((l) => ({ ...l, title: e.target.value }))
                    }
                    className="border-white/10 bg-[#0c0c0c] text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lesson-tagline" className="text-xs text-neutral-300">
                    Short Tagline
                  </Label>
                  <Input
                    id="lesson-tagline"
                    value={activeLesson.tagline}
                    onChange={(e) =>
                      updateActiveLesson((l) => ({
                        ...l,
                        tagline: e.target.value,
                      }))
                    }
                    className="border-white/10 bg-[#0c0c0c] text-white"
                  />
                </div>
              </div>

              {/* 4 Slide Selector Tabs (Syncs with Live Preview on Right) */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-1">
                {[
                  { idx: 0 as BriefingSlideIndex, title: "Slide 1: The Trap" },
                  { idx: 1 as BriefingSlideIndex, title: "Slide 2: The Rule" },
                  { idx: 2 as BriefingSlideIndex, title: "Slide 3: The Tape" },
                  { idx: 3 as BriefingSlideIndex, title: "Slide 4: Chamber" },
                ].map((tab) => (
                  <button
                    key={tab.idx}
                    type="button"
                    onClick={() => setActiveSlide(tab.idx)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                      activeSlide === tab.idx
                        ? "border-white bg-white text-black font-semibold"
                        : "border-white/10 bg-[#0c0c0c] text-neutral-400 hover:text-white"
                    )}
                  >
                    {tab.title}
                  </button>
                ))}
              </div>

              {/* Slide 0 Editor: The Trap */}
              {activeSlide === 0 && (
                <div className="space-y-4 rounded-xl border border-white/[0.06] bg-[#0e0e0e] p-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="trap-headline" className="text-xs text-neutral-300">
                      Trap Headline
                    </Label>
                    <Input
                      id="trap-headline"
                      value={activeLesson.slides.trap.headline}
                      onChange={(e) =>
                        updateActiveLesson((l) => ({
                          ...l,
                          slides: {
                            ...l.slides,
                            trap: { ...l.slides.trap, headline: e.target.value },
                          },
                        }))
                      }
                      className="border-white/10 bg-[#141414] text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="trap-body" className="text-xs text-neutral-300">
                      What speakers get wrong under pressure
                    </Label>
                    <Textarea
                      id="trap-body"
                      rows={3}
                      value={activeLesson.slides.trap.body}
                      onChange={(e) =>
                        updateActiveLesson((l) => ({
                          ...l,
                          slides: {
                            ...l.slides,
                            trap: { ...l.slides.trap, body: e.target.value },
                          },
                        }))
                      }
                      className="border-white/10 bg-[#141414] text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="trap-cost" className="text-xs text-neutral-300">
                      Why this costs you the room
                    </Label>
                    <Input
                      id="trap-cost"
                      value={activeLesson.slides.trap.costOfFailure}
                      onChange={(e) =>
                        updateActiveLesson((l) => ({
                          ...l,
                          slides: {
                            ...l.slides,
                            trap: {
                              ...l.slides.trap,
                              costOfFailure: e.target.value,
                            },
                          },
                        }))
                      }
                      className="border-white/10 bg-[#141414] text-white"
                    />
                  </div>
                </div>
              )}

              {/* Slide 1 Editor: The Mental Model */}
              {activeSlide === 1 && (
                <div className="space-y-4 rounded-xl border border-white/[0.06] bg-[#0e0e0e] p-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="model-headline" className="text-xs text-neutral-300">
                      Framework / Rule Name
                    </Label>
                    <Input
                      id="model-headline"
                      value={activeLesson.slides.mentalModel.headline}
                      onChange={(e) =>
                        updateActiveLesson((l) => ({
                          ...l,
                          slides: {
                            ...l.slides,
                            mentalModel: {
                              ...l.slides.mentalModel,
                              headline: e.target.value,
                            },
                          },
                        }))
                      }
                      className="border-white/10 bg-[#141414] text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="model-body" className="text-xs text-neutral-300">
                      How the technique works
                    </Label>
                    <Textarea
                      id="model-body"
                      rows={3}
                      value={activeLesson.slides.mentalModel.body}
                      onChange={(e) =>
                        updateActiveLesson((l) => ({
                          ...l,
                          slides: {
                            ...l.slides,
                            mentalModel: {
                              ...l.slides.mentalModel,
                              body: e.target.value,
                            },
                          },
                        }))
                      }
                      className="border-white/10 bg-[#141414] text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="model-golden" className="text-xs text-emerald-400">
                      The Golden Rule (1-sentence takeaway)
                    </Label>
                    <Input
                      id="model-golden"
                      value={activeLesson.slides.mentalModel.goldenRule}
                      onChange={(e) =>
                        updateActiveLesson((l) => ({
                          ...l,
                          slides: {
                            ...l.slides,
                            mentalModel: {
                              ...l.slides.mentalModel,
                              goldenRule: e.target.value,
                            },
                          },
                        }))
                      }
                      className="border-white/10 bg-[#141414] text-white"
                    />
                  </div>
                </div>
              )}

              {/* Slide 2 Editor: The Tape Breakdown */}
              {activeSlide === 2 && (
                <div className="space-y-4 rounded-xl border border-white/[0.06] bg-[#0e0e0e] p-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="tape-prompt" className="text-xs text-neutral-300">
                      Example Panelist Question
                    </Label>
                    <Input
                      id="tape-prompt"
                      value={activeLesson.slides.tape.prompt}
                      onChange={(e) =>
                        updateActiveLesson((l) => ({
                          ...l,
                          slides: {
                            ...l.slides,
                            tape: { ...l.slides.tape, prompt: e.target.value },
                          },
                        }))
                      }
                      className="border-white/10 bg-[#141414] text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="tape-weak" className="text-xs text-red-300">
                        Weak / Defensive Response
                      </Label>
                      <Textarea
                        id="tape-weak"
                        rows={3}
                        value={activeLesson.slides.tape.weakResponse}
                        onChange={(e) =>
                          updateActiveLesson((l) => ({
                            ...l,
                            slides: {
                              ...l.slides,
                              tape: {
                                ...l.slides.tape,
                                weakResponse: e.target.value,
                              },
                            },
                          }))
                        }
                        className="border-white/10 bg-[#141414] text-white text-xs"
                      />
                      <Input
                        aria-label="Weak response critique"
                        value={activeLesson.slides.tape.weakCritique}
                        onChange={(e) =>
                          updateActiveLesson((l) => ({
                            ...l,
                            slides: {
                              ...l.slides,
                              tape: {
                                ...l.slides.tape,
                                weakCritique: e.target.value,
                              },
                            },
                          }))
                        }
                        placeholder="Why this fails..."
                        className="border-white/10 bg-[#141414] text-white text-xs"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tape-strong" className="text-xs text-emerald-300">
                        Executive Response
                      </Label>
                      <Textarea
                        id="tape-strong"
                        rows={3}
                        value={activeLesson.slides.tape.strongResponse}
                        onChange={(e) =>
                          updateActiveLesson((l) => ({
                            ...l,
                            slides: {
                              ...l.slides,
                              tape: {
                                ...l.slides.tape,
                                strongResponse: e.target.value,
                              },
                            },
                          }))
                        }
                        className="border-white/10 bg-[#141414] text-white text-xs"
                      />
                      <Input
                        aria-label="Executive response rationale"
                        value={activeLesson.slides.tape.strongWhy}
                        onChange={(e) =>
                          updateActiveLesson((l) => ({
                            ...l,
                            slides: {
                              ...l.slides,
                              tape: {
                                ...l.slides.tape,
                                strongWhy: e.target.value,
                              },
                            },
                          }))
                        }
                        placeholder="Why this works..."
                        className="border-white/10 bg-[#141414] text-white text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Slide 3 Editor: Chamber Mission & Panelist Config */}
              {activeSlide === 3 && (
                <div className="space-y-4 rounded-xl border border-white/[0.06] bg-[#0e0e0e] p-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label htmlFor="room-mode" className="text-xs text-neutral-300">
                        Chamber Mode
                      </Label>
                      <select
                        id="room-mode"
                        value={activeLesson.roomConfig.experience}
                        onChange={(e) => {
                          const exp = e.target.value as "open_spar" | "drill";
                          updateActiveLesson((l) => ({
                            ...l,
                            roomConfig: {
                              ...l.roomConfig,
                              experience: exp,
                              drillTarget:
                                exp === "drill"
                                  ? l.roomConfig.drillTarget || "hedging"
                                  : null,
                            },
                          }));
                        }}
                        className="w-full rounded-md border border-white/10 bg-[#141414] px-3 py-2 text-xs text-white"
                      >
                        <option value="open_spar">Q&A (Open Spar)</option>
                        <option value="drill">Targeted Drill</option>
                      </select>
                    </div>

                    {activeLesson.roomConfig.experience === "drill" && (
                      <div className="space-y-1">
                        <Label htmlFor="room-drill-target" className="text-xs text-neutral-300">
                          Drill Habit Target
                        </Label>
                        <select
                          id="room-drill-target"
                          value={activeLesson.roomConfig.drillTarget || "hedging"}
                          onChange={(e) =>
                            updateActiveLesson((l) => ({
                              ...l,
                              roomConfig: {
                                ...l.roomConfig,
                                drillTarget: e.target.value as DrillTarget,
                              },
                            }))
                          }
                          className="w-full rounded-md border border-white/10 bg-[#141414] px-3 py-2 text-xs text-white"
                        >
                          {DRILL_TARGETS.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label htmlFor="room-archetype" className="text-xs text-neutral-300">
                        Panelist Opponent
                      </Label>
                      <select
                        id="room-archetype"
                        value={activeLesson.roomConfig.archetype}
                        onChange={(e) => {
                          const arch = e.target.value as ArchetypeKey;
                          updateActiveLesson((l) => ({
                            ...l,
                            roomConfig: {
                              ...l.roomConfig,
                              archetype: arch,
                              personaName: ARCHETYPES[arch].defaultName,
                            },
                          }));
                        }}
                        className="w-full rounded-md border border-white/10 bg-[#141414] px-3 py-2 text-xs text-white"
                      >
                        {ARCHETYPE_LIST.map((a) => (
                          <option key={a.key} value={a.key}>
                            {a.defaultName} — {a.tagline}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="room-tone" className="text-xs text-neutral-300">
                        Panelist Tone
                      </Label>
                      <select
                        id="room-tone"
                        value={activeLesson.roomConfig.behaviorStyle}
                        onChange={(e) =>
                          updateActiveLesson((l) => ({
                            ...l,
                            roomConfig: {
                              ...l.roomConfig,
                              behaviorStyle: e.target.value as BehaviorStyle,
                            },
                          }))
                        }
                        className="w-full rounded-md border border-white/10 bg-[#141414] px-3 py-2 text-xs text-white capitalize"
                      >
                        {BEHAVIORS.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="mission-attack" className="text-xs text-amber-300">
                      Opening Attack Line (What the panelist challenges the learner with)
                    </Label>
                    <Textarea
                      id="mission-attack"
                      rows={2}
                      value={activeLesson.slides.mission.openingAttack}
                      onChange={(e) =>
                        updateActiveLesson((l) => ({
                          ...l,
                          slides: {
                            ...l.slides,
                            mission: {
                              ...l.slides.mission,
                              openingAttack: e.target.value,
                            },
                          },
                        }))
                      }
                      className="border-white/10 bg-[#141414] text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="mission-criteria" className="text-xs text-emerald-400">
                      Pass Criteria (What the coach evaluates)
                    </Label>
                    <Input
                      id="mission-criteria"
                      value={activeLesson.slides.mission.passCriteria}
                      onChange={(e) =>
                        updateActiveLesson((l) => ({
                          ...l,
                          slides: {
                            ...l.slides,
                            mission: {
                              ...l.slides.mission,
                              passCriteria: e.target.value,
                            },
                          },
                        }))
                      }
                      className="border-white/10 bg-[#141414] text-white"
                    />
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* RIGHT COLUMN: Sticky Real-Time Learner Preview (5 cols) */}
          <div className="lg:col-span-5">
            <div className="sticky top-20 space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-300">
                    Live Learner Preview
                  </p>
                </div>
                <span className="text-[11px] text-neutral-500">
                  Interactive 4-card deck
                </span>
              </div>

              <ExecutiveBriefingDeck
                course={activeCourse}
                lesson={activeLesson}
                activeSlide={activeSlide}
                onSlideChange={setActiveSlide}
                launching={launchingTest}
                onLaunchDrill={
                  onLaunchTestSession ? handleTestDrill : undefined
                }
                previewMode={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
