import { expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";

const existingSummary = {
  id: "summary-existing",
  sessionId: "session-debriefed",
  momentDescription: "The stored moment",
  whatWentWell: '["The stored strength"]',
  thePattern: "The stored pattern",
  oneThingToPractice: "The stored practice",
  telemetryInsights: '{"pace":"stored"}',
  shareableSummary: "The stored shareable summary",
  createdAt: new Date("2026-09-12T00:00:00.000Z"),
};

const sessionWithoutIncludedSummary = {
  id: "session-debriefed",
  userId: "user-1",
  status: "debriefed",
  experience: "open_spar",
  drillTarget: null,
  coachingEnabled: true,
  coachingFocus: null,
  mode: "without_material",
  rawMaterial: null,
  materialTitle: null,
  roomContext: null,
  extractedClaims: null,
  presentationAnalysis: null,
  scenario: "custom",
  startedAt: new Date("2026-09-12T00:00:00.000Z"),
  endedAt: new Date("2026-09-12T00:10:00.000Z"),
  createdAt: new Date("2026-09-12T00:00:00.000Z"),
  updatedAt: new Date("2026-09-12T00:10:00.000Z"),
  telemetry: null,
  messages: [],
  personas: [],
  user: {
    id: "user-1",
    email: "user@example.com",
    name: "Test User",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    patternMemories: [],
    sessions: [],
  },
};

const db = {
  session: {
    findUnique: mock(
      async (query: { include?: { summary?: boolean } }) => ({
        ...sessionWithoutIncludedSummary,
        ...(query.include?.summary ? { summary: existingSummary } : {}),
      })
    ),
    update: mock(async () => ({})),
  },
  sessionSummary: {
    create: mock(async () => ({
      ...existingSummary,
      id: "summary-regenerated",
      whatWentWell: "[]",
      thePattern: "",
      telemetryInsights:
        '{"pace":"","fillers":"","recovery":"","evidence":""}',
    })),
  },
  patternMemory: {
    findUnique: mock(async () => null),
    update: mock(async () => ({})),
    create: mock(async () => ({})),
  },
  skillSnapshot: {
    create: mock(async () => ({})),
  },
};

mock.module("@/lib/db", () => ({ db }));
mock.module("@/lib/llm", () => ({
  buildPatternMemoryContext: () => "",
  classifyPatternTag: () => "other",
  generateDebrief: async () => ({
    momentDescription: "A regenerated moment",
    whatWentWell: [],
    thePattern: "",
    oneThingToPractice: "A regenerated practice",
    telemetryInsights: {
      pace: "",
      fillers: "",
      recovery: "",
      evidence: "",
    },
    shareableSummary: "A regenerated shareable summary",
  }),
}));

const { POST } = await import("./route");

test("a debriefed session returns its stored summary", async () => {
  const response = await POST(
    new NextRequest("http://localhost/api/sessions/session-debriefed/end", {
      method: "POST",
    }),
    { params: Promise.resolve({ id: "session-debriefed" }) }
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    debrief: {
      ...existingSummary,
      createdAt: existingSummary.createdAt.toISOString(),
    },
    alreadyDebriefed: true,
  });
});
