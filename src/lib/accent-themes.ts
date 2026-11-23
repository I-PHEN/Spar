export type AccentThemeKey = "default";

export interface AccentThemeDefinition {
  key: AccentThemeKey;
  label: string;
  swatch: string;
  hover: string;
  dark: string;
  soft: string;
  text: string;
  foreground: string;
}

export const DEFAULT_ACCENT_THEME: AccentThemeKey = "default";

export const ACCENT_THEMES: Record<AccentThemeKey, AccentThemeDefinition> = {
  default: {
    key: "default",
    label: "Electric Volt",
    swatch: "#C6FF3D",
    hover: "#D4FF66",
    dark: "#6B8E1A",
    soft: "rgba(198, 255, 61, 0.14)",
    text: "#C6FF3D",
    foreground: "#0B0D06",
  },
};

export const ACCENT_THEME_LIST: AccentThemeDefinition[] = [
  ACCENT_THEMES.default,
];

export function isAccentThemeKey(value: unknown): value is AccentThemeKey {
  return value === "default";
}

export function normalizeAccentTheme(_value: unknown): AccentThemeKey {
  return DEFAULT_ACCENT_THEME;
}

export function applyAccentTheme(_value?: unknown): AccentThemeKey {
  if (typeof document !== "undefined") {
    document.documentElement.removeAttribute("data-accent");
  }
  return DEFAULT_ACCENT_THEME;
}
