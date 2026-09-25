import { describe, expect, test } from "bun:test";
import { MODE_CONTRACTS, LIVE_MODEL_BY_MODE, vadConfigFor } from "./mode-contracts";

describe("mode contracts", () => {
  test("patience ladder from research: defense 3000, boardroom 1200, open spar 500, drill 500", () => {
    expect(MODE_CONTRACTS.defense.endOfSpeechPatienceMs).toBe(3000);
    expect(MODE_CONTRACTS.boardroom.endOfSpeechPatienceMs).toBe(1200);
    expect(MODE_CONTRACTS.open_spar.endOfSpeechPatienceMs).toBe(500);
    expect(MODE_CONTRACTS.drill.endOfSpeechPatienceMs).toBe(500);
  });
  test("each contract carries all six behavioral fields as non-empty strings", () => {
    for (const contract of Object.values(MODE_CONTRACTS)) {
      expect(contract.interruptionPolicy.length).toBeGreaterThan(20);
      expect(contract.responseStyleHint.length).toBeGreaterThan(20);
      expect(contract.pacingHint.length).toBeGreaterThan(20);
      expect(contract.openingBehavior.length).toBeGreaterThan(20);
      expect(contract.closingBehavior.length).toBeGreaterThan(20);
    }
  });
  test("boardroom routes to extended thinking; others to base live", () => {
    expect(LIVE_MODEL_BY_MODE.boardroom).toBe("models/gemini-3.8-live-extended-thinking");
    expect(LIVE_MODEL_BY_MODE.defense).toBe("models/gemini-3.8-live");
    expect(LIVE_MODEL_BY_MODE.drill).toBe("models/gemini-3.8-live");
    expect(LIVE_MODEL_BY_MODE.open_spar).toBe("models/gemini-3.8-live");
  });
  test("vad config maps patience to silenceDurationMs", () => {
    expect(vadConfigFor("defense").automaticActivityDetection.silenceDurationMs).toBe(3000);
    expect(vadConfigFor("drill").automaticActivityDetection.prefixPaddingMs).toBe(20);
    expect(vadConfigFor("open_spar").automaticActivityDetection.disabled).toBe(false);
  });
});
