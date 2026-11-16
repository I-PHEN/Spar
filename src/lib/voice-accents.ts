import type { ArchetypeKey } from "./types";

export type AccentKey =
  | "american"
  | "british"
  | "australian"
  | "irish"
  | "indian"
  | "mixed";

export type ConcreteAccentKey = Exclude<AccentKey, "mixed">;

export type VoiceToneKey = "authoritative" | "warm" | "crisp";

export interface AccentDefinition {
  key: AccentKey;
  label: string;
  shortLabel: string;
  regionTag: string;
  description: string;
  previewSample: string;
  liveDirective: string;
}

export interface VoiceToneDefinition {
  key: VoiceToneKey;
  label: string;
  description: string;
  deliveryDirective: string;
}

export const DEFAULT_ACCENT: AccentKey = "american";
export const DEFAULT_VOICE_TONE: VoiceToneKey = "authoritative";

export const DEFAULT_PREVIEW_SENTENCE =
  "Let's pressure-test your opening claim. Walk me through your core assumption in one sentence.";

export const ACCENT_PRESETS: Record<AccentKey, AccentDefinition> = {
  american: {
    key: "american",
    label: "American",
    shortLabel: "American",
    regionTag: "US",
    description: "Clear executive cadence built for boardrooms and thesis panels.",
    previewSample:
      "Walk me through the core assumption behind that number in one crisp sentence.",
    liveDirective:
      "Speak in a natural, clear Standard American English accent.",
  },
  british: {
    key: "british",
    label: "British",
    shortLabel: "British",
    regionTag: "UK",
    description: "Measured Received Pronunciation suited for committee & Oxford style Q&A.",
    previewSample:
      "Before we move on, clarify the causal link you are relying on for that claim.",
    liveDirective:
      "Speak in a natural, educated British English (Received Pronunciation) accent.",
  },
  australian: {
    key: "australian",
    label: "Australian",
    shortLabel: "Australian",
    regionTag: "AU",
    description: "Direct, pragmatic delivery with steady conversational pacing.",
    previewSample:
      "Give me the straightforward answer first — what breaks if that timeline slips?",
    liveDirective:
      "Speak in a natural, clear Australian English accent.",
  },
  irish: {
    key: "irish",
    label: "Irish",
    shortLabel: "Irish",
    regionTag: "IE",
    description: "Engaging, articulate cadence that presses sharply on follow-ups.",
    previewSample:
      "That sounds promising in theory, so show me the concrete proof behind it.",
    liveDirective: "Speak in a natural, clear Irish English accent.",
  },
  indian: {
    key: "indian",
    label: "Indian",
    shortLabel: "Indian",
    regionTag: "IN",
    description:
      "Articulate Indian English delivery (native in Live Voice; Deepgram Flux preview).",
    previewSample:
      "Take a step back and state the single metric that proves this scales cleanly.",
    liveDirective:
      "Speak in a natural, clear, articulate Indian English accent.",
  },
  mixed: {
    key: "mixed",
    label: "Mixed International Panel",
    shortLabel: "Mixed",
    regionTag: "INTL",
    description:
      "Rotates British, American, Australian, and Irish voices across panel seats.",
    previewSample:
      "You have three distinct perspectives across this table — let us hear your sharpest defense.",
    liveDirective:
      "Speak in a crisp, articulate international English cadence.",
  },
};

export const ACCENT_LIST: AccentDefinition[] = [
  ACCENT_PRESETS.american,
  ACCENT_PRESETS.british,
  ACCENT_PRESETS.australian,
  ACCENT_PRESETS.irish,
  ACCENT_PRESETS.indian,
  ACCENT_PRESETS.mixed,
];

export const SEAT_ACCENT_LIST: AccentDefinition[] = ACCENT_LIST.filter(
  (item) => item.key !== "mixed",
);

export const VOICE_TONE_PRESETS: Record<VoiceToneKey, VoiceToneDefinition> = {
  authoritative: {
    key: "authoritative",
    label: "Authoritative",
    description: "Deep, grounded, commanding presence",
    deliveryDirective: "Maintain a measured, grounded, authoritative vocal tone.",
  },
  warm: {
    key: "warm",
    label: "Warm",
    description: "Conversational, steady, approachable",
    deliveryDirective: "Maintain an attentive, warm yet rigorous conversational tone.",
  },
  crisp: {
    key: "crisp",
    label: "Crisp",
    description: "Fast, concise, high-clarity",
    deliveryDirective: "Maintain a brisk, crisp, concise vocal pace with zero filler.",
  },
};

export const VOICE_TONE_LIST: VoiceToneDefinition[] = [
  VOICE_TONE_PRESETS.authoritative,
  VOICE_TONE_PRESETS.warm,
  VOICE_TONE_PRESETS.crisp,
];

export function isAccentKey(value: unknown): value is AccentKey {
  return (
    value === "american" ||
    value === "british" ||
    value === "australian" ||
    value === "irish" ||
    value === "indian" ||
    value === "mixed"
  );
}

export function isVoiceToneKey(value: unknown): value is VoiceToneKey {
  return (
    value === "authoritative" || value === "warm" || value === "crisp"
  );
}

export function normalizeAccent(value: unknown): AccentKey {
  return isAccentKey(value) ? value : DEFAULT_ACCENT;
}

export function normalizeVoiceTone(value: unknown): VoiceToneKey {
  return isVoiceToneKey(value) ? value : DEFAULT_VOICE_TONE;
}

const VOICE_ACCENT_TAG_REGEX =
  /\[VoiceAccent:\s*(american|british|australian|irish|indian|mixed)\]/i;
const VOICE_TONE_TAG_REGEX =
  /\[VoiceTone:\s*(authoritative|warm|crisp)\]/i;
const SEAT_ACCENTS_TAG_REGEX = /\[SeatAccents:\s*([^\]]+)\]/i;
const ANY_VOICE_TAG_REGEX =
  /(?:^|\n)\[(?:VoiceAccent|VoiceTone|SeatAccents):[^\]]*\]/gi;

export function formatVoiceProfileTags(params: {
  accent?: AccentKey | null;
  voiceTone?: VoiceToneKey | null;
  seatAccents?: Record<number, AccentKey>;
}): string {
  const parts: string[] = [];
  if (params.accent && isAccentKey(params.accent)) {
    parts.push(`[VoiceAccent: ${params.accent}]`);
  }
  if (params.voiceTone && isVoiceToneKey(params.voiceTone)) {
    parts.push(`[VoiceTone: ${params.voiceTone}]`);
  }
  if (params.seatAccents) {
    const entries = Object.entries(params.seatAccents)
      .filter(
        ([idx, acc]) =>
          /^\d+$/.test(idx) && isAccentKey(acc) && acc !== "mixed",
      )
      .map(([idx, acc]) => `${idx}=${acc}`);
    if (entries.length > 0) {
      parts.push(`[SeatAccents: ${entries.join(",")}]`);
    }
  }
  return parts.join("\n");
}

export function stripVoiceProfileTags(roomContext?: string | null): string {
  if (!roomContext) return "";
  return roomContext.replace(ANY_VOICE_TAG_REGEX, "").trim();
}

export function extractVoiceProfileFromContext(
  roomContext?: string | null,
): {
  accent: AccentKey;
  voiceTone: VoiceToneKey;
  seatAccents: Record<number, AccentKey>;
  hasExplicitProfile: boolean;
} {
  if (!roomContext) {
    return {
      accent: DEFAULT_ACCENT,
      voiceTone: DEFAULT_VOICE_TONE,
      seatAccents: {},
      hasExplicitProfile: false,
    };
  }

  const accentMatch = roomContext.match(VOICE_ACCENT_TAG_REGEX);
  const toneMatch = roomContext.match(VOICE_TONE_TAG_REGEX);
  const seatsMatch = roomContext.match(SEAT_ACCENTS_TAG_REGEX);

  const seatAccents: Record<number, AccentKey> = {};
  if (seatsMatch?.[1]) {
    for (const pair of seatsMatch[1].split(",")) {
      const [rawIdx, rawAcc] = pair.split("=").map((s) => s.trim());
      const idx = Number(rawIdx);
      if (Number.isInteger(idx) && idx >= 0 && isAccentKey(rawAcc)) {
        seatAccents[idx] = rawAcc;
      }
    }
  }

  return {
    accent: accentMatch?.[1]
      ? normalizeAccent(accentMatch[1].toLowerCase())
      : DEFAULT_ACCENT,
    voiceTone: toneMatch?.[1]
      ? normalizeVoiceTone(toneMatch[1].toLowerCase())
      : DEFAULT_VOICE_TONE,
    seatAccents,
    hasExplicitProfile: Boolean(
      accentMatch || toneMatch || Object.keys(seatAccents).length > 0,
    ),
  };
}

const MIXED_ROTATION: ConcreteAccentKey[] = [
  "british",
  "american",
  "australian",
  "irish",
];

export function resolveEffectiveSeatAccent(params: {
  seatOrder?: number;
  seatAccent?: AccentKey | null;
  globalAccent?: AccentKey | null;
  roomContext?: string | null;
}): ConcreteAccentKey {
  const fromContext = extractVoiceProfileFromContext(params.roomContext);
  const seatIndex = typeof params.seatOrder === "number" ? params.seatOrder : 0;

  const explicitSeat =
    params.seatAccent && isAccentKey(params.seatAccent) && params.seatAccent !== "mixed"
      ? params.seatAccent
      : fromContext.seatAccents[seatIndex] &&
          fromContext.seatAccents[seatIndex] !== "mixed"
        ? fromContext.seatAccents[seatIndex]
        : null;

  if (explicitSeat) {
    return explicitSeat;
  }

  const chosen =
    params.globalAccent && isAccentKey(params.globalAccent)
      ? params.globalAccent
      : fromContext.accent;

  if (chosen === "mixed") {
    return MIXED_ROTATION[Math.abs(seatIndex) % MIXED_ROTATION.length];
  }
  return chosen;
}

const US_MODELS_BY_TONE: Record<VoiceToneKey, Record<ArchetypeKey, string>> = {
  authoritative: {
    skeptic: "aura-2-zeus-en",
    nitpicker: "aura-2-hera-en",
    so_what: "aura-2-orion-en",
    timekeeper: "aura-2-arcas-en",
    ally: "aura-2-apollo-en",
  },
  warm: {
    skeptic: "aura-2-apollo-en",
    nitpicker: "aura-2-helena-en",
    so_what: "aura-2-mars-en",
    timekeeper: "aura-2-arcas-en",
    ally: "aura-2-thalia-en",
  },
  crisp: {
    skeptic: "aura-2-athena-en",
    nitpicker: "aura-2-luna-en",
    so_what: "aura-2-hermes-en",
    timekeeper: "aura-2-orion-en",
    ally: "aura-2-vesta-en",
  },
};

export interface DeepgramVoiceResolution {
  /** Primary Deepgram model ID safe for /v1/speak streaming WebSockets. */
  v1Model: string;
  /** Preferred REST model ID (uses Flux /v2/speak when indian is selected). */
  previewEndpoint: "v1" | "v2";
  previewModel: string;
  effectiveAccent: ConcreteAccentKey;
}

function prefersFemaleVoice(
  archetype: ArchetypeKey,
  voiceTone: VoiceToneKey,
  seatOrder: number,
): boolean {
  if (archetype === "nitpicker") return true;
  if (archetype === "ally" && voiceTone === "crisp") return true;
  if (archetype === "skeptic" && voiceTone === "crisp") return true;
  return seatOrder % 2 === 1;
}

export function resolveDeepgramVoiceModel(params: {
  archetype: ArchetypeKey;
  seatOrder?: number;
  seatAccent?: AccentKey | null;
  accent?: AccentKey | null;
  voiceTone?: VoiceToneKey | null;
  roomContext?: string | null;
}): DeepgramVoiceResolution {
  const ctx = extractVoiceProfileFromContext(params.roomContext);
  const seatOrder = typeof params.seatOrder === "number" ? params.seatOrder : 0;
  const voiceTone =
    params.voiceTone && isVoiceToneKey(params.voiceTone)
      ? params.voiceTone
      : ctx.voiceTone;
  const effectiveAccent = resolveEffectiveSeatAccent({
    seatOrder,
    seatAccent: params.seatAccent,
    globalAccent: params.accent,
    roomContext: params.roomContext,
  });

  const usFallback = US_MODELS_BY_TONE[voiceTone][params.archetype] ?? "aura-2-zeus-en";
  const female = prefersFemaleVoice(params.archetype, voiceTone, seatOrder);

  switch (effectiveAccent) {
    case "british": {
      const ukModel = female ? "aura-2-pandora-en" : "aura-2-draco-en";
      return {
        v1Model: ukModel,
        previewEndpoint: "v1",
        previewModel: ukModel,
        effectiveAccent,
      };
    }
    case "australian": {
      const auModel = female ? "aura-2-theia-en" : "aura-2-hyperion-en";
      return {
        v1Model: auModel,
        previewEndpoint: "v1",
        previewModel: auModel,
        effectiveAccent,
      };
    }
    case "irish": {
      return {
        v1Model: "aura-angus-en",
        previewEndpoint: "v1",
        previewModel: "aura-angus-en",
        effectiveAccent,
      };
    }
    case "indian": {
      const fluxModel = female ? "flux-meena-en" : "flux-naveen-en";
      return {
        // Streaming /v1/speak WS falls back cleanly to US Aura-2; preview & Live Voice use native Flux/Live
        v1Model: usFallback,
        previewEndpoint: "v2",
        previewModel: fluxModel,
        effectiveAccent,
      };
    }
    case "american":
    default:
      return {
        v1Model: usFallback,
        previewEndpoint: "v1",
        previewModel: usFallback,
        effectiveAccent: "american",
      };
  }
}

const GEMINI_LIVE_BY_TONE: Record<VoiceToneKey, Record<ArchetypeKey, string>> = {
  authoritative: {
    skeptic: "Kore",
    nitpicker: "Charon",
    so_what: "Fenrir",
    timekeeper: "Charon",
    ally: "Aoede",
  },
  warm: {
    skeptic: "Aoede",
    nitpicker: "Kore",
    so_what: "Puck",
    timekeeper: "Aoede",
    ally: "Aoede",
  },
  crisp: {
    skeptic: "Puck",
    nitpicker: "Kore",
    so_what: "Charon",
    timekeeper: "Puck",
    ally: "Kore",
  },
};

export function resolveGeminiLiveVoice(params: {
  archetype: ArchetypeKey;
  voiceTone?: VoiceToneKey | null;
  roomContext?: string | null;
  fallbackMap?: Record<ArchetypeKey, string>;
}): string {
  const ctx = extractVoiceProfileFromContext(params.roomContext);
  const hasExplicitTone =
    Boolean(params.voiceTone && isVoiceToneKey(params.voiceTone)) ||
    Boolean(params.roomContext && VOICE_TONE_TAG_REGEX.test(params.roomContext));

  if (!hasExplicitTone && params.fallbackMap?.[params.archetype]) {
    return params.fallbackMap[params.archetype];
  }

  const tone =
    params.voiceTone && isVoiceToneKey(params.voiceTone)
      ? params.voiceTone
      : ctx.voiceTone;
  return GEMINI_LIVE_BY_TONE[tone][params.archetype] ?? "Kore";
}

export function buildLiveAccentDirective(
  roomContext?: string | null,
  seatOrder = 0,
): string {
  const profile = extractVoiceProfileFromContext(roomContext);
  if (!profile.hasExplicitProfile) return "";

  const effectiveAccent = resolveEffectiveSeatAccent({
    seatOrder,
    roomContext,
  });
  const accentDef = ACCENT_PRESETS[effectiveAccent];
  const toneDef = VOICE_TONE_PRESETS[profile.voiceTone];

  return [
    "# SPOKEN ACCENT & DELIVERY",
    `- ${accentDef.liveDirective}`,
    `- ${toneDef.deliveryDirective}`,
  ].join("\n");
}
