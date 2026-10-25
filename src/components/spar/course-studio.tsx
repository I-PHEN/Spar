"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  FileEdit,
  Globe,
  Image as ImageIcon,
  Layers,
  Layout,
  Lock,
  Plus,
  Save,
  Settings,
  Sliders,
  Sparkles,
  Swords,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ARCHETYPE_LIST, ARCHETYPES } from "@/lib/personas";
import {
  DRILL_TARGETS,
  type DrillTarget,
  type ExperienceKey,
} from "@/lib/experiences";
import type { ArchetypeKey, BehaviorStyle } from "@/lib/types";
import {
  ACTIVITY_TYPE_LABELS,
  DEFAULT_COURSES,
  DIAGRAM_PRESET_LABELS,
  MAX_LESSON_SLIDES,
  MIN_LESSON_SLIDES,
  SPAR_SIGNATURE_HEADLINE,
  SPAR_SIGNATURE_MANIFESTO,
  buildLessonSessionPayload,
  createEmptyCourse,
  createEmptyLesson,
  createEmptyModule,
  createExtraSlide,
  getLessonContentSlideCount,
  getRealWorldChallenge,
  type ActivityType,
  type Course,
  type CourseDifficulty,
  type CourseLesson,
  type DiagramPreset,
  type LessonExtraSlide,
  type SlideVisualMedia,
  type VisualLayout,
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

type InspectorTab = "slide" | "visual" | "room";

const DIFFICULTIES: CourseDifficulty[] = [
  "Foundation",
  "Intermediate",
  "Advanced",
];

const BEHAVIORS: Array<{
  id: BehaviorStyle;
  label: string;
  desc: string;
}> = [
  {
    id: "gentle",
    label: "Supportive",
    desc: "Warm-up pacing, patient follow-ups",
  },
  {
    id: "moderate",
    label: "Executive",
    desc: "Realistic boardroom standards",
  },
  {
    id: "aggressive",
    label: "High-Pressure",
    desc: "Interrupts rambling & challenges hedges",
  },
];

const PRESET_KEYS = Object.keys(DIAGRAM_PRESET_LABELS) as DiagramPreset[];

function SlideVisualEditor({
  visual,
  onChange,
}: {
  visual?: SlideVisualMedia;
  onChange: (next: SlideVisualMedia) => void;
}) {
  const current: SlideVisualMedia = visual ?? {
    preset: "none",
    url: "",
    layout: "split",
    caption: "",
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs font-medium text-neutral-300">
          Slide Layout Style
        </Label>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: "split", label: "Side-by-Side" },
              { id: "hero", label: "Top Banner" },
              { id: "card", label: "Bottom Card" },
            ] as const
          ).map((layoutOpt) => (
            <button
              key={layoutOpt.id}
              type="button"
              onClick={() => onChange({ ...current, layout: layoutOpt.id })}
              className={cn(
                "rounded-lg border px-2.5 py-2 text-xs font-medium transition-all",
                (current.layout ?? "split") === layoutOpt.id
                  ? "border-white bg-white text-black font-semibold"
                  : "border-white/10 bg-[#0c0c0e] text-neutral-300 hover:border-white/25"
              )}
            >
              {layoutOpt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium text-neutral-300">
          Built-in Tactical Diagram
        </Label>
        <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-1">
          {PRESET_KEYS.map((k) => {
            const active = (current.preset ?? "none") === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() =>
                  onChange({
                    ...current,
                    preset: k,
                  })
                }
                className={cn(
                  "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-all",
                  active
                    ? "border-sky-400/60 bg-sky-500/15 text-white font-semibold"
                    : "border-white/10 bg-[#0c0c0e] text-neutral-300 hover:border-white/20"
                )}
              >
                <span className="truncate">{DIAGRAM_PRESET_LABELS[k]}</span>
                {active && (
                  <span className="ml-2 shrink-0 text-[10px] font-mono text-sky-300">
                    Active
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 border-t border-white/[0.08] pt-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-neutral-300">
            Custom Slide Graphic / Image URL (Optional)
          </Label>
          <Input
            value={current.url ?? ""}
            onChange={(e) => onChange({ ...current, url: e.target.value })}
            placeholder="https://... or /diagrams/custom.png"
            className="h-8 border-white/10 bg-[#0c0c0e] text-xs text-white"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-neutral-300">Figure Caption</Label>
          <Input
            value={current.caption ?? ""}
            onChange={(e) => onChange({ ...current, caption: e.target.value })}
            placeholder="Fig 1.1 — Executive takeaway..."
            className="h-8 border-white/10 bg-[#0c0c0e] text-xs text-white"
          />
        </div>
      </div>
    </div>
  );
}

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
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("slide");
  const [showCourseSettings, setShowCourseSettings] = useState(false);
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
    setShowCourseSettings(true);
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

  // ─── Dynamic Slide Management (2..6 Content Slides Guardrail) ──────────────
  const contentSlideCount = activeLesson
    ? getLessonContentSlideCount(activeLesson)
    : 4;
  const canAddSlide = contentSlideCount < MAX_LESSON_SLIDES;
  const canRemoveSlide = contentSlideCount > MIN_LESSON_SLIDES;

  function handleAddCustomSlide() {
    if (!activeLesson || !canAddSlide) return;
    const currentExtras = activeLesson.extraSlides ?? [];
    const nextSlide = createExtraSlide(currentExtras.length + 1);
    const nextIndex = 100 + currentExtras.length;
    updateActiveLesson((l) => ({
      ...l,
      extraSlides: [...(l.extraSlides ?? []), nextSlide],
    }));
    setActiveSlide(nextIndex);
    setInspectorTab("slide");
  }

  function handleRemoveCoreSlide(key: "trap" | "mentalModel" | "tape") {
    if (!activeLesson || !canRemoveSlide) return;
    const currentHidden = new Set(activeLesson.hiddenCoreSlides ?? []);
    currentHidden.add(key);
    updateActiveLesson((l) => ({
      ...l,
      hiddenCoreSlides: Array.from(currentHidden),
    }));
    setActiveSlide(3);
  }

  function handleRestoreCoreSlides() {
    if (!activeLesson) return;
    updateActiveLesson((l) => ({
      ...l,
      hiddenCoreSlides: [],
    }));
    setActiveSlide(0);
  }

  function handleRemoveExtraSlide(extraIdx: number) {
    if (!activeLesson || !canRemoveSlide) return;
    updateActiveLesson((l) => ({
      ...l,
      extraSlides: (l.extraSlides ?? []).filter((_, idx) => idx !== extraIdx),
    }));
    setActiveSlide(0);
  }

  function updateExtraSlide(
    extraIdx: number,
    updater: (slide: LessonExtraSlide) => LessonExtraSlide
  ) {
    updateActiveLesson((l) => ({
      ...l,
      extraSlides: (l.extraSlides ?? []).map((s, idx) =>
        idx === extraIdx ? updater(s) : s
      ),
    }));
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

  const hiddenCoreSet = new Set(activeLesson.hiddenCoreSlides ?? []);
  const activeExtraIdx = activeSlide >= 100 ? activeSlide - 100 : -1;
  const activeExtraSlide =
    activeExtraIdx >= 0
      ? (activeLesson.extraSlides ?? [])[activeExtraIdx] ?? null
      : null;

  // Build filmstrip items in order
  const filmstripItems: Array<{
    slideIndex: BriefingSlideIndex;
    badge: string;
    title: string;
    subtitle: string;
    accentClass: string;
    removableKey?: "trap" | "mentalModel" | "tape";
    removableExtraIdx?: number;
  }> = [];

  let slideNumber = 1;
  if (!hiddenCoreSet.has("trap")) {
    filmstripItems.push({
      slideIndex: 0,
      badge: `0${slideNumber++}`,
      title: "The Trap",
      subtitle: activeLesson.slides.trap.headline,
      accentClass: "border-l-rose-400",
      removableKey: "trap",
    });
  }
  if (!hiddenCoreSet.has("mentalModel")) {
    filmstripItems.push({
      slideIndex: 1,
      badge: `0${slideNumber++}`,
      title: "Mental Model",
      subtitle: activeLesson.slides.mentalModel.headline,
      accentClass: "border-l-emerald-400",
      removableKey: "mentalModel",
    });
  }
  if (!hiddenCoreSet.has("tape")) {
    filmstripItems.push({
      slideIndex: 2,
      badge: `0${slideNumber++}`,
      title: "The Tape",
      subtitle: activeLesson.slides.tape.headline,
      accentClass: "border-l-sky-400",
      removableKey: "tape",
    });
  }

  (activeLesson.extraSlides ?? []).forEach((extra, idx) => {
    filmstripItems.push({
      slideIndex: 100 + idx,
      badge: `0${slideNumber++}`,
      title: extra.label || `Insight ${idx + 1}`,
      subtitle: extra.headline,
      accentClass: "border-l-violet-400",
      removableExtraIdx: idx,
    });
  });

  filmstripItems.push({
    slideIndex: 3,
    badge: `0${slideNumber++}`,
    title: "Chamber Mission",
    subtitle: `vs. ${activeLesson.roomConfig.personaName} (${activeLesson.roomConfig.behaviorStyle})`,
    accentClass: "border-l-amber-400",
  });

  filmstripItems.push({
    slideIndex: 4,
    badge: "✦",
    title: "Real-World Transfer",
    subtitle: "Spar Signature Closing Slide",
    accentClass: "border-l-emerald-300",
  });

  return (
    <div className="min-h-screen bg-[#080809] text-white flex flex-col">
      {/* ─── Studio Top Bar ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0d0d0f]/95 backdrop-blur px-4 py-2.5 sm:px-6">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-white/[0.08] hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Learner App
            </Link>

            <div className="flex items-center gap-2 pl-1">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-semibold tracking-tight text-white">
                Course Studio
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  activeCourse.status === "published"
                    ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                    : "border border-amber-500/25 bg-amber-500/10 text-amber-300"
                )}
              >
                {activeCourse.status}
              </span>
            </div>

            {/* Course Switcher */}
            <select
              aria-label="Select course to edit"
              value={activeCourse.id}
              onChange={(e) => {
                setSelectedCourseId(e.target.value);
                setSelectedModuleIdx(0);
                setSelectedLessonIdx(0);
                setActiveSlide(0);
              }}
              className="rounded-lg border border-white/10 bg-[#151518] px-3 py-1.5 text-xs font-medium text-white"
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
              onClick={() => setShowCourseSettings((prev) => !prev)}
              className={cn(
                "h-8 border-white/10 text-xs",
                showCourseSettings
                  ? "bg-white text-black hover:bg-neutral-200 font-semibold"
                  : "bg-white/[0.03] text-neutral-200 hover:bg-white/[0.08]"
              )}
            >
              <Settings className="mr-1.5 h-3.5 w-3.5" />
              1. Course Settings
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateCourse}
              className="h-8 border-white/10 bg-white/[0.03] text-xs text-white hover:bg-white/[0.08]"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              New Course
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFullPreview((p) => !p)}
              className="h-8 border-white/10 bg-white/[0.03] text-xs text-white hover:bg-white/[0.08]"
            >
              {fullPreview ? (
                <>
                  <FileEdit className="mr-1.5 h-3.5 w-3.5" />
                  Back to Slide Studio
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
              className="h-8 border-white/10 bg-white/[0.03] text-xs text-neutral-200 hover:bg-white/[0.08]"
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
              className="h-8 bg-white text-black hover:bg-neutral-200 text-xs font-semibold"
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

      {/* ─── Collapsible Course Settings Drawer ────────────────────────────── */}
      {showCourseSettings && !fullPreview && (
        <div className="border-b border-white/10 bg-[#111114] px-4 py-5 sm:px-6">
          <div className="mx-auto max-w-[1600px] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-300">
                  1. Course Settings &amp; Outcomes
                </p>
                <p className="text-xs text-neutral-400">
                  Configure how this course appears in the Learner Discovery Catalog and Roadmap header.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCourseSettings(false)}
                className="text-xs text-neutral-400 hover:text-white"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Done
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="course-title" className="text-xs text-neutral-300">
                  Course Title
                </Label>
                <Input
                  id="course-title"
                  value={activeCourse.title}
                  onChange={(e) =>
                    updateActiveCourse((c) => ({ ...c, title: e.target.value }))
                  }
                  className="border-white/10 bg-[#0a0a0c] text-white"
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
                  placeholder="Q&A, Pressure Practice, Concision"
                  className="border-white/10 bg-[#0a0a0c] text-white"
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
                  className="h-9 w-full rounded-md border border-white/10 bg-[#0a0a0c] px-3 text-xs text-white"
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="course-subtitle" className="text-xs text-neutral-300">
                  One-Sentence Outcome (Shown on Course Cards)
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
                  className="border-white/10 bg-[#0a0a0c] text-white"
                />
                <Label htmlFor="course-desc" className="mt-2 block text-xs text-neutral-300">
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
                  className="border-white/10 bg-[#0a0a0c] text-white text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="course-outcomes" className="text-xs text-emerald-300">
                  “By the end you&apos;ll be able to…” Outcomes (one per line)
                </Label>
                <Textarea
                  id="course-outcomes"
                  rows={4}
                  value={(activeCourse.learningOutcomes ?? []).join("\n")}
                  onChange={(e) =>
                    updateActiveCourse((c) => ({
                      ...c,
                      learningOutcomes: e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }))
                  }
                  placeholder="Answer hostile questions in your first sentence&#10;Defend core assumptions with downside floors&#10;Recover from curveballs in under 2 seconds"
                  className="border-white/10 bg-[#0a0a0c] text-white text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Full Learner Preview Mode ─────────────────────────────────────── */}
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
        /* ─── 3-Zone Keynote / Pitch Slide Studio ─────────────────────────── */
        <div className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-12">
          {/* ═══ ZONE 1: LEFT RAIL (Curriculum Outline + Slide Filmstrip) ═══ */}
          <aside className="space-y-5 lg:col-span-3">
            {/* 2. Syllabus Structure (Modules & Lessons) */}
            <section className="rounded-2xl border border-white/10 bg-[#111113] p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-300">
                  2. Syllabus Structure
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleAddModule}
                    className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-neutral-200 hover:bg-white/[0.08]"
                  >
                    <Plus className="h-3 w-3" />
                    Module
                  </button>
                  <button
                    type="button"
                    onClick={handleAddLesson}
                    className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-neutral-200 hover:bg-white/[0.08]"
                  >
                    <Plus className="h-3 w-3" />
                    Lesson
                  </button>
                </div>
              </div>

              {/* Module Switcher Pills */}
              <div className="flex flex-wrap gap-1.5">
                {activeCourse.modules.map((mod, mIdx) => (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => {
                      setSelectedModuleIdx(mIdx);
                      setSelectedLessonIdx(0);
                      setActiveSlide(0);
                    }}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                      mIdx === selectedModuleIdx
                        ? "border-white bg-white text-black font-semibold"
                        : "border-white/10 bg-[#0b0b0d] text-neutral-300 hover:border-white/25"
                    )}
                  >
                    {mod.title}
                  </button>
                ))}
              </div>

              {/* Compact Active Module Title Input */}
              <div className="space-y-1.5 pt-1">
                <Input
                  aria-label="Module Title"
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
                  placeholder="Module title..."
                  className="h-8 border-white/10 bg-[#0b0b0d] text-xs text-white"
                />
              </div>

              {/* Vertical Lesson List */}
              <div className="space-y-1.5 border-t border-white/[0.06] pt-2.5">
                {activeModule.lessons.map((les, lIdx) => {
                  const selected = lIdx === selectedLessonIdx;
                  return (
                    <div
                      key={les.id}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs transition-all",
                        selected
                          ? "border-white/25 bg-white/[0.07] text-white font-semibold shadow-sm"
                          : "border-white/[0.06] bg-[#0b0b0d] text-neutral-300 hover:border-white/15"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLessonIdx(lIdx);
                          setActiveSlide(0);
                        }}
                        className="flex-1 truncate text-left"
                      >
                        <span className="font-mono text-[10px] text-neutral-400 mr-1.5">
                          0{lIdx + 1}
                        </span>
                        {les.title}
                      </button>

                      {activeModule.lessons.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteLesson(lIdx)}
                          aria-label={`Delete ${les.title}`}
                          className="text-neutral-500 hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* PowerPoint Slide Filmstrip with 6-Slide Guardrail */}
            <section className="rounded-2xl border border-white/10 bg-[#111113] p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-300">
                    Slide Filmstrip
                  </p>
                  <p className="text-[11px] text-neutral-400">
                    {contentSlideCount} of {MAX_LESSON_SLIDES} content slides
                  </p>
                </div>

                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-mono font-semibold",
                    contentSlideCount <= 4
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                  )}
                >
                  {contentSlideCount <= 4 ? "Optimal Pacing" : "Near Max (6)"}
                </span>
              </div>

              {/* Action-First Pacing Guardrail Bar */}
              <div className="rounded-lg border border-white/[0.06] bg-[#0b0b0d] px-3 py-2 text-[11px] leading-relaxed text-neutral-400">
                Keep lessons between{" "}
                <strong className="text-neutral-200">
                  {MIN_LESSON_SLIDES}–{MAX_LESSON_SLIDES} slides
                </strong>{" "}
                so learners spend 80% of their time speaking, not reading.
              </div>

              {/* Thumbnail Cards */}
              <div className="space-y-2">
                {filmstripItems.map((item) => {
                  const isSelected = activeSlide === item.slideIndex;
                  const canDeleteThis =
                    canRemoveSlide &&
                    (item.removableKey !== undefined ||
                      item.removableExtraIdx !== undefined);

                  return (
                    <div
                      key={item.slideIndex}
                      className={cn(
                        "group relative flex items-center justify-between gap-2 rounded-xl border border-l-4 px-3 py-2.5 transition-all",
                        item.accentClass,
                        isSelected
                          ? "border-white/30 bg-white/[0.08] text-white shadow-sm"
                          : "border-white/[0.07] bg-[#0b0b0d] text-neutral-300 hover:border-white/15"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSlide(item.slideIndex);
                          if (item.slideIndex === 3) {
                            setInspectorTab("room");
                          } else if (inspectorTab === "room") {
                            setInspectorTab("slide");
                          }
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                            {item.badge} · {item.title}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs font-medium text-neutral-200">
                          {item.subtitle}
                        </p>
                      </button>

                      {canDeleteThis && (
                        <button
                          type="button"
                          title="Remove slide from deck"
                          aria-label={`Remove ${item.title} slide`}
                          onClick={() => {
                            if (item.removableKey) {
                              handleRemoveCoreSlide(item.removableKey);
                            } else if (item.removableExtraIdx !== undefined) {
                              handleRemoveExtraSlide(item.removableExtraIdx);
                            }
                          }}
                          className="opacity-70 hover:opacity-100 text-neutral-500 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add / Restore Slide Controls */}
              <div className="space-y-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canAddSlide}
                  onClick={handleAddCustomSlide}
                  className="w-full border-dashed border-white/20 bg-white/[0.03] text-xs text-white hover:bg-white/[0.08] disabled:opacity-40"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  {canAddSlide
                    ? `Add Insight Slide (${contentSlideCount}/${MAX_LESSON_SLIDES})`
                    : `Max ${MAX_LESSON_SLIDES} Slides Reached (Action-First Limit)`}
                </Button>

                {hiddenCoreSet.size > 0 && (
                  <button
                    type="button"
                    onClick={handleRestoreCoreSlides}
                    className="w-full text-center text-[11px] font-medium text-neutral-400 hover:text-white underline-offset-4 hover:underline"
                  >
                    Restore hidden default slides ({hiddenCoreSet.size})
                  </button>
                )}
              </div>
            </section>
          </aside>

          {/* ═══ ZONE 2: CENTER STAGE (Widescreen Keynote Slide Canvas) ═══ */}
          <main className="space-y-4 lg:col-span-5">
            {/* Lesson Header Bar */}
            <div className="rounded-2xl border border-white/10 bg-[#111113] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-300">
                    Live Learner Preview
                  </p>
                </div>
                <span className="text-[11px] text-neutral-400">
                  Widescreen Presentation Stage
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                <div className="sm:col-span-5">
                  <Label htmlFor="lesson-title" className="text-[11px] text-neutral-400">
                    Lesson Title
                  </Label>
                  <Input
                    id="lesson-title"
                    value={activeLesson.title}
                    onChange={(e) =>
                      updateActiveLesson((l) => ({
                        ...l,
                        title: e.target.value,
                      }))
                    }
                    className="mt-1 h-8 border-white/10 bg-[#0b0b0d] text-xs text-white"
                  />
                </div>
                <div className="sm:col-span-4">
                  <Label htmlFor="lesson-tagline" className="text-[11px] text-neutral-400">
                    One-Line Outcome Tagline
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
                    className="mt-1 h-8 border-white/10 bg-[#0b0b0d] text-xs text-white"
                  />
                </div>
                <div className="sm:col-span-3">
                  <Label htmlFor="lesson-activity-type" className="text-[11px] text-neutral-400">
                    Activity Type
                  </Label>
                  <select
                    id="lesson-activity-type"
                    value={activeLesson.activityType ?? "lesson"}
                    onChange={(e) =>
                      updateActiveLesson((l) => ({
                        ...l,
                        activityType: e.target.value as ActivityType,
                      }))
                    }
                    className="mt-1 h-8 w-full rounded-md border border-white/10 bg-[#0b0b0d] px-2.5 text-xs text-white"
                  >
                    {(Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[]).map(
                      (typeKey) => (
                        <option key={typeKey} value={typeKey}>
                          {ACTIVITY_TYPE_LABELS[typeKey]}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>
            </div>

            {/* Interactive Slide Canvas */}
            <ExecutiveBriefingDeck
              course={activeCourse}
              lesson={activeLesson}
              activeSlide={activeSlide}
              onSlideChange={(next) => {
                setActiveSlide(next);
                if (next === 3) {
                  setInspectorTab("room");
                } else if (inspectorTab === "room") {
                  setInspectorTab("slide");
                }
              }}
              launching={launchingTest}
              onLaunchDrill={onLaunchTestSession ? handleTestDrill : undefined}
              previewMode={true}
            />
          </main>

          {/* ═══ ZONE 3: RIGHT CONTEXTUAL INSPECTOR (Slide / Visual / Room) ═══ */}
          <aside className="lg:col-span-4">
            <div className="sticky top-20 rounded-2xl border border-white/10 bg-[#111113] overflow-hidden">
              {/* Inspector Mode Tabs */}
              <div className="border-b border-white/10 bg-[#0c0c0e] p-2">
                <p className="px-2 pb-2 pt-1 text-[10px] font-mono uppercase tracking-[0.18em] text-neutral-400">
                  3. Edit Lesson Slides &amp; Linked Chamber
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setInspectorTab("slide")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all",
                      inspectorTab === "slide"
                        ? "bg-white text-black font-semibold"
                        : "text-neutral-300 hover:bg-white/[0.05]"
                    )}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Slide Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectorTab("visual")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all",
                      inspectorTab === "visual"
                        ? "bg-white text-black font-semibold"
                        : "text-neutral-300 hover:bg-white/[0.05]"
                    )}
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    Diagram
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectorTab("room")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all",
                      inspectorTab === "room"
                        ? "bg-white text-black font-semibold"
                        : "text-neutral-300 hover:bg-white/[0.05]"
                    )}
                  >
                    <Swords className="h-3.5 w-3.5" />
                    Room &amp; AI
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-5 max-h-[calc(100vh-180px)] overflow-y-auto">
                {/* ─── TAB 1: SLIDE COPY INSPECTOR ─────────────────────────── */}
                {inspectorTab === "slide" && (
                  <>
                    {/* Slide 0: The Trap */}
                    {activeSlide === 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-rose-300">
                            Editing Slide: The Trap
                          </span>
                          <span className="text-[11px] text-neutral-500">
                            What speakers get wrong
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="trap-headline" className="text-xs text-neutral-300">
                            Slide Headline
                          </Label>
                          <Input
                            id="trap-headline"
                            value={activeLesson.slides.trap.headline}
                            onChange={(e) =>
                              updateActiveLesson((l) => ({
                                ...l,
                                slides: {
                                  ...l.slides,
                                  trap: {
                                    ...l.slides.trap,
                                    headline: e.target.value,
                                  },
                                },
                              }))
                            }
                            className="border-white/10 bg-[#0b0b0d] text-white text-xs"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="trap-body" className="text-xs text-neutral-300">
                            Core Explanation
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
                                  trap: {
                                    ...l.slides.trap,
                                    body: e.target.value,
                                  },
                                },
                              }))
                            }
                            className="border-white/10 bg-[#0b0b0d] text-white text-xs"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="trap-quote" className="text-xs text-neutral-300">
                            The Fatal Impulse Quote (What speakers blurt out)
                          </Label>
                          <Input
                            id="trap-quote"
                            value={activeLesson.slides.trap.instinctQuote ?? ""}
                            onChange={(e) =>
                              updateActiveLesson((l) => ({
                                ...l,
                                slides: {
                                  ...l.slides,
                                  trap: {
                                    ...l.slides.trap,
                                    instinctQuote: e.target.value,
                                  },
                                },
                              }))
                            }
                            className="border-white/10 bg-[#0b0b0d] text-white text-xs"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="trap-cost" className="text-xs text-rose-300">
                            Why This Costs You the Room
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
                            className="border-white/10 bg-[#0b0b0d] text-white text-xs"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="trap-flaws" className="text-xs text-neutral-300">
                            Flaw Tags (comma-separated)
                          </Label>
                          <Input
                            id="trap-flaws"
                            value={(activeLesson.slides.trap.flaws ?? []).join(", ")}
                            onChange={(e) =>
                              updateActiveLesson((l) => ({
                                ...l,
                                slides: {
                                  ...l.slides,
                                  trap: {
                                    ...l.slides.trap,
                                    flaws: e.target.value
                                      .split(",")
                                      .map((s) => s.trim())
                                      .filter(Boolean),
                                  },
                                },
                              }))
                            }
                            className="border-white/10 bg-[#0b0b0d] text-white text-xs"
                          />
                        </div>
                      </div>
                    )}

                    {/* Slide 1: Mental Model */}
                    {activeSlide === 1 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-emerald-300">
                            Editing Slide: Mental Model
                          </span>
                          <span className="text-[11px] text-neutral-500">
                            Golden Rule &amp; 3 steps
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="model-headline" className="text-xs text-neutral-300">
                            Framework Headline
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
                            className="border-white/10 bg-[#0b0b0d] text-white text-xs"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="model-body" className="text-xs text-neutral-300">
                            How the Technique Works
                          </Label>
                          <Textarea
                            id="model-body"
                            rows={2}
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
                            className="border-white/10 bg-[#0b0b0d] text-white text-xs"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="model-golden" className="text-xs text-emerald-400">
                            The Golden Rule (1-Sentence Law)
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
                            className="border-white/10 bg-[#0b0b0d] text-white text-xs"
                          />
                        </div>

                        {/* 3-Step Playbook */}
                        <div className="space-y-2 border-t border-white/[0.08] pt-3">
                          <Label className="text-xs text-neutral-300">
                            3-Step Tactical Playbook
                          </Label>
                          {(activeLesson.slides.mentalModel.steps ?? [
                            { step: 1, label: "Step 1", detail: "Action one" },
                            { step: 2, label: "Step 2", detail: "Action two" },
                            { step: 3, label: "Step 3", detail: "Action three" },
                          ]).map((st, sIdx) => (
                            <div
                              key={sIdx}
                              className="rounded-lg border border-white/[0.06] bg-[#0b0b0d] p-2.5 space-y-1.5"
                            >
                              <Input
                                value={st.label}
                                onChange={(e) => {
                                  const currentSteps =
                                    activeLesson.slides.mentalModel.steps ?? [];
                                  const nextSteps = currentSteps.map((item, idx) =>
                                    idx === sIdx
                                      ? { ...item, label: e.target.value }
                                      : item
                                  );
                                  updateActiveLesson((l) => ({
                                    ...l,
                                    slides: {
                                      ...l.slides,
                                      mentalModel: {
                                        ...l.slides.mentalModel,
                                        steps: nextSteps,
                                      },
                                    },
                                  }));
                                }}
                                placeholder={`Step ${sIdx + 1} title`}
                                className="h-7 border-white/10 bg-[#141418] text-xs text-white"
                              />
                              <Input
                                value={st.detail}
                                onChange={(e) => {
                                  const currentSteps =
                                    activeLesson.slides.mentalModel.steps ?? [];
                                  const nextSteps = currentSteps.map((item, idx) =>
                                    idx === sIdx
                                      ? { ...item, detail: e.target.value }
                                      : item
                                  );
                                  updateActiveLesson((l) => ({
                                    ...l,
                                    slides: {
                                      ...l.slides,
                                      mentalModel: {
                                        ...l.slides.mentalModel,
                                        steps: nextSteps,
                                      },
                                    },
                                  }));
                                }}
                                placeholder={`Step ${sIdx + 1} detail`}
                                className="h-7 border-white/10 bg-[#141418] text-xs text-neutral-300"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Slide 2: The Tape */}
                    {activeSlide === 2 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-sky-300">
                            Editing Slide: The Tape Breakdown
                          </span>
                          <span className="text-[11px] text-neutral-500">
                            Before vs. After
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="tape-prompt" className="text-xs text-neutral-300">
                            Incoming Panelist Question
                          </Label>
                          <Input
                            id="tape-prompt"
                            value={activeLesson.slides.tape.prompt}
                            onChange={(e) =>
                              updateActiveLesson((l) => ({
                                ...l,
                                slides: {
                                  ...l.slides,
                                  tape: {
                                    ...l.slides.tape,
                                    prompt: e.target.value,
                                  },
                                },
                              }))
                            }
                            className="border-white/10 bg-[#0b0b0d] text-white text-xs"
                          />
                        </div>

                        <div className="space-y-2 rounded-xl border border-rose-500/20 bg-rose-500/[0.03] p-3">
                          <Label htmlFor="tape-weak" className="text-xs text-rose-300">
                            Weak / Defensive Response
                          </Label>
                          <Textarea
                            id="tape-weak"
                            rows={2}
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
                            className="border-white/10 bg-[#0b0b0d] text-white text-xs"
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
                            className="h-8 border-white/10 bg-[#0b0b0d] text-white text-xs"
                          />
                        </div>

                        <div className="space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-3">
                          <Label htmlFor="tape-strong" className="text-xs text-emerald-300">
                            Strong Executive Response
                          </Label>
                          <Textarea
                            id="tape-strong"
                            rows={2}
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
                            className="border-white/10 bg-[#0b0b0d] text-white text-xs"
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
                            className="h-8 border-white/10 bg-[#0b0b0d] text-white text-xs"
                          />
                        </div>
                      </div>
                    )}

                    {/* Custom Extra Slide Editor */}
                    {activeExtraSlide && activeExtraIdx >= 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-violet-300">
                            Editing Custom Slide
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveExtraSlide(activeExtraIdx)}
                            className="inline-flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete Slide
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs text-neutral-300">
                            Slide Tab Label
                          </Label>
                          <Input
                            value={activeExtraSlide.label}
                            onChange={(e) =>
                              updateExtraSlide(activeExtraIdx, (s) => ({
                                ...s,
                                label: e.target.value,
                              }))
                            }
                            className="h-8 border-white/10 bg-[#0b0b0d] text-xs text-white"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs text-neutral-300">
                            Slide Headline
                          </Label>
                          <Input
                            value={activeExtraSlide.headline}
                            onChange={(e) =>
                              updateExtraSlide(activeExtraIdx, (s) => ({
                                ...s,
                                headline: e.target.value,
                              }))
                            }
                            className="h-8 border-white/10 bg-[#0b0b0d] text-xs text-white"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs text-neutral-300">
                            Slide Body
                          </Label>
                          <Textarea
                            rows={3}
                            value={activeExtraSlide.body}
                            onChange={(e) =>
                              updateExtraSlide(activeExtraIdx, (s) => ({
                                ...s,
                                body: e.target.value,
                              }))
                            }
                            className="border-white/10 bg-[#0b0b0d] text-xs text-white"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs text-neutral-300">
                            Key Bullet Points (one per line)
                          </Label>
                          <Textarea
                            rows={3}
                            value={(activeExtraSlide.bullets ?? []).join("\n")}
                            onChange={(e) =>
                              updateExtraSlide(activeExtraIdx, (s) => ({
                                ...s,
                                bullets: e.target.value
                                  .split("\n")
                                  .map((line) => line.trim())
                                  .filter(Boolean),
                              }))
                            }
                            className="border-white/10 bg-[#0b0b0d] text-xs text-white"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs text-violet-300">
                            Highlighted Takeaway Quote
                          </Label>
                          <Input
                            value={activeExtraSlide.takeaway ?? ""}
                            onChange={(e) =>
                              updateExtraSlide(activeExtraIdx, (s) => ({
                                ...s,
                                takeaway: e.target.value,
                              }))
                            }
                            className="h-8 border-white/10 bg-[#0b0b0d] text-xs text-white"
                          />
                        </div>
                      </div>
                    )}

                    {/* Slide 3: Chamber Mission Copy */}
                    {activeSlide === 3 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-amber-300">
                            Editing Slide: Chamber Briefing
                          </span>
                          <button
                            type="button"
                            onClick={() => setInspectorTab("room")}
                            className="text-xs font-medium text-amber-300 underline-offset-4 hover:underline"
                          >
                            Open AI Room Setup →
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs text-neutral-300">
                            Mission Briefing Description
                          </Label>
                          <Textarea
                            rows={2}
                            value={activeLesson.slides.mission.briefing}
                            onChange={(e) =>
                              updateActiveLesson((l) => ({
                                ...l,
                                slides: {
                                  ...l.slides,
                                  mission: {
                                    ...l.slides.mission,
                                    briefing: e.target.value,
                                  },
                                },
                              }))
                            }
                            className="border-white/10 bg-[#0b0b0d] text-xs text-white"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs text-amber-300">
                            Opening Attack Line
                          </Label>
                          <Textarea
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
                            className="border-white/10 bg-[#0b0b0d] text-xs text-white"
                          />
                        </div>
                      </div>
                    )}

                    {/* Slide 4: Spar Signature Real-World Transfer Editor */}
                    {activeSlide === 4 && (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3.5 space-y-1.5">
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-emerald-300">
                            <Sparkles className="h-3.5 w-3.5" />
                            Spar Signature Slide
                          </span>
                          <p className="text-xs font-semibold text-white">
                            “{SPAR_SIGNATURE_HEADLINE}”
                          </p>
                          <p className="text-[11px] leading-relaxed text-neutral-300">
                            {SPAR_SIGNATURE_MANIFESTO}
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          <Label
                            htmlFor="real-world-challenge"
                            className="text-xs text-emerald-300"
                          >
                            24-Hour Real-World Challenge (Action in Real Life)
                          </Label>
                          <Textarea
                            id="real-world-challenge"
                            rows={3}
                            value={getRealWorldChallenge(activeLesson)}
                            onChange={(e) =>
                              updateActiveLesson((l) => ({
                                ...l,
                                realWorldTransfer: {
                                  ...l.realWorldTransfer,
                                  enabled: true,
                                  challenge: e.target.value,
                                },
                              }))
                            }
                            placeholder="Tell the learner how to apply this exact skill in a real conversation today..."
                            className="border-white/10 bg-[#0b0b0d] text-xs text-white"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label
                            htmlFor="real-world-context"
                            className="text-xs text-neutral-300"
                          >
                            Real-World Setting Tag (Optional)
                          </Label>
                          <Input
                            id="real-world-context"
                            value={
                              activeLesson.realWorldTransfer?.contextHint ?? ""
                            }
                            onChange={(e) =>
                              updateActiveLesson((l) => ({
                                ...l,
                                realWorldTransfer: {
                                  challenge: getRealWorldChallenge(l),
                                  enabled: true,
                                  contextHint: e.target.value,
                                },
                              }))
                            }
                            placeholder="e.g., Next Standup, Board Sync, Client Call"
                            className="h-8 border-white/10 bg-[#0b0b0d] text-xs text-white"
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* ─── TAB 2: VISUAL & DIAGRAM INSPECTOR ───────────────────── */}
                {inspectorTab === "visual" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-sky-300">
                        Slide Diagram &amp; Layout
                      </span>
                      <span className="text-[11px] text-neutral-500">
                        {activeSlide === 0
                          ? "Slide 1: The Trap"
                          : activeSlide === 1
                          ? "Slide 2: Mental Model"
                          : activeSlide === 2
                          ? "Slide 3: The Tape"
                          : activeExtraSlide
                          ? activeExtraSlide.label
                          : "Chamber Slide"}
                      </span>
                    </div>

                    {activeSlide === 4 ? (
                      <p className="text-xs text-neutral-400">
                        The Spar Signature Real-World Transfer slide uses Spar&apos;s locked-in 3-stage transfer layout for brand consistency across all courses.
                      </p>
                    ) : (
                      <SlideVisualEditor
                        visual={
                          activeSlide === 0
                            ? activeLesson.slides.trap.visual
                            : activeSlide === 1
                            ? activeLesson.slides.mentalModel.visual
                            : activeSlide === 2
                            ? activeLesson.slides.tape.visual
                            : activeExtraSlide
                            ? activeExtraSlide.visual
                            : activeLesson.slides.mission.visual
                        }
                        onChange={(nextVisual) => {
                          if (activeSlide === 0) {
                            updateActiveLesson((l) => ({
                              ...l,
                              slides: {
                                ...l.slides,
                                trap: { ...l.slides.trap, visual: nextVisual },
                              },
                            }));
                          } else if (activeSlide === 1) {
                            updateActiveLesson((l) => ({
                              ...l,
                              slides: {
                                ...l.slides,
                                mentalModel: {
                                  ...l.slides.mentalModel,
                                  visual: nextVisual,
                                },
                              },
                            }));
                          } else if (activeSlide === 2) {
                            updateActiveLesson((l) => ({
                              ...l,
                              slides: {
                                ...l.slides,
                                tape: { ...l.slides.tape, visual: nextVisual },
                              },
                            }));
                          } else if (activeExtraIdx >= 0) {
                            updateExtraSlide(activeExtraIdx, (s) => ({
                              ...s,
                              visual: nextVisual,
                            }));
                          } else {
                            updateActiveLesson((l) => ({
                              ...l,
                              slides: {
                                ...l.slides,
                                mission: {
                                  ...l.slides.mission,
                                  visual: nextVisual,
                                },
                              },
                            }));
                          }
                        }}
                      />
                    )}
                  </div>
                )}

                {/* ─── TAB 3: SPARRING ROOM & PRACTICE DIRECTOR ────────────── */}
                {inspectorTab === "room" && (
                  <div className="space-y-5">
                    <div>
                      <span className="text-xs font-semibold text-amber-300">
                        AI Sparring Room &amp; Practice Director
                      </span>
                      <p className="mt-0.5 text-[11px] text-neutral-400">
                        Configure the AI partner, room pressure, and speaking prompts for this lesson.
                      </p>
                    </div>

                    {/* 1. Cast the AI Opponent (Visual Cards) */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-neutral-200 flex items-center gap-1.5">
                        <UserCheck className="h-3.5 w-3.5 text-amber-400" />
                        Cast AI Opponent Persona
                      </Label>
                      <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
                        {ARCHETYPE_LIST.map((arch) => {
                          const selected =
                            activeLesson.roomConfig.archetype === arch.key;
                          return (
                            <button
                              key={arch.key}
                              type="button"
                              onClick={() =>
                                updateActiveLesson((l) => ({
                                  ...l,
                                  roomConfig: {
                                    ...l.roomConfig,
                                    archetype: arch.key as ArchetypeKey,
                                    personaName: arch.defaultName,
                                  },
                                }))
                              }
                              className={cn(
                                "flex items-center justify-between rounded-xl border px-3 py-2 text-left transition-all",
                                selected
                                  ? "border-amber-400/60 bg-amber-500/15 text-white"
                                  : "border-white/10 bg-[#0b0b0d] text-neutral-300 hover:border-white/20"
                              )}
                            >
                              <div>
                                <p className="text-xs font-semibold text-white">
                                  {arch.defaultName} ·{" "}
                                  <span className="font-normal text-neutral-300">
                                    {arch.tagline}
                                  </span>
                                </p>
                              </div>
                              {selected && (
                                <span className="text-[10px] font-mono text-amber-300">
                                  Cast
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <div className="pt-1">
                        <Label htmlFor="custom-persona-name" className="text-[11px] text-neutral-400">
                          Custom Partner Display Name
                        </Label>
                        <Input
                          id="custom-persona-name"
                          value={activeLesson.roomConfig.personaName}
                          onChange={(e) =>
                            updateActiveLesson((l) => ({
                              ...l,
                              roomConfig: {
                                ...l.roomConfig,
                                personaName: e.target.value,
                              },
                            }))
                          }
                          className="mt-1 h-8 border-white/10 bg-[#0b0b0d] text-xs text-white"
                        />
                      </div>
                    </div>

                    {/* 2. Room Pressure Level */}
                    <div className="space-y-2 border-t border-white/[0.08] pt-3">
                      <Label className="text-xs font-medium text-neutral-200 flex items-center gap-1.5">
                        <Sliders className="h-3.5 w-3.5 text-emerald-400" />
                        Room Pressure &amp; Demeanor
                      </Label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {BEHAVIORS.map((b) => {
                          const active =
                            activeLesson.roomConfig.behaviorStyle === b.id;
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() =>
                                updateActiveLesson((l) => ({
                                  ...l,
                                  roomConfig: {
                                    ...l.roomConfig,
                                    behaviorStyle: b.id,
                                  },
                                }))
                              }
                              className={cn(
                                "rounded-lg border p-2 text-left transition-all",
                                active
                                  ? "border-white bg-white text-black"
                                  : "border-white/10 bg-[#0b0b0d] text-neutral-300 hover:border-white/25"
                              )}
                            >
                              <p className="text-xs font-semibold">{b.label}</p>
                              <p
                                className={cn(
                                  "mt-0.5 text-[10px] leading-tight",
                                  active ? "text-neutral-700" : "text-neutral-500"
                                )}
                              >
                                {b.desc}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 3. Chamber Mode & Habit Target */}
                    <div className="grid grid-cols-1 gap-3 border-t border-white/[0.08] pt-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="room-mode" className="text-xs text-neutral-300">
                          Session Format
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
                          className="h-8 w-full rounded-md border border-white/10 bg-[#0b0b0d] px-2.5 text-xs text-white"
                        >
                          <option value="open_spar">Open Q&amp;A Spar</option>
                          <option value="drill">Targeted Habit Drill</option>
                        </select>
                      </div>

                      {activeLesson.roomConfig.experience === "drill" && (
                        <div className="space-y-1">
                          <Label htmlFor="room-drill-target" className="text-xs text-neutral-300">
                            Vocal Habit Tracked
                          </Label>
                          <select
                            id="room-drill-target"
                            value={
                              activeLesson.roomConfig.drillTarget || "hedging"
                            }
                            onChange={(e) =>
                              updateActiveLesson((l) => ({
                                ...l,
                                roomConfig: {
                                  ...l.roomConfig,
                                  drillTarget: e.target.value as DrillTarget,
                                },
                              }))
                            }
                            className="h-8 w-full rounded-md border border-white/10 bg-[#0b0b0d] px-2.5 text-xs text-white"
                          >
                            {DRILL_TARGETS.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* 4. In-Lesson & Live Chamber Prompts */}
                    <div className="space-y-3 border-t border-white/[0.08] pt-3">
                      <div className="space-y-1">
                        <Label htmlFor="lesson-hook-prompt" className="text-xs text-neutral-300">
                          Stage 1 Warm-Up Prompt (Before Slides)
                        </Label>
                        <Textarea
                          id="lesson-hook-prompt"
                          rows={2}
                          value={
                            activeLesson.practice?.hookPrompt ??
                            activeLesson.slides.tape.prompt
                          }
                          onChange={(e) =>
                            updateActiveLesson((l) => ({
                              ...l,
                              practice: {
                                hookContext:
                                  l.practice?.hookContext ??
                                  "Executive Scenario Challenge",
                                hookSpeaker:
                                  l.practice?.hookSpeaker ??
                                  l.roomConfig.personaName,
                                hookPrompt: e.target.value,
                                timeLimitSeconds:
                                  l.practice?.timeLimitSeconds ?? 30,
                                differenceSummary:
                                  l.practice?.differenceSummary ??
                                  l.slides.tape.strongWhy,
                                retryContext:
                                  l.practice?.retryContext ??
                                  "Follow-Up Pressure Challenge",
                                retryPrompt:
                                  l.practice?.retryPrompt ??
                                  l.slides.mission.openingAttack,
                                targetMaxWords:
                                  l.practice?.targetMaxWords ?? 35,
                                suggestedRewrite:
                                  l.practice?.suggestedRewrite ??
                                  l.slides.tape.strongResponse,
                              },
                            }))
                          }
                          className="border-white/10 bg-[#0b0b0d] text-xs text-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="mission-attack" className="text-xs text-amber-300">
                          Live Room Opening Attack Line
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
                          className="border-white/10 bg-[#0b0b0d] text-xs text-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="mission-criteria" className="text-xs text-emerald-400">
                          Pass Criteria Headline
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
                          className="h-8 border-white/10 bg-[#0b0b0d] text-xs text-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="mission-directives" className="text-xs text-neutral-300">
                          Pass Directives Checklist (one per line)
                        </Label>
                        <Textarea
                          id="mission-directives"
                          rows={3}
                          value={(
                            activeLesson.slides.mission.passCriteriaList ?? []
                          ).join("\n")}
                          onChange={(e) =>
                            updateActiveLesson((l) => ({
                              ...l,
                              slides: {
                                ...l.slides,
                                mission: {
                                  ...l.slides.mission,
                                  passCriteriaList: e.target.value
                                    .split("\n")
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                },
                              },
                            }))
                          }
                          className="border-white/10 bg-[#0b0b0d] text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
