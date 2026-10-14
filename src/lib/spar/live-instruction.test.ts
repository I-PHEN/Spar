import { describe, expect, test } from "bun:test";
import { ARCHETYPES, BEHAVIOR_STYLE_PROMPTS } from "../personas";
import { MODE_CONTRACTS } from "./mode-contracts";
import { buildLiveSystemInstruction } from "./live-instruction";

const baseParams = {
  archetype: "skeptic" as const,
  behaviorStyle: "moderate" as const,
  mode: "defense" as const,
  scenarioLabel: "PhD Defense — Machine Learning",
  claims: [
    { id: 1, label: "Novelty", claim: "Our method reduces training time by 40%", evidence: "Table 2" },
    { id: 2, label: "Impact", claim: "This matters for edge deployment" },
  ],
  otherPanelists: [
    { name: "Dr. Hurt", archetype: "nitpicker" as const },
    { name: "Prof. Vale", archetype: "timekeeper" as const },
  ],
};

describe("buildLiveSystemInstruction", () => {
  const instruction = buildLiveSystemInstruction(baseParams);

  test("carries the persona identity: name, lens, triggers, forbidden rules, tone", () => {
    const skeptic = ARCHETYPES.skeptic;
    expect(instruction).toContain(`You are ${skeptic.defaultName}, a Spar panelist.`);
    expect(instruction).toContain(`Lens: ${skeptic.lens}`);
    for (const trigger of skeptic.triggers) expect(instruction).toContain(trigger);
    for (const template of skeptic.questionTemplates) expect(instruction).toContain(template);
    for (const rule of skeptic.forbidden) expect(instruction).toContain(rule);
    expect(instruction).toContain(BEHAVIOR_STYLE_PROMPTS.moderate);
  });

  test("embeds all five mode-contract behavioral fields verbatim", () => {
    const contract = MODE_CONTRACTS.defense;
    expect(instruction).toContain(contract.interruptionPolicy);
    expect(instruction).toContain(contract.responseStyleHint);
    expect(instruction).toContain(contract.pacingHint);
    expect(instruction).toContain(contract.openingBehavior);
    expect(instruction).toContain(contract.closingBehavior);
  });

  test("follows the requested mode, not a hardcoded one", () => {
    const drill = buildLiveSystemInstruction({ ...baseParams, mode: "drill" });
    expect(drill).toContain(MODE_CONTRACTS.drill.responseStyleHint);
    expect(drill).not.toContain(MODE_CONTRACTS.defense.responseStyleHint);
  });

  test("includes the session rules: scenario, claims block, other panelists", () => {
    expect(instruction).toContain(`Experience room: ${baseParams.scenarioLabel}`);
    expect(instruction).toContain("Claim 1: Novelty");
    expect(instruction).toContain("Statement: Our method reduces training time by 40%");
    expect(instruction).toContain("Evidence provided: Table 2");
    expect(instruction).toContain("Claim 2: Impact");
    expect(instruction).toContain("Dr. Hurt");
    expect(instruction).toContain(ARCHETYPES.nitpicker.lens);
    expect(instruction).toContain("Prof. Vale");
  });

  test("does not leak the cascade JSON format into spoken mode", () => {
    expect(instruction).not.toContain("STRICT JSON");
    expect(instruction).not.toContain('"content":');
    expect(instruction).not.toContain('"claimRef"');
  });

  test("states the spoken-style rules including the brevity line", () => {
    expect(instruction).toContain("one question per turn");
    expect(instruction).toContain("no markdown");
    expect(instruction).toContain("1-3 sentences");
    expect(instruction).toContain("Timekeeper");
    expect(instruction).toContain("Never mention being an AI");
    expect(instruction).toContain("Keep spoken turns under 20 seconds unless presenting.");
  });
});
