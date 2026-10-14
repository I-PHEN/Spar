import { beforeEach, describe, expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";

const personas = [
  { id: "persona-lead", archetype: "skeptic", name: "The Skeptic", behaviorStyle: "moderate", seatOrder: 0 },
  { id: "persona-second", archetype: "timekeeper", name: "The Timekeeper", behaviorStyle: "gentle", seatOrder: 1 },
];

let storedSession: Record<string, unknown> | null = {
  id: "session-live",
  userId: "user-1",
  status: "active",
  experience: "open_spar",
  personas,
};
let findUniqueError: Error | null = null;
const createdMessages: Array<Record<string, unknown>> = [];

const db = {
  session: {
    findUnique: mock(async () => {
      if (findUniqueError !== null) throw findUniqueError;
      return storedSession;
    }),
  },
  sessionMessage: {
    create: mock(async ({ data }: { data: Record<string, unknown> }) => {
      const message = { id: `message-${createdMessages.length + 1}`, createdAt: new Date(), ...data };
      createdMessages.push(message);
      return message;
    }),
  },
};

mock.module("@/lib/db", () => ({ db }));

const { POST } = await import("./route");

function exchangeRequest(
  id: string,
  body: unknown,
  origin = "http://localhost:3000",
): Promise<Response> {
  return POST(
    new NextRequest(`http://localhost:3000/api/sessions/${id}/live-exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

beforeEach(() => {
  storedSession = {
    id: "session-live",
    userId: "user-1",
    status: "active",
    experience: "open_spar",
    personas,
  };
  findUniqueError = null;
  createdMessages.length = 0;
  db.session.findUnique.mockClear();
  db.sessionMessage.create.mockClear();
});

describe("POST /api/sessions/[id]/live-exchange", () => {
  test("persists the user and assistant halves with the spar-stream message shapes", async () => {
    const response = await exchangeRequest("session-live", {
      turnId: "session-live:life:2",
      userTranscripts: ["Our churn is two percent."],
      assistantTranscript: "Two percent is flat. What is the CAC?",
    });

    expect(response.status).toBe(202);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ accepted: true });
    expect(db.session.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "session-live" },
    }));
    expect(createdMessages).toEqual([
      expect.objectContaining({
        sessionId: "session-live",
        role: "user",
        content: "Our churn is two percent.",
        type: "normal",
      }),
      expect.objectContaining({
        sessionId: "session-live",
        personaId: "persona-lead",
        role: "persona",
        content: "Two percent is flat. What is the CAC?",
        type: "normal",
        claimRef: null,
      }),
    ]);
  });

  test("persists every unpaired user transcript before the assistant answer", async () => {
    const response = await exchangeRequest("session-live", {
      turnId: "session-live:life:4",
      userTranscripts: ["Our churn is two percent.", "Blended CAC is forty dollars."],
      assistantTranscript: "Blended CAC is about forty dollars.",
    });

    expect(response.status).toBe(202);
    expect(createdMessages.map((message) => message.role)).toEqual(["user", "user", "persona"]);
    expect(createdMessages[0].content).toBe("Our churn is two percent.");
    expect(createdMessages[1].content).toBe("Blended CAC is forty dollars.");
    expect(createdMessages[2].content).toBe("Blended CAC is about forty dollars.");
  });

  test("attributes the assistant message to the lead (lowest seat) panelist", async () => {
    await exchangeRequest("session-live", {
      turnId: "t",
      userTranscripts: ["question"],
      assistantTranscript: "answer",
    });

    expect(createdMessages[1]).toMatchObject({ personaId: "persona-lead", role: "persona" });
  });

  test("trims and slices content to the spar-stream limits instead of rejecting long turns", async () => {
    const response = await exchangeRequest("session-live", {
      turnId: "t",
      userTranscripts: [`  ${"a".repeat(6_000)}  `],
      assistantTranscript: `  ${"b".repeat(2_500)}  `,
    });

    expect(response.status).toBe(202);
    expect((createdMessages[0].content as string).length).toBe(5_000);
    expect((createdMessages[1].content as string).length).toBe(2_000);
  });

  test("accepts a presenting boardroom room, rejects ended sessions", async () => {
    storedSession = { ...storedSession, status: "presenting", experience: "boardroom" };
    const presenting = await exchangeRequest("session-live", {
      turnId: "t", userTranscripts: ["question"], assistantTranscript: "answer",
    });
    expect(presenting.status).toBe(202);

    storedSession = { ...storedSession, status: "ended" };
    db.sessionMessage.create.mockClear();
    const ended = await exchangeRequest("session-live", {
      turnId: "t", userTranscripts: ["question"], assistantTranscript: "answer",
    });
    expect(ended.status).toBe(400);
    expect(await ended.json()).toEqual({ error: "Session not active (status: ended)" });
    expect(db.sessionMessage.create).not.toHaveBeenCalled();
  });

  test("rejects invalid bodies without touching persistence", async () => {
    const cases: unknown[] = [
      { turnId: "t", assistantTranscript: "answer" }, // no user transcripts
      { turnId: "t", userTranscripts: [], assistantTranscript: "answer" }, // empty array
      { turnId: "t", userTranscripts: ["   "], assistantTranscript: "answer" }, // whitespace-only transcript
      { turnId: "t", userTranscripts: ["question"], assistantTranscript: "" }, // empty assistant half
      { turnId: "t", userTranscripts: ["question"], assistantTranscript: "answer", extra: true }, // unknown field
      { userTranscripts: ["question"], assistantTranscript: "answer" }, // no turn id
      "not-json",
    ];
    for (const body of cases) {
      const response = await exchangeRequest("session-live", body);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Invalid live exchange." });
    }
    expect(db.sessionMessage.create).not.toHaveBeenCalled();
  });

  test("returns 404 for an unknown session without persisting", async () => {
    storedSession = null;

    const response = await exchangeRequest("session-missing", {
      turnId: "t", userTranscripts: ["question"], assistantTranscript: "answer",
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Session not found" });
    expect(db.sessionMessage.create).not.toHaveBeenCalled();
  });

  test("answers 500 without details when the session has no personas or the write fails", async () => {
    storedSession = { ...storedSession, personas: [] };
    const noPersonas = await exchangeRequest("session-live", {
      turnId: "t", userTranscripts: ["question"], assistantTranscript: "answer",
    });
    expect(noPersonas.status).toBe(500);
    expect(await noPersonas.json()).toEqual({ error: "No persona available" });

    storedSession = { ...storedSession, personas };
    const originalCreate = db.sessionMessage.create;
    db.sessionMessage.create = mock(async () => { throw new Error("DATABASE_URL contained a sensitive value"); });
    try {
      const failed = await exchangeRequest("session-live", {
        turnId: "t", userTranscripts: ["question"], assistantTranscript: "answer",
      });
      const body = await failed.text();
      expect(failed.status).toBe(500);
      expect(body).toBe('{"error":"Unable to persist live exchange."}');
      expect(body).not.toContain("sensitive");
    } finally {
      db.sessionMessage.create = originalCreate;
    }
  });

  test("rejects cross-origin writes", async () => {
    const response = await exchangeRequest(
      "session-live",
      { turnId: "t", userTranscripts: ["question"], assistantTranscript: "answer" },
      "https://attacker.example",
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(db.session.findUnique).not.toHaveBeenCalled();
  });
});
