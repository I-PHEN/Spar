import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeView, SessionHistoryCard, StatCard, groupSessionsByDate } from "./home-view";

const session = {
  id: "s1",
  scenario: "open_spar",
  materialTitle: "Machine learning",
  createdAt: new Date("2026-10-20T10:00:00Z").toISOString(),
  personas: [
    { name: "Ada", archetype: "skeptic" },
    { name: "Chiara", archetype: "so_what" },
  ],
  summary: { oneThingToPractice: "Answer the question asked, then stop." },
};

describe("SessionHistoryCard", () => {
  test("renders topic header, mode label, panelists, takeaway, outcome badge, and whole-row button", () => {
    const m = renderToStaticMarkup(
      <SessionHistoryCard session={session} onOpenDebrief={() => {}} />,
    );
    expect(m).toContain("Machine learning"); // topic header
    expect(m).toContain("Q&amp;A"); // mode chip resolves the experience key
    expect(m).toContain("Ada");
    expect(m).toContain("Chiara");
    expect(m).toContain("Answer the question asked, then stop.");
    expect(m).not.toContain("Read debrief"); // replaced by whole-row click
    expect(m).toContain('role="button"');
    expect(m).toContain('tabindex="0"');
    expect(m).toContain("Debriefed"); // outcome indicator badge
  });

  test("deduplicates repeated panelist names in panel display and initials avatar", () => {
    const m = renderToStaticMarkup(
      <SessionHistoryCard
        session={{
          ...session,
          personas: [
            { name: "Ada", archetype: "skeptic" },
            { name: "Ada", archetype: "nitpicker" },
            { name: "Priya", archetype: "ally" },
          ],
        }}
        onOpenDebrief={() => {}}
      />,
    );
    expect(m).toContain("Ada · Priya");
    expect(m).not.toContain("Ada · Ada");
  });

  test("suppresses generic fallback practice tips", () => {
    const m = renderToStaticMarkup(
      <SessionHistoryCard
        session={{
          ...session,
          summary: { oneThingToPractice: "Keep sparring. Your baseline is solid." },
        }}
        onOpenDebrief={() => {}}
      />,
    );
    expect(m).not.toContain("Keep sparring");
    expect(m).not.toContain("Practice:");
  });

  test("renders score outcome badge when skills telemetry is present", () => {
    const m = renderToStaticMarkup(
      <SessionHistoryCard
        session={{
          ...session,
          skills: { clarity: 80, recovery: 90, concision: 85, presence: 85, evidence: 85 },
        }}
        onOpenDebrief={() => {}}
      />,
    );
    expect(m).toContain("85");
    expect(m).toContain("pts");
  });

  test("a session without a debrief renders incomplete badge and omits practice line", () => {
    const m = renderToStaticMarkup(
      <SessionHistoryCard
        session={{ ...session, summary: null }}
        onOpenDebrief={() => {}}
      />,
    );
    expect(m).toContain("Incomplete");
    expect(m).not.toContain("Practice:");
    expect(m).not.toContain("Read debrief");
  });
});

describe("HomeView", () => {
  const markup = renderToStaticMarkup(
    <HomeView userName="Michael" onEnterSparringRoom={() => {}} onOpenDebrief={() => {}} />,
  );

  test("primary CTA reads truthfully", () => {
    expect(markup).toContain("New session");
    expect(markup).not.toContain(">Enter the Sparring Room<");
  });

  test("home view body is calm and action-oriented without heavy stats row", () => {
    expect(markup).not.toContain("Total sessions");
    expect(markup).not.toContain("Sessions this week");
  });

  test("header includes executive command title, username, and calm tagline without duplicate CTA", () => {
    expect(markup).toContain("Executive Command");
    expect(markup).toContain("Michael.");
    expect(markup).toContain("Sharpen your instincts against adversarial panels.");
    expect(markup).not.toContain("Set preparation target");
  });
});

describe("StatCard", () => {
  test("renders label, value, and optional sub-metric", () => {
    const m = renderToStaticMarkup(
      <StatCard
        icon={<span>*</span>}
        label="Current streak"
        value="5d"
        sub="top 10%"
      />,
    );
    expect(m).toContain("Current streak");
    expect(m).toContain("5d");
    expect(m).toContain("top 10%");
  });
});

describe("groupSessionsByDate", () => {
  test("buckets sessions into Today, This week, and Earlier categories", () => {
    const now = new Date();
    const todayIso = now.toISOString();
    const threeDaysAgoIso = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const twoWeeksAgoIso = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const sampleSessions = [
      { ...session, id: "s-today", createdAt: todayIso },
      { ...session, id: "s-week", createdAt: threeDaysAgoIso },
      { ...session, id: "s-earlier", createdAt: twoWeeksAgoIso },
    ];

    const groups = groupSessionsByDate(sampleSessions);
    expect(groups.length).toBe(3);
    expect(groups[0].group).toBe("Today");
    expect(groups[0].sessions[0].id).toBe("s-today");
    expect(groups[1].group).toBe("This week");
    expect(groups[1].sessions[0].id).toBe("s-week");
    expect(groups[2].group).toBe("Earlier");
    expect(groups[2].sessions[0].id).toBe("s-earlier");
  });
});
