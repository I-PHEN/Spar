"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Compass,
  Eye,
  FileEdit,
  Flame,
  Globe,
  Image as ImageIcon,
  LayoutGrid,
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

export type StudioStep = "syllabus" | "slides" | "room";

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

// ─── On-Slide Visual Frame (Direct Image Upload + Diagram Picker Modal) ──────

function OnSlideVisualCanvas({
  visual,
  onChange,
}: {
  visual?: SlideVisualMedia;
  onChange: (next: SlideVisualMedia) => void;
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

  const hasVisual = Boolean(
    current.url?.trim() || (current.preset && current.preset !== "none")
  );

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
            "group relative rounded-2xl border bg-[#0a0a0a] p-2 transition-all",
            isDragging
              ? "border-white bg-white/10"
              : "border-white/12 hover:border-white/25"
          )}
        >
          {/* Floating Visual Controls on Hover */}
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#141414] px-3 py-1.5 text-xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-md bg-white/[0.07] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/[0.14]"
              >
                <Upload className="h-3 w-3" />
                Upload Image
              </button>
              <button
                type="button"
                onClick={() => setShowDiagramModal(true)}
                className="inline-flex items-center gap-1 rounded-md bg-white/[0.07] px-2.5 py-1 text-[11px] font-medium text-neutral-200 hover:bg-white/[0.14]"
              >
                <LayoutGrid className="h-3 w-3" />
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
                      ? "bg-white text-black font-semibold"
                      : "text-neutral-400 hover:text-white"
                  )}
                >
                  {l.label}
                </button>
              ))}

              <button
                type="button"
                onClick={() =>
                  onChange({ ...current, url: "", preset: "none" })
                }
                title="Remove visual from slide"
                className="ml-1 rounded p-1 text-neutral-400 hover:bg-white/10 hover:text-white"
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
            className="mt-2 w-full rounded-lg bg-transparent px-3 py-1.5 text-center font-mono text-xs text-neutral-400 placeholder:text-neutral-600 focus:bg-white/[0.04] focus:text-neutral-200 focus:outline-none"
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
            "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-6 text-center transition-all",
            isDragging
              ? "border-white bg-white/10"
              : "border-white/15 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]"
          )}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-neutral-300">
            <ImageIcon className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-white">
              Add an Image or Tactical Diagram to this Slide
            </p>
            <p className="text-[11px] text-neutral-400">
              Drag &amp; drop an image file here, upload from your computer, or pick a built-in diagram.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 bg-white text-black hover:bg-neutral-200 text-xs font-semibold"
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Upload Image
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowDiagramModal(true)}
              className="h-8 border-white/15 bg-white/[0.04] text-xs text-white hover:bg-white/[0.08]"
            >
              <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
              Choose Diagram
            </Button>
          </div>
        </div>
      )}

      {/* Clean Modal Gallery for Built-in Diagrams or Image URL */}
      {showDiagramModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl border border-white/15 bg-[#121212] p-6 shadow-2xl space-y-5 max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-base font-bold text-white">
                  Choose Slide Visual
                </h3>
                <p className="text-xs text-neutral-400">
                  Pick a built-in executive diagram, upload a file, or paste an image link.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDiagramModal(false)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-white/10 hover:text-white"
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
                className="border-white/10 bg-[#0a0a0a] text-xs text-white"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  fileInputRef.current?.click();
                  setShowDiagramModal(false);
                }}
                className="shrink-0 border-white/15 bg-white/[0.05] text-xs text-white"
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
                        ? "border-white bg-white/[0.08] ring-1 ring-white"
                        : "border-white/10 bg-[#0e0e0e] hover:border-white/25"
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

// ─── Main Course Studio Component ("One Thing at a Time") ────────────────────

export function CourseStudio({
  initialCourses = DEFAULT_COURSES,
  initialUnlocked = false,
  initialStep = "slides",
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-4 py-16">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121212] p-7 shadow-2xl">
          <div className="flex items-center gap-2 text-neutral-400">
            <Lock className="h-4 w-4 text-neutral-400" />
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
      accentClass: "border-l-white/40",
      removableKey: "trap",
    });
  }
  if (!hiddenCoreSet.has("mentalModel")) {
    filmstripItems.push({
      slideIndex: 1,
      badge: `0${slideNumber++}`,
      title: "Mental Model",
      subtitle: activeLesson.slides.mentalModel.headline,
      accentClass: "border-l-white/40",
      removableKey: "mentalModel",
    });
  }
  if (!hiddenCoreSet.has("tape")) {
    filmstripItems.push({
      slideIndex: 2,
      badge: `0${slideNumber++}`,
      title: "The Tape",
      subtitle: activeLesson.slides.tape.headline,
      accentClass: "border-l-white/40",
      removableKey: "tape",
    });
  }

  (activeLesson.extraSlides ?? []).forEach((extra, idx) => {
    filmstripItems.push({
      slideIndex: 100 + idx,
      badge: `0${slideNumber++}`,
      title: extra.label || `Insight ${idx + 1}`,
      subtitle: extra.headline,
      accentClass: "border-l-white/40",
      removableExtraIdx: idx,
    });
  });

  filmstripItems.push({
    slideIndex: 3,
    badge: `0${slideNumber++}`,
    title: "Chamber Briefing",
    subtitle: `vs. ${activeLesson.roomConfig.personaName}`,
    accentClass: "border-l-white/40",
  });

  filmstripItems.push({
    slideIndex: 4,
    badge: "✦",
    title: "Real-World Transfer",
    subtitle: "Spar Signature Slide",
    accentClass: "border-l-white/40",
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
  const trapLayout = slides.trap.visual?.layout ?? "split";

  return (
    <div className="min-h-screen bg-[#070707] text-white flex flex-col">
      {/* ─── Clean Top Studio Navigation Bar ───────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a0a0a]/95 backdrop-blur px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3">
          {/* Left: Back + Course Picker */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-white/[0.08] hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              App
            </Link>

            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-white" />
              <span className="text-sm font-semibold tracking-tight text-white">
                Course Studio
              </span>
            </div>

            <select
              aria-label="Select course to edit"
              value={activeCourse.id}
              onChange={(e) => {
                setSelectedCourseId(e.target.value);
                setSelectedModuleIdx(0);
                setSelectedLessonIdx(0);
                setActiveSlide(0);
              }}
              className="rounded-lg border border-white/10 bg-[#141414] px-3 py-1.5 text-xs font-medium text-white"
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
              className="h-8 border-white/10 bg-white/[0.03] text-xs text-white hover:bg-white/[0.08]"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              New Course
            </Button>
          </div>

          {/* Center: 3-Step "One Thing at a Time" Switcher */}
          {!fullPreview && (
            <nav
              aria-label="Studio workflow steps"
              className="flex items-center rounded-xl border border-white/10 bg-[#121212] p-1"
            >
              <button
                type="button"
                onClick={() => setStudioStep("syllabus")}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all",
                  studioStep === "syllabus"
                    ? "bg-white text-black font-semibold shadow-sm"
                    : "text-neutral-400 hover:text-white"
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
                    ? "bg-white text-black font-semibold shadow-sm"
                    : "text-neutral-400 hover:text-white"
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
                    ? "bg-white text-black font-semibold shadow-sm"
                    : "text-neutral-400 hover:text-white"
                )}
              >
                3. AI Sparring Room
              </button>
            </nav>
          )}

          {/* Right: Live Learner Preview + Save + Publish */}
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
                  Back to Studio
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
                ? "Update Published"
                : "Publish Course"}
            </Button>
          </div>
        </div>
      </header>

      {saveBanner && (
        <div className="border-b border-white/15 bg-white/[0.05] px-6 py-2 text-center text-xs font-medium text-white">
          <CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5" />
          {saveBanner}
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
        <div className="flex-1">
          {/* ═══════════════════════════════════════════════════════════════════
              STEP 1: COURSE & SYLLABUS SCREEN (Focused Single-Column Outline)
             ═══════════════════════════════════════════════════════════════════ */}
          {studioStep === "syllabus" && (
            <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 space-y-8">
              {/* Course Header Card */}
              <section className="rounded-3xl border border-white/10 bg-[#121212] p-6 sm:p-8 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-mono font-semibold uppercase tracking-[0.18em] text-neutral-400">
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
                      className="h-8 w-36 border-white/10 bg-[#0a0a0a] text-xs text-white"
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
                      className="h-8 rounded-md border border-white/10 bg-[#0a0a0a] px-2.5 text-xs text-white"
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
                <div className="space-y-3">
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
                    placeholder="Course Title..."
                    className="w-full rounded-xl bg-transparent px-2 py-1 -mx-2 text-2xl sm:text-3xl font-bold tracking-tight text-white hover:bg-white/[0.03] focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-white/25"
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
                    placeholder="One-sentence learner outcome..."
                    className="w-full rounded-lg bg-transparent px-2 py-1 -mx-2 text-base font-medium text-neutral-300 hover:bg-white/[0.03] focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-white/25"
                  />

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
                    className="border-white/10 bg-[#0a0a0a] text-xs text-neutral-300"
                  />
                </div>

                {/* Learning Outcomes */}
                <div className="space-y-2 border-t border-white/[0.07] pt-4">
                  <Label className="text-xs font-medium text-neutral-300">
                    “By the end you&apos;ll be able to…” (one outcome per line)
                  </Label>
                  <Textarea
                    rows={3}
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
                    className="border-white/10 bg-[#0a0a0a] text-xs text-white"
                  />
                </div>
              </section>

              {/* Modules & Lessons Outline */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      2. Syllabus Structure
                    </h2>
                    <p className="text-xs text-neutral-400">
                      Click any lesson below to open its Presentation Slides or AI Sparring Room.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddModule}
                    className="border-white/15 bg-white/[0.04] text-xs text-white hover:bg-white/[0.08]"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add Module
                  </Button>
                </div>

                {activeCourse.modules.map((mod, mIdx) => (
                  <div
                    key={mod.id}
                    className="rounded-2xl border border-white/10 bg-[#121212] p-5 sm:p-6 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-3">
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
                          placeholder="Module one-line objective..."
                          className="w-full rounded bg-transparent px-1.5 py-0.5 -mx-1.5 text-xs text-neutral-400 hover:bg-white/[0.04] focus:bg-white/[0.06] focus:outline-none"
                        />
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddLesson(mIdx)}
                        className="h-8 border-white/10 bg-white/[0.03] text-xs text-white hover:bg-white/[0.08]"
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Add Lesson
                      </Button>
                    </div>

                    <div className="space-y-2.5">
                      {mod.lessons.map((les, lIdx) => (
                        <div
                          key={les.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#0e0e0e] px-4 py-3 hover:border-white/20 transition-all"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-neutral-400">
                                0{lIdx + 1}
                              </span>
                              <span className="truncate text-sm font-semibold text-white">
                                {les.title}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-neutral-300">
                                {
                                  ACTIVITY_TYPE_LABELS[
                                    les.activityType ?? "lesson"
                                  ]
                                }
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-xs text-neutral-400">
                              {les.tagline} · Partner: {les.roomConfig.personaName}
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
                              className="h-8 bg-white text-black hover:bg-neutral-200 text-xs font-semibold"
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
                              className="h-8 border-white/12 bg-white/[0.03] text-xs text-neutral-200 hover:bg-white/[0.08]"
                            >
                              <Swords className="mr-1.5 h-3.5 w-3.5 text-neutral-400" />
                              AI Room
                            </Button>

                            {mod.lessons.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteLesson(mIdx, lIdx)}
                                aria-label={`Delete ${les.title}`}
                                className="p-1.5 text-neutral-500 hover:text-white"
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
              STEP 2: DIRECT ON-SLIDE CANVAS (PowerPoint Mode — Zero Form Sidebar!)
             ═══════════════════════════════════════════════════════════════════ */}
          {studioStep === "slides" && (
            <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-12">
              {/* Left Thumbnail Rail (3 cols) */}
              <aside className="space-y-4 lg:col-span-3">
                {/* Active Lesson Switcher */}
                <div className="rounded-2xl border border-white/10 bg-[#121212] p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                      Editing Lesson
                    </span>
                    <button
                      type="button"
                      onClick={() => setStudioStep("syllabus")}
                      className="text-[11px] font-medium text-neutral-400 hover:text-white"
                    >
                      Change lesson →
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
                    className="w-full rounded-lg border border-white/10 bg-[#0a0a0a] px-2.5 py-1.5 text-xs font-semibold text-white focus:border-white/30 focus:outline-none"
                  />
                </div>

                {/* Slide Filmstrip */}
                <div className="rounded-2xl border border-white/10 bg-[#121212] p-4 space-y-3.5">
                  <div className="flex items-center justify-between">
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
                          ? "border-white/20 bg-white/[0.06] text-white"
                          : "border-white/15 bg-white/[0.03] text-neutral-300"
                      )}
                    >
                      {contentSlideCount <= 4 ? "Optimal Pacing" : "Near Max (6)"}
                    </span>
                  </div>

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
                            "flex items-center justify-between gap-2 rounded-xl border border-l-4 px-3 py-2.5 transition-all",
                            item.accentClass,
                            isSelected
                              ? "border-white/35 bg-white/[0.09] text-white shadow-sm"
                              : "border-white/[0.07] bg-[#0a0a0a] text-neutral-300 hover:border-white/15"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setActiveSlide(item.slideIndex)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                              {item.badge} · {item.title}
                            </span>
                            <p className="mt-0.5 truncate text-xs font-medium text-neutral-100">
                              {item.subtitle}
                            </p>
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
                              className="p-1 text-neutral-500 hover:text-white"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Add / Restore Slide Buttons */}
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
                        : `Max ${MAX_LESSON_SLIDES} Slides (Action-First Limit)`}
                    </Button>

                    {hiddenCoreSet.size > 0 && (
                      <button
                        type="button"
                        onClick={handleRestoreCoreSlides}
                        className="w-full text-center text-[11px] text-neutral-400 hover:text-white underline"
                      >
                        Restore hidden slides ({hiddenCoreSet.size})
                      </button>
                    )}
                  </div>
                </div>
              </aside>

              {/* Center Widescreen Slide Canvas (9 cols — Click directly on slide to edit!) */}
              <main className="lg:col-span-9 space-y-4">
                {/* Subtle Studio Bar Above Slide */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-white" />
                    <span className="text-xs font-semibold text-neutral-200">
                      Live Learner Preview &amp; Direct Slide Canvas
                    </span>
                    <span className="hidden sm:inline text-xs text-neutral-500">
                      — Click any text or image directly on the slide to edit
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStudioStep("room")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white hover:bg-white/[0.08]"
                  >
                    <Swords className="h-3.5 w-3.5" />
                    Configure AI Sparring Room →
                  </button>
                </div>

                {/* FIXED-DIMENSION EDITORIAL COURSE FOLIO CANVAS */}
                <div className="w-full max-w-[1040px] h-[640px] flex flex-col rounded-2xl border border-white/15 bg-[#0a0a0a] shadow-[0_32px_100px_rgba(0,0,0,0.85)] overflow-hidden mx-auto">
                  {/* Pinned Top Architectural Folio Bar */}
                  <header className="h-12 shrink-0 border-b border-white/[0.08] bg-[#0e0e0e] px-5 sm:px-7 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-neutral-400 truncate">
                        FOLIO // {activeCourse.title} · L0{selectedLessonIdx + 1}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {activeSlide === 0 && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-300">
                          <ShieldAlert className="h-3 w-3" />
                          Chapter 01 · Diagnostic Pattern
                        </span>
                      )}
                      {activeSlide === 1 && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-300">
                          <Sparkles className="h-3 w-3" />
                          Chapter 02 · Foundational Model
                        </span>
                      )}
                      {activeSlide === 2 && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-300">
                          <BookOpen className="h-3 w-3" />
                          Chapter 03 · Field Breakdown
                        </span>
                      )}
                      {activeExtraSlide && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-300">
                          <Sparkles className="h-3 w-3" />
                          {activeExtraSlide.label || "Tactical Deep-Dive"}
                        </span>
                      )}
                      {activeSlide === 3 && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-300">
                          <Swords className="h-3 w-3" />
                          Chapter 04 · Simulation Briefing
                        </span>
                      )}
                      {activeSlide === 4 && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-white">
                          <Sparkles className="h-3 w-3" />
                          Spar Signature · Reality Transfer
                        </span>
                      )}
                      <span className="hidden sm:inline-block text-[11px] font-mono text-neutral-500">
                        · {activeLesson.durationMinutes} min drill
                      </span>
                    </div>
                  </header>

                  {/* Fixed-Height Editorial Magazine / Bento Stage */}
                  <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-white/[0.08] overflow-hidden">
                    {/* ─── SLIDE 1: THE TRAP ─────────────────────────────── */}
                    {activeSlide === 0 && (
                      <>
                        <div className="lg:col-span-7 h-full overflow-y-auto p-6 sm:p-8 space-y-4 bg-[#0a0a0a]">
                          <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
                            <span className="font-mono text-[11px] font-semibold tracking-[0.2em] uppercase text-white">
                              01 // THE PATTERN TO BREAK
                            </span>
                            <input
                              type="text"
                              value={(slides.trap.flaws ?? []).join(", ")}
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
                              placeholder="Flaw tags (comma-separated)..."
                              className="w-48 rounded border border-white/15 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-neutral-300 focus:outline-none"
                            />
                          </div>

                          <div className="space-y-2">
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
                              placeholder="Headline of the trap or mistake..."
                              className="w-full rounded-lg bg-transparent px-2 py-1 -mx-2 text-2xl font-bold tracking-tight text-white hover:bg-white/[0.04] focus:bg-white/[0.06] focus:outline-none"
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
                              placeholder="Explain what speakers get wrong under pressure..."
                              className="w-full resize-none rounded-lg bg-transparent px-2 py-1 -mx-2 text-sm leading-relaxed text-neutral-300 hover:bg-white/[0.04] focus:bg-white/[0.06] focus:outline-none"
                            />
                          </div>

                          {/* Fatal Impulse Verbatim Callout */}
                          <div className="border-l-2 border-white/20 bg-white/[0.03] p-3.5 rounded-r-xl space-y-1">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                              The Fatal Impulse (What speakers blurt out)
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
                              className="w-full rounded bg-transparent px-1.5 py-0.5 -mx-1.5 text-xs italic text-neutral-200 hover:bg-white/[0.04] focus:outline-none"
                            />
                          </div>

                          {/* Autopsy: Why this loses the room */}
                          <div className="border-l-2 border-white/30 bg-white/[0.03] p-3.5 rounded-r-xl space-y-1">
                            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-300">
                              Why this costs you the room
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
                              placeholder="Why this mistake loses authority in the room..."
                              className="w-full rounded bg-transparent px-1.5 py-0.5 -mx-1.5 text-xs text-white hover:bg-white/[0.04] focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="lg:col-span-5 h-full overflow-y-auto p-6 sm:p-7 space-y-4 bg-[#070707]">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                            Tactical Visual or Diagram
                          </span>
                          <OnSlideVisualCanvas
                            visual={slides.trap.visual}
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
                      </>
                    )}

                    {/* ─── SLIDE 2: THE MENTAL MODEL ─────────────────────── */}
                    {activeSlide === 1 && (
                      <>
                        <div className="lg:col-span-7 h-full overflow-y-auto p-6 sm:p-8 space-y-5 bg-[#0a0a0a]">
                          <span className="font-mono text-[11px] font-semibold tracking-[0.2em] uppercase text-white block border-b border-white/[0.06] pb-3">
                            02 // THE TACTICAL LAW
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
                              placeholder="Framework headline (e.g. BLUF)..."
                              className="w-full rounded-lg bg-transparent px-2 py-1 -mx-2 text-2xl font-bold tracking-tight text-white hover:bg-white/[0.04] focus:bg-white/[0.06] focus:outline-none"
                            />

                            <textarea
                              rows={3}
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
                              placeholder="Explain how the technique works..."
                              className="w-full resize-none rounded-lg bg-transparent px-2 py-1 -mx-2 text-sm leading-relaxed text-neutral-300 hover:bg-white/[0.04] focus:bg-white/[0.06] focus:outline-none"
                            />
                          </div>

                          {/* The Golden Rule Plate */}
                          <div className="rounded-2xl border border-white/20 bg-white/[0.03] p-5 space-y-1.5">
                            <div className="flex items-center gap-2 text-[10px] font-mono font-semibold uppercase tracking-[0.2em] text-neutral-300">
                              <Compass className="h-3.5 w-3.5" />
                              The Golden Rule Law
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
                              placeholder="Type the 1-sentence golden rule..."
                              className="w-full rounded bg-transparent px-2 py-1 -mx-2 text-base font-bold text-white hover:bg-white/[0.04] focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="lg:col-span-5 h-full overflow-y-auto p-6 sm:p-7 space-y-4 bg-[#070707]">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                            3-Step Execution Pipeline
                          </span>
                          <div className="space-y-2.5">
                            {(slides.mentalModel.steps ?? [
                              { step: 1, label: "", detail: "" },
                              { step: 2, label: "", detail: "" },
                              { step: 3, label: "", detail: "" },
                            ]).map((st, sIdx) => (
                              <div
                                key={sIdx}
                                className="rounded-xl border border-white/10 bg-[#121212] p-3 space-y-1"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white/[0.08] font-mono text-[10px] font-bold text-white">
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
                                    placeholder={`Step ${sIdx + 1} label...`}
                                    className="w-full rounded bg-transparent text-xs font-semibold text-white focus:outline-none"
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
                                  placeholder="Step instruction..."
                                  className="w-full rounded bg-transparent text-[11px] text-neutral-400 focus:outline-none"
                                />
                              </div>
                            ))}
                          </div>

                          <div className="pt-2">
                            <OnSlideVisualCanvas
                              visual={slides.mentalModel.visual}
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
                        </div>
                      </>
                    )}

                    {/* ─── SLIDE 3: THE TAPE BREAKDOWN ───────────────────── */}
                    {activeSlide === 2 && (
                      <>
                        <div className="lg:col-span-6 h-full overflow-y-auto p-6 sm:p-8 space-y-5 bg-[#0a0a0a]">
                          <span className="font-mono text-[11px] font-semibold tracking-[0.2em] uppercase text-white block border-b border-white/[0.06] pb-3">
                            03 // THE ARENA TAPE
                          </span>

                          <div className="rounded-xl border border-white/10 bg-[#121212] p-4 space-y-1.5">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-300">
                              Incoming Question from {roomConfig.personaName}
                            </span>
                            <textarea
                              rows={2}
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
                              placeholder="Type the high-stakes question being tested..."
                              className="w-full resize-none rounded bg-transparent text-sm font-semibold text-white focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1.5 border-t border-white/[0.08] pt-3">
                            <span className="text-[10px] font-mono uppercase text-neutral-400">
                              Coach Difference Summary
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
                              placeholder="Summarize the core distinction between the weak and strong answers..."
                              className="w-full resize-none rounded-lg bg-transparent p-2 text-xs text-neutral-300 border border-white/10 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="lg:col-span-6 h-full overflow-y-auto p-6 space-y-3.5 bg-[#070707]">
                          {/* Weak Response Card */}
                          <div className="rounded-xl border border-white/10 bg-[#121212] p-3.5 space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-neutral-300">
                              <span className="flex items-center gap-1.5">
                                <XCircle className="h-3.5 w-3.5" />
                                Ineffective Response
                              </span>
                              <span className="font-mono text-[10px] text-neutral-400">Loses room</span>
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
                              placeholder="Amateur or defensive response..."
                              className="w-full resize-none rounded bg-transparent text-xs italic text-neutral-300 focus:outline-none"
                            />
                            <input
                              type="text"
                              value={slides.tape.weakCritique}
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
                              placeholder="Why it fails..."
                              className="w-full rounded border-t border-white/10 pt-1.5 bg-transparent text-[11px] text-neutral-400 focus:outline-none"
                            />
                          </div>

                          {/* Strong Response Card */}
                          <div className="rounded-xl border border-white/20 bg-white/[0.03] p-3.5 space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-white">
                              <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Strong Executive Response
                              </span>
                              <span className="font-mono text-[10px] text-neutral-300">Commands room</span>
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
                              placeholder="Disciplined executive response..."
                              className="w-full resize-none rounded bg-transparent text-xs font-medium text-white focus:outline-none"
                            />
                            <input
                              type="text"
                              value={slides.tape.strongWhy}
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
                              placeholder="Why it works..."
                              className="w-full rounded border-t border-white/10 pt-1.5 bg-transparent text-[11px] text-neutral-200 focus:outline-none"
                            />
                          </div>

                          <OnSlideVisualCanvas
                            visual={slides.tape.visual}
                            onChange={(nextVisual) =>
                              updateActiveLesson((l) => ({
                                ...l,
                                slides: {
                                  ...l.slides,
                                  tape: { ...l.slides.tape, visual: nextVisual },
                                },
                              }))
                            }
                          />
                        </div>
                      </>
                    )}

                    {/* ─── CUSTOM INSIGHT SLIDE ──────────────────────────── */}
                    {activeExtraSlide && activeExtraIdx >= 0 && (
                      <>
                        <div className="lg:col-span-7 h-full overflow-y-auto p-6 sm:p-8 space-y-5 bg-[#0a0a0a]">
                          <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
                            <span className="font-mono text-[11px] font-semibold tracking-[0.2em] uppercase text-white">
                              INSIGHT // TACTICAL DEEP-DIVE
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveExtraSlide(activeExtraIdx)}
                              className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-white"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete Slide
                            </button>
                          </div>

                          <div className="space-y-2">
                            <input
                              type="text"
                              value={activeExtraSlide.headline}
                              onChange={(e) =>
                                updateExtraSlide(activeExtraIdx, (s) => ({
                                  ...s,
                                  headline: e.target.value,
                                }))
                              }
                              placeholder="Insight headline..."
                              className="w-full rounded-lg bg-transparent px-2 py-1 -mx-2 text-2xl font-bold tracking-tight text-white hover:bg-white/[0.04] focus:outline-none"
                            />

                            <textarea
                              rows={3}
                              value={activeExtraSlide.body}
                              onChange={(e) =>
                                updateExtraSlide(activeExtraIdx, (s) => ({
                                  ...s,
                                  body: e.target.value,
                                }))
                              }
                              placeholder="Explain this insight in depth..."
                              className="w-full resize-none rounded-lg bg-transparent px-2 py-1 -mx-2 text-sm leading-relaxed text-neutral-300 hover:bg-white/[0.04] focus:outline-none"
                            />
                          </div>

                          <div className="border-l-2 border-white/30 bg-white/[0.03] p-4 rounded-r-xl space-y-1">
                            <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.2em] text-neutral-300">
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
                              placeholder="Core takeaway rule..."
                              className="w-full rounded bg-transparent text-sm font-semibold text-white focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="lg:col-span-5 h-full overflow-y-auto p-6 sm:p-7 space-y-4 bg-[#070707]">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                            Core Breakdown Points
                          </span>
                          <div className="space-y-2">
                            {(activeExtraSlide.bullets ?? ["", "", ""]).map((b, bIdx) => (
                              <div
                                key={bIdx}
                                className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#121212] p-2.5"
                              >
                                <span className="font-mono text-[10px] text-neutral-400">0{bIdx + 1}</span>
                                <input
                                  type="text"
                                  value={b}
                                  onChange={(e) => {
                                    const nextBullets = [...(activeExtraSlide.bullets ?? [])];
                                    nextBullets[bIdx] = e.target.value;
                                    updateExtraSlide(activeExtraIdx, (s) => ({
                                      ...s,
                                      bullets: nextBullets,
                                    }));
                                  }}
                                  placeholder={`Point ${bIdx + 1}...`}
                                  className="w-full rounded bg-transparent text-xs text-neutral-200 focus:outline-none"
                                />
                              </div>
                            ))}
                          </div>

                          <OnSlideVisualCanvas
                            visual={activeExtraSlide.visual}
                            onChange={(nextVisual) =>
                              updateExtraSlide(activeExtraIdx, (s) => ({
                                ...s,
                                visual: nextVisual,
                              }))
                            }
                          />
                        </div>
                      </>
                    )}

                    {/* ─── SLIDE 4: CHAMBER BRIEFING ─────────────────────── */}
                    {activeSlide === 3 && (
                      <>
                        <div className="lg:col-span-7 h-full overflow-y-auto p-6 sm:p-8 space-y-5 bg-[#0a0a0a]">
                          <span className="font-mono text-[11px] font-semibold tracking-[0.2em] uppercase text-white block border-b border-white/[0.06] pb-3">
                            04 // SIMULATION BRIEFING
                          </span>

                          <div className="space-y-2">
                            <h3 className="text-2xl font-bold text-white">
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
                              placeholder="Brief the learner on what to expect in this sparring room..."
                              className="w-full resize-none rounded-lg bg-transparent px-2 py-1 -mx-2 text-sm text-neutral-300 hover:bg-white/[0.04] focus:outline-none"
                            />
                          </div>

                          <div className="border-l-2 border-white/30 bg-white/[0.03] p-4 rounded-r-xl space-y-1.5">
                            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-300">
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
                              placeholder="Type what the opponent asks first..."
                              className="w-full resize-none rounded bg-transparent text-sm font-semibold italic text-white focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="lg:col-span-5 h-full overflow-y-auto p-6 sm:p-7 space-y-4 bg-[#070707]">
                          <div className="rounded-xl border border-white/10 bg-[#121212] p-4 space-y-2">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/[0.06] text-sm font-bold text-white">
                                {roomConfig.personaName.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-white">{roomConfig.personaName}</p>
                                <p className="truncate text-xs text-neutral-400">{archetypeDef.tagline}</p>
                              </div>
                            </div>
                            <div className="border-t border-white/[0.08] pt-2 space-y-1">
                              <span className="text-[10px] font-mono text-neutral-300">Pass Criteria:</span>
                              <input
                                type="text"
                                value={slides.mission.passCriteria}
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
                              placeholder="One-line pass criteria..."
                              className="w-full rounded bg-transparent text-xs text-white focus:outline-none"
                            />
                            </div>
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setStudioStep("room")}
                            className="w-full bg-white text-black hover:bg-neutral-200 text-xs font-semibold"
                          >
                            Open Full AI Room Builder →
                          </Button>
                        </div>
                      </>
                    )}

                    {/* ─── SLIDE 5: SPAR SIGNATURE REAL-WORLD TRANSFER ───── */}
                    {activeSlide === 4 && (
                      <>
                        <div className="lg:col-span-7 h-full overflow-y-auto p-6 sm:p-8 space-y-5 bg-[#0a0a0a]">
                          <span className="font-mono text-[11px] font-semibold tracking-[0.2em] uppercase text-white block border-b border-white/[0.06] pb-3">
                            SPAR MANIFESTO // REAL-WORLD PROTOCOL
                          </span>

                          <div>
                            <h3 className="text-2xl font-bold tracking-tight text-white">
                              {SPAR_SIGNATURE_HEADLINE}
                            </h3>
                            <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                              {SPAR_SIGNATURE_MANIFESTO}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-white/20 bg-white/[0.03] p-5 space-y-2">
                            <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.2em] text-neutral-300">
                              Your 24-Hour Real-World Challenge
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
                              placeholder="Challenge the learner to apply this technique in the real world..."
                              className="w-full resize-none rounded-lg bg-transparent text-sm font-semibold text-white focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="lg:col-span-5 h-full overflow-y-auto p-6 sm:p-7 space-y-3 bg-[#070707]">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                            The 3-Phase Progression
                          </span>
                          <div className="space-y-2 text-xs">
                            <div className="rounded-xl border border-white/10 bg-[#121212] p-3">
                              <span className="font-mono text-[10px] text-neutral-400">01 · SPOT THE TRAP</span>
                              <p className="mt-0.5 font-semibold text-white">Recognize the instinct under pressure</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-[#121212] p-3">
                              <span className="font-mono text-[10px] text-neutral-300">02 · WIRE THE REFLEX</span>
                              <p className="mt-0.5 font-semibold text-white">Spar in the chamber with {roomConfig.personaName}</p>
                            </div>
                            <div className="rounded-xl border border-white/15 bg-white/[0.04] p-3">
                              <span className="font-mono text-[10px] text-white">03 · REAL-WORLD DEPLOYMENT</span>
                              <p className="mt-0.5 font-semibold text-white">Apply with real stakeholders within 24h</p>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Pinned Bottom Architectural Folio Bar */}
                  <footer className="h-14 shrink-0 border-t border-white/[0.08] bg-[#0e0e0e] px-5 sm:px-7 flex items-center justify-between">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!prevFilmItem}
                      onClick={() =>
                        prevFilmItem && setActiveSlide(prevFilmItem.slideIndex)
                      }
                      className="text-xs text-neutral-300 hover:text-white"
                    >
                      <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                      Previous Chapter
                    </Button>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-neutral-400">
                        Chapter {currentFilmPos + 1} of {filmstripItems.length}
                      </span>
                      <div className="hidden sm:flex items-center gap-1">
                        {filmstripItems.map((item, idx) => (
                          <span
                            key={item.slideIndex}
                            className={cn(
                              "h-1.5 rounded-full transition-all",
                              idx === currentFilmPos
                                ? "w-4 bg-white"
                                : "w-1.5 bg-white/20"
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
                        className="bg-white text-black hover:bg-neutral-200 text-xs font-semibold"
                      >
                        Next: {nextFilmItem.title}
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setStudioStep("room")}
                        className="bg-white text-black hover:bg-neutral-200 text-xs font-semibold"
                      >
                        Next: AI Sparring Room →
                      </Button>
                    )}
                  </footer>
                </div>
              </main>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STEP 3: DEDICATED AI SPARRING ROOM BUILDER (One Decision Per Card)
             ═══════════════════════════════════════════════════════════════════ */}
          {studioStep === "room" && (
            <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-mono font-semibold uppercase tracking-[0.18em] text-neutral-400">
                    3. Edit Lesson Slides &amp; Linked Chamber
                  </span>
                  <h2 className="mt-1 text-2xl font-bold text-white">
                    AI Sparring Room Setup · {activeLesson.title}
                  </h2>
                  <p className="text-xs text-neutral-400">
                    Set up who the learner practices against, how tough the room is, and what they need to do to pass.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStudioStep("slides")}
                  className="border-white/15 bg-white/[0.04] text-xs text-white"
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Back to Lesson Slides
                </Button>
              </div>

              {/* Card 1: Activity Type & Pacing */}
              <section className="rounded-2xl border border-white/10 bg-[#121212] p-6 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
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
                              ? "border-white bg-white text-black font-semibold"
                              : "border-white/10 bg-[#0a0a0a] text-neutral-300 hover:border-white/25"
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
              <section className="rounded-2xl border border-white/10 bg-[#121212] p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                    <UserCheck className="h-4 w-4 text-white" />
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
                            ? "border-white bg-white/10 text-white"
                            : "border-white/10 bg-[#0a0a0a] text-neutral-300 hover:border-white/25"
                        )}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-sm font-bold text-white">
                          {arch.defaultName.slice(0, 1)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white">
                            {arch.defaultName}
                          </p>
                          <p className="truncate text-xs text-neutral-400">
                            {arch.tagline}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-neutral-300">
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
                      className="border-white/10 bg-[#0a0a0a] text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-neutral-300">
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
                      className="h-9 w-full rounded-md border border-white/10 bg-[#0a0a0a] px-3 text-xs text-white"
                    >
                      <option value="open_spar">Open Q&amp;A Sparring</option>
                      <option value="drill">Targeted Vocal Habit Drill</option>
                    </select>
                  </div>
                </div>

                {activeLesson.roomConfig.experience === "drill" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-neutral-300">
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
                      className="h-9 w-full rounded-md border border-white/10 bg-[#0a0a0a] px-3 text-xs text-white"
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
                <div className="space-y-2 border-t border-white/[0.07] pt-4">
                  <Label className="text-xs text-neutral-300">
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
                              ? "border-white bg-white text-black"
                              : "border-white/10 bg-[#0a0a0a] text-neutral-300 hover:border-white/25"
                          )}
                        >
                          <p className="text-xs font-bold">{b.label}</p>
                          <p
                            className={cn(
                              "mt-0.5 text-[11px]",
                              active ? "text-neutral-700" : "text-neutral-400"
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

              {/* Card 3: The Questions */}
              <section className="rounded-2xl border border-white/10 bg-[#121212] p-6 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <Flame className="h-4 w-4 text-white" />
                  Step 3 · Write the Challenge Questions
                </p>

                <div className="space-y-1.5">
                  <Label className="text-xs text-neutral-300">
                    1. In-Lesson Warm-Up Question (Asked before the slides)
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
                    className="border-white/10 bg-[#0a0a0a] text-xs text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-neutral-300">
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
                    className="border-white/10 bg-[#0a0a0a] text-xs text-white"
                  />
                </div>
              </section>

              {/* Card 4: Pass Criteria & Live Test */}
              <section className="rounded-2xl border border-white/10 bg-[#121212] p-6 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <Target className="h-4 w-4 text-white" />
                  Step 4 · Set the Pass Criteria
                </p>

                <div className="space-y-1.5">
                  <Label className="text-xs text-neutral-300">
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
                    className="border-white/10 bg-[#0a0a0a] text-xs text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-neutral-300">
                    Pass Checklist Items (one rule per line)
                  </Label>
                  <Textarea
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
                    className="border-white/10 bg-[#0a0a0a] text-xs text-white"
                  />
                </div>

                {onLaunchTestSession && (
                  <div className="border-t border-white/[0.08] pt-4">
                    <Button
                      type="button"
                      disabled={launchingTest}
                      onClick={() => handleTestDrill(activeCourse, activeLesson)}
                      className="bg-white text-black hover:bg-neutral-200 text-xs font-bold px-5 py-2.5 h-auto"
                    >
                      <Play className="mr-1.5 h-4 w-4 fill-current" />
                      {launchingTest
                        ? "Opening Sparring Room..."
                        : `Test This Room Live vs. ${activeLesson.roomConfig.personaName} →`}
                    </Button>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
