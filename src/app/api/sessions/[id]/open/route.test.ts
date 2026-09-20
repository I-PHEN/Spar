import { expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";

const persistedMessages: Array<{ content: string; type: string }> = [];

const db = {
  session: {
    findUnique: mock(async () => ({
      id: "session-open-spar",
      userId: "user-1",
      experience: "open_spar",
      drillTarget: null,
      coachingEnabled: true,
      coachingFocus: null,
      scenario: "custom",
      mode: "without_material",
      rawMaterial: null,
      materialTitle: null,
      roomContext: "Test the claim under pressure.",
      extractedClaims: null,
      presentationAnalysis: null,
      status: "configured",
      startedAt: null,
      endedAt: null,
      createdAt: new Date("2026-09-20T00:00:00.000Z"),
      updatedAt: new Date("2026-09-20T00:00:00.000Z"),
      telemetry: null,
      personas: [{
        id: "persona-skeptic",
        sessionId: "session-open-spar",
        archetype: "skeptic",
        name: "The Skeptic",
        behaviorStyle: "moderate",
        seatOrder: 0,
        createdAt: new Date("2026-09-20T00:00:00.000Z"),
      }],
      messages: [],
      user: {
        id: "user-1",
        email: "user@example.com",
        name: "Test User",
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        updatedAt: new Date("2026-09-01T00:00:00.000Z"),
        patternMemories: [],
        sessions: [],
      },
    })),
    update: mock(async () => ({})),
  },
  sessionMessage: {
    create: mock(async ({ data }: { data: { content: string; type: string } }) => {
      persistedMessages.push({ content: data.content, type: data.type });
      return {
        id: "opening-message",
        createdAt: new Date("2026-09-20T00:00:01.000Z"),
      };
    }),
  },
};

mock.module("@/lib/db", () => ({ db }));
mock.module("@/lib/voice", () => ({ generatePersonaAudio: async () => null }));
mock.module("z-ai-web-dev-sdk", () => ({
  default: { create: async () => { throw new Error("Configuration file not found"); } },
}));

const { POST } = await import("./route");

test("opens an Open Spar room with the deterministic persona opening when generation initialization fails", async () => {
  const response = await POST(
    new NextRequest("http://localhost/api/sessions/session-open-spar/open", {
      method: "POST",
    }),
    { params: Promise.resolve({ id: "session-open-spar" }) },
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    alreadyStarted: false,
    message: {
      content: "What evidence supports your central claim?",
      type: "opening",
      mood: "pressing",
    },
  });
  expect(persistedMessages).toEqual([
    { content: "What evidence supports your central claim?", type: "opening" },
  ]);
});
