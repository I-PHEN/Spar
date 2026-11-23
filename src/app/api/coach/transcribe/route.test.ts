import { afterEach, describe, expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";
import { POST } from "./route";

const originalFetch = globalThis.fetch;
const originalGroq = process.env.GROQ_API_KEY;
const originalDeepgram = process.env.DEEPGRAM_API_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalGroq === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = originalGroq;
  if (originalDeepgram === undefined) delete process.env.DEEPGRAM_API_KEY;
  else process.env.DEEPGRAM_API_KEY = originalDeepgram;
});

function buildRequest(file?: File) {
  const form = new FormData();
  if (file) form.append("audio", file);
  return new NextRequest("http://localhost:3000/api/coach/transcribe", {
    method: "POST",
    body: form,
  });
}

describe("POST /api/coach/transcribe", () => {
  test("rejects missing audio file with 400", async () => {
    const res = await POST(buildRequest());
    expect(res.status).toBe(400);
  });

  test("returns 503 when neither GROQ_API_KEY nor DEEPGRAM_API_KEY is configured", async () => {
    delete process.env.GROQ_API_KEY;
    delete process.env.DEEPGRAM_API_KEY;
    const file = new File([new Uint8Array([1, 2, 3])], "clip.webm", { type: "audio/webm" });
    const res = await POST(buildRequest(file));
    expect(res.status).toBe(503);
  });

  test("returns transcribed text from Groq Whisper when configured", async () => {
    process.env.GROQ_API_KEY = "test-groq-key";
    delete process.env.DEEPGRAM_API_KEY;
    globalThis.fetch = mock(async () =>
      Response.json({ text: "We tested 40 accounts at 34 percent conversion." }),
    ) as unknown as typeof fetch;

    const file = new File([new Uint8Array([1, 2, 3])], "clip.webm", { type: "audio/webm" });
    const res = await POST(buildRequest(file));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.transcript).toBe("We tested 40 accounts at 34 percent conversion.");
  });
});
