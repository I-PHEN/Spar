import { describe, expect, test } from "bun:test";
import { ARCHETYPES, buildPersonaSystemPrompt } from "./personas";

const EXPECTED: Record<string, { name: string; tagline: string; initials: string }> = {
  skeptic: { name: "Ada", tagline: "Questions your core assumptions", initials: "A" },
  nitpicker: { name: "Victor", tagline: "Digs into your methods and details", initials: "V" },
  so_what: { name: "Chiara", tagline: "Challenges your impact and relevance", initials: "C" },
  timekeeper: { name: "Marcus", tagline: "Pushes you to be concise", initials: "M" },
  ally: { name: "Priya", tagline: "Supports, then finds the weak spot", initials: "P" },
};

describe("persona display", () => {
  test("first names, one-liners, initials for all five", () => {
    for (const [key, want] of Object.entries(EXPECTED)) {
      const a = ARCHETYPES[key as keyof typeof ARCHETYPES];
      expect(a.defaultName).toBe(want.name);
      expect(a.tagline).toBe(want.tagline);
      expect(a.initials).toBe(want.initials);
    }
  });

  test("prompt identity follows the first name; behavior blocks unchanged", () => {
    const prompt = buildPersonaSystemPrompt({
      archetype: "skeptic",
      behaviorStyle: "moderate",
      scenarioLabel: "Q&A",
      claims: [],
      patternMemory: "",
      otherPersonas: [],
    });
    expect(prompt).toContain("You are Ada, a Spar panelist.");
    expect(prompt).toContain(ARCHETYPES.skeptic.lens);
    expect(prompt).toContain(ARCHETYPES.skeptic.forbidden[0]);
  });
});
