import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { PracticeView } from "./practice-view";

describe("PracticeView", () => {
  test("renders the first step without crashing", () => {
    const markup = renderToStaticMarkup(
      <PracticeView onSessionCreated={() => {}} onCancel={() => {}} />,
    );
    expect(markup.length).toBeGreaterThan(0);
  });

  test("picker and defaults wired to the visible allowlist", () => {
    const source = readFileSync(
      new URL("./practice-view.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("VISIBLE_EXPERIENCE_LIST.map"); // picker source
    // "VISIBLE_EXPERIENCE_LIST.map" contains "EXPERIENCE_LIST.map" as a
    // substring, so guard on the JSX-braced old picker usage instead.
    expect(source).not.toContain("{EXPERIENCE_LIST.map");
    expect(source).toContain('useState<ExperienceKey>("open_spar")');
    expect(source).toContain('defaultSeatsFor("open_spar")');
    expect(source).toContain("addSeat"); // add-panelist affordance
  });
});

describe("PracticeView single screen", () => {
  const markup = renderToStaticMarkup(
    <PracticeView onSessionCreated={() => {}} onCancel={() => {}} />,
  );

  test("all sections render at once — no stepper", () => {
    expect(markup).toContain("What are you defending");
    expect(markup).toContain("How will you spar");
    expect(markup).toContain("Arrange your panel");
    expect(markup).toContain("Start Sparring");
    // The old stepper label does not render as a step chip.
    expect(markup).not.toContain(">Experience<");
  });

  test("both mode cards visible; drill chips hidden until Drill is picked", () => {
    expect(markup).toContain("Q&amp;A");
    expect(markup).toContain("Drill");
    expect(markup).not.toContain("What are you drilling");
  });

  test("room description is behind a disclosure, not shown by default", () => {
    expect(markup).toContain("Customize the room");
    expect(markup).not.toContain("Describe the specific room");
  });

  test("panel shows the default panelist summary and the YOU visual", () => {
    expect(markup).toContain("YOU");
    expect(markup).toContain("Ada");
    expect(markup).toContain("Moderate");
    expect(markup).toContain("Add panelist");
  });

  test("softer short-material state exists in source", () => {
    const source = readFileSync(
      new URL("./practice-view.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("Short, so the panel will have less to challenge");
    // Sticky start bar.
    expect(source).toContain("sticky");
  });
});

describe("practice aesthetic contract", () => {
  test("seat cards preview the room: the panelist's accent hue renders", () => {
    const markup = renderToStaticMarkup(
      <PracticeView onSessionCreated={() => {}} onCancel={() => {}} />,
    );
    // Ada (skeptic) is the default seat — her blue must be in the markup.
    expect(markup).toContain("oklch(0.68 0.13 250");
  });
});
