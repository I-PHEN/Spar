import { describe, expect, mock, test } from "bun:test";
import type { GenerationEvent, GenerationRequest, ProviderFetcher } from "./types";
import { estimateGenerationCost } from "./pricing";

mock.module("server-only", () => ({}));
const { createPersonaGenerator } = await import("./persona-generator");

const config = { groqApiKey: "groq-fixture-key", openRouterApiKey: "router-fixture-key" };
const request: GenerationRequest = { messages: [{ role: "user", content: "Speak briefly" }], speechStarted: () => false };
const encoder = new TextEncoder();
const delta = (text: string) => `data: ${JSON.stringify({ id: "fixture", object: "chat.completion.chunk", created: 1,
  model: "openai/gpt-oss-20b", choices: [{ index: 0, delta: { content: text }, finish_reason: null }] })}\n\n`;
const failure = 'data: {"error":{"code":"server_error","message":"private-provider-body"}}\n\n';

function response(text: string) {
  return new Response(new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(encoder.encode(text)); controller.close(); } }));
}

async function collect(stream: AsyncIterable<GenerationEvent>) {
  const events: GenerationEvent[] = [];
  for await (const value of stream) events.push(value);
  return events;
}

describe("persona generator fallback boundary", () => {
  test("uses Groq first and never contacts OpenRouter for a successful stream", async () => {
    const calls: string[] = [];
    const fetcher: ProviderFetcher = async (input) => { calls.push(input); return response(delta("First") + delta(" second") + "data: [DONE]\n\n"); };
    const events = await collect(createPersonaGenerator(config, fetcher).stream(request, new AbortController().signal));
    expect(calls).toEqual(["https://api.groq.com/openai/v1/chat/completions"]);
    expect(events.map((value) => value.type)).toEqual(["provider-selected", "text-delta", "text-delta", "complete"]);
    expect(events.filter((value) => value.type === "text-delta").map((value) => value.text)).toEqual(["First", " second"]);
    expect(events.at(-1)).toMatchObject({ type: "complete", status: "success", provider: "groq" });
  });

  test.each([
    { name: "HTTP failure", primary: () => new Response("private-provider-body", { status: 503 }), reason: "http-error" },
    { name: "failure before any text", primary: () => response(failure), reason: "provider-error" },
    { name: "failure after unspoken text", primary: () => response(delta("Discard me") + failure), reason: "provider-error" },
  ])("restarts on OpenRouter after $name while speech has not begun", async ({ primary, reason }) => {
    const calls: { input: string; signal: AbortSignal | null | undefined; body: unknown }[] = [];
    const controller = new AbortController();
    const fetcher: ProviderFetcher = async (input, init) => {
      calls.push({ input, signal: init.signal, body: JSON.parse(init.body as string) });
      return input.includes("api.groq.com") ? primary() : response(delta("Replacement") + "data: [DONE]\n\n");
    };
    const events = await collect(createPersonaGenerator(config, fetcher).stream(request, controller.signal));
    expect(calls.map((call) => call.input)).toEqual(["https://api.groq.com/openai/v1/chat/completions", "https://openrouter.ai/api/v1/chat/completions"]);
    expect(calls.every((call) => call.signal === controller.signal)).toBe(true);
    expect(calls[1]?.body).toMatchObject({ model: "openai/gpt-oss-20b", messages: [{ role: "user", content: "Speak briefly" }] });
    expect(events.filter((value) => value.type === "fallback")).toEqual([{ type: "fallback", from: "groq", to: "openrouter", reason, resetText: true }]);
    expect(events.filter((value) => value.type === "provider-selected").map((value) => value.provider)).toEqual(["groq", "openrouter"]);
    expect(events.at(-1)).toMatchObject({ type: "complete", provider: "openrouter", status: "success" });
    expect(JSON.stringify(events)).not.toContain("private-provider");
    // The fallback boundary tells the speech consumer to clear any unspoken draft.
    let speakableText = "";
    for (const value of events) {
      if (value.type === "fallback") speakableText = "";
      if (value.type === "text-delta") speakableText += value.text;
    }
    expect(speakableText).toBe("Replacement");
  });

  test("ends cleanly without a second provider after the orchestrator marks speech started", async () => {
    let spoken = false;
    const calls: string[] = [];
    const fetcher: ProviderFetcher = async (input) => { calls.push(input); return response(delta("Already spoken") + failure); };
    const events: GenerationEvent[] = [];
    for await (const value of createPersonaGenerator(config, fetcher).stream({ ...request, speechStarted: () => spoken }, new AbortController().signal)) {
      events.push(value);
      if (value.type === "text-delta") spoken = true;
    }
    expect(calls).toEqual(["https://api.groq.com/openai/v1/chat/completions"]);
    expect(events.map((value) => value.type)).toEqual(["provider-selected", "text-delta", "complete"]);
    expect(events.at(-1)).toEqual({ type: "complete", provider: "groq", model: "openai/gpt-oss-20b", status: "provider-error", reason: "provider-error", usage: null });
  });

  test.each(["fallback", "provider-selected"])("rechecks speech state after yielding %s before starting fallback fetch", async (boundary) => {
    let spoken = false;
    const calls: string[] = [];
    const events: GenerationEvent[] = [];
    const fetcher: ProviderFetcher = async (input) => { calls.push(input); return response(failure); };
    for await (const value of createPersonaGenerator(config, fetcher).stream({ ...request, speechStarted: () => spoken }, new AbortController().signal)) {
      events.push(value);
      if (value.type === boundary && (value.type !== "provider-selected" || value.provider === "openrouter")) spoken = true;
    }
    expect(calls).toEqual(["https://api.groq.com/openai/v1/chat/completions"]);
    expect(events.at(-1)).toMatchObject({ type: "complete", status: "provider-error" });
    expect(events.some((value) => value.type === "text-delta")).toBe(false);
  });

  test.each(["pre-aborted", "text-delta", "fallback", "fallback-selected"])("abort at %s never triggers another request", async (boundary) => {
    const controller = new AbortController();
    const calls: string[] = [];
    const events: GenerationEvent[] = [];
    const fetcher: ProviderFetcher = async (input) => { calls.push(input); return response(delta("partial") + failure); };
    if (boundary === "pre-aborted") controller.abort("private-abort-reason");
    const result = (async () => {
      for await (const value of createPersonaGenerator(config, fetcher).stream(request, controller.signal)) {
        events.push(value);
        if (value.type === boundary || (boundary === "fallback-selected" && value.type === "provider-selected" && value.provider === "openrouter")) controller.abort("private-abort-reason");
      }
    })();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(calls).toEqual(boundary === "pre-aborted" ? [] : ["https://api.groq.com/openai/v1/chat/completions"]);
    expect(events.some((value) => value.type === "complete")).toBe(false);
    expect(String(await result.catch((error: unknown) => error))).not.toContain("private-abort-reason");
  });

  test("an AbortError from the transport never falls back even if signal is not marked", async () => {
    const calls: string[] = [];
    const fetcher: ProviderFetcher = async (input) => { calls.push(input); throw new DOMException("private-provider-body", "AbortError"); };
    await expect(collect(createPersonaGenerator(config, fetcher).stream(request, new AbortController().signal))).rejects.toMatchObject({ name: "AbortError" });
    expect(calls).toEqual(["https://api.groq.com/openai/v1/chat/completions"]);
  });

  test("fallback failure ends once and never starts a third attempt", async () => {
    const calls: string[] = [];
    const fetcher: ProviderFetcher = async (input) => { calls.push(input); return response(failure); };
    const events = await collect(createPersonaGenerator(config, fetcher).stream(request, new AbortController().signal));
    expect(calls).toHaveLength(2);
    expect(events.filter((value) => value.type === "fallback")).toHaveLength(1);
    expect(events.filter((value) => value.type === "complete")).toEqual([{ type: "complete", provider: "openrouter", model: "openai/gpt-oss-20b", status: "provider-error", reason: "provider-error", usage: null }]);
  });
});

describe("versioned cost estimates", () => {
  test("leaves absent usage and unknown provider/model pricing unknown", () => {
    expect(estimateGenerationCost("groq", "openai/gpt-oss-20b", null)).toEqual({ estimatedCostUsd: null, priceVersion: null });
    expect(estimateGenerationCost("groq", "unpriced-model", { inputTokens: 1000, outputTokens: 20, cachedTokens: 200 })).toEqual({ estimatedCostUsd: null, priceVersion: null });
    expect(estimateGenerationCost("openrouter", "openai/gpt-oss-20b", { inputTokens: 1000, outputTokens: 20, cachedTokens: 200 })).toEqual({ estimatedCostUsd: null, priceVersion: null });
  });
});
