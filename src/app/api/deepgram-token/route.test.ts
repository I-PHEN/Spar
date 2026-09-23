import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

const { POST } = await import("./route");

const originalFetch = globalThis.fetch;
const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY,
  DEEPGRAM_REGION: process.env.DEEPGRAM_REGION,
};

function installFetchMock(
  implementation: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>,
) {
  const fetchMock = mock(implementation);
  globalThis.fetch = Object.assign(fetchMock, {
    preconnect: originalFetch.preconnect,
  });
  return fetchMock;
}

function restoreEnvironment() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("POST /api/deepgram-token", () => {
  beforeEach(() => {
    Object.assign(process.env, { NODE_ENV: "development" });
    process.env.GROQ_API_KEY = "test-groq-key";
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    process.env.DEEPGRAM_API_KEY = "test-deepgram-key";
    process.env.DEEPGRAM_REGION = "us";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  });

  test("returns a 404 outside development", async () => {
    Object.assign(process.env, { NODE_ENV: "production" });

    const response = await POST(
      new Request("http://localhost:3000/api/deepgram-token", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  test("rejects a cross-origin request", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/deepgram-token", {
        method: "POST",
        headers: { Origin: "https://attacker.example" },
      }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  test("returns only a no-store temporary token plus the server region for a same-origin development request", async () => {
    installFetchMock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ access_token: "temporary-token", expires_in: 60 }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const response = await POST(
      new Request("http://localhost:3000/api/deepgram-token", {
        method: "POST",
        headers: { Origin: "http://localhost:3000" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      accessToken: "temporary-token",
      expiresIn: 60,
      region: "us",
    });
  });

  test("reports the server's eu region so browser sockets cannot diverge from it", async () => {
    process.env.DEEPGRAM_REGION = "eu";
    installFetchMock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ access_token: "temporary-token", expires_in: 60 }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const response = await POST(
      new Request("http://localhost:3000/api/deepgram-token", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      accessToken: "temporary-token",
      expiresIn: 60,
      region: "eu",
    });
  });

  test.each([401, 403])(
    "returns a clear safe error when Deepgram denies grant permissions with %i",
    async (status) => {
      installFetchMock(() =>
        Promise.resolve(
          new Response("sensitive upstream response", { status }),
        ),
      );

      const response = await POST(
        new Request("http://localhost:3000/api/deepgram-token", {
          method: "POST",
        }),
      );

      expect(response.status).toBe(500);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(await response.json()).toEqual({
        error:
          "Configured Deepgram API key needs permission to grant temporary tokens.",
      });
    },
  );

  test("redacts unexpected provider error details", async () => {
    const sensitiveDetail = "test-deepgram-key appeared in an unexpected error";
    installFetchMock(() => Promise.reject(new Error(sensitiveDetail)));

    const response = await POST(
      new Request("http://localhost:3000/api/deepgram-token", {
        method: "POST",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({
      error: "Unable to grant a temporary Deepgram token.",
    });
    expect(body.error).not.toContain(sensitiveDetail);
  });
});
