import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_COURSES } from "@/lib/courses";
import { CoachView, ExecutiveBriefingDeck } from "./coach-view";

describe("CoachView (3-Screen Learner Experience)", () => {
  test("Screen A (Catalog): renders 'Build your presence.' discovery header, 'Continue learning' section, and outcome-first course cards without creator controls", () => {
    const markup = renderToStaticMarkup(
      <CoachView
        onSessionCreated={() => {}}
        initialCourses={DEFAULT_COURSES}
        initialScreen="catalog"
        initialCompletions={[
          {
            courseId: "defending-under-fire",
            lessonId: "duf-lesson-1-bluf",
            completedAt: "2026-10-23T10:00:00.000Z",
          },
        ]}
      />
    );

    // Discovery header
    expect(markup).toContain("Build your presence.");
    expect(markup).toContain(
      "Practise the skills that help you think clearly and speak with confidence."
    );

    // Continue learning section for started courses
    expect(markup).toContain("Continue learning");
    expect(markup).toContain("1 of 3 completed");
    expect(markup).toContain("33%");

    // Explore courses grid with outcome subtitles
    expect(markup).toContain("Explore courses");
    expect(markup).toContain("Defending Under Fire");
    expect(markup).toContain("Zero-Hedge Concision");
    expect(markup).toContain("Boardroom Curveballs");
    expect(markup).toContain(
      "Handle unexpected questions without losing composure."
    );

    // Learner view must NEVER expose creator authoring controls
    expect(markup).not.toContain("Publish Course");
    expect(markup).not.toContain("Save Draft");
    expect(markup).not.toContain("Creator Passkey");
  });

  test("Screen B (Roadmap): renders focused course roadmap with 'Learn /' breadcrumb, upfront outcomes, straight-axis lesson nodes, and 'Apply in the room' link", () => {
    const markup = renderToStaticMarkup(
      <CoachView
        onSessionCreated={() => {}}
        initialCourses={DEFAULT_COURSES}
        initialScreen="roadmap"
        initialSelectedCourseId="boardroom-curveballs"
        initialCompletions={[]}
      />
    );

    expect(markup).toContain("Learn");
    expect(markup).toContain("Boardroom Curveballs");
    expect(markup).toContain("By the end you&#x27;ll be able to:");
    expect(markup).toContain("Up next:");
    expect(markup).toContain("Surviving the Friendly Trap");
    expect(markup).toContain("Two-Second Recovery");
    expect(markup).toContain("Partner in room:");
    expect(markup).toContain("Apply in the room");

    // Must NOT show other courses as switcher pills above the roadmap
    expect(markup).not.toContain("Zero-Hedge Concision");
  });

  test("Screen C (Interactive Lesson Player): renders Hook & Attempt stage for 'Surviving the Friendly Trap' before debrief", () => {
    const markup = renderToStaticMarkup(
      <CoachView
        onSessionCreated={() => {}}
        initialCourses={DEFAULT_COURSES}
        initialScreen="lesson"
        initialSelectedCourseId="boardroom-curveballs"
        initialActiveLessonId="bc-lesson-1-ally-pivot"
        initialCompletions={[]}
      />
    );

    expect(markup).toContain("Surviving the Friendly Trap");
    expect(markup).toContain("1. Scenario &amp; Attempt");
    expect(markup).toContain("Speak response");
    expect(markup).toContain("Submit attempt &amp; see principle");
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

  test("renders built-in SVG tactical diagrams and custom partner visual URLs", () => {
    const customLesson = structuredClone(lesson);
    customLesson.slides.trap.visual = {
      url: "https://example.com/custom-framework.png",
      caption: "Custom Partner Framework Figure",
      layout: "hero",
    };

    const m = renderToStaticMarkup(
      <ExecutiveBriefingDeck
        course={course}
        lesson={customLesson}
        activeSlide={0}
      />
    );
    expect(m).toContain("https://example.com/custom-framework.png");
    expect(m).toContain("Custom Partner Framework Figure");
  });
});

