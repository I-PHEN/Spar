import { describe, expect, mock, test } from "bun:test";
import type { LiveTurnEvent } from "./live-turn-service";

mock.module("server-only", () => ({}));
const { createLiveTurnService } = await import("./live-turn-service");

async function collect(events: AsyncIterable<LiveTurnEvent>): Promise<LiveTurnEvent[]> {
  const values: LiveTurnEvent[] = [];
  for await (const event of events) values.push(event);
  return values;
}

describe("live turn service", () => {
  test("persists a finalized Flux turn once and streams exact generated phrases before completion", async () => {
    const persistedUsers: string[] = [];
    const persistedAssistants: string[] = [];
    const metricTypes: string[] = [];
    let providerMessages: ReadonlyArray<{ role: string; content: string; section?: string }> = [];
    let providerSignal: AbortSignal | undefined;
    let now = 100;

    const service = createLiveTurnService({
      now: () => now++,
      loadContext: async (_request, signal) => {
        expect(signal).toBeInstanceOf(AbortSignal);
        return {
          persona: { id: "persona-1", name: "The Skeptic", archetype: "skeptic", behaviorStyle: "moderate", seatOrder: 0 },
          experience: "open_spar",
          selectedRegion: "us",
          stablePrefix: "STABLE PREFIX",
          sessionRules: "Ask one focused challenge.",
          rollingSummary: "",
          history: [],
          deterministicState: { experience: "open_spar" },
        };
      },
      persistUser: async (_sessionId, text, signal) => {
        expect(signal).toBeInstanceOf(AbortSignal);
        persistedUsers.push(text);
      },
      persistAssistant: async (_request, text, _metadata, signal) => {
        expect(signal).toBeInstanceOf(AbortSignal);
        persistedAssistants.push(text);
        return "message-1";
      },
      persistMetric: async (metric, signal) => {
        expect(signal).toBeInstanceOf(AbortSignal);
        metricTypes.push(metric.type);
      },
      generator: {
        async *stream(request, signal) {
          providerMessages = request.messages;
          providerSignal = signal;
          yield { type: "provider-selected", provider: "groq", model: "openai/gpt-oss-20b" } as const;
          yield { type: "text-delta", provider: "groq", model: "openai/gpt-oss-20b", text: '{"content":"Exact first sentence. ' } as const;
          yield { type: "text-delta", provider: "groq", model: "openai/gpt-oss-20b", text: 'Exact second sentence.","type":"normal","claimRef":null,"mood":"pressing"}' } as const;
          yield { type: "usage", provider: "groq", model: "openai/gpt-oss-20b", usage: { inputTokens: 42, outputTokens: 8, cachedTokens: 21, estimatedCostUsd: 0.0001, priceVersion: "test" } } as const;
          yield { type: "complete", provider: "groq", model: "openai/gpt-oss-20b", status: "success", usage: { inputTokens: 42, outputTokens: 8, cachedTokens: 21, estimatedCostUsd: 0.0001, priceVersion: "test" } } as const;
        },
      },
    });

    const abort = new AbortController();
    const events = await collect(service({ sessionId: "session-1", turnId: "turn-1", transcript: " My exact words. ", confidence: 0.91 }, abort.signal));

    expect(persistedUsers).toEqual(["My exact words."]);
    expect(persistedAssistants).toEqual(["Exact first sentence. Exact second sentence."]);
    expect(providerSignal).toBe(abort.signal);
    expect(providerMessages[0]).toEqual({ role: "system", content: "STABLE PREFIX", section: "stable-prefix" });
    expect(providerMessages.at(-1)?.content).toContain("My exact words.");
    expect(events.map((event) => event.type)).toEqual([
      "turn-start", "metric", "metric", "metric", "text-delta", "metric", "phrase", "metric", "text-delta", "usage", "metric", "phrase", "complete",
    ]);
    expect(events.filter((event) => event.type === "text-delta").map((event) => event.text).join(""))
      .toBe("Exact first sentence. Exact second sentence.");
    expect(events.filter((event) => event.type === "phrase").map((event) => event.phrase.text).join(""))
      .toBe("Exact first sentence. Exact second sentence.");
    expect(events.findIndex((event) => event.type === "phrase"))
      .toBeLessThan(events.findIndex((event) => event.type === "complete"));
    expect(metricTypes).toEqual(["turn-context", "transcript-finalized", "generation-started", "first-token", "first-phrase", "usage"]);
    const start = events[0];
    expect(start.type === "turn-start" && start.maxOutputTokens).toBe(80);
    expect(events.every((event) => event.turnId === "turn-1")).toBe(true);
  });

  test("discards an abandoned partial answer instead of persisting it", async () => {
    let assistantWrites = 0;
    const service = createLiveTurnService({
      now: () => 1,
      loadContext: async () => ({
        persona: { id: "p", name: "P", archetype: "skeptic", behaviorStyle: "moderate", seatOrder: 0 },
        experience: "open_spar", selectedRegion: "us", stablePrefix: "s", sessionRules: "r", rollingSummary: "", history: [], deterministicState: {},
      }),
      persistUser: async () => {},
      persistAssistant: async () => { assistantWrites++; return "message"; },
      persistMetric: async () => {},
      generator: { async *stream() {
        yield { type: "provider-selected", provider: "groq", model: "m" } as const;
        yield { type: "text-delta", provider: "groq", model: "m", text: '{"content":"partial' } as const;
        yield { type: "complete", provider: "groq", model: "m", status: "provider-error", reason: "network-error", usage: null } as const;
      } },
    });
    const events = await collect(service({ sessionId: "s", turnId: "t", transcript: "hello", confidence: 1 }, new AbortController().signal));
    expect(assistantWrites).toBe(0);
    expect(events.at(-1)).toMatchObject({ type: "error", turnId: "t", code: "network-error" });
  });
});
