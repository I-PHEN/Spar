import { describe, expect, test } from "bun:test";
import {
  DEFAULT_COURSES,
  buildLessonSessionPayload,
  createEmptyCourse,
  evaluatePracticeAttempt,
  getCourseLessonCount,
  getCourseLessons,
  getNextIncompleteLesson,
} from "./courses";
import {
  deleteCourse,
  listCourses,
  recordLessonCompletion,
  upsertCourse,
  verifyCreatorPasskey,
} from "./course-store";

describe("courses schema & lesson-to-chamber linking", () => {
  test("DEFAULT_COURSES includes published executive courses with 4-slide lessons", () => {
    expect(DEFAULT_COURSES.length).toBeGreaterThanOrEqual(3);
    for (const course of DEFAULT_COURSES) {
      expect(course.status).toBe("published");
      const lessons = getCourseLessons(course);
      expect(lessons.length).toBeGreaterThan(0);
      for (const lesson of lessons) {
        expect(lesson.slides.trap.headline.length).toBeGreaterThan(0);
        expect(lesson.slides.mentalModel.goldenRule.length).toBeGreaterThan(0);
        expect(lesson.slides.tape.strongResponse.length).toBeGreaterThan(0);
        expect(lesson.slides.mission.openingAttack.length).toBeGreaterThan(0);
      }
    }
  });

  test("buildLessonSessionPayload maps a lesson into a valid POST /api/sessions payload", () => {
    const course = DEFAULT_COURSES[0];
    const lesson = course.modules[0].lessons[0];
    const payload = buildLessonSessionPayload(course, lesson);

    expect(payload.experience).toBe("open_spar");
    expect(payload.drillTarget).toBeNull();
    expect(payload.coachingEnabled).toBe(true);
    expect(payload.mode).toBe("with_material");
    expect(payload.materialTitle).toContain(lesson.title);
    expect(payload.rawMaterial).toContain(lesson.slides.mission.openingAttack);
    expect(payload.personas).toEqual([
      {
        archetype: "skeptic",
        name: "Ada",
        behaviorStyle: "aggressive",
        seatOrder: 0,
      },
    ]);
  });

  test("getNextIncompleteLesson returns the first unmastered lesson in syllabus order", () => {
    const course = DEFAULT_COURSES[0];
    const lessons = getCourseLessons(course);
    expect(getCourseLessonCount(course)).toBe(lessons.length);

    const first = getNextIncompleteLesson(course, new Set());
    expect(first?.id).toBe(lessons[0].id);

    const second = getNextIncompleteLesson(course, new Set([lessons[0].id]));
    expect(second?.id).toBe(lessons[1].id);
  });

  test("course-store filters drafts from learner catalog and includes them in studio mode", () => {
    const draft = createEmptyCourse();
    draft.title = "Partner Draft Track";
    draft.status = "draft";

    upsertCourse(draft);

    const learnerList = listCourses({ includeDrafts: false });
    expect(learnerList.some((c) => c.id === draft.id)).toBe(false);

    const studioList = listCourses({ includeDrafts: true });
    expect(studioList.some((c) => c.id === draft.id)).toBe(true);

    // Publish the course and verify learners can now see it
    upsertCourse({ ...draft, status: "published" });
    const learnerListAfterPublish = listCourses({ includeDrafts: false });
    expect(learnerListAfterPublish.some((c) => c.id === draft.id)).toBe(true);

    // Clean up custom test course
    expect(deleteCourse(draft.id)).toBe(true);
  });

  test("recordLessonCompletion persists lesson mastery", () => {
    const entry = recordLessonCompletion({
      courseId: "defending-under-fire",
      lessonId: "duf-lesson-1-bluf",
      sessionId: "session-test-123",
    });
    expect(entry.courseId).toBe("defending-under-fire");
    expect(entry.lessonId).toBe("duf-lesson-1-bluf");
    expect(entry.sessionId).toBe("session-test-123");
  });

  test("verifyCreatorPasskey validates creator passkey", () => {
    expect(verifyCreatorPasskey("spar-studio")).toBe(true);
    expect(verifyCreatorPasskey("wrong-passkey")).toBe(false);
  });

  test("evaluatePracticeAttempt scores direct vs hedged responses with honest measurable dimensions", () => {
    const curveballs = DEFAULT_COURSES.find(
      (c) => c.id === "boardroom-curveballs"
    )!;
    const friendlyTrapLesson = curveballs.modules[0].lessons[0];

    const strongEval = evaluatePracticeAttempt(
      "Yes — our model includes a 15% buffer for partner delays, and our core deployment path remains on schedule for Q3.",
      friendlyTrapLesson
    );
    expect(strongEval.totalCriteriaCount).toBe(4);
    expect(strongEval.passedCriteriaCount).toBe(4);
    expect(strongEval.detectedHedges.length).toBe(0);
    expect(strongEval.hasConcreteNumbers).toBe(true);
    expect(strongEval.hasDirectOpening).toBe(true);
    expect(strongEval.didWell.length).toBeGreaterThan(0);
    expect(strongEval.toImprove.length).toBeGreaterThan(0);
    expect(strongEval.suggestedRewrite.length).toBeGreaterThan(0);

    const hedgedEval = evaluatePracticeAttempt(
      "Well, I think maybe we might kind of see some delays if partners slip.",
      friendlyTrapLesson
    );
    expect(hedgedEval.detectedHedges.length).toBeGreaterThan(0);
    expect(hedgedEval.hasConcreteNumbers).toBe(false);
    expect(hedgedEval.hasDirectOpening).toBe(false);
  });
});
