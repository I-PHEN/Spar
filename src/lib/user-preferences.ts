import {
  DEFAULT_ACCENT_THEME,
  isAccentThemeKey,
  type AccentThemeKey,
} from "./accent-themes";
import {
  DEFAULT_ACCENT,
  DEFAULT_VOICE_TONE,
  isAccentKey,
  isVoiceToneKey,
  type AccentKey,
  type VoiceToneKey,
} from "./voice-accents";

export const USER_PREFERENCES_STORAGE_KEY = "spar:user-preferences:v1";
export const LAST_CONFIG_STORAGE_KEY = "spar:last-config";

export type PrimaryTrackKey = "debate" | "pitch" | "academic" | "interview";
export type DefaultDomainKey = "sparring" | "commercial" | "academic" | "interview";
export type PanelIntensityKey = "gentle" | "moderate" | "aggressive";
export type DefaultModeKey = "open_spar" | "drill";

export interface UserPreferences {
  primaryTrack?: PrimaryTrackKey;
  defaultDomain?: DefaultDomainKey;
  panelIntensity?: PanelIntensityKey;
  defaultMode?: DefaultModeKey;
  accentColor?: AccentThemeKey;
  defaultAccent?: AccentKey;
  voiceTone?: VoiceToneKey;
  autoMicEnabled?: boolean;
  buzzerSoundEnabled?: boolean;
}

export const DEFAULT_USER_PREFERENCES: Required<UserPreferences> = {
  primaryTrack: "debate",
  defaultDomain: "sparring",
  panelIntensity: "moderate",
  defaultMode: "open_spar",
  accentColor: DEFAULT_ACCENT_THEME,
  defaultAccent: DEFAULT_ACCENT,
  voiceTone: DEFAULT_VOICE_TONE,
  autoMicEnabled: true,
  buzzerSoundEnabled: true,
};

export function derivePrimaryTrackFromDomain(
  domain: DefaultDomainKey,
): PrimaryTrackKey {
  switch (domain) {
    case "commercial":
      return "pitch";
    case "academic":
      return "academic";
    case "interview":
      return "interview";
    case "sparring":
    default:
      return "debate";
  }
}

export function intensityNumberFromBehavior(
  style?: string | null,
): 1 | 2 | 3 {
  if (style === "gentle") return 1;
  if (style === "aggressive") return 3;
  return 2;
}

export function parseUserPreferences(
  raw: string | null | undefined,
): Required<UserPreferences> {
  if (!raw) return { ...DEFAULT_USER_PREFERENCES };
  try {
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    const defaultDomain: DefaultDomainKey =
      parsed.defaultDomain === "sparring" ||
      parsed.defaultDomain === "commercial" ||
      parsed.defaultDomain === "academic" ||
      parsed.defaultDomain === "interview"
        ? parsed.defaultDomain
        : DEFAULT_USER_PREFERENCES.defaultDomain;

    return {
      primaryTrack:
        parsed.primaryTrack === "debate" ||
        parsed.primaryTrack === "pitch" ||
        parsed.primaryTrack === "academic" ||
        parsed.primaryTrack === "interview"
          ? parsed.primaryTrack
          : derivePrimaryTrackFromDomain(defaultDomain),
      defaultDomain,
      panelIntensity:
        parsed.panelIntensity === "gentle" ||
        parsed.panelIntensity === "moderate" ||
        parsed.panelIntensity === "aggressive"
          ? parsed.panelIntensity
          : DEFAULT_USER_PREFERENCES.panelIntensity,
      defaultMode:
        parsed.defaultMode === "open_spar" || parsed.defaultMode === "drill"
          ? parsed.defaultMode
          : DEFAULT_USER_PREFERENCES.defaultMode,
      accentColor: DEFAULT_USER_PREFERENCES.accentColor,
      defaultAccent: isAccentKey(parsed.defaultAccent)
        ? parsed.defaultAccent
        : DEFAULT_USER_PREFERENCES.defaultAccent,
      voiceTone: isVoiceToneKey(parsed.voiceTone)
        ? parsed.voiceTone
        : DEFAULT_USER_PREFERENCES.voiceTone,
      autoMicEnabled:
        typeof parsed.autoMicEnabled === "boolean"
          ? parsed.autoMicEnabled
          : DEFAULT_USER_PREFERENCES.autoMicEnabled,
      buzzerSoundEnabled:
        typeof parsed.buzzerSoundEnabled === "boolean"
          ? parsed.buzzerSoundEnabled
          : DEFAULT_USER_PREFERENCES.buzzerSoundEnabled,
    };
  } catch {
    return { ...DEFAULT_USER_PREFERENCES };
  }
}

export function readStoredUserPreferences(): Required<UserPreferences> {
  if (typeof window === "undefined") {
    return { ...DEFAULT_USER_PREFERENCES };
  }
  try {
    return parseUserPreferences(
      window.localStorage.getItem(USER_PREFERENCES_STORAGE_KEY),
    );
  } catch {
    return { ...DEFAULT_USER_PREFERENCES };
  }
}

export function writeStoredUserPreferences(
  prefs: Partial<UserPreferences>,
): Required<UserPreferences> {
  const normalized = parseUserPreferences(
    JSON.stringify({ ...DEFAULT_USER_PREFERENCES, ...prefs }),
  );
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        USER_PREFERENCES_STORAGE_KEY,
        JSON.stringify(normalized),
      );
    } catch {
      // Ignore private browsing storage failures
    }
  }
  return normalized;
}

export function syncLastConfigFromPreferences(
  prefs: Required<UserPreferences>,
): void {
  if (typeof window === "undefined") return;
  try {
    const rawLast = window.localStorage.getItem(LAST_CONFIG_STORAGE_KEY);
    const parsedLast = rawLast ? JSON.parse(rawLast) : {};
    const targetIntensity = intensityNumberFromBehavior(prefs.panelIntensity);

    const existingSeats =
      Array.isArray(parsedLast?.seats) && parsedLast.seats.length > 0
        ? parsedLast.seats.map(
            (seat: Record<string, unknown>) => ({
              ...seat,
              intensity: targetIntensity,
              behaviorStyle: prefs.panelIntensity,
            }),
          )
        : [
            {
              archetype: "skeptic",
              name: "Ada",
              intensity: targetIntensity,
              behaviorStyle: prefs.panelIntensity,
              filled: true,
            },
          ];

    window.localStorage.setItem(
      LAST_CONFIG_STORAGE_KEY,
      JSON.stringify({
        experience: prefs.defaultMode,
        drillTarget: parsedLast?.drillTarget || "hedging",
        hasMaterial:
          typeof parsedLast?.hasMaterial === "boolean"
            ? parsedLast.hasMaterial
            : true,
        seats: existingSeats,
      }),
    );
  } catch {
    // Ignore malformed storage
  }
}
