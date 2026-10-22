import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { SparringMockup } from "./sparring-mockup";

describe("SparringMockup (truth mockup)", () => {
  const markup = renderToStaticMarkup(<SparringMockup />);

  test("mirrors the real room: Q&A mode, Ada's circular presence, her accent", () => {
    expect(markup).toContain("Q&amp;A");
    expect(markup).toContain("Ada");
    expect(markup).toContain("rounded-full");
    expect(markup).toContain("oklch(0.68 0.13 250"); // skeptic accent
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
});
