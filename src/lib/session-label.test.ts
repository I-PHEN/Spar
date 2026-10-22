import { describe, expect, test } from "bun:test";
import { sessionLabel } from "./session-label";

describe("sessionLabel", () => {
  test("experience keys use the experience label (sessions since Project 2)", () => {
    expect(sessionLabel("open_spar")).toBe("Q&A");
    expect(sessionLabel("drill")).toBe("Drill");
    // Hidden-but-retained experiences still label correctly for old sessions.
    expect(sessionLabel("defense")).toBe("Defense");
    expect(sessionLabel("boardroom")).toBe("Boardroom");
  });

  test("legacy scenario keys fall back to their labels", () => {
    const legacy = sessionLabel("investor_pitch");
    expect(typeof legacy).toBe("string");
    expect(legacy.length).toBeGreaterThan(0);
    expect(legacy).not.toBe("investor_pitch");
  });

  test("unknown keys pass through unchanged", () => {
    expect(sessionLabel("mystery_mode")).toBe("mystery_mode");
  });
});
