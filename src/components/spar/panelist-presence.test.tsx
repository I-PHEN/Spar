import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PanelistPresence } from "./panelist-presence";

describe("PanelistPresence (portrait)", () => {
  const markup = renderToStaticMarkup(
    <PanelistPresence archetype="skeptic" name="Ada" status="listening" />,
  );

  test("renders the name and the one-line tagline", () => {
    expect(markup).toContain("Ada");
    expect(markup).toContain("Questions your core assumptions");
  });

  test("carries the persona's accent hue", () => {
    // skeptic accent — the room's only color comes from the persona
    expect(markup).toContain("oklch(0.68 0.13 250");
  });

  test("avatar is a circle, equal in every variant (user-locked)", () => {
    expect(markup).toContain("rounded-full");
    const row = renderToStaticMarkup(
      <PanelistPresence archetype="skeptic" name="Ada" status="listening" variant="row" />,
    );
    // Same size class in both variants — no panelist towers over another.
    expect(row).toContain("h-24 w-24");
    expect(row).toContain("rounded-full");
  });

  test("shows the listening status word", () => {
    expect(markup).toContain("Listening");
  });

  test("quiet room: no behavior badges, no meter bars", () => {
    for (const badge of ["Gentle", "Moderate", "Aggressive"]) {
      expect(markup).not.toContain(`>${badge}<`);
    }
    expect(markup).not.toContain("h-1 flex-1 rounded-full");
  });
});

describe("PanelistPresence (states)", () => {
  test("gathering shows the gathering word and dots", () => {
    const m = renderToStaticMarkup(
      <PanelistPresence archetype="skeptic" name="Ada" status="gathering" />,
    );
    expect(m).toContain("Gathering…");
    expect(m).toContain("spar-thinking-dot");
  });

  test("speaking shows the speaking word and the glow treatment", () => {
    const m = renderToStaticMarkup(
      <PanelistPresence archetype="skeptic" name="Ada" status="speaking" />,
    );
    expect(m).toContain("Speaking");
    expect(m).toContain("spar-presence-speaking");
  });

  test("interrupted adds the barge-in flicker", () => {
    const m = renderToStaticMarkup(
      <PanelistPresence archetype="skeptic" name="Ada" status="listening" interrupted />,
    );
    expect(m).toContain("spar-presence-flicker");
  });

  test("about-to-interrupt pulses the avatar (agitation tell)", () => {
    const m = renderToStaticMarkup(
      <PanelistPresence archetype="skeptic" name="Ada" status="listening" aboutToInterrupt />,
    );
    expect(m).toContain("spar-pulse");
  });
});

describe("PanelistPresence (row variant)", () => {
  test("compact row: name and status, no tagline", () => {
    const m = renderToStaticMarkup(
      <PanelistPresence archetype="so_what" name="Chiara" status="listening" variant="row" />,
    );
    expect(m).toContain("Chiara");
    expect(m).toContain("Listening");
    expect(m).not.toContain("Challenges your impact and relevance");
    // accent still present in the compact treatment
    expect(m).toContain("oklch(0.65 0.08 180");
  });
});
