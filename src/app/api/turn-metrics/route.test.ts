import {
  afterAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";

const originalNodeEnv = process.env.NODE_ENV;
let storedRecord: Record<string, unknown> | null = null;
let findManyError: Error | null = null;

const turnMetric = {
  findUnique: mock(async () => storedRecord),
  create: mock(async ({ data }: { data: Record<string, unknown> }) => {
    storedRecord = {
      id: "metric-1",
      ...data,
      createdAt: new Date("2026-09-13T00:00:00.000Z"),
      updatedAt: new Date("2026-09-13T00:00:00.000Z"),
    };
    return storedRecord;
  }),
  update: mock(async ({ data }: { data: Record<string, unknown> }) => {
    storedRecord = { ...storedRecord, ...data };
    return storedRecord;
  }),
  findMany: mock(async () => {
    if (findManyError !== null) throw findManyError;
    return storedRecord === null ? [] : [storedRecord];
  }),
};

const db = {
  turnMetric,
  $transaction: mock(
    async (operation: (transaction: { turnMetric: typeof turnMetric }) => unknown) =>
      operation({ turnMetric }),
  ),
};

mock.module("@/lib/db", () => ({ db }));

const { POST } = await import("./route");
const { GET } = await import("../dev/metrics/route");

function metricRequest(body: unknown, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/turn-metrics", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
    },
    body: JSON.stringify(body),
  });
}

function persistedRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "metric-existing",
    turnId: "turn-1",
    sessionId: "session-1",
    traceId: "trace-1",
    experience: "boardroom",
    persona: "The Skeptic",
    transcriptConfidence: 0.9,
    selectedRegion: "eu",
    transcriptFinalizedOffsetMs: 100,
    serverGenerationStartedOffsetMs: 170,
    firstTokenOffsetMs: 230,
    firstPhraseOffsetMs: 300,
    firstTtsByteOffsetMs: 410,
    firstPlaybackOffsetMs: 900,
    cancellationOffsetMs: null,
    generationProvider: "groq",
    generationModel: "openai/gpt-oss-20b",
    ttsProvider: "deepgram",
    ttsModel: "aura-2-thalia-en",
    inputTokens: 900,
    outputTokens: 40,
    cachedTokens: 600,
    estimatedCostUsd: 0.0001,
    fallbackReason: null,
    cancelled: false,
    orderingFailureCount: 0,
    voiceEngine: null,
    firstLiveAudioMs: null,
    interruptions: null,
    createdAt: new Date("2026-09-13T00:00:00.000Z"),
    updatedAt: new Date("2026-09-13T00:00:01.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  Object.assign(process.env, { NODE_ENV: "development" });
  storedRecord = null;
  findManyError = null;
  for (const operation of Object.values(turnMetric)) operation.mockClear();
  db.$transaction.mockClear();
});

afterAll(() => {
  if (originalNodeEnv === undefined) {
    Reflect.deleteProperty(process.env, "NODE_ENV");
  } else {
    Object.assign(process.env, { NODE_ENV: originalNodeEnv });
  }
});

describe("POST /api/turn-metrics", () => {
  test("persists a validated event without returning the metric payload", async () => {
    const response = await POST(
      metricRequest({
        type: "turn-context",
        turnId: "turn-1",
        sessionId: "session-1",
        traceId: "trace-1",
        experience: "boardroom",
        persona: "The Skeptic",
        selectedRegion: "eu",
      }),
    );

    expect(response.status).toBe(202);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ accepted: true });
    expect(storedRecord).toMatchObject({
      turnId: "turn-1",
      sessionId: "session-1",
      traceId: "trace-1",
      selectedRegion: "eu",
    });
  });

  test("accepts a live-engine event with latency and interruption measurements", async () => {
    const response = await POST(
      metricRequest({
        type: "live-engine",
        turnId: "turn-1",
        sessionId: "session-1",
        voiceEngine: "gemini-live",
        firstLiveAudioMs: 812,
        interruptions: 1,
      }),
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ accepted: true });
    expect(storedRecord).toMatchObject({
      turnId: "turn-1",
      sessionId: "session-1",
      voiceEngine: "gemini-live",
      firstLiveAudioMs: 812,
      interruptions: 1,
    });
  });

  test("accepts a live-engine event without optional measurements", async () => {
    const response = await POST(
      metricRequest({
        type: "live-engine",
        turnId: "turn-1",
        sessionId: "session-1",
        voiceEngine: "cascade",
      }),
    );

    expect(response.status).toBe(202);
    expect(storedRecord).toMatchObject({
      voiceEngine: "cascade",
      firstLiveAudioMs: null,
      interruptions: null,
    });
  });

  test("rejects unknown voice engine strings", async () => {
    const response = await POST(
      metricRequest({
        type: "live-engine",
        turnId: "turn-1",
        sessionId: "session-1",
        voiceEngine: "gpt-realtime",
        firstLiveAudioMs: 812,
        interruptions: 1,
      }),
    );
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(body).toBe('{"error":"Invalid metric event."}');
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  test("updates an existing turn without writing persistence metadata", async () => {
    storedRecord = persistedRecord();

    const response = await POST(
      metricRequest({
        type: "fallback",
        turnId: "turn-1",
        sessionId: "session-1",
        reason: "groq-unavailable-before-speech",
      }),
    );
    const update = turnMetric.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ accepted: true });
    expect(update.data.fallbackReason).toBe(
      "groq-unavailable-before-speech",
    );
    expect(update.data).not.toHaveProperty("id");
    expect(update.data).not.toHaveProperty("createdAt");
    expect(update.data).not.toHaveProperty("updatedAt");
  });

  test("ignores an event when the persisted turn belongs to another session", async () => {
    storedRecord = persistedRecord({ sessionId: "session-existing" });

    const response = await POST(
      metricRequest({
        type: "first-playback",
        turnId: "turn-1",
        sessionId: "session-other",
        offsetMs: 950,
      }),
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ accepted: false });
    expect(turnMetric.update).not.toHaveBeenCalled();
    expect(storedRecord.firstPlaybackOffsetMs).toBe(900);
  });

  test("rejects unknown fields and never reflects their values", async () => {
    const secret = "sensitive-environment-value";
    const response = await POST(
      metricRequest({
        type: "first-token",
        turnId: "turn-1",
        sessionId: "session-1",
        offsetMs: 225,
        apiKey: secret,
      }),
    );
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toBe('{"error":"Invalid metric event."}');
    expect(body).not.toContain(secret);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  test("rejects cross-origin writes", async () => {
    const response = await POST(
      metricRequest(
        {
          type: "first-token",
          turnId: "turn-1",
          sessionId: "session-1",
          offsetMs: 225,
        },
        "https://attacker.example",
      ),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  test("accepts secure same-origin metric writes outside development", async () => {
    Object.assign(process.env, { NODE_ENV: "production" });

    const response = await POST(
      metricRequest({
        type: "first-token",
        turnId: "turn-1",
        sessionId: "session-1",
        offsetMs: 225,
      }),
    );

    expect(response.status).toBe(202);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/dev/metrics", () => {
  test("returns recent persisted turns with the shared summary", async () => {
    storedRecord = persistedRecord();

    const response = await GET();
    const body = (await response.json()) as {
      turns: Array<{ turnId: string }>;
      summary: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(turnMetric.findMany).toHaveBeenCalledWith({
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    expect(body.turns).toHaveLength(1);
    expect(body.turns[0].turnId).toBe("turn-1");
    expect(body.summary).toEqual({
      turnCount: 1,
      p50PlaybackMs: 800,
      p95PlaybackMs: 800,
      maxInputTokens: 900,
      maxOutputTokens: 40,
      cacheRatio: 2 / 3,
      totalCostUsd: 0.0001,
      fallbackCount: 0,
      cancelledCount: 0,
      orderingFailureCount: 0,
      voiceEngines: { "gemini-live": null, cascade: null, browser: null },
    });
  });

  test("does not read persisted metrics outside development", async () => {
    Object.assign(process.env, { NODE_ENV: "production" });

    const response = await GET();

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(turnMetric.findMany).not.toHaveBeenCalled();
  });

  test("returns a redacted no-store response when persistence fails", async () => {
    const sensitiveDetail = "DATABASE_URL contained a sensitive value";
    findManyError = new Error(sensitiveDetail);

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toBe('{"error":"Unable to read metrics."}');
    expect(body).not.toContain(sensitiveDetail);
  });
});
