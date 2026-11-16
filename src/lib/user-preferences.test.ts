import { describe, expect, test } from "bun:test";
import {
  DEFAULT_USER_PREFERENCES,
  derivePrimaryTrackFromDomain,
  intensityNumberFromBehavior,
  parseUserPreferences,
} from "./user-preferences";

describe("user-preferences", () => {
  test("returns complete defaults when raw preferences are missing or malformed", () => {
    expect(parseUserPreferences(null)).toEqual(DEFAULT_USER_PREFERENCES);
    expect(parseUserPreferences("{invalid-json")).toEqual(
      DEFAULT_USER_PREFERENCES,
    );
  });

  test("preserves valid accents, voice tones, display accent colors, and audio flags while deriving primaryTrack from defaultDomain", () => {
    const parsed = parseUserPreferences(
      JSON.stringify({
        defaultDomain: "commercial",
        panelIntensity: "aggressive",
        defaultMode: "drill",
        accentColor: "green",
        defaultAccent: "british",
        voiceTone: "crisp",
        autoMicEnabled: false,
        buzzerSoundEnabled: true,
      }),
    );

    expect(parsed.defaultDomain).toBe("commercial");
    expect(parsed.primaryTrack).toBe("pitch");
    expect(parsed.panelIntensity).toBe("aggressive");
    expect(parsed.defaultMode).toBe("drill");
    expect(parsed.accentColor).toBe("green");
    expect(parsed.defaultAccent).toBe("british");
    expect(parsed.voiceTone).toBe("crisp");
    expect(parsed.autoMicEnabled).toBe(false);
    expect(parsed.buzzerSoundEnabled).toBe(true);
  });

  test("normalizes unknown accent or tone fields cleanly to defaults", () => {
    const parsed = parseUserPreferences(
      JSON.stringify({
        accentColor: "ultraviolet",
        defaultAccent: "martian",
        voiceTone: "robotic",
      }),
    );
    expect(parsed.accentColor).toBe("default");
    expect(parsed.defaultAccent).toBe("american");
    expect(parsed.voiceTone).toBe("authoritative");
  });

  test("derives primary track and numeric intensity cleanly", () => {
    expect(derivePrimaryTrackFromDomain("sparring")).toBe("debate");
    expect(derivePrimaryTrackFromDomain("commercial")).toBe("pitch");
    expect(derivePrimaryTrackFromDomain("academic")).toBe("academic");
    expect(derivePrimaryTrackFromDomain("interview")).toBe("interview");

    expect(intensityNumberFromBehavior("gentle")).toBe(1);
    expect(intensityNumberFromBehavior("moderate")).toBe(2);
    expect(intensityNumberFromBehavior("aggressive")).toBe(3);
  });
});
