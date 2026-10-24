import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_COURSES } from "@/lib/courses";
import { CoachView, ExecutiveBriefingDeck } from "./coach-view";

describe("CoachView (Learner Experience)", () => {
  test("renders course catalog, active course progress, and syllabus without exposing creator studio controls", () => {
    const markup = renderToStaticMarkup(
      <CoachView
        onSessionCreated={() => {}}
        initialCourses={DEFAULT_COURSES}
        initialCompletions={[
          {
            courseId: "defending-under-fire",
            lessonId: "duf-lesson-1-bluf",
            completedAt: "2026-10-23T10:00:00.000Z",
          },
        ]}
      />
    );

    // Academy header & active course
    expect(markup).toContain("Executive Academy");
    expect(markup).toContain("Defending Under Fire");
    expect(markup).toContain("Zero-Hedge Concision");
    expect(markup).toContain("Boardroom Curveballs");

    // Progress tracking: 1 of 3 lessons mastered
    expect(markup).toContain("of 3 lessons mastered");
    expect(markup).toContain("33%");
    expect(markup).toContain("Mastered");

    // Syllabus modules & lessons
    expect(markup).toContain("BLUF: Bottom-Line Up Front");
    expect(markup).toContain("Defending Core Assumptions");

    // Learner view must NEVER expose creator authoring controls
    expect(markup).not.toContain("Publish Course");
    expect(markup).not.toContain("Save Draft");
    expect(markup).not.toContain("Creator Passkey");
  });
});

describe("ExecutiveBriefingDeck (4-Card Lesson Presentation)", () => {
  const course = DEFAULT_COURSES[0];
  const lesson = course.modules[0].lessons[0];

  test("renders Slide 1 (The Trap) with headline and cost of failure", () => {
    const m = renderToStaticMarkup(
      <ExecutiveBriefingDeck
        course={course}
        lesson={lesson}
        activeSlide={0}
      />
    );
    expect(m).toContain("Slide 1 of 4");
    expect(m).toContain(lesson.slides.trap.headline);
    expect(m).toContain(lesson.slides.trap.costOfFailure);
  });

  test("renders Slide 2 (The Mental Model) with Golden Rule", () => {
    const m = renderToStaticMarkup(
      <ExecutiveBriefingDeck
        course={course}
        lesson={lesson}
        activeSlide={1}
      />
    );
    expect(m).toContain("Slide 2 of 4");
    expect(m).toContain(lesson.slides.mentalModel.headline);
    expect(m).toContain(lesson.slides.mentalModel.goldenRule);
  });

  test("renders Slide 3 (The Tape Breakdown) with Weak vs. Executive responses", () => {
    const m = renderToStaticMarkup(
      <ExecutiveBriefingDeck
        course={course}
        lesson={lesson}
        activeSlide={2}
      />
    );
    expect(m).toContain("Slide 3 of 4");
    expect(m).toContain("Weak / Defensive Tape");
    expect(m).toContain("Executive Tape");
    expect(m).toContain(lesson.slides.tape.weakResponse);
    expect(m).toContain(lesson.slides.tape.strongResponse);
  });

  test("renders Slide 4 (Chamber Mission) with opponent, opening attack, and launch button", () => {
    const m = renderToStaticMarkup(
      <ExecutiveBriefingDeck
        course={course}
        lesson={lesson}
        activeSlide={3}
        onLaunchDrill={() => {}}
      />
    );
    expect(m).toContain("Slide 4 of 4");
    expect(m).toContain("Ada");
    expect(m).toContain(lesson.slides.mission.openingAttack);
    expect(m).toContain(lesson.slides.mission.passCriteria);
    expect(m).toContain("Enter Drill Chamber");
  });
});
