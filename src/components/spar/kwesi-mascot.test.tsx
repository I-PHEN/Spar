import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Kwesi, type KwesiPose, type KwesiVariant } from "./kwesi-mascot";

const POSES: KwesiPose[] = [
  "hype",
  "listening",
  "proud",
  "thinking",
  "shake-it-off",
];

const VARIANTS: KwesiVariant[] = ["cornerman", "strategist"];

describe("Kwesi mascot (V1 SVG + Framer Motion)", () => {
  test("renders all 5 poses with distinct pose attributes and accessible labels", () => {
    for (const pose of POSES) {
      const markup = renderToStaticMarkup(<Kwesi pose={pose} size="md" />);
      expect(markup).toContain(`data-pose="${pose}"`);
      expect(markup).toContain('role="img"');
    }
  });

  test("renders both Cornerman and Strategist visual takes", () => {
    for (const variant of VARIANTS) {
      const markup = renderToStaticMarkup(
        <Kwesi pose="hype" variant={variant} size="lg" />,
      );
      expect(markup).toContain(`data-variant="${variant}"`);
      expect(markup).toContain("#C6FF3D");
    }
  });

  test("renders speech bubble and Kwesi corner badge when a line is passed", () => {
    const markup = renderToStaticMarkup(
      <Kwesi
        pose="shake-it-off"
        line="Shake it off. Breathe, then hit the core claim first."
      />,
    );
    expect(markup).toContain("KWESI · COACH");
    expect(markup).toContain(
      "Shake it off. Breathe, then hit the core claim first.",
    );
    expect(markup).toContain("#FF5A1F");
  });
});
