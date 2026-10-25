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

  test("renders 3-zone Keynote Slide Studio with Slide Filmstrip, 6-slide pacing guardrail, Spar Signature slide, and contextual inspector when unlocked", () => {
    const m = renderToStaticMarkup(
      <CourseStudio initialCourses={DEFAULT_COURSES} initialUnlocked={true} />
    );
    expect(m).toContain("Course Studio");
    expect(m).toContain("1. Course Settings");
    expect(m).toContain("2. Syllabus Structure");
    expect(m).toContain("Slide Filmstrip");
    expect(m).toContain("4 of 6 content slides");
    expect(m).toContain("Optimal Pacing");
    expect(m).toContain("Add Insight Slide (4/6)");
    expect(m).toContain("Real-World Transfer");
    expect(m).toContain("3. Edit Lesson Slides &amp; Linked Chamber");
    expect(m).toContain("Live Learner Preview");
    expect(m).toContain("Save Draft");
    expect(m).toContain("Full Learner Preview");
  });
});
