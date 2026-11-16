import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { PracticeView, SAMPLE_DEBATE_CASE } from "./practice-view";
import {
  ATTACK_ANGLE_LIST,
  DOMAIN_PRESET_LIST,
  STANCE_PRESET_LIST,
} from "@/lib/domains";

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
    // Q&A default — with the remembered-config fallback in front of it.
    expect(source).toContain('?? "open_spar"');
    expect(source).toContain('defaultSeatsFor("open_spar")');
    expect(source).toContain("addSeat"); // add-panelist affordance
  });
});

describe("PracticeView single screen", () => {
  const markup = renderToStaticMarkup(
    <PracticeView onSessionCreated={() => {}} onCancel={() => {}} />,
  );

  test("all sections render at once — no stepper", () => {
    expect(markup).toContain("What are you defending");
    expect(markup).toContain("How will you spar");
    expect(markup).toContain("Arrange your panel");
    expect(markup).toContain("Start Sparring");
    // The old stepper label does not render as a step chip.
    expect(markup).not.toContain(">Experience<");
  });

  test("both mode cards visible; drill chips hidden until Drill is picked", () => {
    expect(markup).toContain("Q&amp;A");
    expect(markup).toContain("Drill");
    expect(markup).not.toContain("What are you drilling");
  });

  test("room description is behind a disclosure, not shown by default", () => {
    expect(markup).toContain("More options");
    expect(markup).not.toContain("Describe the specific room");
  });

  test("panel shows the default panelist summary and the YOU visual", () => {
    expect(markup).toContain("YOU");
    expect(markup).toContain("Ada");
    expect(markup).toContain("Moderate");
    expect(markup).toContain("Add panelist");
  });

  test("sticky start bar exists without extra setup eyebrow", () => {
    const source = readFileSync(
      new URL("./practice-view.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("sticky");
    expect(source).not.toContain("SESSION SETUP");
  });
});

describe("practice aesthetic contract", () => {
  test("seat cards use crisp obsidian surfaces, role taglines, and wider layout without left accent stripes or oklch haze", () => {
    const markup = renderToStaticMarkup(
      <PracticeView onSessionCreated={() => {}} onCancel={() => {}} />,
    );
    expect(markup).toContain("max-w-3xl");
    expect(markup).toContain("Questions your core assumptions");
    expect(markup).not.toContain("border-l-[#2F65F6]");
    expect(markup).toContain("bg-[#16161D]");
    expect(markup).not.toContain("oklch(");

    const source = readFileSync(
      new URL("./practice-view.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("Custom room active");
    expect(source).not.toContain('setCustomRoom("")');
  });
});

describe("practice polish wave (user review 2)", () => {
  const markup = renderToStaticMarkup(
    <PracticeView onSessionCreated={() => {}} onCancel={() => {}} />,
  );

  test("mode cards use the short taglines — balanced cards", () => {
    expect(markup).toContain("Hammer one weakness until it&#x27;s fixed");
  });

  test("topic box has example chips", () => {
    const source = readFileSync(
      new URL("./practice-view.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("TOPIC_EXAMPLES");
  });

  test("add-panelist opens the editor directly on the new seat", () => {
    const source = readFileSync(
      new URL("./practice-view.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("onEditSeat(next.length - 1)");
  });

  test("config persists between visits + Ctrl+Enter starts", () => {
    const source = readFileSync(
      new URL("./practice-view.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("spar:last-config");
    expect(source).toContain("ctrlKey");
    expect(source).toContain("Ctrl");
  });

  test("renders upload bar on default view and moves secondary controls into More options", () => {
    expect(markup).toContain("Attach File");
    expect(markup).toContain("More options");
    expect(markup).not.toContain("Subject domain");

    const source = readFileSync(
      new URL("./practice-view.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("MoreOptionsSection");
    expect(source).toContain("Subject domain");
    expect(source).toContain("DOMAIN_PRESET_LIST");
    const domainLabels = DOMAIN_PRESET_LIST.map((d) => d.shortLabel);
    expect(domainLabels).toContain("Academic");
    expect(domainLabels).toContain("Interview");
    expect(domainLabels).toContain("Commercial");
    expect(domainLabels).toContain("Debate");
  });

  test("renders 1-click sample debate case loader and debater starter motions", () => {
    expect(markup).toContain("Load sample debate case");
    expect(SAMPLE_DEBATE_CASE.hotspots.length).toBe(3);
    expect(SAMPLE_DEBATE_CASE.domain).toBe("sparring");

    const source = readFileSync(
      new URL("./practice-view.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("Debate Motion —");
    expect(source).toContain("Policy Debate —");
  });

  test("moves secondary stance and panel focus controls behind More options without duplicate custom rule inputs", () => {
    expect(markup).not.toContain("Your Stance");
    expect(markup).not.toContain("Your stance");
    expect(markup).not.toContain("Panel focus");
    expect(markup).not.toContain("Causal Links &amp; Logic");
    expect(markup).not.toContain("Quick Custom Rule");

    const source = readFileSync(
      new URL("./practice-view.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("Your stance");
    expect(source).toContain("Panel focus");
    expect(source).toContain("STANCE_PRESET_LIST");
    expect(source).toContain("ATTACK_ANGLE_LIST");
    const stanceLabels = STANCE_PRESET_LIST.map((s) => s.shortLabel);
    expect(stanceLabels).toContain("Defending (Prop)");
    expect(stanceLabels).toContain("Opposing (Opp)");
    const angleLabels = ATTACK_ANGLE_LIST.map((a) => a.label);
    expect(angleLabels).toContain("Causal Links & Logic");
    expect(source).toContain("Drill Strictness");
    expect(source).not.toContain("quick-custom-rule");
  });

  test("supports Reset to defaults and voice tone wiring without regional accent UI", () => {
    expect(markup).toContain("Reset to defaults");

    const source = readFileSync(
      new URL("./practice-view.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("handleResetDefaults");
    expect(source).not.toContain("Voice Accent");
    expect(source).toContain("voiceTone: prefs.voiceTone");
  });
});
