import { describe, expect, mock, test } from "bun:test";
import type { GenerationEvent, GenerationRequest, ProviderFetcher } from "./types";

mock.module("server-only", () => ({}));
const { createGroqGenerator } = await import("./groq");
const { createOpenRouterGenerator } = await import("./openrouter");

const request: GenerationRequest = {
  messages: [{ role: "system", content: "Stable persona" }, { role: "user", content: "Newest turn" }],
  speechStarted: () => false,
};
const encoder = new TextEncoder();

function chunk(content: string | null, extras = {}) {
  return { id: "completion-fixture", object: "chat.completion.chunk", created: 1,
    model: "openai/gpt-oss-20b", choices: [{ index: 0, delta: { content }, finish_reason: null }], ...extras };
}

function event(value: unknown): string {
  return `data: ${JSON.stringify(value)}\n\n`;
}

function responseFor(parts: readonly (string | Uint8Array)[], onCancel = () => {}) {
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) controller.enqueue(typeof part === "string" ? encoder.encode(part) : part);
      controller.close();
    },
    cancel: onCancel,
  }));
}

async function collect(events: AsyncIterable<GenerationEvent>) {
  const result: GenerationEvent[] = [];
  for await (const value of events) result.push(value);
  return result;
}

describe.each([
  { provider: "groq", endpoint: "https://api.groq.com/openai/v1/chat/completions", create: createGroqGenerator },
  { provider: "openrouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", create: createOpenRouterGenerator },
])("$provider streaming adapter", ({ provider, endpoint, create }) => {
  test("sends bounded messages, streaming usage, low reasoning and the caller signal", async () => {
    let observed: { input: string; init: RequestInit } | undefined;
    const fetcher: ProviderFetcher = async (input, init) => {
      observed = { input, init };
      return responseFor([event(chunk("Hi")), "data: [DONE]\n\n"]);
    };
    const controller = new AbortController();
    const contextualRequest = { ...request, messages: [{ role: "system" as const, content: "Stable persona", section: "stable-prefix" }] };
    const events = await collect(create("fixture-key", fetcher).stream(contextualRequest, controller.signal));
    expect(observed?.input).toBe(endpoint);
    expect(observed?.init.method).toBe("POST");
    expect(observed?.init.signal).toBe(controller.signal);
    expect(observed?.init.headers).toEqual({ Authorization: "Bearer fixture-key", "Content-Type": "application/json" });
    const body = JSON.parse(observed!.init.body as string);
    expect(body).toMatchObject({ model: "openai/gpt-oss-20b", messages: [{ role: "system", content: "Stable persona" }],
      stream: true, stream_options: { include_usage: true }, max_completion_tokens: 80 });
    expect(body.messages[0]).not.toHaveProperty("section");
    expect(provider === "groq" ? body.reasoning_effort : body.reasoning.effort).toBe("low");
    expect(events).toEqual([
      { type: "provider-selected", provider, model: "openai/gpt-oss-20b" },
      { type: "text-delta", provider, model: "openai/gpt-oss-20b", text: "Hi" },
      { type: "complete", provider, model: "openai/gpt-oss-20b", status: "success", usage: null },
    ]);
  });

  test("preserves exact ordered deltas across byte fragments, CRLF and combined events", async () => {
    const wire = `: keepalive\r\n\r\n${event(chunk(" Hé ")).replaceAll("\n", "\r\n")}${event(chunk("world"))}${event(chunk("!"))}data:[DONE]\r\n\r\n${event(chunk("ignored"))}`;
    const parts = Array.from(encoder.encode(wire), (byte) => new Uint8Array([byte]));
    const events = await collect(create("fixture-key", async () => responseFor(parts)).stream(request, new AbortController().signal));
    expect(events.filter((value) => value.type === "text-delta").map((value) => value.text)).toEqual([" Hé ", "world", "!"]);
    expect(events.filter((value) => value.type === "complete")).toHaveLength(1);
  });

  test("yields the first delta before the network stream finishes and cancels on early return", async () => {
    let cancelled = 0;
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(encoder.encode(event(chunk("First")))); },
      cancel() { cancelled++; },
    });
    const stream = create("fixture-key", async () => new Response(body)).stream(request, new AbortController().signal)[Symbol.asyncIterator]();
    expect((await stream.next()).value.type).toBe("provider-selected");
    expect((await stream.next()).value).toMatchObject({ type: "text-delta", text: "First" });
    await stream.return?.();
    expect(cancelled).toBe(1);
    expect(body.locked).toBe(false);
  });

  test("handles multiline data fields and a final DONE without a trailing newline", async () => {
    const text = `data: {"choices":\ndata: [{"index":0,"delta":{"content":"ok"},"finish_reason":null}]}\n\ndata: [DONE]`;
    const events = await collect(create("fixture-key", async () => responseFor([text])).stream(request, new AbortController().signal));
    expect(events.filter((value) => value.type === "text-delta").map((value) => value.text)).toEqual(["ok"]);
    expect(events.at(-1)).toMatchObject({ type: "complete", status: "success" });
  });

  test("normalizes final provider usage without treating the accounting frame as text", async () => {
    const usage = { prompt_tokens: 1000, completion_tokens: 20, total_tokens: 1020, prompt_tokens_details: { cached_tokens: 200 } };
    const accounting = provider === "groq" ? { x_groq: { id: "request-fixture", usage } } : { usage };
    const events = await collect(create("fixture-key", async () => responseFor([
      event(chunk("Answer")), event(chunk("", { ...accounting, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })), "data: [DONE]\n\n",
    ])).stream(request, new AbortController().signal));
    const measured = events.find((value) => value.type === "usage");
    expect(measured).toMatchObject({ type: "usage", provider, model: "openai/gpt-oss-20b", usage: { inputTokens: 1000, outputTokens: 20, cachedTokens: 200 } });
    if (measured?.type !== "usage") throw new Error("Expected measured usage");
    if (provider === "groq") expect(measured.usage.estimatedCostUsd).toBeCloseTo(0.0000734, 12);
    else expect(measured.usage.estimatedCostUsd).toBeNull();
    expect(measured.usage.priceVersion).toBe(provider === "groq" ? "2026-09-13" : null);
    expect(events.at(-1)).toMatchObject({ type: "complete", usage: measured.usage });
    expect(events.filter((value) => value.type === "text-delta")).toHaveLength(1);
  });

  test.each([
    { name: "malformed JSON", parts: ["data: {private-provider-body\n\n"], code: "invalid-stream" },
    { name: "provider error envelope", parts: [event({ error: { message: "private-provider-body" } })], code: "provider-error" },
    { name: "choice error", parts: [event(chunk("", { choices: [{ delta: {}, error: { message: "private-provider-body" }, finish_reason: "error" }] }))], code: "provider-error" },
    { name: "truncated stream", parts: [event(chunk("partial"))], code: "unexpected-eof" },
    { name: "invalid text delta", parts: [event(chunk(null, { choices: [{ delta: { content: 5 } }] }))], code: "invalid-stream" },
  ])("rejects $name with a safe error", async ({ parts, code }) => {
    const result = collect(create("private-provider-key", async () => responseFor(parts)).stream(request, new AbortController().signal));
    await expect(result).rejects.toMatchObject({ name: "GenerationError", code, provider });
    const error = await result.catch((value: unknown) => value);
    expect(String(error)).not.toContain("private-provider");
    expect(error).not.toHaveProperty("cause");
  });

  test.each([401, 429, 503])("redacts HTTP %s without reading the error body", async (status) => {
    const response = new Response("private-provider-body", { status });
    const result = collect(create("private-provider-key", async () => response).stream(request, new AbortController().signal));
    await expect(result).rejects.toMatchObject({ code: "http-error", status });
    expect(response.bodyUsed).toBe(false);
    expect(String(await result.catch((error: unknown) => error))).not.toContain("private-provider");
  });

  test("redacts transport failures and rejects a missing response body", async () => {
    for (const fetcher of [async () => { throw new Error("private-provider-key private-provider-body"); }, async () => new Response(null)]) {
      const result = collect(create("private-provider-key", fetcher).stream(request, new AbortController().signal));
      await expect(result).rejects.toMatchObject({ name: "GenerationError" });
      expect(String(await result.catch((error: unknown) => error))).not.toContain("private-provider");
    }
  });

  test("rejects an already aborted request without making a network call", async () => {
    let calls = 0;
    const controller = new AbortController();
    controller.abort("private-abort-reason");
    const result = collect(create("fixture-key", async () => { calls++; return responseFor([]); }).stream(request, controller.signal));
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(calls).toBe(0);
    expect(String(await result.catch((error: unknown) => error))).not.toContain("private-abort-reason");
  });

  test("abort cancels a pending reader and prevents buffered deltas from leaking", async () => {
    let cancelled = 0;
    let reading!: () => void;
    const pendingRead = new Promise<void>((resolve) => { reading = resolve; });
    const controller = new AbortController();
    const body = new ReadableStream<Uint8Array>({ pull() { reading(); }, cancel() { cancelled++; } });
    const stream = create("fixture-key", async () => new Response(body)).stream(request, controller.signal)[Symbol.asyncIterator]();
    await stream.next();
    const next = stream.next();
    await pendingRead;
    controller.abort();
    await expect(next).rejects.toMatchObject({ name: "AbortError" });
    expect(cancelled).toBe(1);
    expect(body.locked).toBe(false);

    const second = new AbortController();
    const buffered = create("fixture-key", async () => responseFor([event(chunk("one")) + event(chunk("two")) + "data: [DONE]\n\n"]))
      .stream(request, second.signal)[Symbol.asyncIterator]();
    await buffered.next();
    expect((await buffered.next()).value).toMatchObject({ text: "one" });
    second.abort();
    await expect(buffered.next()).rejects.toMatchObject({ name: "AbortError" });
  });
});

test("legacy OpenRouter caller receives ordered tokens, one completion and caller cancellation", async () => {
  // The session route suite replaces this module globally. A fresh Bun process
  // exercises the real compatibility boundary without inheriting that mock.
  const script = `
    import { mock } from "bun:test";
    import assert from "node:assert/strict";
    mock.module("server-only", () => ({}));
    const { streamPersonaResponse } = await import(${JSON.stringify(new URL("../openrouter.ts", import.meta.url).href)});
    const controller = new AbortController();
    globalThis.fetch = async (input, init) => {
      assert.equal(input, "https://openrouter.ai/api/v1/chat/completions");
      assert.equal(init.signal, controller.signal);
      assert.equal(JSON.parse(init.body).max_completion_tokens, 80);
      return new Response('data: {"choices":[{"delta":{"content":"first"}}]}\\n\\ndata: {"choices":[{"delta":{"content":" second"}}]}\\n\\ndata: [DONE]\\n\\n');
    };
    const tokens = [];
    for await (const token of streamPersonaResponse("system", "user", controller.signal)) tokens.push(token);
    assert.deepEqual(tokens, [{ content: "first", done: false }, { content: " second", done: false }, { content: "", done: true }]);
    controller.abort();
    await assert.rejects(async () => {
      for await (const token of streamPersonaResponse("system", "user", controller.signal)) {}
    }, { name: "AbortError" });
  `;
  const child = Bun.spawn([process.execPath, "-e", script], {
    env: { ...process.env, OPENROUTER_API_KEY: "compat-fixture-key" }, stdout: "pipe", stderr: "pipe",
  });
  const [exitCode, errors] = await Promise.all([child.exited, new Response(child.stderr).text()]);
  expect({ exitCode, errors }).toEqual({ exitCode: 0, errors: "" });
});
