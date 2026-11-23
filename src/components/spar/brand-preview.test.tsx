import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { BrandPreview } from "./brand-preview";

describe("BrandPreview (/brand design system showcase)", () => {
  test("renders Fight Night palette, font candidates, chunky cards, and both Kwesi takes across all 5 poses", () => {
    const markup = renderToStaticMarkup(<BrandPreview />);

    // Palette swatches
    expect(markup).toContain("#C6FF3D");
    expect(markup).toContain("#FF5A1F");

    // Display font candidates
    expect(markup).toContain("Space Grotesk");
    expect(markup).toContain("Bricolage Grotesque");

    // Chunky card & button specimens (uniform borders, no left-side stripes)
    expect(markup).toContain("spar-chunky-card-volt");
    expect(markup).toContain("spar-chunky-card-ember");
    expect(markup).toContain("spar-volt-btn");
    expect(markup).toContain("Enter the Ring");
    expect(markup).not.toContain("border-l-4");

    // Both Kwesi takes & all 5 poses
    expect(markup).toContain("Cornerman");
    expect(markup).toContain("Strategist");
    expect(markup).toContain('data-pose="hype"');
    expect(markup).toContain('data-pose="listening"');
    expect(markup).toContain('data-pose="proud"');
    expect(markup).toContain('data-pose="thinking"');
    expect(markup).toContain('data-pose="shake-it-off"');
  });
});
