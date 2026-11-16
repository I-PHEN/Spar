import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  computeHighlightProgress,
  HeroHighlight,
  Highlight,
} from "./hero-highlight";

describe("HeroHighlight", () => {
  test("renders dot-matrix field with radial edge mask and Highlight sweep", () => {
    const markup = renderToStaticMarkup(
      <HeroHighlight>
        <h2>
          Survive <Highlight>the hardest question</Highlight> first.
        </h2>
      </HeroHighlight>,
    );

    expect(markup).toContain("the hardest question");
    expect(markup).toContain("bg-dot-thick-neutral");
    expect(markup).toContain("bg-dot-thick-cobalt");
    expect(markup).toContain(
      "[mask-image:radial-gradient(ellipse_at_center,black_45%,transparent_100%)]",
    );
    expect(markup).toContain("from-[#2F65F6]/35");
    expect(markup).toContain("background-size:0% 100%");
  });
});

describe("computeHighlightProgress", () => {
  test("stays unhighlighted at scroll top, highlights on scroll down, and reverses back to 0 at top", () => {
    expect(computeHighlightProgress(0, 20, 220)).toBe(0);
    expect(computeHighlightProgress(20, 20, 220)).toBe(0);
    expect(computeHighlightProgress(120, 20, 220)).toBe(0.5);
    expect(computeHighlightProgress(220, 20, 220)).toBe(1);
    expect(computeHighlightProgress(600, 20, 220)).toBe(1);
    // Reversing back up toward top unhighlights symmetrically
    expect(computeHighlightProgress(70, 20, 220)).toBe(0.25);
    expect(computeHighlightProgress(0, 20, 220)).toBe(0);
  });
});
