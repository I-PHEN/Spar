"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Eye,
  FileEdit,
  Flame,
  FolderKanban,
  Globe,
  Image as ImageIcon,
  KeyRound,
  LayoutGrid,
  Layers,
  Lock,
  Play,
  Plus,
  Save,
  ShieldAlert,
  Sparkles,
  Swords,
  Target,
  Trash2,
  Upload,
  UserCheck,
  X,
  XCircle,
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
  getCourseLessonCount,
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
  SlideVisualBlock,
  type BriefingSlideIndex,
} from "./coach-view";

export type StudioStep = "courses" | "syllabus" | "slides" | "room";

export interface CourseStudioProps {
  initialCourses?: Course[];
  initialUnlocked?: boolean;
  initialStep?: StudioStep;
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

const BEHAVIORS: Array<{
  id: BehaviorStyle;
  label: string;
  desc: string;
}> = [
  {
    id: "gentle",
    label: "Supportive",
    desc: "Warm-up pacing with patient follow-ups",
  },
  {
    id: "moderate",
    label: "Executive Standard",
    desc: "Realistic boardroom pushback",
  },
  {
    id: "aggressive",
    label: "High-Pressure",
    desc: "Interrupts rambling & challenges every hedge",
  },
];

const PRESET_KEYS = (
  Object.keys(DIAGRAM_PRESET_LABELS) as DiagramPreset[]
).filter((k) => k !== "none");

function hasSlideVisual(visual?: SlideVisualMedia): boolean {
  if (!visual) return false;
  return Boolean(
    visual.url?.trim() || (visual.preset && visual.preset !== "none")
  );
}

// ─── On-Slide Visual Frame (Direct Image Upload + Diagram Picker Modal) ──────

function OnSlideVisualCanvas({
  visual,
  onChange,
  onCloseEmpty,
}: {
  visual?: SlideVisualMedia;
  onChange: (next: SlideVisualMedia) => void;
  onCloseEmpty?: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showDiagramModal, setShowDiagramModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const current: SlideVisualMedia = visual ?? {
    preset: "none",
    url: "",
    layout: "split",
    caption: "",
  };

  const hasVisual = hasSlideVisual(current);

  function handleFileSelected(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onChange({
          ...current,
          url: reader.result,
          preset: "none",
        });
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileSelected(e.target.files?.[0])}
      />

      {hasVisual ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFileSelected(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "group relative rounded-2xl border bg-[var(--bg-base)] p-2.5 transition-all",
            isDragging
              ? "border-[var(--accent)] bg-[var(--accent)]/10"
              : "border-[var(--border-subtle)] hover:border-white/25"
          )}
        >
          {/* Floating Visual Controls */}
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-1.5 text-xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-1)] px-2.5 py-1 text-[11px] font-medium text-white hover:border-white/20 hover:bg-white/[0.06]"
              >
                <Upload className="h-3 w-3 text-[var(--accent)]" />
                Upload Image
              </button>
              <button
                type="button"
                onClick={() => setShowDiagramModal(true)}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-1)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:border-white/20 hover:text-white"
              >
                <LayoutGrid className="h-3 w-3 text-[var(--accent)]" />
                Diagrams
              </button>
            </div>

            <div className="flex items-center gap-1">
              {(
                [
                  { id: "split", label: "Split" },
                  { id: "hero", label: "Top" },
                  { id: "card", label: "Bottom" },
                ] as const
              ).map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() =>
                    onChange({ ...current, layout: l.id as VisualLayout })
                  }
                  className={cn(
                    "rounded px-2 py-0.5 text-[10px] font-mono transition-colors",
                    (current.layout ?? "split") === l.id
                      ? "bg-white text-[#080B10] font-semibold"
                      : "text-[var(--text-muted)] hover:text-white"
                  )}
                >
                  {l.label}
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  onChange({ ...current, url: "", preset: "none" });
                  onCloseEmpty?.();
                }}
                title="Remove visual from slide"
                className="ml-1 rounded p-1 text-[var(--text-muted)] hover:bg-white/10 hover:text-white"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <SlideVisualBlock visual={current} />

          <input
            type="text"
            value={current.caption ?? ""}
            onChange={(e) => onChange({ ...current, caption: e.target.value })}
            placeholder="Click to add a figure caption (optional)..."
            className="mt-2 w-full rounded-lg bg-transparent px-3 py-1.5 text-center font-mono text-xs text-[var(--text-muted)] placeholder:text-[var(--text-muted)]/60 focus:bg-white/[0.04] focus:text-[var(--text-secondary)] focus:outline-none"
          />
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFileSelected(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "relative flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-6 text-center transition-all",
            isDragging
              ? "border-[var(--accent)] bg-[var(--accent)]/10"
              : "border-[var(--border-subtle)] bg-[var(--surface-1)]/60 hover:border-white/25 hover:bg-[var(--surface-1)]"
          )}
        >
          {onCloseEmpty && (
            <button
              type="button"
              onClick={onCloseEmpty}
              title="Hide visual slot"
              className="absolute right-3 top-3 rounded-lg p-1 text-[var(--text-muted)] hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/10 text-[var(--accent)]">
            <ImageIcon className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-white">
              Add an Image or Tactical Diagram
            </p>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Drag &amp; drop an image file here, upload from your computer, or pick a built-in diagram.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 bg-white text-[#080B10] hover:bg-neutral-200 text-xs font-bold"
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Upload Image
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowDiagramModal(true)}
              className="h-8 border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs text-white hover:bg-white/[0.08]"
            >
              <LayoutGrid className="mr-1.5 h-3.5 w-3.5 text-[var(--accent)]" />
              Choose Diagram
            </Button>
          </div>
        </div>
      )}

      {/* Clean Modal Gallery for Built-in Diagrams or Image URL */}
      {showDiagramModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 shadow-2xl space-y-5 max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <div>
                <h3 className="text-base font-bold text-white">
                  Choose Slide Visual
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Pick a built-in executive diagram, upload a file, or paste an image link.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDiagramModal(false)}
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Paste Image URL option */}
            <div className="flex gap-2">
              <Input
                value={current.url?.startsWith("data:") ? "" : current.url ?? ""}
                onChange={(e) =>
                  onChange({
                    ...current,
                    url: e.target.value,
                    preset: "none",
                  })
                }
                placeholder="Or paste an external image URL (https://...)"
                className="border-[var(--border-subtle)] bg-[var(--bg-base)] text-xs text-white"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  fileInputRef.current?.click();
                  setShowDiagramModal(false);
                }}
                className="shrink-0 border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs text-white"
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Upload File
              </Button>
            </div>

            {/* Visual Grid of Built-in Diagrams */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {PRESET_KEYS.map((presetKey) => {
                const selected = current.preset === presetKey && !current.url;
                return (
                  <button
                    key={presetKey}
                    type="button"
                    onClick={() => {
                      onChange({
                        ...current,
                        preset: presetKey,
                        url: "",
                      });
                      setShowDiagramModal(false);
                    }}
                    className={cn(
                      "flex flex-col justify-between rounded-xl border p-3 text-left transition-all",
                      selected
                        ? "border-[var(--accent)] bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]"
                        : "border-[var(--border-subtle)] bg-[var(--bg-base)] hover:border-white/25"
                    )}
                  >
                    <p className="mb-2 text-xs font-semibold text-white">
                      {DIAGRAM_PRESET_LABELS[presetKey]}
                    </p>
                    <div className="pointer-events-none">
                      <SlideVisualBlock visual={{ preset: presetKey }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Progressive Course Studio Component ────────────────────────────────

export function CourseStudio({
  initialCourses = DEFAULT_COURSES,
  initialUnlocked = false,
  initialStep = "courses",
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
  const [studioStep, setStudioStep] = useState<StudioStep>(initialStep);
  const [activeSlide, setActiveSlide] = useState<BriefingSlideIndex>(0);
  const [fullPreview, setFullPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);
  const [launchingTest, setLaunchingTest] = useState(false);

  // Progressive disclosure states to prevent visual clutter
  const [showCourseDetails, setShowCourseDetails] = useState(false);
  const [openVisualSlideKey, setOpenVisualSlideKey] = useState<number | null>(
    null
  );
  const [showAddSlideMenu, setShowAddSlideMenu] = useState(false);

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
    setStudioStep("syllabus");
    setSaveBanner("New blank course created — give it a title and design your slides.");
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

  function handleAddLesson(targetModuleIdx = selectedModuleIdx) {
    if (!activeCourse) return;
    const mod = activeCourse.modules[targetModuleIdx];
    if (!mod) return;
    const nextIdx = mod.lessons.length;
    const les = createEmptyLesson(nextIdx + 1);
    updateActiveCourse((course) => ({
      ...course,
      modules: course.modules.map((m, idx) =>
        idx !== targetModuleIdx
          ? m
          : { ...m, lessons: [...m.lessons, les] }
      ),
    }));
    setSelectedModuleIdx(targetModuleIdx);
    setSelectedLessonIdx(nextIdx);
    setActiveSlide(0);
    setStudioStep("slides");
  }

  function handleDeleteLesson(moduleIdx: number, lessonIdx: number) {
    if (!activeCourse) return;
    const mod = activeCourse.modules[moduleIdx];
    if (!mod || mod.lessons.length <= 1) return;
    updateActiveCourse((course) => ({
      ...course,
      modules: course.modules.map((m, idx) =>
        idx !== moduleIdx
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

  function handleAddCustomSlide(customLabel?: string) {
    if (!activeLesson || !canAddSlide) return;
    const currentExtras = activeLesson.extraSlides ?? [];
    const nextSlide = createExtraSlide(currentExtras.length + 1);
    if (customLabel) {
      nextSlide.label = customLabel;
    }
    const nextIndex = 100 + currentExtras.length;
    updateActiveLesson((l) => ({
      ...l,
      extraSlides: [...(l.extraSlides ?? []), nextSlide],
    }));
    setActiveSlide(nextIndex);
    setShowAddSlideMenu(false);
  }

  function handleUnhideCoreSlide(
    key: "trap" | "mentalModel" | "tape",
    targetSlideIndex: BriefingSlideIndex
  ) {
    if (!activeLesson || !canAddSlide) return;
    const nextHidden = (activeLesson.hiddenCoreSlides ?? []).filter(
      (k) => k !== key
    );
    updateActiveLesson((l) => ({
      ...l,
      hiddenCoreSlides: nextHidden,
    }));
    setActiveSlide(targetSlideIndex);
    setShowAddSlideMenu(false);
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

  // ─── Creator Passkey Gate ─────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-[var(--bg-base)] px-4 py-16 overflow-hidden">
        {/* Top Ambient Electric Cobalt Dome */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-85"
          style={{
            background:
              "radial-gradient(ellipse 65% 45% at 50% 0%, rgba(37, 99, 235, 0.14), transparent 72%)",
          }}
        />

        <div className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-7 sm:p-8 shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1 text-[var(--accent)]">
            <Lock className="h-3.5 w-3.5" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]">
              Creator Portal · Restricted Access
            </span>
          </div>

          <h1 className="mt-4 font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Spar Course Studio
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
            This authoring workspace is restricted to course creators. Enter the creator passkey to design lessons, preview briefing decks, and publish to learners.
          </p>

          <form onSubmit={handleUnlock} className="mt-6 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label
                  htmlFor="creator-passkey"
                  className="text-xs font-medium text-[var(--text-secondary)]"
                >
                  Creator Passkey
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    setPasskey("spar-studio");
                    setAuthError(null);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--accent)]/35 bg-[var(--accent)]/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-white hover:bg-[var(--accent)]/20 transition-colors"
                >
                  <KeyRound className="h-2.5 w-2.5 text-[var(--accent)]" />
                  Fill Default Passkey (spar-studio)
                </button>
              </div>
              <Input
                id="creator-passkey"
                type="password"
                value={passkey}
                onChange={(e) => setPasskey(e.target.value)}
                placeholder="Enter creator passkey (default: spar-studio)"
                className="h-11 rounded-xl border-[var(--border-subtle)] bg-[var(--bg-base)] text-white placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
              />
            </div>

            {authError && (
              <p role="alert" className="text-xs font-medium text-red-400">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={verifying || !passkey.trim()}
              className="w-full inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-xs font-bold text-[#080B10] transition-all hover:bg-neutral-100 active:translate-y-[2px] disabled:opacity-45 disabled:pointer-events-none"
              style={{
                boxShadow:
                  verifying || !passkey.trim() ? "none" : "0 4px 0 #CBD5E1",
              }}
            >
              {verifying ? "Verifying..." : "Unlock Course Studio"}
            </button>
          </form>

          <div className="mt-6 border-t border-[var(--border-subtle)] pt-4 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-white transition-colors"
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
      removableKey: "trap",
    });
  }
  if (!hiddenCoreSet.has("mentalModel")) {
    filmstripItems.push({
      slideIndex: 1,
      badge: `0${slideNumber++}`,
      title: "Mental Model",
      subtitle: activeLesson.slides.mentalModel.headline,
      removableKey: "mentalModel",
    });
  }
  if (!hiddenCoreSet.has("tape")) {
    filmstripItems.push({
      slideIndex: 2,
      badge: `0${slideNumber++}`,
      title: "The Tape",
      subtitle: activeLesson.slides.tape.headline,
      removableKey: "tape",
    });
  }

  (activeLesson.extraSlides ?? []).forEach((extra, idx) => {
    filmstripItems.push({
      slideIndex: 100 + idx,
      badge: `0${slideNumber++}`,
      title: extra.label || `Insight ${idx + 1}`,
      subtitle: extra.headline,
      removableExtraIdx: idx,
    });
  });

  filmstripItems.push({
    slideIndex: 3,
    badge: `0${slideNumber++}`,
    title: "Chamber Briefing",
    subtitle: `vs. ${activeLesson.roomConfig.personaName}`,
  });

  filmstripItems.push({
    slideIndex: 4,
    badge: "✦",
    title: "Real-World Transfer",
    subtitle: "Spar Signature Slide",
  });

  const currentFilmPos = Math.max(
    0,
    filmstripItems.findIndex((i) => i.slideIndex === activeSlide)
  );
  const prevFilmItem =
    currentFilmPos > 0 ? filmstripItems[currentFilmPos - 1] : null;
  const nextFilmItem =
    currentFilmPos < filmstripItems.length - 1
      ? filmstripItems[currentFilmPos + 1]
      : null;

  const { slides, roomConfig } = activeLesson;
  const archetypeDef = ARCHETYPES[roomConfig.archetype] ?? ARCHETYPES.skeptic;

  // Determine if the active slide has a visual attached or if the creator toggled the visual panel open
  const currentSlideVisual =
    activeSlide === 0
      ? slides.trap.visual
      : activeSlide === 1
      ? slides.mentalModel.visual
      : activeSlide === 2
      ? slides.tape.visual
      : activeExtraSlide
      ? activeExtraSlide.visual
      : undefined;

  const showVisualPanel =
    hasSlideVisual(currentSlideVisual) || openVisualSlideKey === activeSlide;

  return (
    <div className="relative min-h-screen bg-[var(--bg-base)] text-white flex flex-col">
      {/* Overhead Electric Cobalt Studio Lighting Dome */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-[360px] opacity-75"
        style={{
          background:
            "radial-gradient(ellipse 68% 42% at 50% 0%, rgba(37, 99, 235, 0.11), transparent 72%)",
        }}
      />

      {/* ─── Contextual Top Studio Header (Minimal & Uncluttered) ──────────── */}
      <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/90 backdrop-blur-md px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3">
          {/* Left: Contextual Back + Title */}
          <div className="flex flex-wrap items-center gap-3">
            {studioStep === "courses" ? (
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-white/20 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                App
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setStudioStep("courses")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-white/20 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                All Courses
              </button>
            )}

            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--accent)]" />
              <span className="font-display text-sm font-bold tracking-tight text-white">
                Course Studio
              </span>
              {studioStep !== "courses" && (
                <>
                  <span className="text-[var(--text-muted)]">/</span>
                  <span className="max-w-[220px] truncate text-xs font-semibold text-[var(--text-secondary)]">
                    {activeCourse.title}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Center: Progressive Step Switcher (only shown once inside a course) */}
          {studioStep !== "courses" && !fullPreview && (
            <nav
              aria-label="Studio workflow steps"
              className="flex items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-1"
            >
              <button
                type="button"
                onClick={() => setStudioStep("syllabus")}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all",
                  studioStep === "syllabus"
                    ? "bg-white text-[#080B10] font-bold shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-white"
                )}
              >
                1. Course &amp; Syllabus
              </button>
              <button
                type="button"
                onClick={() => setStudioStep("slides")}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all",
                  studioStep === "slides"
                    ? "bg-white text-[#080B10] font-bold shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-white"
                )}
              >
                2. Lesson Slides
              </button>
              <button
                type="button"
                onClick={() => setStudioStep("room")}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all",
                  studioStep === "room"
                    ? "bg-white text-[#080B10] font-bold shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-white"
                )}
              >
                3. AI Sparring Room
              </button>
            </nav>
          )}

          {/* Right: Contextual Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {studioStep === "courses" ? (
              <button
                type="button"
                onClick={handleCreateCourse}
                className="inline-flex h-9 items-center rounded-full bg-white px-4 text-xs font-bold text-[#080B10] transition-all hover:bg-neutral-100 active:translate-y-[1px]"
                style={{ boxShadow: "0 3px 0 #CBD5E1" }}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Create New Course
              </button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFullPreview((p) => !p)}
                  className={cn(
                    "h-8 border-[var(--border-subtle)] text-xs transition-all",
                    fullPreview
                      ? "border-[var(--accent)]/50 bg-[var(--accent)]/15 text-white"
                      : "bg-[var(--surface-1)] text-white hover:bg-[var(--surface-2)]"
                  )}
                >
                  {fullPreview ? (
                    <>
                      <FileEdit className="mr-1.5 h-3.5 w-3.5 text-[var(--accent)]" />
                      Back to Studio
                    </>
                  ) : (
                    <>
                      <Eye className="mr-1.5 h-3.5 w-3.5 text-[var(--accent)]" />
                      Full Learner Preview
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={() => persistCourse("draft")}
                  className="h-8 border-[var(--border-subtle)] bg-[var(--surface-1)] text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-white"
                >
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  Save Draft
                </Button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    persistCourse(
                      activeCourse.status === "published" ? "draft" : "published"
                    )
                  }
                  className="inline-flex h-8 items-center rounded-full bg-white px-4 text-xs font-bold text-[#080B10] transition-all hover:bg-neutral-100 active:translate-y-[1px] disabled:opacity-50"
                  style={{ boxShadow: "0 3px 0 #CBD5E1" }}
                >
                  <Globe className="mr-1.5 h-3.5 w-3.5" />
                  {activeCourse.status === "published"
                    ? "Update Published"
                    : "Publish Course"}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {saveBanner && (
        <div className="relative z-20 border-b border-[var(--accent)]/30 bg-[var(--accent)]/10 px-6 py-2 text-center text-xs font-medium text-white">
          <CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5 text-[var(--accent)]" />
          {saveBanner}
        </div>
      )}

      {/* ─── Full Learner Preview Mode ─────────────────────────────────────── */}
      {fullPreview ? (
        <div className="relative z-10 py-4">
          <CoachView
            initialCourses={[activeCourse]}
            onSessionCreated={(id, exp, target) => {
              onLaunchTestSession?.(id, exp, target);
            }}
          />
        </div>
      ) : (
        <div className="relative z-10 flex-1">
          {/* ═══════════════════════════════════════════════════════════════════
              STAGE 0 (DEFAULT): MY COURSES LIBRARY
             ═══════════════════════════════════════════════════════════════════ */}
          {studioStep === "courses" && (
            <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 space-y-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
                    CREATOR WORKSPACE
                  </span>
                  <h1 className="mt-1.5 font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
                    Your Courses
                  </h1>
                  <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
                    Pick a course below to edit its slide decks and sparring rooms, or create a new course from scratch.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {/* Create New Course Card (First in Grid for Fast Creation) */}
                <button
                  type="button"
                  onClick={handleCreateCourse}
                  className="group flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--border-subtle)] bg-[var(--surface-1)]/45 p-6 text-center transition-all hover:border-[var(--accent)] hover:bg-[var(--surface-1)]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--accent)]/35 bg-[var(--accent)]/15 text-[var(--accent)] transition-transform group-hover:scale-105">
                    <Plus className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-display text-base font-bold text-white">
                      Create New Course
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] max-w-[210px]">
                      Start with a clean slate, build PowerPoint-style slides, and link an AI sparring room.
                    </p>
                  </div>
                </button>

                {/* Existing Course Cards */}
                {courses.map((course) => {
                  const lessonCount = getCourseLessonCount(course);
                  const isPublished = course.status === "published";

                  return (
                    <div
                      key={course.id}
                      onClick={() => {
                        setSelectedCourseId(course.id);
                        setSelectedModuleIdx(0);
                        setSelectedLessonIdx(0);
                        setActiveSlide(0);
                        setStudioStep("syllabus");
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedCourseId(course.id);
                          setSelectedModuleIdx(0);
                          setSelectedLessonIdx(0);
                          setActiveSlide(0);
                          setStudioStep("syllabus");
                        }
                      }}
                      className="group flex min-h-[220px] cursor-pointer flex-col justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 text-left transition-all hover:border-[var(--accent)]/60 hover:bg-[var(--surface-2)]/70 shadow-[0_14px_40px_rgba(0,0,0,0.45)]"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                            {course.category} · {course.difficulty}
                          </span>
                          <span
                            className={cn(
                              "rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider",
                              isPublished
                                ? "border-[var(--accent)]/40 bg-[var(--accent)]/15 text-white"
                                : "border-[var(--border-subtle)] bg-[var(--bg-base)] text-[var(--text-muted)]"
                            )}
                          >
                            {isPublished ? "Published" : "Draft"}
                          </span>
                        </div>

                        <div>
                          <h2 className="font-display text-lg font-bold tracking-tight text-white group-hover:text-white">
                            {course.title}
                          </h2>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                            {course.subtitle ||
                              "Click to add a course subtitle and design lessons..."}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 flex items-center justify-between border-t border-[var(--border-subtle)] pt-3.5 text-xs">
                        <span className="font-mono text-[11px] text-[var(--text-muted)]">
                          {course.modules.length}{" "}
                          {course.modules.length === 1 ? "module" : "modules"} ·{" "}
                          {lessonCount}{" "}
                          {lessonCount === 1 ? "lesson" : "lessons"}
                        </span>
                        <span className="inline-flex items-center gap-1 font-semibold text-white group-hover:text-[var(--accent)] transition-colors">
                          Open Course
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STEP 1: COURSE & SYLLABUS SCREEN (Focused Outline)
             ═══════════════════════════════════════════════════════════════════ */}
          {studioStep === "syllabus" && (
            <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 space-y-8">
              {/* Course Header Card */}
              <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 sm:p-8 space-y-5 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
                    1. Course Settings
                  </span>
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label="Course Category"
                      value={activeCourse.category}
                      onChange={(e) =>
                        updateActiveCourse((c) => ({
                          ...c,
                          category: e.target.value,
                        }))
                      }
                      placeholder="Category (e.g. Q&A)"
                      className="h-8 w-36 border-[var(--border-subtle)] bg-[var(--bg-base)] text-xs text-white"
                    />
                    <select
                      aria-label="Course Difficulty"
                      value={activeCourse.difficulty}
                      onChange={(e) =>
                        updateActiveCourse((c) => ({
                          ...c,
                          difficulty: e.target.value as CourseDifficulty,
                        }))
                      }
                      className="h-8 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2.5 text-xs text-white"
                    >
                      {DIFFICULTIES.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Click-to-edit Course Title & Subtitle */}
                <div className="space-y-2.5">
                  <input
                    type="text"
                    aria-label="Course Title"
                    value={activeCourse.title}
                    onChange={(e) =>
                      updateActiveCourse((c) => ({
                        ...c,
                        title: e.target.value,
                      }))
                    }
                    placeholder="Click to name your course..."
                    className="w-full rounded-xl bg-transparent px-2 py-1 -mx-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-white hover:bg-white/[0.03] focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />

                  <input
                    type="text"
                    aria-label="One-Sentence Outcome"
                    value={activeCourse.subtitle}
                    onChange={(e) =>
                      updateActiveCourse((c) => ({
                        ...c,
                        subtitle: e.target.value,
                      }))
                    }
                    placeholder="Add a one-sentence learner outcome..."
                    className="w-full rounded-lg bg-transparent px-2 py-1 -mx-2 text-base font-medium text-[var(--text-secondary)] hover:bg-white/[0.03] focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>

                {/* Progressive Disclosure for Extended Course Overview & Outcomes */}
                <div className="border-t border-[var(--border-subtle)] pt-3">
                  <button
                    type="button"
                    onClick={() => setShowCourseDetails((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-white transition-colors"
                  >
                    {showCourseDetails ? (
                      <>
                        <ChevronUp className="h-3.5 w-3.5 text-[var(--accent)]" />
                        Hide extended description &amp; learning outcomes
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3.5 w-3.5 text-[var(--accent)]" />
                        Edit course description &amp; learning outcomes (optional)
                      </>
                    )}
                  </button>

                  {showCourseDetails && (
                    <div className="mt-4 space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-[var(--text-secondary)]">
                          Course Overview
                        </Label>
                        <Textarea
                          aria-label="Course Overview"
                          rows={2}
                          value={activeCourse.description}
                          onChange={(e) =>
                            updateActiveCourse((c) => ({
                              ...c,
                              description: e.target.value,
                            }))
                          }
                          placeholder="Short course overview..."
                          className="border-[var(--border-subtle)] bg-[var(--bg-base)] text-xs text-[var(--text-secondary)]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-[var(--text-secondary)]">
                          “By the end you&apos;ll be able to…” (one outcome per line)
                        </Label>
                        <Textarea
                          rows={3}
                          value={(activeCourse.learningOutcomes ?? []).join(
                            "\n"
                          )}
                          onChange={(e) =>
                            updateActiveCourse((c) => ({
                              ...c,
                              learningOutcomes: e.target.value
                                .split("\n")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            }))
                          }
                          placeholder="Answer hostile questions in your first sentence&#10;Defend core assumptions with downside floors"
                          className="border-[var(--border-subtle)] bg-[var(--bg-base)] text-xs text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Modules & Lessons Outline */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-lg font-bold text-white">
                      2. Syllabus Structure
                    </h2>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Click <strong className="text-white">Edit Slides</strong> on any lesson to open its PowerPoint-style slide deck, then add its practice room.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddModule}
                    className="border-[var(--border-subtle)] bg-[var(--surface-1)] text-xs text-white hover:bg-[var(--surface-2)]"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5 text-[var(--accent)]" />
                    Add Module
                  </Button>
                </div>

                {activeCourse.modules.map((mod, mIdx) => (
                  <div
                    key={mod.id}
                    className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 sm:p-6 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
                      <div className="flex-1 min-w-[240px] space-y-1">
                        <input
                          type="text"
                          value={mod.title}
                          onChange={(e) =>
                            updateActiveCourse((course) => ({
                              ...course,
                              modules: course.modules.map((m, idx) =>
                                idx === mIdx
                                  ? { ...m, title: e.target.value }
                                  : m
                              ),
                            }))
                          }
                          className="w-full rounded bg-transparent px-1.5 py-0.5 -mx-1.5 text-base font-bold text-white hover:bg-white/[0.04] focus:bg-white/[0.06] focus:outline-none"
                        />
                        <input
                          type="text"
                          value={mod.description}
                          onChange={(e) =>
                            updateActiveCourse((course) => ({
                              ...course,
                              modules: course.modules.map((m, idx) =>
                                idx === mIdx
                                  ? { ...m, description: e.target.value }
                                  : m
                              ),
                            }))
                          }
                          placeholder="Module one-line objective (optional)..."
                          className="w-full rounded bg-transparent px-1.5 py-0.5 -mx-1.5 text-xs text-[var(--text-secondary)] hover:bg-white/[0.04] focus:bg-white/[0.06] focus:outline-none"
                        />
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddLesson(mIdx)}
                        className="h-8 border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs text-white hover:bg-white/[0.08]"
                      >
                        <Plus className="mr-1 h-3.5 w-3.5 text-[var(--accent)]" />
                        Add Lesson
                      </Button>
                    </div>

                    <div className="space-y-2.5">
                      {mod.lessons.map((les, lIdx) => (
                        <div
                          key={les.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-3.5 hover:border-white/20 transition-all"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2.5">
                              <span className="font-mono text-xs font-bold text-[var(--accent)]">
                                0{lIdx + 1}
                              </span>
                              <span className="truncate text-sm font-semibold text-white">
                                {les.title}
                              </span>
                              <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                                {
                                  ACTIVITY_TYPE_LABELS[
                                    les.activityType ?? "lesson"
                                  ]
                                }
                              </span>
                            </div>
                            <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
                              {les.tagline || "Click Edit Slides to build this lesson deck"} · Partner: {les.roomConfig.personaName}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                setSelectedModuleIdx(mIdx);
                                setSelectedLessonIdx(lIdx);
                                setActiveSlide(0);
                                setStudioStep("slides");
                              }}
                              className="h-8 bg-white text-[#080B10] hover:bg-neutral-200 text-xs font-bold"
                            >
                              Edit Slides
                              <ArrowRight className="ml-1 h-3.5 w-3.5" />
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedModuleIdx(mIdx);
                                setSelectedLessonIdx(lIdx);
                                setStudioStep("room");
                              }}
                              className="h-8 border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs text-white hover:bg-white/[0.08]"
                            >
                              <Swords className="mr-1.5 h-3.5 w-3.5 text-[var(--accent)]" />
                              AI Room
                            </Button>

                            {mod.lessons.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteLesson(mIdx, lIdx)}
                                aria-label={`Delete ${les.title}`}
                                className="p-1.5 text-[var(--text-muted)] hover:text-white"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STEP 2: POWERPOINT-STYLE 16:9 SLIDE DECK STUDIO
             ═══════════════════════════════════════════════════════════════════ */}
          {studioStep === "slides" && (
            <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-12">
              {/* Left PowerPoint-Style 16:9 Thumbnail Rail (3 cols) */}
              <aside className="space-y-4 lg:col-span-3">
                {/* Active Lesson Title Card */}
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--accent)]">
                      Lesson Deck
                    </span>
                    <button
                      type="button"
                      onClick={() => setStudioStep("syllabus")}
                      className="text-[11px] font-medium text-[var(--text-secondary)] hover:text-white"
                    >
                      ← Syllabus
                    </button>
                  </div>

                  <input
                    type="text"
                    aria-label="Lesson Title"
                    value={activeLesson.title}
                    onChange={(e) =>
                      updateActiveLesson((l) => ({
                        ...l,
                        title: e.target.value,
                      }))
                    }
                    placeholder="Lesson title..."
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-1.5 text-xs font-semibold text-white focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>

                {/* PowerPoint 16:9 Slide Filmstrip */}
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3.5 space-y-3">
                  <div className="flex items-center justify-between px-0.5">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white">
                        Slide Filmstrip
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        {contentSlideCount} of {MAX_LESSON_SLIDES} content slides
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-mono font-semibold",
                        contentSlideCount <= 4
                          ? "border-[var(--accent)]/40 bg-[var(--accent)]/15 text-white"
                          : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-secondary)]"
                      )}
                    >
                      {contentSlideCount <= 4 ? "Optimal Pacing" : "Near Max (6)"}
                    </span>
                  </div>

                  {/* Miniature 16:9 Slide Thumbnails */}
                  <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-0.5">
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
                            "group relative flex flex-col justify-between rounded-xl border p-3 transition-all aspect-[16/9]",
                            isSelected
                              ? "border-[var(--accent)] bg-[var(--surface-2)] text-white ring-2 ring-[var(--accent)]/25 shadow-md"
                              : "border-[var(--border-subtle)] bg-[var(--bg-base)] text-[var(--text-secondary)] hover:border-white/25"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setActiveSlide(item.slideIndex)}
                            className="flex h-full w-full flex-col justify-between text-left"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider",
                                  isSelected
                                    ? "text-[var(--accent)]"
                                    : "text-[var(--text-muted)]"
                                )}
                              >
                                <span
                                  className={cn(
                                    "inline-flex h-4 min-w-[20px] items-center justify-center rounded px-1 text-[9px]",
                                    isSelected
                                      ? "bg-[var(--accent)] text-white"
                                      : "bg-white/[0.06] text-[var(--text-secondary)]"
                                  )}
                                >
                                  {item.badge}
                                </span>
                                {item.title}
                              </span>
                            </div>

                            <p
                              className={cn(
                                "line-clamp-2 text-xs font-semibold leading-snug",
                                item.subtitle
                                  ? "text-white"
                                  : "italic text-[var(--text-muted)]"
                              )}
                            >
                              {item.subtitle || "Empty slide — click to type..."}
                            </p>

                            <div className="flex items-center gap-1">
                              <span className="h-1 w-8 rounded-full bg-white/15" />
                              <span className="h-1 w-4 rounded-full bg-white/10" />
                            </div>
                          </button>

                          {canDeleteThis && (
                            <button
                              type="button"
                              title="Remove slide"
                              aria-label={`Remove ${item.title} slide`}
                              onClick={() => {
                                if (item.removableKey) {
                                  handleRemoveCoreSlide(item.removableKey);
                                } else if (
                                  item.removableExtraIdx !== undefined
                                ) {
                                  handleRemoveExtraSlide(item.removableExtraIdx);
                                }
                              }}
                              className="absolute right-2.5 top-2.5 rounded-md p-1 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:bg-white/10 hover:text-white transition-opacity"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* + Add Slide & Template Layout Picker */}
                  <div className="space-y-2 pt-1 border-t border-[var(--border-subtle)]">
                    <div className="flex gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!canAddSlide}
                        onClick={() => handleAddCustomSlide()}
                        className="flex-1 border-dashed border-[var(--border-subtle)] bg-[var(--bg-base)] text-xs text-white hover:border-[var(--accent)]/50 hover:bg-[var(--surface-2)] disabled:opacity-40"
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5 text-[var(--accent)]" />
                        {canAddSlide
                          ? `Add Insight Slide (${contentSlideCount}/${MAX_LESSON_SLIDES})`
                          : `Max ${MAX_LESSON_SLIDES} Slides`}
                      </Button>

                      {canAddSlide && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAddSlideMenu((v) => !v)}
                          title="Choose slide template layout"
                          className="px-2.5 border-[var(--border-subtle)] bg-[var(--bg-base)] text-xs text-[var(--text-secondary)] hover:text-white"
                        >
                          <Layers className="h-3.5 w-3.5 text-[var(--accent)]" />
                        </Button>
                      )}
                    </div>

                    {/* Slide Template Layout Menu */}
                    {showAddSlideMenu && canAddSlide && (
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-2.5 space-y-1.5">
                        <p className="px-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                          Pick Slide Template (Starts Empty)
                        </p>
                        <button
                          type="button"
                          onClick={() => handleAddCustomSlide("Key Concept")}
                          className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-white hover:bg-[var(--surface-2)] flex items-center justify-between"
                        >
                          <span>Concept &amp; Takeaway</span>
                          <span className="font-mono text-[10px] text-[var(--text-muted)]">
                            Clean
                          </span>
                        </button>
                        {hiddenCoreSet.has("mentalModel") && (
                          <button
                            type="button"
                            onClick={() =>
                              handleUnhideCoreSlide("mentalModel", 1)
                            }
                            className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-white hover:bg-[var(--surface-2)] flex items-center justify-between"
                          >
                            <span>3-Step Framework</span>
                            <span className="font-mono text-[10px] text-[var(--accent)]">
                              Steps
                            </span>
                          </button>
                        )}
                        {hiddenCoreSet.has("tape") && (
                          <button
                            type="button"
                            onClick={() => handleUnhideCoreSlide("tape", 2)}
                            className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-white hover:bg-[var(--surface-2)] flex items-center justify-between"
                          >
                            <span>Weak vs. Strong Comparison</span>
                            <span className="font-mono text-[10px] text-[var(--accent)]">
                              Split
                            </span>
                          </button>
                        )}
                        {hiddenCoreSet.has("trap") && (
                          <button
                            type="button"
                            onClick={() => handleUnhideCoreSlide("trap", 0)}
                            className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-white hover:bg-[var(--surface-2)] flex items-center justify-between"
                          >
                            <span>The Trap / Mistake</span>
                            <span className="font-mono text-[10px] text-[var(--text-muted)]">
                              Diagnostic
                            </span>
                          </button>
                        )}
                      </div>
                    )}

                    {hiddenCoreSet.size > 0 && !showAddSlideMenu && (
                      <button
                        type="button"
                        onClick={handleRestoreCoreSlides}
                        className="w-full text-center text-[11px] text-[var(--text-secondary)] hover:text-white underline"
                      >
                        Restore all template slides ({hiddenCoreSet.size})
                      </button>
                    )}
                  </div>
                </div>

                {/* Natural Progression Card: After Slides -> Practice & AI Room */}
                <button
                  type="button"
                  onClick={() => setStudioStep("room")}
                  className="w-full flex items-center justify-between gap-3 rounded-2xl border border-[var(--accent)]/35 bg-[var(--accent)]/10 p-4 text-left transition-all hover:bg-[var(--accent)]/20"
                >
                  <div className="space-y-0.5">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                      AFTER SLIDES · STEP 3
                    </span>
                    <p className="text-xs font-bold text-white">
                      Add Practice &amp; AI Room
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                </button>
              </aside>

              {/* Center Widescreen 16:9 Slide Canvas (9 cols — PowerPoint Mode) */}
              <main className="lg:col-span-9 space-y-3">
                {/* Clean Slide Canvas Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                    <span className="text-xs font-semibold text-white">
                      Live Learner Preview &amp; Direct Slide Canvas
                    </span>
                    <span className="hidden md:inline text-xs text-[var(--text-muted)]">
                      — Click directly on the slide to type
                    </span>
                  </div>

                  {/* Contextual Slide Actions: Toggle Image/Diagram + Go to AI Room */}
                  <div className="flex items-center gap-2">
                    {(activeSlide === 0 ||
                      activeSlide === 1 ||
                      activeSlide === 2 ||
                      activeExtraSlide !== null) && (
                      <button
                        type="button"
                        onClick={() =>
                          setOpenVisualSlideKey((prev) =>
                            prev === activeSlide ? null : activeSlide
                          )
                        }
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                          showVisualPanel
                            ? "border-[var(--accent)]/50 bg-[var(--accent)]/15 text-white"
                            : "border-[var(--border-subtle)] bg-[var(--bg-base)] text-[var(--text-secondary)] hover:text-white"
                        )}
                      >
                        <Upload className="h-3.5 w-3.5 text-[var(--accent)]" />
                        Upload Image
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setStudioStep("room")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)]/35 bg-[var(--accent)]/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent)]/20 transition-colors"
                    >
                      <Swords className="h-3.5 w-3.5 text-[var(--accent)]" />
                      Design Practice Room →
                    </button>
                  </div>
                </div>

                {/* 16:9 PRESENTATION SLIDE STAGE */}
                <div className="w-full max-w-[1040px] min-h-[580px] flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] shadow-[0_32px_100px_rgba(0,0,0,0.75)] overflow-hidden mx-auto">
                  {/* Top Slide Header Strip */}
                  <header className="h-12 shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-base)] px-6 flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase text-[var(--text-muted)] truncate">
                      {activeCourse.title} · {activeLesson.title}
                    </span>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/35 bg-[var(--accent)]/10 px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-white">
                        <Sparkles className="h-3 w-3 text-[var(--accent)]" />
                        Slide {currentFilmPos + 1} of {filmstripItems.length}
                      </span>
                    </div>
                  </header>

                  {/* Slide Body — Full Width Typography unless Visual Slot is Open */}
                  <div
                    className={cn(
                      "flex-1 min-h-0 grid grid-cols-1 divide-y lg:divide-y-0 lg:divide-x divide-[var(--border-subtle)] overflow-hidden",
                      showVisualPanel || activeSlide === 2
                        ? "lg:grid-cols-12"
                        : "lg:grid-cols-1"
                    )}
                  >
                    {/* ─── SLIDE 1: THE TRAP (Diagnostic Slide) ──────────── */}
                    {activeSlide === 0 && (
                      <>
                        <div
                          className={cn(
                            "h-full overflow-y-auto p-8 sm:p-10 space-y-6 bg-[var(--surface-1)]",
                            showVisualPanel ? "lg:col-span-7" : "max-w-3xl"
                          )}
                        >
                          <span className="inline-block font-mono text-[11px] font-bold tracking-[0.2em] uppercase text-[var(--accent)]">
                            SLIDE 01 // THE PATTERN TO BREAK
                          </span>

                          <div className="space-y-3">
                            <input
                              type="text"
                              aria-label="Trap Headline"
                              value={slides.trap.headline}
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
                              placeholder="Click to add slide headline..."
                              className="w-full rounded-lg bg-transparent px-2 py-1 -mx-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-white placeholder:text-[var(--text-muted)]/60 hover:bg-white/[0.03] focus:bg-white/[0.05] focus:outline-none"
                            />

                            <textarea
                              rows={3}
                              aria-label="Trap Explanation"
                              value={slides.trap.body}
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
                              placeholder="Click to explain the core concept or mistake speakers make under pressure..."
                              className="w-full resize-none rounded-lg bg-transparent px-2 py-1 -mx-2 text-base leading-relaxed text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]/50 hover:bg-white/[0.03] focus:bg-white/[0.05] focus:outline-none"
                            />
                          </div>

                          {/* Callout Strip */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                            <div className="border-l-2 border-white/25 bg-[var(--bg-base)] p-4 rounded-r-xl space-y-1.5">
                              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                                Common Mistake Quote (Optional)
                              </span>
                              <input
                                type="text"
                                value={slides.trap.instinctQuote ?? ""}
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
                                placeholder="“Well, we had several moving pieces...”"
                                className="w-full rounded bg-transparent text-xs italic text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]/50 focus:outline-none"
                              />
                            </div>

                            <div className="border-l-2 border-[var(--accent)] bg-[var(--accent)]/[0.06] p-4 rounded-r-xl space-y-1.5">
                              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--accent)]">
                                Key Takeaway / Why It Matters
                              </span>
                              <input
                                type="text"
                                value={slides.trap.costOfFailure}
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
                                placeholder="Click to add key takeaway..."
                                className="w-full rounded bg-transparent text-xs font-medium text-white placeholder:text-[var(--text-muted)]/50 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>

                        {showVisualPanel && (
                          <div className="lg:col-span-5 h-full overflow-y-auto p-6 sm:p-7 space-y-4 bg-[var(--bg-base)]">
                            <OnSlideVisualCanvas
                              visual={slides.trap.visual}
                              onCloseEmpty={() => setOpenVisualSlideKey(null)}
                              onChange={(nextVisual) =>
                                updateActiveLesson((l) => ({
                                  ...l,
                                  slides: {
                                    ...l.slides,
                                    trap: {
                                      ...l.slides.trap,
                                      visual: nextVisual,
                                    },
                                  },
                                }))
                              }
                            />
                          </div>
                        )}
                      </>
                    )}

                    {/* ─── SLIDE 2: 3-STEP FRAMEWORK / MENTAL MODEL ──────── */}
                    {activeSlide === 1 && (
                      <>
                        <div
                          className={cn(
                            "h-full overflow-y-auto p-8 sm:p-10 space-y-5 bg-[var(--surface-1)]",
                            showVisualPanel ? "lg:col-span-7" : "w-full"
                          )}
                        >
                          <span className="inline-block font-mono text-[11px] font-bold tracking-[0.2em] uppercase text-[var(--accent)]">
                            FRAMEWORK // 3-STEP MODEL
                          </span>

                          <div className="space-y-2">
                            <input
                              type="text"
                              aria-label="Mental Model Headline"
                              value={slides.mentalModel.headline}
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
                              placeholder="Click to add framework title (e.g. BLUF)..."
                              className="w-full rounded-lg bg-transparent px-2 py-1 -mx-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-white placeholder:text-[var(--text-muted)]/60 hover:bg-white/[0.03] focus:outline-none"
                            />

                            <textarea
                              rows={2}
                              aria-label="Mental Model Body"
                              value={slides.mentalModel.body}
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
                              placeholder="Click to explain how this framework works..."
                              className="w-full resize-none rounded-lg bg-transparent px-2 py-1 -mx-2 text-sm leading-relaxed text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]/50 hover:bg-white/[0.03] focus:outline-none"
                            />
                          </div>

                          {/* The Golden Rule Plate */}
                          <div className="rounded-2xl border border-[var(--accent)]/35 bg-[var(--accent)]/[0.06] p-4 space-y-1">
                            <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
                              <Compass className="h-3.5 w-3.5" />
                              The Golden Rule
                            </div>
                            <input
                              type="text"
                              aria-label="The Golden Rule"
                              value={slides.mentalModel.goldenRule}
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
                              placeholder="Click to type the 1-sentence golden rule..."
                              className="w-full rounded bg-transparent text-sm font-bold text-white placeholder:text-[var(--text-muted)]/50 focus:outline-none"
                            />
                          </div>

                          {/* 3-Step Horizontal Cards */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                            {(slides.mentalModel.steps ?? [
                              { step: 1, label: "", detail: "" },
                              { step: 2, label: "", detail: "" },
                              { step: 3, label: "", detail: "" },
                            ]).map((st, sIdx) => (
                              <div
                                key={sIdx}
                                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3.5 space-y-1.5"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[var(--accent)]/35 bg-[var(--accent)]/15 font-mono text-[10px] font-bold text-white">
                                    0{sIdx + 1}
                                  </span>
                                  <input
                                    type="text"
                                    value={st.label}
                                    onChange={(e) => {
                                      const currentSteps =
                                        slides.mentalModel.steps ?? [];
                                      const nextSteps = currentSteps.map(
                                        (item, idx) =>
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
                                    placeholder={`Step ${sIdx + 1} title...`}
                                    className="w-full rounded bg-transparent text-xs font-bold text-white placeholder:text-[var(--text-muted)]/50 focus:outline-none"
                                  />
                                </div>
                                <input
                                  type="text"
                                  value={st.detail}
                                  onChange={(e) => {
                                    const currentSteps =
                                      slides.mentalModel.steps ?? [];
                                    const nextSteps = currentSteps.map(
                                      (item, idx) =>
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
                                  placeholder="Step detail..."
                                  className="w-full rounded bg-transparent text-[11px] text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]/50 focus:outline-none"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {showVisualPanel && (
                          <div className="lg:col-span-5 h-full overflow-y-auto p-6 sm:p-7 space-y-4 bg-[var(--bg-base)]">
                            <OnSlideVisualCanvas
                              visual={slides.mentalModel.visual}
                              onCloseEmpty={() => setOpenVisualSlideKey(null)}
                              onChange={(nextVisual) =>
                                updateActiveLesson((l) => ({
                                  ...l,
                                  slides: {
                                    ...l.slides,
                                    mentalModel: {
                                      ...l.slides.mentalModel,
                                      visual: nextVisual,
                                    },
                                  },
                                }))
                              }
                            />
                          </div>
                        )}
                      </>
                    )}

                    {/* ─── SLIDE 3: WEAK VS. STRONG COMPARISON ───────────── */}
                    {activeSlide === 2 && (
                      <>
                        <div className="lg:col-span-5 h-full overflow-y-auto p-8 space-y-5 bg-[var(--surface-1)]">
                          <span className="font-mono text-[11px] font-bold tracking-[0.2em] uppercase text-[var(--accent)] block">
                            COMPARISON // THE TAPE
                          </span>

                          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4 space-y-1.5">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-secondary)]">
                              Scenario Question from {roomConfig.personaName}
                            </span>
                            <textarea
                              rows={3}
                              aria-label="Example Panelist Question"
                              value={slides.tape.prompt}
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
                              placeholder="Click to type the high-stakes question..."
                              className="w-full resize-none rounded bg-transparent text-sm font-semibold text-white placeholder:text-[var(--text-muted)]/50 focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <span className="text-[10px] font-mono uppercase text-[var(--text-muted)]">
                              Key Distinction
                            </span>
                            <textarea
                              rows={3}
                              value={slides.tape.differenceSummary}
                              onChange={(e) =>
                                updateActiveLesson((l) => ({
                                  ...l,
                                  slides: {
                                    ...l.slides,
                                    tape: {
                                      ...l.slides.tape,
                                      differenceSummary: e.target.value,
                                    },
                                  },
                                }))
                              }
                              placeholder="Explain why the strong answer wins the room..."
                              className="w-full resize-none rounded-xl bg-[var(--bg-base)] p-3 text-xs text-[var(--text-secondary)] border border-[var(--border-subtle)] placeholder:text-[var(--text-muted)]/50 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="lg:col-span-7 h-full overflow-y-auto p-8 space-y-4 bg-[var(--bg-base)]">
                          {/* Weak Response Card */}
                          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-[var(--text-secondary)]">
                              <span className="flex items-center gap-1.5">
                                <XCircle className="h-3.5 w-3.5" />
                                Weak / Defensive Answer
                              </span>
                              <span className="font-mono text-[10px] text-[var(--text-muted)]">
                                Loses room
                              </span>
                            </div>
                            <textarea
                              rows={2}
                              aria-label="Weak Response"
                              value={slides.tape.weakResponse}
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
                              placeholder="Click to type the weak response..."
                              className="w-full resize-none rounded bg-transparent text-xs italic text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]/50 focus:outline-none"
                            />
                          </div>

                          {/* Strong Response Card */}
                          <div className="rounded-xl border border-[var(--accent)]/35 bg-[var(--accent)]/[0.06] p-4 space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-white">
                              <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--accent)]" />
                                Strong Executive Answer
                              </span>
                              <span className="font-mono text-[10px] text-[var(--accent)]">
                                Commands room
                              </span>
                            </div>
                            <textarea
                              rows={2}
                              aria-label="Executive Response"
                              value={slides.tape.strongResponse}
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
                              placeholder="Click to type the strong benchmark answer..."
                              className="w-full resize-none rounded bg-transparent text-xs font-medium text-white placeholder:text-[var(--text-muted)]/50 focus:outline-none"
                            />
                          </div>

                          {showVisualPanel && (
                            <OnSlideVisualCanvas
                              visual={slides.tape.visual}
                              onCloseEmpty={() => setOpenVisualSlideKey(null)}
                              onChange={(nextVisual) =>
                                updateActiveLesson((l) => ({
                                  ...l,
                                  slides: {
                                    ...l.slides,
                                    tape: {
                                      ...l.slides.tape,
                                      visual: nextVisual,
                                    },
                                  },
                                }))
                              }
                            />
                          )}
                        </div>
                      </>
                    )}

                    {/* ─── CUSTOM INSIGHT SLIDE (Clean Blank Slide Template) ─ */}
                    {activeExtraSlide && activeExtraIdx >= 0 && (
                      <>
                        <div
                          className={cn(
                            "h-full overflow-y-auto p-8 sm:p-10 space-y-6 bg-[var(--surface-1)]",
                            showVisualPanel ? "lg:col-span-7" : "max-w-3xl"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <input
                              type="text"
                              value={activeExtraSlide.label}
                              onChange={(e) =>
                                updateExtraSlide(activeExtraIdx, (s) => ({
                                  ...s,
                                  label: e.target.value,
                                }))
                              }
                              placeholder="SLIDE TAG..."
                              className="bg-transparent font-mono text-[11px] font-bold tracking-[0.2em] uppercase text-[var(--accent)] focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveExtraSlide(activeExtraIdx)
                              }
                              className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-white"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete Slide
                            </button>
                          </div>

                          <div className="space-y-3">
                            <input
                              type="text"
                              value={activeExtraSlide.headline}
                              onChange={(e) =>
                                updateExtraSlide(activeExtraIdx, (s) => ({
                                  ...s,
                                  headline: e.target.value,
                                }))
                              }
                              placeholder="Click to add slide headline..."
                              className="w-full rounded-lg bg-transparent px-2 py-1 -mx-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-white placeholder:text-[var(--text-muted)]/60 hover:bg-white/[0.03] focus:outline-none"
                            />

                            <textarea
                              rows={4}
                              value={activeExtraSlide.body}
                              onChange={(e) =>
                                updateExtraSlide(activeExtraIdx, (s) => ({
                                  ...s,
                                  body: e.target.value,
                                }))
                              }
                              placeholder="Click to write the slide body content..."
                              className="w-full resize-none rounded-lg bg-transparent px-2 py-1 -mx-2 text-base leading-relaxed text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]/50 hover:bg-white/[0.03] focus:outline-none"
                            />
                          </div>

                          <div className="border-l-2 border-[var(--accent)] bg-[var(--accent)]/[0.06] p-4 rounded-r-xl space-y-1">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
                              Key Takeaway
                            </span>
                            <input
                              type="text"
                              value={activeExtraSlide.takeaway ?? ""}
                              onChange={(e) =>
                                updateExtraSlide(activeExtraIdx, (s) => ({
                                  ...s,
                                  takeaway: e.target.value,
                                }))
                              }
                              placeholder="Click to add a 1-sentence takeaway..."
                              className="w-full rounded bg-transparent text-sm font-semibold text-white placeholder:text-[var(--text-muted)]/50 focus:outline-none"
                            />
                          </div>
                        </div>

                        {showVisualPanel && (
                          <div className="lg:col-span-5 h-full overflow-y-auto p-6 sm:p-7 space-y-4 bg-[var(--bg-base)]">
                            <OnSlideVisualCanvas
                              visual={activeExtraSlide.visual}
                              onCloseEmpty={() => setOpenVisualSlideKey(null)}
                              onChange={(nextVisual) =>
                                updateExtraSlide(activeExtraIdx, (s) => ({
                                  ...s,
                                  visual: nextVisual,
                                }))
                              }
                            />
                          </div>
                        )}
                      </>
                    )}

                    {/* ─── SLIDE 4: CHAMBER BRIEFING ─────────────────────── */}
                    {activeSlide === 3 && (
                      <div className="h-full overflow-y-auto p-8 sm:p-10 space-y-6 bg-[var(--surface-1)] max-w-3xl">
                        <span className="font-mono text-[11px] font-bold tracking-[0.2em] uppercase text-[var(--accent)] block">
                          PRACTICE BRIEFING // ENTERING THE ROOM
                        </span>

                        <div className="space-y-2">
                          <h3 className="font-display text-2xl sm:text-3xl font-bold text-white">
                            Prove It Live Against {roomConfig.personaName}
                          </h3>
                          <textarea
                            rows={2}
                            value={slides.mission.briefing}
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
                            placeholder="Click to brief the learner on what to expect in this sparring room..."
                            className="w-full resize-none rounded-lg bg-transparent px-2 py-1 -mx-2 text-base text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]/50 hover:bg-white/[0.03] focus:outline-none"
                          />
                        </div>

                        <div className="border-l-2 border-[var(--accent)] bg-[var(--accent)]/[0.06] p-4 rounded-r-xl space-y-1.5">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--accent)]">
                            Opening Attack Line from {roomConfig.personaName}
                          </span>
                          <textarea
                            rows={2}
                            value={slides.mission.openingAttack}
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
                            placeholder="Click to type what the AI opponent asks first..."
                            className="w-full resize-none rounded bg-transparent text-sm font-semibold italic text-white placeholder:text-[var(--text-muted)]/50 focus:outline-none"
                          />
                        </div>

                        <div className="pt-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setStudioStep("room")}
                            className="bg-white text-[#080B10] hover:bg-neutral-200 text-xs font-bold"
                          >
                            Configure AI Sparring Partner &amp; Room →
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* ─── SLIDE 5: SPAR SIGNATURE REAL-WORLD TRANSFER ───── */}
                    {activeSlide === 4 && (
                      <div className="h-full overflow-y-auto p-8 sm:p-10 space-y-6 bg-[var(--surface-1)] max-w-3xl">
                        <span className="font-mono text-[11px] font-bold tracking-[0.2em] uppercase text-[var(--accent)] block">
                          SPAR MANIFESTO // REAL-WORLD PROTOCOL
                        </span>

                        <div>
                          <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                            {SPAR_SIGNATURE_HEADLINE}
                          </h3>
                          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                            {SPAR_SIGNATURE_MANIFESTO}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-[var(--accent)]/35 bg-[var(--accent)]/[0.06] p-5 space-y-2">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
                            24-Hour Real-World Challenge
                          </span>
                          <textarea
                            rows={2}
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
                            placeholder="Click to write a real-world challenge for the learner..."
                            className="w-full resize-none rounded-lg bg-transparent text-sm font-semibold text-white placeholder:text-[var(--text-muted)]/50 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pinned Bottom Slide Navigation Bar */}
                  <footer className="h-14 shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-base)] px-6 flex items-center justify-between">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!prevFilmItem}
                      onClick={() =>
                        prevFilmItem && setActiveSlide(prevFilmItem.slideIndex)
                      }
                      className="text-xs text-[var(--text-secondary)] hover:text-white"
                    >
                      <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                      Previous Slide
                    </Button>

                    <div className="flex items-center gap-2">
                      <div className="hidden sm:flex items-center gap-1.5">
                        {filmstripItems.map((item, idx) => (
                          <button
                            key={item.slideIndex}
                            type="button"
                            onClick={() => setActiveSlide(item.slideIndex)}
                            aria-label={`Go to ${item.title}`}
                            className={cn(
                              "h-1.5 rounded-full transition-all",
                              idx === currentFilmPos
                                ? "w-5 bg-[var(--accent)]"
                                : "w-1.5 bg-white/20 hover:bg-white/40"
                            )}
                          />
                        ))}
                      </div>
                    </div>

                    {nextFilmItem ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setActiveSlide(nextFilmItem.slideIndex)}
                        className="bg-white text-[#080B10] hover:bg-neutral-200 text-xs font-bold"
                      >
                        Next Slide: {nextFilmItem.title}
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setStudioStep("room")}
                        className="inline-flex h-8 items-center rounded-full bg-white px-4 text-xs font-bold text-[#080B10] transition-all hover:bg-neutral-100"
                        style={{ boxShadow: "0 3px 0 #CBD5E1" }}
                      >
                        Next: Design Practice &amp; AI Room →
                      </button>
                    )}
                  </footer>
                </div>
              </main>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STEP 3: DEDICATED AI SPARRING ROOM BUILDER (Reached After Slides)
             ═══════════════════════════════════════════════════════════════════ */}
          {studioStep === "room" && (
            <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-mono font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
                    3. Practice &amp; Linked AI Sparring Room
                  </span>
                  <h2 className="mt-1 font-display text-2xl font-bold text-white">
                    AI Sparring Room · {activeLesson.title}
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Now that your slides are ready, configure the AI partner and practice challenge that follows the deck.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStudioStep("slides")}
                  className="border-[var(--border-subtle)] bg-[var(--surface-1)] text-xs text-white hover:bg-[var(--surface-2)]"
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Back to Lesson Slides
                </Button>
              </div>

              {/* Card 1: Activity Type */}
              <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-white">
                  Step 1 · Choose Lesson Activity Type
                </p>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                  {(Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[]).map(
                    (typeKey) => {
                      const active =
                        (activeLesson.activityType ?? "lesson") === typeKey;
                      return (
                        <button
                          key={typeKey}
                          type="button"
                          onClick={() =>
                            updateActiveLesson((l) => ({
                              ...l,
                              activityType: typeKey,
                            }))
                          }
                          className={cn(
                            "rounded-xl border px-3 py-2.5 text-xs font-medium transition-all",
                            active
                              ? "border-white bg-white text-[#080B10] font-bold shadow-sm"
                              : "border-[var(--border-subtle)] bg-[var(--bg-base)] text-[var(--text-secondary)] hover:border-white/25"
                          )}
                        >
                          {ACTIVITY_TYPE_LABELS[typeKey]}
                        </button>
                      );
                    }
                  )}
                </div>
              </section>

              {/* Card 2: Cast the AI Partner & Pressure */}
              <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                    <UserCheck className="h-4 w-4 text-[var(--accent)]" />
                    Step 2 · Cast the AI Sparring Partner
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
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
                          "flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all",
                          selected
                            ? "border-[var(--accent)] bg-[var(--accent)]/15 text-white ring-1 ring-[var(--accent)]/40"
                            : "border-[var(--border-subtle)] bg-[var(--bg-base)] text-[var(--text-secondary)] hover:border-white/25"
                        )}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 text-sm font-bold text-white">
                          {arch.defaultName.slice(0, 1)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white">
                            {arch.defaultName}
                          </p>
                          <p className="truncate text-xs text-[var(--text-secondary)]">
                            {arch.tagline}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[var(--text-secondary)]">
                      Partner Name in Room
                    </Label>
                    <Input
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
                      className="border-[var(--border-subtle)] bg-[var(--bg-base)] text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-[var(--text-secondary)]">
                      Room Format
                    </Label>
                    <select
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
                      className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 text-xs text-white"
                    >
                      <option value="open_spar">Open Q&amp;A Sparring</option>
                      <option value="drill">Targeted Vocal Habit Drill</option>
                    </select>
                  </div>
                </div>

                {activeLesson.roomConfig.experience === "drill" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[var(--text-secondary)]">
                      Habit Tracked in Drill
                    </Label>
                    <select
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
                      className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 text-xs text-white"
                    >
                      {DRILL_TARGETS.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Pressure Level */}
                <div className="space-y-2 border-t border-[var(--border-subtle)] pt-4">
                  <Label className="text-xs text-[var(--text-secondary)]">
                    How tough should {activeLesson.roomConfig.personaName} be?
                  </Label>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
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
                            "rounded-xl border p-3 text-left transition-all",
                            active
                              ? "border-white bg-white text-[#080B10]"
                              : "border-[var(--border-subtle)] bg-[var(--bg-base)] text-[var(--text-secondary)] hover:border-white/25"
                          )}
                        >
                          <p className="text-xs font-bold">{b.label}</p>
                          <p
                            className={cn(
                              "mt-0.5 text-[11px]",
                              active
                                ? "text-neutral-700"
                                : "text-[var(--text-muted)]"
                            )}
                          >
                            {b.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* Card 3: The Challenge Questions */}
              <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                  <Flame className="h-4 w-4 text-[var(--accent)]" />
                  Step 3 · Write the Challenge Questions
                </p>

                <div className="space-y-1.5">
                  <Label className="text-xs text-[var(--text-secondary)]">
                    1. In-Lesson Speaking Drill Prompt
                  </Label>
                  <Textarea
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
                          targetMaxWords: l.practice?.targetMaxWords ?? 35,
                          suggestedRewrite:
                            l.practice?.suggestedRewrite ??
                            l.slides.tape.strongResponse,
                        },
                      }))
                    }
                    placeholder="What question does the learner practice answering inside the lesson?"
                    className="border-[var(--border-subtle)] bg-[var(--bg-base)] text-xs text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-[var(--text-secondary)]">
                    2. Live Sparring Room Opening Question (What {activeLesson.roomConfig.personaName} asks first)
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
                    placeholder="What is the first question the AI opponent asks when the live room opens?"
                    className="border-[var(--border-subtle)] bg-[var(--bg-base)] text-xs text-white"
                  />
                </div>
              </section>

              {/* Card 4: Pass Criteria & Live Test */}
              <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                  <Target className="h-4 w-4 text-[var(--accent)]" />
                  Step 4 · Set the Pass Criteria
                </p>

                <div className="space-y-1.5">
                  <Label className="text-xs text-[var(--text-secondary)]">
                    One-Line Pass Target
                  </Label>
                  <Input
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
                    placeholder="e.g. Answer directly in the first sentence under 35 words"
                    className="border-[var(--border-subtle)] bg-[var(--bg-base)] text-xs text-white"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStudioStep("syllabus")}
                    className="border-[var(--border-subtle)] bg-[var(--bg-base)] text-xs text-white hover:bg-[var(--surface-2)]"
                  >
                    <FolderKanban className="mr-1.5 h-3.5 w-3.5 text-[var(--accent)]" />
                    Done — Back to Course Outline
                  </Button>

                  {onLaunchTestSession && (
                    <button
                      type="button"
                      disabled={launchingTest}
                      onClick={() =>
                        handleTestDrill(activeCourse, activeLesson)
                      }
                      className="inline-flex items-center rounded-full bg-white px-6 py-3 text-xs font-bold text-[#080B10] transition-all hover:bg-neutral-100 active:translate-y-[2px] disabled:opacity-50"
                      style={{ boxShadow: "0 4px 0 #CBD5E1" }}
                    >
                      <Play className="mr-2 h-4 w-4 fill-current" />
                      {launchingTest
                        ? "Opening Sparring Room..."
                        : `Test This Room Live vs. ${activeLesson.roomConfig.personaName} →`}
                    </button>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
