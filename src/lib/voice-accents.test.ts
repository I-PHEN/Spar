import { describe, expect, test } from "bun:test";
import {
  ACCENT_LIST,
  buildLiveAccentDirective,
  extractVoiceProfileFromContext,
  formatVoiceProfileTags,
  resolveDeepgramVoiceModel,
  resolveEffectiveSeatAccent,
  resolveGeminiLiveVoice,
  stripVoiceProfileTags,
} from "./voice-accents";
import { LIVE_VOICES } from "../hooks/use-live-voice";

describe("voice-accents", () => {
  test("defines all six accent presets including mixed international panel", () => {
    const keys = ACCENT_LIST.map((a) => a.key);
    expect(keys).toEqual([
      "american",
      "british",
      "australian",
      "irish",
      "indian",
      "mixed",
    ]);
  });

  test("resolves native Deepgram Aura-2 / Aura-1 / Flux models across accents", () => {
    const uk = resolveDeepgramVoiceModel({
      archetype: "skeptic",
      seatOrder: 0,
      accent: "british",
      voiceTone: "authoritative",
    });
    expect(uk.v1Model).toBe("aura-2-draco-en");
    expect(uk.previewEndpoint).toBe("v1");

    const au = resolveDeepgramVoiceModel({
      archetype: "nitpicker",
      seatOrder: 0,
      accent: "australian",
      voiceTone: "warm",
    });
    expect(au.v1Model).toBe("aura-2-theia-en");

    const ie = resolveDeepgramVoiceModel({
      archetype: "skeptic",
      seatOrder: 0,
      accent: "irish",
    });
    expect(ie.v1Model).toBe("aura-angus-en");

    const inVoice = resolveDeepgramVoiceModel({
      archetype: "skeptic",
      seatOrder: 0,
      accent: "indian",
    });
    expect(inVoice.previewEndpoint).toBe("v2");
    expect(inVoice.previewModel).toBe("flux-naveen-en");
    expect(inVoice.v1Model).toBe("aura-2-zeus-en");
  });

  test("rotates regional voices across mixed international panel seats and respects seat overrides", () => {
    expect(
      resolveEffectiveSeatAccent({ seatOrder: 0, globalAccent: "mixed" }),
    ).toBe("british");
    expect(
      resolveEffectiveSeatAccent({ seatOrder: 1, globalAccent: "mixed" }),
    ).toBe("american");
    expect(
      resolveEffectiveSeatAccent({ seatOrder: 2, globalAccent: "mixed" }),
    ).toBe("australian");
    expect(
      resolveEffectiveSeatAccent({
        seatOrder: 1,
        seatAccent: "irish",
        globalAccent: "american",
      }),
    ).toBe("irish");
  });

  test("serializes, parses, and strips voice profile context tags cleanly", () => {
    const tags = formatVoiceProfileTags({
      accent: "british",
      voiceTone: "crisp",
      seatAccents: { 0: "british", 1: "australian" },
    });
    const fullContext = `[Domain: sparring]\n${tags}\nCustom Room Instructions: Oxford Union floor.`;

    const extracted = extractVoiceProfileFromContext(fullContext);
    expect(extracted.hasExplicitProfile).toBe(true);
    expect(extracted.accent).toBe("british");
    expect(extracted.voiceTone).toBe("crisp");
    expect(extracted.seatAccents).toEqual({ 0: "british", 1: "australian" });

    const stripped = stripVoiceProfileTags(fullContext);
    expect(stripped).not.toContain("[VoiceAccent:");
    expect(stripped).not.toContain("[VoiceTone:");
    expect(stripped).not.toContain("[SeatAccents:");
    expect(stripped).toContain("Custom Room Instructions: Oxford Union floor.");
  });

  test("builds Live accent directive and preserves fallback map when no explicit tone is tagged", () => {
    expect(buildLiveAccentDirective("Coach Lesson: The 15-Word Ceiling.")).toBe(
      "",
    );

    const directive = buildLiveAccentDirective(
      "[VoiceAccent: irish]\n[VoiceTone: warm]",
    );
    expect(directive).toContain("# SPOKEN ACCENT & DELIVERY");
    expect(directive).toContain("Irish English accent");
    expect(directive).toContain("warm yet rigorous conversational tone");

    expect(
      resolveGeminiLiveVoice({
        archetype: "so_what",
        roomContext: "Coach Lesson: Plain",
        fallbackMap: LIVE_VOICES,
      }),
    ).toBe("Pulcherrima");

    expect(
      resolveGeminiLiveVoice({
        archetype: "skeptic",
        roomContext: "[VoiceTone: warm]",
        fallbackMap: LIVE_VOICES,
      }),
    ).toBe("Aoede");
  });
});
