import { describe, expect, test } from "bun:test";
import {
  EXPERIENCES,
  VISIBLE_EXPERIENCES,
  VISIBLE_EXPERIENCE_LIST,
  EXPERIENCE_LIST,
} from "./experiences";

describe("visible experiences", () => {
  test("allowlist is exactly Q&A and Drill, Q&A first", () => {
    expect(VISIBLE_EXPERIENCES).toEqual(["open_spar", "drill"]);
    expect(VISIBLE_EXPERIENCE_LIST.map((e) => e.key)).toEqual([
      "open_spar",
      "drill",
    ]);
  });

  test("open_spar is renamed Q&A with the locked copy; nothing else about it changes", () => {
    const qa = EXPERIENCES.open_spar;
    expect(qa.label).toBe("Q&A");
    expect(qa.tagline).toBe("They ask. You answer. They push back.");
    expect(qa.description).toBe("They ask. You answer. They push back.");
    // unchanged internals
    expect(qa.key).toBe("open_spar");
    expect(qa.userPresentsFirst).toBe(false);
    expect(qa.defaultPanel[0]).toEqual({
      archetype: "skeptic",
      behaviorStyle: "moderate",
    });
  });

  test("hidden modes remain fully defined and in the full list", () => {
    expect(EXPERIENCES.defense.label).toBe("Defense");
    expect(EXPERIENCES.boardroom.label).toBe("Boardroom");
    expect(EXPERIENCES.drill.label).toBe("Drill");
    expect(EXPERIENCE_LIST).toHaveLength(4);
  });
});
