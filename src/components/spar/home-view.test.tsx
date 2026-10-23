import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeView, SessionHistoryCard, StatCard } from "./home-view";

const session = {
  id: "s1",
  scenario: "open_spar",
  createdAt: new Date("2026-10-20T10:00:00Z").toISOString(),
  personas: [
    { name: "Ada", archetype: "skeptic" },
    { name: "Chiara", archetype: "so_what" },
  ],
  summary: { oneThingToPractice: "Answer the question asked, then stop." },
};

describe("SessionHistoryCard", () => {
  test("renders mode label, panelists, takeaway, and a debrief link", () => {
    const m = renderToStaticMarkup(
      <SessionHistoryCard session={session} onOpenDebrief={() => {}} />,
    );
    expect(m).toContain("Q&amp;A"); // mode chip resolves the experience key
    expect(m).toContain("Ada");
    expect(m).toContain("Chiara");
    expect(m).toContain("Answer the question asked, then stop.");
    expect(m).toContain("Read debrief");
  });

  test("a session without a debrief says so honestly", () => {
    const m = renderToStaticMarkup(
      <SessionHistoryCard
        session={{ ...session, summary: null }}
        onOpenDebrief={() => {}}
      />,
    );
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

  test("stats row includes total sessions", () => {
    expect(markup).toContain("Total sessions");
  });

  test("header includes executive command title and username", () => {
    expect(markup).toContain("Executive Command");
    expect(markup).toContain("Michael.");
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
