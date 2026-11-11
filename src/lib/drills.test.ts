import { describe, expect, test } from "bun:test";
import { evaluateDrillTurn, selectNextPersona } from "./drills";

describe("evaluateDrillTurn", () => {
  test("hedging drill catches qualifiers even on short 3-4 word responses", () => {
    const failed = evaluateDrillTurn("I think it converges.", "hedging");
    expect(failed.clean).toBe(false);
    expect(failed.reason).toContain("I think");

    const passed = evaluateDrillTurn(
      "Newton's method converges quadratically near the root.",
      "hedging"
    );
    expect(passed.clean).toBe(true);
  });

  test("over-explaining drill enforces the 18-word ceiling", () => {
    const longText =
      "There are many different aspects to consider when we evaluate the convergence rate of second-order optimization methods across high-dimensional parameter spaces.";
    const failed = evaluateDrillTurn(longText, "over-explaining");
    expect(failed.clean).toBe(false);
    expect(failed.reason).toContain("exceeds the 15-word drill ceiling");

    const shortText =
      "Inverting the Hessian costs O(n^3) operations per iteration.";
    expect(evaluateDrillTurn(shortText, "over-explaining").clean).toBe(true);
  });

  test("evidence-gaps drill rejects vague quantifiers and unsourced claims", () => {
    const vague = evaluateDrillTurn(
      "We improved throughput by roughly 40% last month.",
      "evidence-gaps"
    );
    expect(vague.clean).toBe(false);
    expect(vague.reason).toContain("vague quantifier");

    const unsourced = evaluateDrillTurn(
      "Our system is much faster and more reliable than alternatives.",
      "evidence-gaps"
    );
    expect(unsourced.clean).toBe(false);
    expect(unsourced.reason).toContain("No specific number, metric, or verifiable source");

    const groundedNumeric = evaluateDrillTurn(
      "P99 latency dropped from 420ms to 85ms across 12,000 requests.",
      "evidence-gaps"
    );
    expect(groundedNumeric.clean).toBe(true);

    const groundedMath = evaluateDrillTurn(
      "By the Kantorovich theorem, quadratic convergence holds when the Hessian is Lipschitz continuous.",
      "evidence-gaps"
    );
    expect(groundedMath.clean).toBe(true);
  });

  test("recovery-speed drill catches stalling filler openers and slow vocal onset", () => {
    const stalled = evaluateDrillTurn(
      "Um, that's a great question, we pause paid acquisition first.",
      "recovery-speed"
    );
    expect(stalled.clean).toBe(false);
    expect(stalled.reason).toContain("stalling filler");

    const slowOnset = evaluateDrillTurn(
      "We pause paid acquisition immediately.",
      "recovery-speed",
      3200
    );
    expect(slowOnset.clean).toBe(false);
    expect(slowOnset.reason).toContain("3.2s");

    const fastAndClean = evaluateDrillTurn(
      "We pause paid acquisition immediately and protect core renewals.",
      "recovery-speed",
      1100
    );
    expect(fastAndClean.clean).toBe(true);
  });
});

describe("selectNextPersona (Multi-Panelist Q&A Rotation)", () => {
  const personas = [
    { id: "p-ada", name: "Ada", seatOrder: 0 },
    { id: "p-chiara", name: "Chiara", seatOrder: 1 },
    { id: "p-victor", name: "Victor", seatOrder: 2 },
  ];

  test("rotates round-robin across all seated panelists on consecutive turns", () => {
    // Opening turn was spoken by Ada (seat 0), then user answered
    const afterTurn1 = [
      { role: "persona", personaId: "p-ada", type: "opening" },
      { role: "user", personaId: null, type: "normal" },
    ];
    expect(selectNextPersona(personas, afterTurn1)?.id).toBe("p-chiara");

    // Chiara (seat 1) spoke, then user answered
    const afterTurn2 = [
      ...afterTurn1,
      { role: "persona", personaId: "p-chiara", type: "normal" },
      { role: "user", personaId: null, type: "normal" },
    ];
    expect(selectNextPersona(personas, afterTurn2)?.id).toBe("p-victor");

    // Victor (seat 2) spoke, then user answered -> wraps back to Ada (seat 0)
    const afterTurn3 = [
      ...afterTurn2,
      { role: "persona", personaId: "p-victor", type: "normal" },
      { role: "user", personaId: null, type: "normal" },
    ];
    expect(selectNextPersona(personas, afterTurn3)?.id).toBe("p-ada");
  });

  test("honors forcedPersonaId when an agitation interrupt targets a specific panelist", () => {
    const messages = [
      { role: "persona", personaId: "p-ada", type: "opening" },
      { role: "user", personaId: null, type: "normal" },
    ];
    expect(selectNextPersona(personas, messages, "p-victor")?.id).toBe("p-victor");
  });
});
