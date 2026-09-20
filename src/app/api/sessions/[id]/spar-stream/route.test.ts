import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";

const originalConsoleError = console.error;
console.error = mock(() => {});

interface StoredMessage {
  id: string;
  sessionId: string;
  personaId: string | null;
  role: string;
  content: string;
  type: string;
  claimRef: number | null;
  createdAt: Date;
}

const storedMessages: StoredMessage[] = [];
let providerSystemPrompt: string | null = null;
let providerUserPrompt: string | null = null;

const persona = {
  id: "persona-1",
  sessionId: "session-context-budget",
  archetype: "skeptic",
  name: "The Skeptic",
  behaviorStyle: "moderate",
  seatOrder: 0,
  createdAt: new Date("2026-09-13T00:00:00.000Z"),
};

const db = {
  sessionMessage: {
    create: mock(
      async ({
        data,
      }: {
        data: {
          sessionId: string;
          personaId?: string;
          role: string;
          content: string;
          type: string;
          claimRef?: number | null;
        };
      }) => {
        const message = {
          id: `message-${storedMessages.length + 1}`,
          sessionId: data.sessionId,
          personaId: data.personaId ?? null,
          role: data.role,
          content: data.content,
          type: data.type,
          claimRef: data.claimRef ?? null,
          createdAt: new Date("2026-09-13T00:00:01.000Z"),
        };
        storedMessages.push(message);
        return message;
      },
    ),
    findMany: mock(async () => storedMessages),
  },
  session: {
    findUnique: mock(async () => ({
      id: "session-context-budget",
      userId: "user-1",
      experience: "open_spar",
      drillTarget: null,
      coachingEnabled: true,
      coachingFocus: null,
      scenario: "custom",
      mode: "without_material",
      rawMaterial: null,
      materialTitle: null,
      roomContext: null,
      extractedClaims: null,
      presentationAnalysis: null,
      status: "active",
      startedAt: new Date("2026-09-13T00:00:00.000Z"),
      endedAt: null,
      createdAt: new Date("2026-09-13T00:00:00.000Z"),
      updatedAt: new Date("2026-09-13T00:00:00.000Z"),
      telemetry: null,
      personas: [persona],
      messages: [...storedMessages],
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
  },
};

mock.module("@/lib/db", () => ({ db }));
mock.module("@/lib/llm", () => ({
  buildPatternMemoryContext: () => "",
  generateOpening: async () => ({
    content: "What evidence supports your central claim?",
    type: "normal",
    claimRef: null,
    mood: "pressing",
  }),
}));
mock.module("@/lib/voice", () => ({
  generatePersonaAudio: async () => {
    throw new Error("TTS must not run for an over-budget context");
  },
}));
mock.module("@/lib/openrouter", () => ({
  extractPartialContent: () => null,
  parseStreamedPersonaResponse: () => null,
  streamPersonaResponse: async function* (
    systemPrompt: string,
    userPrompt: string,
  ) {
    providerSystemPrompt = systemPrompt;
    providerUserPrompt = userPrompt;
    yield { content: "{}", done: false };
  },
}));

const { POST } = await import("./route");
const { clearPromptCache, invalidateSession } = await import(
  "@/lib/session-cache"
);

beforeEach(() => {
  storedMessages.length = 0;
  providerSystemPrompt = null;
  providerUserPrompt = null;
  invalidateSession("session-context-budget");
  invalidateSession("session-rolling-summary");
  clearPromptCache("session-context-budget");
  clearPromptCache("session-rolling-summary");
  db.session.findUnique.mockClear();
  db.sessionMessage.create.mockClear();
  db.sessionMessage.findMany.mockClear();
});

afterAll(() => {
  console.error = originalConsoleError;
});

test("an oversized permitted utterance is persisted and reported through SSE", async () => {
  const oversizedUtterance = "x".repeat(5_000);
  const response = await POST(
    new NextRequest(
      "http://localhost/api/sessions/session-context-budget/spar-stream",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMessage: oversizedUtterance }),
      },
    ),
    { params: Promise.resolve({ id: "session-context-budget" }) },
  );
  const events = await response.text();

  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("text/event-stream");
  expect(events).toContain("event: start");
  expect(events).toContain("event: error");
  expect(events).toContain("exceed the context budget");
  expect(storedMessages).toEqual([
    expect.objectContaining({
      role: "user",
      content: oversizedUtterance,
    }),
  ]);
  expect(providerSystemPrompt).toBeNull();
  expect(providerUserPrompt).toBeNull();
});

test("the bounded rolling context retains the newest omitted correction", async () => {
  for (let index = 0; index < 14; index++) {
    const isCorrection = index === 8;
    storedMessages.push({
      id: `existing-${index}`,
      sessionId: "session-rolling-summary",
      personaId: index % 2 === 0 ? null : persona.id,
      role: index % 2 === 0 ? "user" : "persona",
      content: isCorrection
        ? "CORRECTION: approved budget is $900000."
        : index < 8
          ? `Historical fact ${index}: ${"x".repeat(150)}.`
          : `Recent turn ${index}.`,
      type: "normal",
      claimRef: null,
      createdAt: new Date(`2026-09-13T00:00:${index
        .toString()
        .padStart(2, "0")}.000Z`),
    });
  }

  const response = await POST(
    new NextRequest(
      "http://localhost/api/sessions/session-rolling-summary/spar-stream",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMessage: "Latest answer." }),
      },
    ),
    { params: Promise.resolve({ id: "session-rolling-summary" }) },
  );
  await response.text();

  expect(providerSystemPrompt).not.toBeNull();
  expect(providerUserPrompt).toContain(
    "CORRECTION: approved budget is $900000.",
  );
});
