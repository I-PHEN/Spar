import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { PracticeView } from "./practice-view";

describe("PracticeView", () => {
  test("renders the first step without crashing", () => {
    const markup = renderToStaticMarkup(
      <PracticeView onSessionCreated={() => {}} onCancel={() => {}} />,
    );
    expect(markup.length).toBeGreaterThan(0);
  });

  test("picker and defaults wired to the visible allowlist", () => {
    const source = readFileSync(
      new URL("./practice-view.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("VISIBLE_EXPERIENCE_LIST.map"); // picker source
    // "VISIBLE_EXPERIENCE_LIST.map" contains "EXPERIENCE_LIST.map" as a
    // substring, so guard on the JSX-braced old picker usage instead.
    expect(source).not.toContain("{EXPERIENCE_LIST.map");
    expect(source).toContain('useState<ExperienceKey>("open_spar")');
    expect(source).toContain('defaultSeatsFor("open_spar")');
    expect(source).toContain("addSeat"); // add-panelist affordance
  });
});
