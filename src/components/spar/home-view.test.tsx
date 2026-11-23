import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
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

  test("renders discrete Fight Night tactile cards with solid fighter medallions and Volt badges (no emerald green)", () => {
    const m = renderToStaticMarkup(
      <SessionHistoryCard
        session={{
          ...session,
          skills: { clarity: 60, recovery: 60, concision: 60, presence: 60, evidence: 60 },
        }}
        onOpenDebrief={() => {}}
      />,
    );
    expect(m).toContain("spar-stat-tile");
    expect(m).toContain("spar-chunky-card-interactive");
    expect(m).toContain("oklch(0.72 0.19 250)"); // Solid Ada medallion accent
    expect(m).toContain("#C6FF3D"); // Electric Volt score pill >= 60
    expect(m).not.toContain("emerald-"); // Zero generic SaaS emerald green

    const lowScore = renderToStaticMarkup(
      <SessionHistoryCard
        session={{
          ...session,
          skills: { clarity: 40, recovery: 40, concision: 40, presence: 40, evidence: 40 },
        }}
        onOpenDebrief={() => {}}
      />,
    );
    expect(lowScore).toContain("#FF5A1F"); // Arena Ember warning pill < 50
  });

  test("renders discreet delete button outside the card debrief button when onDelete is provided", () => {
    const m = renderToStaticMarkup(
      <SessionHistoryCard
        session={session}
        onOpenDebrief={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(m).toContain('aria-label="Delete session Machine learning"');
    const roleButtonIndex = m.indexOf('role="button"');
    const deleteButtonIndex = m.indexOf('aria-label="Delete session Machine learning"');
    expect(roleButtonIndex).toBeGreaterThan(-1);
    expect(deleteButtonIndex).toBeGreaterThan(roleButtonIndex);
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

  test("renders 3-metric workspace bar without wireframe header line or Ada card", () => {
    expect(markup).toContain("Sessions this week");
    expect(markup).toContain("Current streak");
    expect(markup).toContain("Top skill");
    expect(markup).not.toContain("Across the table");
    expect(markup).not.toContain(">Ada<");
  });

  test("header includes time-of-day greeting, username, and calm action without wireframe border or AI branding", () => {
    expect(markup).not.toContain("Executive Command");
    expect(markup).toContain("Michael.");
    expect(markup).not.toContain("Sharpen your instincts against adversarial panels.");
    expect(markup).not.toContain("Set preparation target");
    expect(markup).toContain("Start setup");
    expect(markup).not.toContain("Start first session");
  });

  test("omits Today's Focus and WhatsApp clutter on minimal Home", () => {
    expect(markup).not.toContain("Early Testers Community");
    expect(markup).not.toContain("Today&#x27;s Focus");
    expect(markup).not.toContain("border-l-[#2F65F6]");
  });

  test("omits redundant beta WhatsApp banner above session card on minimal Home", () => {
    expect(markup).not.toContain("Join WhatsApp");
    expect(markup).not.toContain("Dismiss beta WhatsApp banner");
    expect(markup).not.toContain("Join the Spar WhatsApp group");
  });

  test("includes quick timeframe pills and equal-height launcher without mode toggle or repeat clutter", () => {
    expect(markup).toContain("max-w-5xl");
    expect(markup).toContain("items-stretch");
    expect(markup).toContain("In 3 days");
    expect(markup).toContain("In 1 week");
    expect(markup).toContain("In 2 weeks");
    expect(markup).not.toContain('aria-label="Session mode"');
    expect(markup).not.toContain("Repeat last");

    const source = readFileSync(
      new URL("./home-view.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("Once you finish a round");
    expect(source).toContain("sessions.slice(0, 5)");
    expect(source).toContain("CardFooter");
    expect(source).not.toContain("CardFrame");
    expect(source).not.toContain("MagicCard");
    expect(source).not.toContain("Across the table");
    expect(source).not.toContain("Repeat last");
    expect(source).not.toContain("Email confirmation summary");
    expect(source).toContain("triggerMomentIcsDownload");
    expect(source).toContain("Add to calendar");
  });

  test("includes collapsible recent sessions header and clear action", () => {
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain("Recent sessions");
  });

  test("uses Flight Night chunky stat tiles and chunky recent ledger without card frames or gradients", () => {
    expect(markup).toContain("spar-stat-tile");
    expect(markup).toContain("spar-chunky-card");
    expect(markup).not.toContain('data-slot="card-frame"');
    expect(markup).not.toContain("radial-gradient");
    expect(markup).not.toContain("min-h-[224px]");
  });

  test("renders Fight Night Volt primary launcher card and Kwesi corner coach in header", () => {
    expect(markup).toContain("spar-chunky-card-volt");
    expect(markup).toContain("spar-volt-btn");
    expect(markup).toContain("kwesi-avatar");
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
