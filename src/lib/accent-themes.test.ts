import { describe, expect, test } from "bun:test";
import {
  ACCENT_THEMES,
  ACCENT_THEME_LIST,
  DEFAULT_ACCENT_THEME,
  applyAccentTheme,
  isAccentThemeKey,
  normalizeAccentTheme,
} from "./accent-themes";

describe("accent-themes", () => {
  test("defines Default Mono plus Blue, Green, Yellow, Pink, and Orange", () => {
    expect(DEFAULT_ACCENT_THEME).toBe("default");
    expect(ACCENT_THEME_LIST.map((t) => t.key)).toEqual([
      "default",
      "blue",
      "green",
      "yellow",
      "pink",
      "orange",
    ]);
    expect(ACCENT_THEMES.default.swatch).toBe("#F4F4F5");
    expect(ACCENT_THEMES.blue.swatch).toBe("#2F65F6");
    expect(ACCENT_THEMES.green.swatch).toBe("#22C55E");
    expect(ACCENT_THEMES.yellow.swatch).toBe("#EAB308");
    expect(ACCENT_THEMES.pink.swatch).toBe("#EC4899");
    expect(ACCENT_THEMES.orange.swatch).toBe("#F97316");
  });

  test("validates and normalizes unknown accent values to default", () => {
    expect(isAccentThemeKey("green")).toBe(true);
    expect(isAccentThemeKey("neon-purple")).toBe(false);
    expect(normalizeAccentTheme("pink")).toBe("pink");
    expect(normalizeAccentTheme("invalid")).toBe("default");
    expect(normalizeAccentTheme(undefined)).toBe("default");
    expect(applyAccentTheme("orange")).toBe("orange");
  });
});
