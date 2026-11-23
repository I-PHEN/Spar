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
  test("locks the Spar brand accent to Electric Volt (#C6FF3D)", () => {
    expect(DEFAULT_ACCENT_THEME).toBe("default");
    expect(ACCENT_THEME_LIST.map((t) => t.key)).toEqual(["default"]);
    expect(ACCENT_THEMES.default.swatch).toBe("#C6FF3D");
    expect(ACCENT_THEMES.default.dark).toBe("#6B8E1A");
  });

  test("normalizes legacy or arbitrary accent keys back to default Electric Volt", () => {
    expect(isAccentThemeKey("default")).toBe(true);
    expect(isAccentThemeKey("blue")).toBe(false);
    expect(normalizeAccentTheme("blue")).toBe("default");
    expect(normalizeAccentTheme("pink")).toBe("default");
    expect(normalizeAccentTheme(undefined)).toBe("default");
    expect(applyAccentTheme("orange")).toBe("default");
  });
});
