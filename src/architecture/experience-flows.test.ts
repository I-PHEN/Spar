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
    expect(detail?.failureBehavior).toBe("If deterministic correction handling fails, the session emits an error and cannot continue that correction. Only a missing stored target falls back to the hard-coded hedging target; if debrief generation fails, ending is retried before results are available.");
  });

  test("describes the real Open Spar interruption and Defense persistence boundaries", () => {
    const openSpar = selectExperienceDetail(architectureManifest.experiences, "open_spar");
    const defense = selectExperienceDetail(architectureManifest.experiences, "defense");

    expect(openSpar?.interruptionPolicy).toBe("There is no presentation phase; the panel opens the exchange and live-answer interruptions can still occur.");
    expect(defense?.storedResults).toBe("Session transcript, telemetry, and audio clips are stored. The debrief and pattern memory are stored when debrief generation succeeds; presentation analysis is stored only when coaching is enabled and the analysis succeeds.");
    expect(defense?.failureBehavior).toBe("If presentation analysis fails, Q&A continues without the coach read. If debrief generation fails, ending is retried before final coaching results are available.");
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
