import { describe, expect, test } from "bun:test";
import type { LiveTurnEvent, LiveTurnRequest } from "../lib/spar/live-turn-service";
import { createTurnController, type TurnControllerDependencies } from "./use-turn-controller";

function stream(events: LiveTurnEvent[]): TurnControllerDependencies["streamTurn"] {
  return async function* (_request, signal) {
    for (const event of events) {
      if (signal.aborted) return;
      yield event;
    }
  };
}

function event<T extends LiveTurnEvent["type"]>(type: T, value: Omit<Extract<LiveTurnEvent, { type: T }>, "type" | "turnId">, turnId = "room:1") {
  return { type, turnId, ...value } as Extract<LiveTurnEvent, { type: T }>;
}

function harness(events: LiveTurnEvent[]) {
  const effects: string[] = [];
  const spoken: string[] = [];
  const requests: LiveTurnRequest[] = [];
  const dependencies: TurnControllerDependencies = {
    streamTurn: async function* (request, signal) {
      requests.push(request);
      yield* stream(events)(request, signal);
    },
    beginSpeech: async turnId => { effects.push(`begin-speech:${turnId}`); },
    speakPhrase: (turnId, phrase) => { effects.push(`speak:${turnId}`); spoken.push(phrase.text); },
    finishSpeech: turnId => { effects.push(`finish:${turnId}`); },
    cancelGeneration: turnId => { effects.push(`abort:${turnId}`); },
    invalidatePhraseQueue: turnId => { effects.push(`invalidate:${turnId}`); },
    stopAudio: turnId => { effects.push(`stop-audio:${turnId}`); },
    clearTts: turnId => { effects.push(`clear-tts:${turnId}`); },
    beginListening: turnId => { effects.push(`listen:${turnId}`); },
    recordMetric: async () => {},
    now: () => 20,
  };
  return { controller: createTurnController("room", "aura-2-thalia-en", dependencies), effects, spoken, requests };
}

const persona = { id: "p", name: "The Skeptic", archetype: "skeptic", behaviorStyle: "moderate", seatOrder: 0 };
const normalEvents = [
  event("turn-start", { persona, model: "openai/gpt-oss-20b", maxOutputTokens: 80 }),
  event("text-delta", { text: "Exact answer. " }),
  event("phrase", { phrase: { text: "Exact answer. ", sequence: 0, isFinal: false } }),
  event("complete", { text: "Exact answer. ", messageId: "m1", metadata: { type: "normal", claimRef: null, mood: "neutral" } }),
];

describe("turn controller", () => {
  test("submits only EndOfTurn and yields one visible and audible assistant answer", async () => {
    const h = harness(normalEvents);
    await h.controller.acceptStt({ type: "StartOfTurn", transcript: "", confidence: 0 });
    h.controller.acceptStt({ type: "interim", transcript: "My exact", confidence: 0.8 });
    expect(h.requests).toHaveLength(0);
    await h.controller.acceptStt({ type: "EndOfTurn", transcript: "My exact words.", confidence: 0.94 });

    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]).toMatchObject({ turnId: "room:1", transcript: "My exact words.", confidence: 0.94 });
    expect(h.controller.getSnapshot().messages).toEqual([
      expect.objectContaining({ role: "user", content: "My exact words." }),
      expect.objectContaining({ role: "assistant", content: "Exact answer. ", messageId: "m1" }),
    ]);
    expect(h.controller.getSnapshot().assistantCaption).toBe("Exact answer. ");
    expect(h.spoken).toEqual(["Exact answer. "]);
    expect(h.effects.filter(value => value.startsWith("finish:"))).toHaveLength(1);
  });

  test("resets unspoken Groq text on fallback without duplicating captions or speech", async () => {
    const h = harness([
      event("turn-start", { persona, model: "openai/gpt-oss-20b", maxOutputTokens: 80 }),
      event("text-delta", { text: "Discard me" }),
      event("fallback", { from: "groq", to: "openrouter", reason: "network-error", resetText: true }),
      event("text-delta", { text: "Use me. " }),
      event("phrase", { phrase: { text: "Use me. ", sequence: 0, isFinal: false } }),
      event("complete", { text: "Use me. ", messageId: "m2", metadata: { type: "normal", claimRef: null, mood: "neutral" } }),
    ]);
    await h.controller.acceptStt({ type: "StartOfTurn", transcript: "", confidence: 0 });
    await h.controller.acceptStt({ type: "EndOfTurn", transcript: "Question", confidence: 1 });
    expect(h.controller.getSnapshot().assistantCaption).toBe("Use me. ");
    expect(h.spoken).toEqual(["Use me. "]);
    expect(h.controller.getSnapshot().messages.filter(message => message.role === "assistant")).toHaveLength(1);
  });

  test.each(["generation", "playback"])("executes fixed cancellation order for barge-in during %s", async phase => {
    const h = harness(phase === "playback" ? normalEvents : normalEvents.slice(0, 2));
    await h.controller.acceptStt({ type: "StartOfTurn", transcript: "", confidence: 0 });
    await h.controller.acceptStt({ type: "EndOfTurn", transcript: "First", confidence: 1 });
    h.effects.length = 0;
    await h.controller.acceptStt({ type: "StartOfTurn", transcript: "", confidence: 0 });
    expect(h.effects.slice(0, 5)).toEqual([
      "abort:room:1", "invalidate:room:1", "stop-audio:room:1", "clear-tts:room:1", "listen:room:2",
    ]);
  });

  test("repeated StartOfTurn, unmount, network loss, and old-turn completion remain idempotent", async () => {
    const h = harness([]);
    await h.controller.acceptStt({ type: "StartOfTurn", turnIndex: 4, transcript: "", confidence: 0 });
    const beforeRepeat = h.effects.length;
    await h.controller.acceptStt({ type: "StartOfTurn", turnIndex: 4, transcript: "", confidence: 0 });
    expect(h.effects).toHaveLength(beforeRepeat);
    const afterRepeat = h.effects.length;
    h.controller.acceptServerEvent(event("complete", { text: "stale", messageId: "old", metadata: { type: "normal", claimRef: null, mood: "neutral" } }, "room:0"));
    expect(h.controller.getSnapshot().messages).toHaveLength(0);
    h.controller.networkLost("offline");
    expect(h.controller.getSnapshot().error).toBe("offline");
    h.controller.setSttFallback(true);
    h.controller.acceptSpeechEvent({ type: "fallback", turnId: "room:1", reason: "tts-unavailable", timestampMs: 20 });
    expect(h.controller.getSnapshot()).toMatchObject({ usingSttFallback: true, usingTtsFallback: true });
    h.controller.dispose();
    h.controller.dispose();
    expect(h.effects.length).toBeGreaterThan(afterRepeat);
  });
});
