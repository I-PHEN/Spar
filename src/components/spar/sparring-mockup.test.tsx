import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { SparringMockup, SPARRING_MOCKUP_STAGES } from "./sparring-mockup";

describe("SparringMockup (truth mockup)", () => {
  const markup = renderToStaticMarkup(<SparringMockup />);

  test("mirrors the real room: Q&A mode, Ada's circular presence, her accent", () => {
    expect(markup).toContain("Q&amp;A");
    expect(markup).toContain("Ada");
    expect(markup).toContain("rounded-full");
    expect(markup).toContain("oklch(0.72 0.19 250"); // skeptic accent
  });

  test("speaks the room's real language, not the old room's", () => {
    expect(markup).toContain("Start speaking");
    expect(markup).not.toContain("Click to speak");
    expect(markup).not.toContain("Thesis Defense");
  });

  test("shows the true default: one panelist, not a crowded panel", () => {
    expect(markup).not.toContain("Victor");
    expect(markup).not.toContain("Chiara");
  });

  test("the animation is decorative and respects reduced motion", () => {
    const source = readFileSync(
      new URL("./sparring-mockup.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("aria-hidden");
    expect(source).toContain("prefers-reduced-motion");
  });

  test("renders 4 interactive showcase stage tabs and stage-specific content", () => {
    expect(SPARRING_MOCKUP_STAGES).toHaveLength(4);
    expect(markup).toContain("Attach &amp; Scan");
    expect(markup).toContain("Hands-Free Q&amp;A");
    expect(markup).toContain("Drill Buzzer");
    expect(markup).toContain("Debrief Dossier");
    expect(markup).toContain("Auto-Mic On");

    const attachMarkup = renderToStaticMarkup(<SparringMockup initialStage={0} />);
    expect(attachMarkup).toContain("3 Attack Hotspots Extracted");
    expect(attachMarkup).toContain("WUDC_Debate_Case.pdf");

    const drillMarkup = renderToStaticMarkup(<SparringMockup initialStage={2} />);
    expect(drillMarkup).toContain("LIVE BUZZER");
    expect(drillMarkup).toContain("Drill: No Hedging");

    const debriefMarkup = renderToStaticMarkup(<SparringMockup initialStage={3} />);
    expect(debriefMarkup).toContain("01 The Moment");
    expect(debriefMarkup).toContain("02 One Thing to Practice");
    expect(debriefMarkup).toContain("Clarity");
  });
});
