import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { HeroView } from "./hero-view";

describe("HeroView (truth in the hero)", () => {
  const markup = renderToStaticMarkup(<HeroView onEnter={() => {}} />);

  test("truth in panel copy: 1-3 panelists with Ada opening", () => {
    expect(markup).toContain("1–3");
    expect(markup).toContain("Ada");
    expect(markup).not.toContain("2-3 personas");
  });

  test("kills filler microcopy", () => {
    expect(markup).not.toContain("Free to start. No credit card required.");
  });

  test("scenario chips reflect real two modes: Q&A and Drill use cases", () => {
    expect(markup).toContain("Q&amp;A");
    expect(markup).toContain("Drill");
  });

  test("visual animations have aria-hidden", () => {
    const source = readFileSync(
      new URL("./hero-view.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("aria-hidden");
    expect(source).toContain("prefers-reduced-motion");
  });
});
