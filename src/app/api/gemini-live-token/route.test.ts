import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

const { GET } = await import("./route");
const { getResolvedAuthTokensApiVersion } = await import(
  "@/lib/providers/gemini-ephemeral-token"
);

const GEMINI_API_KEY = "test-gemini-key";
const MINT_URL_V1BETA =
  "https://generativelanguage.googleapis.com/v1beta/auth_tokens";
const MINT_URL_V1ALPHA =
  "https://generativelanguage.googleapis.com/v1alpha/auth_tokens";

const originalFetch = globalThis.fetch;
const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY,
  DEEPGRAM_REGION: process.env.DEEPGRAM_REGION,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
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

function mintedTokenResponse(expireTime: string): Response {
  return new Response(
    JSON.stringify({ token: { name: "auth_tokens/abc", expireTime } }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
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

describe("GET /api/gemini-live-token", () => {
  beforeEach(() => {
    process.env.GROQ_API_KEY = "test-groq-key";
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    process.env.DEEPGRAM_API_KEY = "test-deepgram-key";
    process.env.DEEPGRAM_REGION = "us";
    process.env.GEMINI_API_KEY = GEMINI_API_KEY;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  });

  test("rejects a cross-origin request", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/gemini-live-token", {
        headers: { Origin: "https://attacker.example" },
      }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  test("returns the minted token name plus expiresIn from expireTime for a same-origin request", async () => {
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const fetchMock = installFetchMock(() =>
      Promise.resolve(mintedTokenResponse(expireTime)),
    );

    const response = await GET(
      new Request("http://localhost:3000/api/gemini-live-token", {
        headers: { Origin: "http://localhost:3000" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const body = (await response.json()) as { token: string; expiresIn: number };
    expect(body.token).toBe("auth_tokens/abc");
    expect(body.expiresIn).toBeGreaterThanOrEqual(25 * 60);
    expect(body.expiresIn).toBeLessThanOrEqual(35 * 60);
    expect(JSON.stringify(body)).not.toContain(GEMINI_API_KEY);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(MINT_URL_V1BETA);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      "x-goog-api-key": GEMINI_API_KEY,
    });

    const sentBody = JSON.parse(String(init?.body)) as {
      uses: number;
      expireTime: string;
      newSessionExpireTime: string;
    };
    expect(sentBody.uses).toBe(1);
    const requestedExpiry = Date.parse(sentBody.expireTime) - Date.now();
    expect(requestedExpiry).toBeGreaterThanOrEqual(25 * 60 * 1000);
    expect(requestedExpiry).toBeLessThanOrEqual(35 * 60 * 1000);
    const requestedSessionExpiry =
      Date.parse(sentBody.newSessionExpireTime) - Date.now();
    expect(requestedSessionExpiry).toBeGreaterThanOrEqual(30 * 1000);
    expect(requestedSessionExpiry).toBeLessThanOrEqual(90 * 1000);
  });

  test("falls back to the 30-minute default when the mint response omits expireTime", async () => {
    installFetchMock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ token: { name: "auth_tokens/abc" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const response = await GET(
      new Request("http://localhost:3000/api/gemini-live-token"),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { expiresIn: number };
    expect(body.expiresIn).toBeGreaterThanOrEqual(25 * 60);
    expect(body.expiresIn).toBeLessThanOrEqual(35 * 60);
  });

  test("answers 503 gemini-unconfigured when GEMINI_API_KEY is absent", async () => {
    delete process.env.GEMINI_API_KEY;
    const fetchMock = installFetchMock(() => {
      throw new Error("the mint call must never run without a key");
    });

    const response = await GET(
      new Request("http://localhost:3000/api/gemini-live-token"),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "gemini-unconfigured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test.each([401, 500])(
    "answers 502 gemini-mint-failed without key material when the mint endpoint answers %i",
    async (status) => {
      const fetchMock = installFetchMock(() =>
        Promise.resolve(
          new Response(
            `upstream failure mentioning ${GEMINI_API_KEY} in its body`,
            { status },
          ),
        ),
      );

      const response = await GET(
        new Request("http://localhost:3000/api/gemini-live-token"),
      );

      expect(response.status).toBe(502);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      const body = (await response.json()) as { error: string };
      expect(body).toEqual({ error: "gemini-mint-failed" });
      expect(body.error).not.toContain(GEMINI_API_KEY);
      // Only a 404 triggers the v1alpha retry; other failures fail fast.
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  test("answers 502 gemini-mint-failed when the mint call rejects", async () => {
    installFetchMock(() =>
      Promise.reject(new Error(`network failure exposing ${GEMINI_API_KEY}`)),
    );

    const response = await GET(
      new Request("http://localhost:3000/api/gemini-live-token"),
    );

    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = (await response.json()) as { error: string };
    expect(body).toEqual({ error: "gemini-mint-failed" });
    expect(body.error).not.toContain(GEMINI_API_KEY);
  });

  test("answers 502 gemini-mint-failed when the mint response has no token name", async () => {
    installFetchMock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ token: {} }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const response = await GET(
      new Request("http://localhost:3000/api/gemini-live-token"),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "gemini-mint-failed" });
  });

  test("retries once against v1alpha when the v1beta mint endpoint answers 404", async () => {
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    let upstreamCall = 0;
    const fetchMock = installFetchMock(() => {
      upstreamCall += 1;
      return upstreamCall === 1
        ? Promise.resolve(new Response("not found", { status: 404 }))
        : Promise.resolve(mintedTokenResponse(expireTime));
    });

    const response = await GET(
      new Request("http://localhost:3000/api/gemini-live-token"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ token: "auth_tokens/abc" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toBe(MINT_URL_V1BETA);
    expect(String(fetchMock.mock.calls[1][0])).toBe(MINT_URL_V1ALPHA);
    expect(getResolvedAuthTokensApiVersion()).toBe("v1alpha");
  });
});
