import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { OnboardingView } from "./onboarding-view";

describe("OnboardingView", () => {
  const markup = renderToStaticMarkup(
    <OnboardingView onComplete={() => {}} onBack={() => {}} />,
  );

  test("renders step 1 (What are you preparing for?) with distinct active/inactive track cards", () => {
    expect(markup).toContain("What are you preparing for?");
    expect(markup).toContain("Skip");
    expect(markup).toContain("Debate &amp; Arguments");
    expect(markup).toContain("Pitches &amp; Presentations");
    expect(markup).toContain("Academic &amp; Research");
    expect(markup).toContain("Interviews &amp; Career");
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('aria-pressed="false"');
    expect(markup).toContain("Selected");
  });

  test("source pins: exactly 2 steps, vibrant selection states, no upcoming-moment form", () => {
    const source = readFileSync(
      new URL("./onboarding-view.tsx", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain("FOCUS_OPTIONS");
    expect(source).not.toContain("Focus area");
    expect(source).not.toContain("/api/upcoming-moment");
    expect(source).not.toContain("Upcoming Moment");
    expect(source).not.toContain("moment-date");
    expect(source).toContain("/api/user");
    expect(source).toContain("aria-pressed");
  });
});
