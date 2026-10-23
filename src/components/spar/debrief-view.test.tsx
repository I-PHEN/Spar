import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DebriefView,
  DebriefContent,
  YourAnswersSection,
  TelemetryInsight,
  DrillStat,
} from "./debrief-view";
import type { DebriefPayload, TelemetrySnapshot } from "@/lib/types";

const mockDebrief: DebriefPayload = {
  momentDescription: "When Chiara pressed on CAC payback, you hesitated then pivoted to brand equity.",
  presentationEvaluation: "Structured and composed opening thesis.",
  coachRead: "Sharp domain depth, but vulnerable on margins.",
  whatWentWell: [
    "Crisp problem framing in the opening 60 seconds",
    "Maintained eye contact and composure through interruptions",
  ],
  thePattern: "Deflection when challenged on unit economics.",
  oneThingToPractice: "Lead with the exact number before providing strategic context.",
  telemetryInsights: {
    pace: "Paced well at 34 words per turn.",
    fillers: "Clean delivery with only 2 hedges.",
    recovery: "Recovered decisively after the second interruption.",
    evidence: "Cited hard cohort metrics in 3 responses.",
  },
  shareableSummary: "Spar Debrief: Focused on CAC payback discipline and unit economics posture.",
};

const mockTelemetry: TelemetrySnapshot = {
  userTurns: 6,
  totalWords: 204,
  avgWordsPerResponse: 34,
  hedgeCount: 2,
  hedgesPerResponse: 0.33,
  avgResponseMs: 1200,
  deflections: 1,
  evidenceCitations: 3,
  turns: [],
};

const mockTranscript = [
  {
    role: "persona",
    personaName: "Chiara",
    content: "What is your blended payback period today?",
    type: "question",
    createdAt: "2026-10-22T20:00:00Z",
  },
  {
    role: "user",
    personaName: null,
    content: "Our blended payback is 14 months across core mid-market cohorts.",
    type: "answer",
    createdAt: "2026-10-22T20:00:15Z",
  },
];

const mockDrillStats = {
  target: "concision",
  label: "Concision Under Pressure",
  totalChallenges: 5,
  resolvedChallenges: 4,
  unresolvedChallenges: 1,
  attempt1Clean: 3,
  attempt2Clean: 1,
  attempt3Plus: 1,
  fastestRecovery: 1.2,
  slowestRecovery: 4.8,
  avgRecovery: 2.3,
  totalScore: 85,
  maxScore: 100,
};

describe("DebriefView loading state", () => {
  test("renders reviewing tape state on mount", () => {
    const markup = renderToStaticMarkup(
      <DebriefView
        sessionId="session-123"
        onBackHome={() => {}}
        onSparAgain={() => {}}
      />
    );
    expect(markup).toContain("reviewing the tape");
  });
});

describe("DebriefContent (Executive Coaching Dossier)", () => {
  test("renders dossier header, coach's notes, and key sections", () => {
    const markup = renderToStaticMarkup(
      <DebriefContent
        scenarioLabel="Series A Pitch"
        data={{
          debrief: mockDebrief,
          telemetry: mockTelemetry,
          transcript: mockTranscript,
        }}
        clips={new Map()}
        playingIndex={null}
        showTranscript={false}
        copied={false}
        onPlay={() => {}}
        onPause={() => {}}
        onCopy={() => {}}
        onToggleTranscript={() => {}}
        onBackHome={() => {}}
        onSparAgain={() => {}}
      />
    );

    // Header & Meta
    expect(markup).toContain("Series A Pitch");
    expect(markup).toContain("The coach&#x27;s notes");

    // The Moment
    expect(markup).toContain("The Moment");
    expect(markup).toContain("When Chiara pressed on CAC payback");

    // Strengths & Pattern
    expect(markup).toContain("What You Did Well");
    expect(markup).toContain("Crisp problem framing in the opening 60 seconds");
    expect(markup).toContain("The Pattern");
    expect(markup).toContain("Deflection when challenged on unit economics.");

    // One Thing to Practice
    expect(markup).toContain("One Thing to Practice");
    expect(markup).toContain("Lead with the exact number before providing strategic context.");

    // Telemetry insights
    expect(markup).toContain("Telemetry");
    expect(markup).toContain("Pace");
    expect(markup).toContain("34 words / response");
    expect(markup).toContain("Fillers");
    expect(markup).toContain("Recovery");
    expect(markup).toContain("Evidence");

    // Summary & CTAs
    expect(markup).toContain("Save or Share");
    expect(markup).toContain("Back to Home");
    expect(markup).toContain("Spar again");
  });

  test("renders drill stats when in drill mode", () => {
    const markup = renderToStaticMarkup(
      <DebriefContent
        scenarioLabel="Drill"
        data={{
          debrief: mockDebrief,
          telemetry: mockTelemetry,
          drillStats: mockDrillStats,
        }}
        clips={new Map()}
        playingIndex={null}
        showTranscript={false}
        copied={false}
        onPlay={() => {}}
        onPause={() => {}}
        onCopy={() => {}}
        onToggleTranscript={() => {}}
        onBackHome={() => {}}
        onSparAgain={() => {}}
      />
    );

    expect(markup).toContain("Drill: Concision Under Pressure");
    expect(markup).toContain("Challenges");
    expect(markup).toContain("5");
    expect(markup).toContain("85/100");
    expect(markup).toContain("Clean on 1st try (3)");
  });

  test("renders presentation evaluation and coach read when available", () => {
    const markup = renderToStaticMarkup(
      <DebriefContent
        scenarioLabel="Boardroom Defense"
        data={{
          debrief: mockDebrief,
          telemetry: mockTelemetry,
        }}
        clips={new Map()}
        playingIndex={null}
        showTranscript={false}
        copied={false}
        onPlay={() => {}}
        onPause={() => {}}
        onCopy={() => {}}
        onToggleTranscript={() => {}}
        onBackHome={() => {}}
        onSparAgain={() => {}}
      />
    );

    expect(markup).toContain("Your Presentation");
    expect(markup).toContain("Structured and composed opening thesis.");
    expect(markup).toContain("Sharp domain depth, but vulnerable on margins.");
  });
});

describe("YourAnswersSection", () => {
  test("renders user answer with persona context", () => {
    const markup = renderToStaticMarkup(
      <YourAnswersSection
        transcript={mockTranscript}
        clips={new Map()}
        playingIndex={null}
        onPlay={() => {}}
        onPause={() => {}}
      />
    );

    expect(markup).toContain("Your answers");
    expect(markup).toContain("Chiara asked");
    expect(markup).toContain("What is your blended payback period today?");
    expect(markup).toContain("Our blended payback is 14 months across core mid-market cohorts.");
  });

  test("renders active playing state when clip is selected", () => {
    const clips = new Map([[0, { url: "blob:clip-0", duration: 8.4 }]]);
    const markup = renderToStaticMarkup(
      <YourAnswersSection
        transcript={mockTranscript}
        clips={clips}
        playingIndex={0}
        onPlay={() => {}}
        onPause={() => {}}
      />
    );

    expect(markup).toContain("Pause");
    expect(markup).toContain("8s");
  });
});

describe("TelemetryInsight and DrillStat helpers", () => {
  test("TelemetryInsight renders label, metric, and qualitative insight", () => {
    const markup = renderToStaticMarkup(
      <TelemetryInsight
        label="Pace"
        value="Optimal speed"
        metric="32 wpm"
      />
    );
    expect(markup).toContain("Pace");
    expect(markup).toContain("Optimal speed");
    expect(markup).toContain("32 wpm");
  });

  test("DrillStat renders label and value with tabular styling", () => {
    const markup = renderToStaticMarkup(
      <DrillStat label="Recovery Time" value="1.8s" />
    );
    expect(markup).toContain("Recovery Time");
    expect(markup).toContain("1.8s");
  });
});
