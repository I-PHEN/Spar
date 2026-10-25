import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_COURSES } from "@/lib/courses";
import { CourseStudio } from "./course-studio";

describe("CourseStudio (Creator Portal)", () => {
  test("locks out unauthenticated visitors behind the Creator Passkey gate", () => {
    const m = renderToStaticMarkup(
      <CourseStudio initialCourses={DEFAULT_COURSES} initialUnlocked={false} />
    );
    expect(m).toContain("Creator Portal · Restricted Access");
    expect(m).toContain("Creator Passkey");
    expect(m).toContain("Unlock Course Studio");
    expect(m).not.toContain("1. Course Settings");
  });

  test("renders Screen 1 (Course & Syllabus) with clean single-column course settings and syllabus outline", () => {
    const m = renderToStaticMarkup(
      <CourseStudio
        initialCourses={DEFAULT_COURSES}
        initialUnlocked={true}
        initialStep="syllabus"
      />
    );
    expect(m).toContain("Course &amp; Syllabus");
    expect(m).toContain("1. Course Settings");
    expect(m).toContain("2. Syllabus Structure");
    expect(m).toContain("Edit Slides");
    expect(m).toContain("AI Room");
  });

  test("renders Screen 2 (Lesson Slides) with widescreen Direct On-Slide Canvas, 6-slide pacing guardrail, image upload, and Spar Signature slide", () => {
    const m = renderToStaticMarkup(
      <CourseStudio
        initialCourses={DEFAULT_COURSES}
        initialUnlocked={true}
        initialStep="slides"
      />
    );
    expect(m).toContain("Course Studio");
    expect(m).toContain("Slide Filmstrip");
    expect(m).toContain("4 of 6 content slides");
    expect(m).toContain("Optimal Pacing");
    expect(m).toContain("Add Insight Slide (4/6)");
    expect(m).toContain("Real-World Transfer");
    expect(m).toContain("Live Learner Preview &amp; Direct Slide Canvas");
    expect(m).toContain("Upload Image");
    expect(m).toContain("Save Draft");
    expect(m).toContain("Full Learner Preview");
  });

  test("renders Screen 3 (AI Sparring Room) with step-by-step activity type, partner casting, challenge questions, and pass criteria", () => {
    const m = renderToStaticMarkup(
      <CourseStudio
        initialCourses={DEFAULT_COURSES}
        initialUnlocked={true}
        initialStep="room"
        onLaunchTestSession={() => {}}
      />
    );
    expect(m).toContain("Step 1 · Choose Lesson Activity Type");
    expect(m).toContain("Step 2 · Cast the AI Sparring Partner");
    expect(m).toContain("Step 3 · Write the Challenge Questions");
    expect(m).toContain("Step 4 · Set the Pass Criteria");
    expect(m).toContain("Test This Room Live");
  });
});

