// Spar — Server-side store for partner-authored courses & learner progress
//
// Persists courses (drafts + published) and lesson completions to
// data/coach-store.json so partner edits in /studio and learner progress
// survive server restarts without mutating existing Prisma session tables.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  DEFAULT_COURSES,
  type Course,
  type LessonCompletion,
} from "./courses";

interface CoachStoreFile {
  courses: Course[];
  completions: LessonCompletion[];
}

const STORE_PATH = join(process.cwd(), "data", "coach-store.json");

let memoryFallback: CoachStoreFile | null = null;

function createInitialStore(): CoachStoreFile {
  return {
    courses: structuredClone(DEFAULT_COURSES),
    completions: [],
  };
}

function readStore(): CoachStoreFile {
  if (memoryFallback) {
    return memoryFallback;
  }
  try {
    if (!existsSync(STORE_PATH)) {
      const initial = createInitialStore();
      writeStore(initial);
      return initial;
    }
    const raw = readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<CoachStoreFile>;
    const storedCourses = Array.isArray(parsed.courses) ? parsed.courses : [];
    const completions = Array.isArray(parsed.completions)
      ? parsed.completions
      : [];

    // Ensure default courses exist and inherit any newly added schema defaults
    const defaultLessonMap = new Map<string, Course["modules"][number]["lessons"][number]>();
    for (const def of DEFAULT_COURSES) {
      for (const mod of def.modules) {
        for (const les of mod.lessons) {
          defaultLessonMap.set(les.id, les);
        }
      }
    }

    const byId = new Map<string, Course>();
    for (const def of DEFAULT_COURSES) {
      byId.set(def.id, structuredClone(def));
    }
    for (const c of storedCourses) {
      if (c && typeof c.id === "string") {
        const hydratedCourse: Course = {
          ...c,
          modules: Array.isArray(c.modules)
            ? c.modules.map((mod) => ({
                ...mod,
                lessons: Array.isArray(mod.lessons)
                  ? mod.lessons.map((les) => {
                      const seedLes = defaultLessonMap.get(les.id);
                      if (!seedLes) return les;
                      return {
                        ...seedLes,
                        ...les,
                        slides: {
                          trap: { ...seedLes.slides.trap, ...les.slides?.trap },
                          mentalModel: {
                            ...seedLes.slides.mentalModel,
                            ...les.slides?.mentalModel,
                          },
                          tape: { ...seedLes.slides.tape, ...les.slides?.tape },
                          mission: {
                            ...seedLes.slides.mission,
                            ...les.slides?.mission,
                          },
                        },
                      };
                    })
                  : [],
              }))
            : [],
        };
        byId.set(c.id, hydratedCourse);
      }
    }

    return {
      courses: Array.from(byId.values()),
      completions,
    };
  } catch {
    if (!memoryFallback) {
      memoryFallback = createInitialStore();
    }
    return memoryFallback;
  }
}

function writeStore(data: CoachStoreFile): void {
  try {
    const dir = dirname(STORE_PATH);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
    memoryFallback = null;
  } catch {
    memoryFallback = data;
  }
}

/**
 * List courses.
 * @param includeDrafts - false for learners (only published), true for Creator Studio.
 */
export function listCourses(options?: { includeDrafts?: boolean }): Course[] {
  const store = readStore();
  const includeDrafts = options?.includeDrafts ?? false;
  return store.courses.filter((c) => includeDrafts || c.status === "published");
}

export function getCourseById(id: string): Course | null {
  const store = readStore();
  return store.courses.find((c) => c.id === id) ?? null;
}

/**
 * Create or update a course from the Creator Studio.
 */
export function upsertCourse(course: Course): Course {
  const store = readStore();
  const normalized: Course = {
    ...course,
    title: course.title?.trim() || "Untitled Executive Course",
    subtitle: course.subtitle?.trim() || "",
    description: course.description?.trim() || "",
    category: course.category?.trim() || "Executive Presence",
    updatedAt: new Date().toISOString(),
  };

  const idx = store.courses.findIndex((c) => c.id === normalized.id);
  if (idx >= 0) {
    store.courses[idx] = normalized;
  } else {
    store.courses.push(normalized);
  }
  writeStore(store);
  return normalized;
}

/**
 * Delete a course by ID.
 */
export function deleteCourse(id: string): boolean {
  const store = readStore();
  const prevLen = store.courses.length;
  store.courses = store.courses.filter((c) => c.id !== id);
  if (store.courses.length !== prevLen) {
    writeStore(store);
    return true;
  }
  return false;
}

/**
 * List all lesson completions for the learner.
 */
export function listCompletions(): LessonCompletion[] {
  const store = readStore();
  return store.completions;
}

/**
 * Record a lesson as completed / mastered.
 */
export function recordLessonCompletion(params: {
  courseId: string;
  lessonId: string;
  sessionId?: string | null;
}): LessonCompletion {
  const store = readStore();
  const existingIdx = store.completions.findIndex(
    (c) => c.courseId === params.courseId && c.lessonId === params.lessonId
  );

  const entry: LessonCompletion = {
    courseId: params.courseId,
    lessonId: params.lessonId,
    completedAt: new Date().toISOString(),
    sessionId: params.sessionId ?? null,
  };

  if (existingIdx >= 0) {
    store.completions[existingIdx] = entry;
  } else {
    store.completions.push(entry);
  }
  writeStore(store);
  return entry;
}

/**
 * Verify Creator Studio passkey.
 * Uses SPAR_CREATOR_KEY env var if set; defaults to "spar-studio" for local authoring.
 */
export function verifyCreatorPasskey(candidate: string): boolean {
  const expected = (process.env.SPAR_CREATOR_KEY || "spar-studio").trim();
  return candidate.trim() === expected;
}
