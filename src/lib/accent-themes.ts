export type AccentThemeKey =
  | "default"
  | "blue"
  | "green"
  | "yellow"
  | "pink"
  | "orange";

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
    label: "Default",
    swatch: "#F4F4F5",
    hover: "#FFFFFF",
    dark: "#D4D4D8",
    soft: "rgba(244, 244, 245, 0.12)",
    text: "#F4F4F5",
    foreground: "#111113",
  },
  blue: {
    key: "blue",
    label: "Blue",
    swatch: "#2F65F6",
    hover: "#2555D9",
    dark: "#1E40AF",
    soft: "rgba(47, 101, 246, 0.14)",
    text: "#9AB5FF",
    foreground: "#FFFFFF",
  },
  green: {
    key: "green",
    label: "Green",
    swatch: "#22C55E",
    hover: "#16A34A",
    dark: "#15803D",
    soft: "rgba(34, 197, 94, 0.14)",
    text: "#86EFAC",
    foreground: "#091910",
  },
  yellow: {
    key: "yellow",
    label: "Yellow",
    swatch: "#EAB308",
    hover: "#CA8A04",
    dark: "#A16207",
    soft: "rgba(234, 179, 8, 0.15)",
    text: "#FDE047",
    foreground: "#111113",
  },
  pink: {
    key: "pink",
    label: "Pink",
    swatch: "#EC4899",
    hover: "#DB2777",
    dark: "#BE185D",
    soft: "rgba(236, 72, 153, 0.14)",
    text: "#F9A8D4",
    foreground: "#FFFFFF",
  },
  orange: {
    key: "orange",
    label: "Orange",
    swatch: "#F97316",
    hover: "#EA580C",
    dark: "#C2410C",
    soft: "rgba(249, 115, 22, 0.14)",
    text: "#FDBA74",
    foreground: "#111113",
  },
};

export const ACCENT_THEME_LIST: AccentThemeDefinition[] = [
  ACCENT_THEMES.default,
  ACCENT_THEMES.blue,
  ACCENT_THEMES.green,
  ACCENT_THEMES.yellow,
  ACCENT_THEMES.pink,
  ACCENT_THEMES.orange,
];

export function isAccentThemeKey(value: unknown): value is AccentThemeKey {
  return (
    value === "default" ||
    value === "blue" ||
    value === "green" ||
    value === "yellow" ||
    value === "pink" ||
    value === "orange"
  );
}

export function normalizeAccentTheme(value: unknown): AccentThemeKey {
  return isAccentThemeKey(value) ? value : DEFAULT_ACCENT_THEME;
}

export function applyAccentTheme(value: unknown): AccentThemeKey {
  const normalized = normalizeAccentTheme(value);
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-accent", normalized);
  }
  return normalized;
}
