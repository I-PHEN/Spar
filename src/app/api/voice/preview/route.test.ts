import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";

mock.module("server-only", () => ({}));

const { POST } = await import("./route");

const originalFetch = globalThis.fetch;
const originalEnv = {
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

function restoreEnv() {
  for (const [k, v] of Object.entries(originalEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe("POST /api/voice/preview", () => {
  beforeEach(() => {
    process.env.GROQ_API_KEY = "test-groq-key";
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    process.env.DEEPGRAM_API_KEY = "test-deepgram-key";
    process.env.DEEPGRAM_REGION = "us";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    restoreEnv();
  });

  test("rejects cross-origin requests with 403", async () => {
    const req = new NextRequest("http://localhost:3000/api/voice/preview", {
      method: "POST",
      headers: {
        Origin: "https://evil.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ accent: "british", voiceTone: "authoritative" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  test("rejects invalid accent parameters with 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/voice/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accent: "unknown" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test("returns 503 with fallbackText when DEEPGRAM_API_KEY is unset", async () => {
    delete process.env.DEEPGRAM_API_KEY;
    const req = new NextRequest("http://localhost:3000/api/voice/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accent: "british", voiceTone: "warm" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(typeof json.fallbackText).toBe("string");
  });

  test("synthesizes audio via Deepgram /v1/speak for british accent", async () => {
    const fetchMock = installFetchMock(() =>
      Promise.resolve(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        }),
      ),
    );
    const req = new NextRequest("http://localhost:3000/api/voice/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accent: "british", voiceTone: "authoritative" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(res.headers.get("X-Spar-Voice-Model")).toBe("aura-2-draco-en");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "https://api.deepgram.com/v1/speak?model=aura-2-draco-en",
    );
  });

  test("falls back cleanly from /v2/speak to /v1/speak for indian accent when /v2 fails", async () => {
    let call = 0;
    const fetchMock = installFetchMock(() => {
      call += 1;
      if (call === 1) {
        return Promise.resolve(new Response("Not enabled", { status: 404 }));
      }
      return Promise.resolve(
        new Response(new Uint8Array([9, 8, 7]), {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        }),
      );
    });
    const req = new NextRequest("http://localhost:3000/api/voice/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accent: "indian", voiceTone: "authoritative" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/v2/speak?model=flux-naveen-en");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/v1/speak?model=aura-2-zeus-en");
  });
});
