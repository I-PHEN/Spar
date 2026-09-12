/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test";
import { architectureManifest } from "./manifest";
import { selectExperienceDetail } from "./experience-flows";

describe("experience flow selection", () => {
  test("selecting Drill explains its panel opening and execution boundaries", () => {
    const detail = selectExperienceDetail(architectureManifest.experiences, "drill");

    expect(detail).not.toBeNull();
    expect(detail?.flow.id).toBe("drill");
    expect(detail?.whoSpeaksFirst).toBe("The panel asks the first focused question.");
    expect(detail?.presentationRule).toBe("No presentation phase; the user answers one focused question at a time.");
    expect(detail?.interruptionPolicy).toBe("A detected target behavior immediately produces a correction and requires a retry.");
    expect(detail?.aiStepIds).toEqual(["question", "debrief"]);
    expect(detail?.deterministicStepIds).toEqual(["detect", "correct-or-advance"]);
    expect(detail?.storedResults).toBe("The selected target, attempts, corrections, transcript, telemetry, audio clips, debrief, and pattern memory are stored.");
    expect(detail?.failureBehavior).toBe("If deterministic drill handling cannot continue, the session falls back to the configured target; if debrief generation fails, ending is retried before results are available.");
  });

  test("keeps the approved ordered steps for every experience", () => {
    const stepsByExperience = Object.fromEntries(
      architectureManifest.experiences.map((experience) => [
        experience.id,
        experience.steps.map((step) => step.id),
      ]),
    );

    expect(stepsByExperience).toEqual({
      defense: ["configure", "present", "analyze", "qa", "end", "debrief"],
      boardroom: ["configure", "present", "interrupt", "recover", "qa", "end", "debrief"],
      open_spar: ["configure", "panel-opens", "answer", "challenge", "end", "debrief"],
      drill: ["choose-target", "question", "answer", "detect", "correct-or-advance", "end", "debrief"],
    });
  });
});
