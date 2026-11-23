import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_COURSES, getCourseLessons } from "@/lib/courses";
import { CoachView, ExecutiveBriefingDeck } from "./coach-view";
import { MyCourseCard } from "./coach/my-course-card";
import { LessonPlayer } from "./coach/lesson-player";
import { DebriefContent } from "./debrief-view";

describe("CoachView (3-Screen Learner Experience)", () => {
  test("Screen A (Catalog): renders minimal 'Learn' header, tactile course cards, and browse drawer trigger without creator controls", () => {
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

    // Minimal Learn header with tactile course cards
    expect(markup).toContain("Learn");
    expect(markup).not.toContain(">Coach<");
    expect(markup).toContain("spar-chunky-card-volt");
    expect(markup).toContain("Browse courses");
    expect(markup).not.toMatch(/<header[^>]*border-b/);

    // Started course progress
    expect(markup).toContain("1/3");
    expect(markup).toContain("1 of 3 completed");
    expect(markup).toContain("33%");

    // Explore courses registry with outcome subtitles
    expect(markup).toContain("Explore courses");
    expect(markup).toContain("Defending Under Fire");
    expect(markup).toContain("Zero-Hedge Concision");
    expect(markup).toContain("Boardroom Curveballs");
    expect(markup).toContain(
      "Handle unexpected questions without losing composure."
    );

    // Minimal copy strips out filler eyebrows and left accent bar
    expect(markup).not.toContain("COACHING · LEARN");
    expect(markup).not.toContain("Build your presence.");
    expect(markup).not.toContain("border-l-[#2F65F6]");

    // Learner view must NEVER expose creator authoring controls
    expect(markup).not.toContain("Publish Course");
    expect(markup).not.toContain("Save Draft");
    expect(markup).not.toContain("Creator Passkey");
  });

  test("Screen B (Roadmap): renders clean Brilliant-style course roadmap with 'Learn /' breadcrumb, tactile 3D disc journey, and bottom action launcher without text walls", () => {
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
    expect(markup).toContain("LEVEL 1");
    expect(markup).toContain("Surviving the Friendly Trap");
    expect(markup).toContain("Two-Second Recovery");
    expect(markup).toContain("Lessons");
    expect(markup).toContain("Exercises");
    expect(markup).toContain("Start");

    // Must NOT contain cluttered accordion or multi-line metadata
    expect(markup).not.toContain("By the end you&#x27;ll be able to:");
    expect(markup).not.toContain("Partner in room:");
    expect(markup).not.toContain("Target: Cite a specific");

    // Must NOT show other courses as switcher pills above the roadmap
    expect(markup).not.toContain("Zero-Hedge Concision");
  });

  test("Screen B (Roadmap): each roadmap card is directly clickable as a button to open slides straight away on phone and desktop", () => {
    const markup = renderToStaticMarkup(
      <CoachView
        onSessionCreated={() => {}}
        initialCourses={DEFAULT_COURSES}
        initialScreen="roadmap"
        initialSelectedCourseId="boardroom-curveballs"
        initialCompletions={[
          {
            courseId: "boardroom-curveballs",
            lessonId: "bc-lesson-1-ally-pivot",
            completedAt: "2026-10-23T10:00:00.000Z",
          },
        ]}
      />
    );

    // Both 3D discs and title labels render as directly clickable buttons to open lessons straight away
    expect(markup).toContain('aria-label="Open lesson 1: Surviving the Friendly Trap (Completed, click to review)"');
    expect(markup).toContain('aria-label="Open lesson 2: Two-Second Recovery (Current lesson, click to start)"');
    expect(markup).toContain('aria-label="Open lesson 1: Surviving the Friendly Trap"');
    expect(markup).toContain('aria-label="Open lesson 2: Two-Second Recovery"');

    // Bottom action launcher provides primary start action
    expect(markup).toContain("Start");
  });

  test("Screen C (Interactive Lesson Player): renders full-screen theater stage with single undivided progress bar and Exit to roadmap action", () => {
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

    expect(markup).toContain("fixed inset-0 z-50");
    expect(markup).toContain("Exit to roadmap");
    expect(markup).toContain("Surviving the Friendly Trap");
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain("Which instinct is fatal here?");
    expect(markup).toContain("spar-volt-btn");
    expect(markup).toContain("Continue");
  });

  test("Course-Focused Debrief: renders Course Drill Completed banner and direct roadmap return buttons while omitting heavy full-practice telemetry", () => {
    const markup = renderToStaticMarkup(
      <DebriefContent
        scenarioLabel="Drill"
        courseContext={{
          courseId: "boardroom-curveballs",
          lessonId: "bc-lesson-1-ally-pivot",
          courseTitle: "Boardroom Curveballs",
          lessonTitle: "Surviving the Friendly Trap",
          passCriteria: "Bridge back to core strategy in under 20 seconds.",
        }}
        data={{
          debrief: {
            momentDescription: "You anchored immediately without accepting the false premise.",
            whatWentWell: ["Named the trade-off cleanly in the first sentence."],
            thePattern: "Held composure when pressed on timeline.",
            oneThingToPractice: "Pause one beat before delivering the metric.",
            telemetryInsights: {
              pace: "Steady",
              fillers: "Zero hedges",
              recovery: "Fast",
              evidence: "Strong",
            },
            shareableSummary: "Summary",
          },
          telemetry: null,
          skillSnapshot: {
            clarity: 80,
            recovery: 82,
            concision: 78,
            presence: 85,
            evidence: 79,
          },
        }}
        clips={new Map()}
        playingIndex={null}
        showTranscript={false}
        copied={false}
        onPlay={() => {}}
        onPause={() => {}}
        onCopy={() => {}}
        onToggleTranscript={() => {}}
        onBackHome={() => {}}
        onSparAgain={() => {}}
      />
    );

    expect(markup).toContain("Course Drill Completed");
    expect(markup).toContain("Lesson Debrief: Surviving the Friendly Trap");
    expect(markup).toContain("Bridge back to core strategy in under 20 seconds.");
    expect(markup).toContain("Back to Boardroom Curveballs Roadmap");
    expect(markup).toContain("Continue Course");
    expect(markup).not.toContain("Skill baseline (this session)");
    expect(markup).not.toContain("Executive debrief memo");
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

  test("renders Spar Signature Slide (Real-World Transfer) with 24-Hour Real-World Challenge", () => {
    const m = renderToStaticMarkup(
      <ExecutiveBriefingDeck
        course={course}
        lesson={lesson}
        activeSlide={4}
      />
    );
    expect(m).toContain("Spar Signature Principle · Real-World Transfer");
    expect(m).toContain(
      "The room builds the reflex. The real world builds the leader."
    );
    expect(m).toContain("Your 24-Hour Real-World Challenge");
  });
});

describe("LessonPlayer (4-Slide Brilliant Minimalist Flow)", () => {
  const course = DEFAULT_COURSES[0];
  const lesson = course.modules[0].lessons[0];

  test("Slide 1 (The Pressure Test): renders single undivided progress bar, spacious choices, tactile 2.5D Continue button, and zero left stripes", () => {
    const markup = renderToStaticMarkup(
      <LessonPlayer
        course={course}
        lesson={lesson}
        isCompleted={false}
        launchingChamber={false}
        onBackToRoadmap={() => {}}
        onLaunchChamber={() => {}}
        onCompleteLesson={() => {}}
      />
    );

    // Single undivided progress bar (no 4-part split tabs)
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-valuenow="25"');
    expect(markup).not.toContain('role="tablist"');
    expect(markup).not.toContain("1. Reflex Check");
    expect(markup).not.toContain("border-l-4");
    expect(markup).not.toContain("border-l-2");

    // Clean hook prompt & choice cards & 2.5D Volt Continue CTA
    expect(markup).toContain(lesson.practice?.hookPrompt || lesson.slides.tape.prompt);
    expect(markup).toContain("Which instinct is fatal here?");
    expect(markup).toContain("Approach A");
    expect(markup).toContain("Approach B");
    expect(markup).toContain("spar-volt-btn");
    expect(markup).toContain("Continue");

    // Must NOT contain cluttered full-page textarea or large forms in Slide 1
    expect(markup).not.toContain("Speak with microphone or type your immediate answer");
    expect(markup).not.toContain("CHOOSE YOUR REFLEX (OR SPEAK CUSTOM BELOW):");
  });

  test("MyCourseCard at 100% completion uses unified Fight Night Volt palette with zero emerald clash", () => {
    const course =
      DEFAULT_COURSES.find((c) => c.id === "zero-hedge-concision") ??
      DEFAULT_COURSES[0];
    const completedIds = new Set(getCourseLessons(course).map((l) => l.id));
    const markup = renderToStaticMarkup(
      <MyCourseCard
        course={course}
        completedLessonIds={completedIds}
        isHeroCourse
        onSelectCourse={() => {}}
        onStartOrContinueLesson={() => {}}
        onRemoveCourse={() => {}}
      />,
    );

    expect(markup).toContain("100%");
    expect(markup).toContain("#C6FF3D");
    expect(markup).not.toContain("emerald-");
  });
});

