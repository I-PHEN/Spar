import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { HeroView, DemoShowcaseModal, HERO_STAGE_ITEMS } from "./hero-view";

describe("HeroView (ultra-simple matte hero & 60s demo stage)", () => {
  const markup = renderToStaticMarkup(<HeroView onEnter={() => {}} />);
  const source = readFileSync(
    new URL("./hero-view.tsx", import.meta.url),
    "utf8",
  );

  test("renders the calm motto and eliminates paragraph/pill clutter", () => {
    expect(markup).toContain("The room before the real room.");
    expect(markup).not.toContain("2-3 personas");
    expect(markup).not.toContain("Free to start. No credit card required.");
    expect(markup).not.toContain("High-Stakes Q&amp;A");
    expect(markup).not.toContain("Voice Sparring Chamber");
  });

  test("renders solid 3D voice capsule, solid palette, and scroll-autoplay 60s Demo frame", () => {
    expect(markup).toContain("spar-hero-root");
    expect(markup).toContain("60s Demo");
    expect(markup).toContain("01:00");
    expect(markup).toContain("Play 60s Demo");
    expect(markup).toContain("Get Started");
    expect(markup).toContain("<svg");
    expect(source).toContain("IntersectionObserver");
    expect(HERO_STAGE_ITEMS.map((i) => i.accentColor)).toEqual([
      "#FF4F28",
      "#2563EB",
      "#EAB308",
      "#10B981",
    ]);
  });

  test("visual animations are accessible and never freeze on mouse hover", () => {
    expect(source).toContain("aria-hidden");
    expect(source).toContain("prefers-reduced-motion");
    expect(source).not.toContain("onPauseChange");
    expect(source).not.toContain("onMouseEnter");
    expect(source).not.toContain("textShadow");
    expect(source).not.toContain("blur-[");
  });

  test("renders Whop-inspired 3D isometric carousel with cycling roles", () => {
    expect(HERO_STAGE_ITEMS.length).toBe(4);
    expect(markup).toContain("Your ");
    expect(markup).toContain("debate opponent");
    expect(markup).toContain("all in one room.");
  });

  test("renders HeroHighlight quote band between Get Started CTA and 60s Demo", () => {
    expect(markup).toContain("the hardest question in the room");
    expect(markup).toContain("bg-dot-thick-neutral");
    const ctaIdx = markup.indexOf("Get Started");
    const highlightIdx = markup.indexOf("the hardest question in the room");
    const demoIdx = markup.indexOf("60s Demo");
    expect(ctaIdx).toBeGreaterThan(-1);
    expect(highlightIdx).toBeGreaterThan(ctaIdx);
    expect(demoIdx).toBeGreaterThan(highlightIdx);
  });

  test("DemoShowcaseModal renders interactive walkthrough and video player when open", () => {
    const emptyVideoMarkup = renderToStaticMarkup(
      <DemoShowcaseModal open={true} onClose={() => {}} onEnter={() => {}} />
    );
    expect(emptyVideoMarkup).toContain("Inside the Sparring Room");
    expect(emptyVideoMarkup).toContain("Try Spar Live Now");
    expect(emptyVideoMarkup).toContain("Attach &amp; Scan");
    expect(emptyVideoMarkup).not.toContain("<iframe");
    expect(emptyVideoMarkup).not.toContain("<video");

    const youtubeMarkup = renderToStaticMarkup(
      <DemoShowcaseModal
        open={true}
        onClose={() => {}}
        onEnter={() => {}}
        videoUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      />
    );
    expect(youtubeMarkup).toContain("<iframe");
    expect(youtubeMarkup).toContain("youtube.com/embed/dQw4w9WgXcQ");

    const mp4Markup = renderToStaticMarkup(
      <DemoShowcaseModal
        open={true}
        onClose={() => {}}
        onEnter={() => {}}
        videoUrl="https://cdn.example.com/spar-demo.mp4"
      />
    );
    expect(mp4Markup).toContain("<video");
    expect(mp4Markup).toContain("spar-demo.mp4");
  });
});
