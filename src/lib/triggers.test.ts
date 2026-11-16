import { describe, expect, test } from "bun:test";
import { detectTriggers, getThreshold } from "./triggers";

describe("triggers (Agitation Engine & Drill Mode)", () => {
  test("fires active over-explaining drill trigger across archetypes once 18 words exceeded", () => {
    const text =
      "We believe that autonomous deterrence requires careful diplomatic treaties signed across every multilateral security council and oversight body worldwide today.";
    const words = text.split(/\s+/).length;
    const res = detectTriggers(text, words, {
      coachingMode: "drill",
      drillTarget: "over-explaining",
    });
    expect(res.agitation.timekeeper).toBeGreaterThanOrEqual(100);
    expect(res.agitation.skeptic).toBeGreaterThanOrEqual(100);
    expect(res.reason).toContain("exceeds 15-word drill ceiling");
  });

  test("fires evidence-gaps drill trigger after 22 words without cited evidence", () => {
    const unsourced =
      "Our diplomatic framework completely stabilizes international borders while transforming institutional trust across multiple sovereign regions and partner coalitions throughout every disputed territory involved today.";
    const res = detectTriggers(unsourced, unsourced.split(/\s+/).length, {
      coachingMode: "drill",
      drillTarget: "evidence-gaps",
    });
    expect(res.agitation.nitpicker).toBeGreaterThanOrEqual(100);
    expect(res.reason).toContain("no cited data or source");

    const sourced =
      "Across 14 bilateral treaties between 2015 and 2024, binding hardware inspections reduced covert proliferation incidents by 62 percent across monitored states.";
    const cleanRes = detectTriggers(sourced, sourced.split(/\s+/).length, {
      coachingMode: "drill",
      drillTarget: "evidence-gaps",
    });
    expect(cleanRes.agitation.nitpicker ?? 0).toBeLessThan(
      getThreshold("nitpicker", "drill", "evidence-gaps")
    );
  });
});
