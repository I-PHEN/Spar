/// <reference types="bun-types" />

/**
 * Experience behavior contracts.
 *
 * These tests pin the approved behavior of the four sparring experiences
 * (Defense, Boardroom, Open Spar, Drill) to the implementation seams that
 * decide it: the experience definitions, the deterministic interrupt and
 * drill rules, the bounded persona context, and the live turn service. The
 * persona generator is mocked wherever a model response is expected, and
 * the Drill contracts prove corrections and progression never depend on
 * model output.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, mock, test } from "bun:test";
import {
  DRILL_DEFINITIONS,
  emptyDrillStats,
  getDrillAcknowledgment,
  getDrillCorrection,
  scoreAttempt,
} from "@/lib/drills";
import { DRILL_TARGETS, EXPERIENCES } from "@/lib/experiences";
import {
  buildPersonaContext,
  estimateInputTokens,
  MAX_CONTEXT_TOKENS,
} from "@/lib/persona/context-builder";
import { ARCHETYPES } from "@/lib/personas";
import type { PersonaGenerator } from "@/lib/providers/types";
import { detectTriggers, getThreshold } from "@/lib/triggers";
import type { LiveTurnContext, LiveTurnEvent, LiveTurnRequest } from "./live-turn-service";

mock.module("server-only", () => ({}));
const { createLiveTurnService } = await import("./live-turn-service");

type Experience = keyof typeof EXPERIENCES;
type DrillTarget = (typeof DRILL_TARGETS)[number]["id"];

interface Recorded {
  calls: number;
  messages: Array<ReadonlyArray<{ role: string; content: string }>>;
}

function scriptedGenerator(content: string, recorded: Recorded): PersonaGenerator {
  return {
    async *stream(request) {
      recorded.calls += 1;
      recorded.messages.push(request.messages);
      yield { type: "provider-selected", provider: "groq", model: "openai/gpt-oss-20b" } as const;
      yield { type: "text-delta", provider: "groq", model: "openai/gpt-oss-20b", text: `{"content":"${content}` } as const;
      yield { type: "text-delta", provider: "groq", model: "openai/gpt-oss-20b", text: '","type":"normal","claimRef":null,"mood":"neutral"}' } as const;
      yield {
        type: "usage",
        provider: "groq",
        model: "openai/gpt-oss-20b",
        usage: { inputTokens: 120, outputTokens: 24, cachedTokens: 60, estimatedCostUsd: 0.00004, priceVersion: "test" },
      } as const;
      yield {
        type: "complete",
        provider: "groq",
        model: "openai/gpt-oss-20b",
        status: "success",
        usage: { inputTokens: 120, outputTokens: 24, cachedTokens: 60, estimatedCostUsd: 0.00004, priceVersion: "test" },
      } as const;
    },
  };
}

interface Harness {
  recorded: Recorded;
  users: string[];
  assistants: Array<{ text: string; type: string }>;
  run(
    experience: Experience,
    transcript: string,
    options?: { isInterrupt?: boolean; drillInterrupt?: boolean; drillClean?: boolean; drillTarget?: DrillTarget },
  ): Promise<LiveTurnEvent[]>;
}

function serviceHarness(generatorContent: string): Harness {
  const recorded: Recorded = { calls: 0, messages: [] };
  const users: string[] = [];
  const assistants: Array<{ text: string; type: string }> = [];
  let experience: Experience = "open_spar";
  let drillTarget: DrillTarget = "hedging";

  const service = createLiveTurnService({
    now: () => 1,
    loadContext: async (request): Promise<LiveTurnContext> => ({
      persona: { id: "persona-1", name: "The Skeptic", archetype: "skeptic", behaviorStyle: "moderate", seatOrder: 0 },
      experience,
      selectedRegion: "us",
      stablePrefix: "STABLE PREFIX",
      sessionRules: "One focused challenge.",
      rollingSummary: "",
      history: [],
      deterministicState: { experience, drillTarget },
    }),
    persistUser: async (_sessionId, text) => {
      users.push(text);
    },
    persistAssistant: async (_request: LiveTurnRequest, text, metadata) => {
      assistants.push({ text, type: metadata.type });
      return `message-${assistants.length}`;
    },
    persistMetric: async () => {},
    generator: scriptedGenerator(generatorContent, recorded),
  });

  return {
    recorded,
    users,
    assistants,
    async run(current, transcript, options = {}) {
      experience = current;
      drillTarget = options.drillTarget ?? "hedging";
      const events: LiveTurnEvent[] = [];
      for await (const event of service(
        {
          sessionId: "session-contract",
          turnId: `turn-${users.length + assistants.length}-${current}`,
          transcript,
          confidence: 0.9,
          isInterrupt: options.isInterrupt,
          drillInterrupt: options.drillInterrupt,
          drillClean: options.drillClean,
        },
        new AbortController().signal,
      )) {
        events.push(event);
      }
      return events;
    },
  };
}

function joinedText(events: LiveTurnEvent[]): string {
  return events
    .filter((event) => event.type === "text-delta")
    .map((event) => (event.type === "text-delta" ? event.text : ""))
    .join("");
}

describe("experience contracts", () => {
  test("the presenting-first experiences are exactly Defense and Boardroom, in definition and open route", () => {
    expect(
      (Object.keys(EXPERIENCES) as Experience[]).filter((key) => EXPERIENCES[key].userPresentsFirst),
    ).toEqual(["defense", "boardroom"]);
    expect(EXPERIENCES.open_spar.userPresentsFirst).toBe(false);
    expect(EXPERIENCES.drill.userPresentsFirst).toBe(false);

    const source = readFileSync(join(process.cwd(), "src/app/api/sessions/[id]/open/route.ts"), "utf8");
    expect(source).toContain('session.experience === "defense" || session.experience === "boardroom"');
  });

  test("defense presents uninterrupted, then Q&A turns persist both sides without a deterministic interrupt", async () => {
    // No heuristic interrupt can fire below the full threshold in the
    // non-drill experiences, so a Defense presentation stays uninterrupted.
    for (const archetype of Object.keys(ARCHETYPES)) {
      expect(getThreshold(archetype as keyof typeof ARCHETYPES, "pure-spar")).toBe(100);
    }
    const threeHedges = detectTriggers("I think maybe we sort of see growth overall", 12);
    expect(threeHedges.agitation.skeptic).toBe(90);
    expect(threeHedges.agitation.skeptic!).toBeLessThan(getThreshold("skeptic", "pure-spar"));

    const harness = serviceHarness("Which claim carries your defense?");
    const events = await harness.run("defense", "My chapter four results hold under scrutiny.");
    expect(joinedText(events)).toBe("Which claim carries your defense?");
    expect(harness.users).toEqual(["My chapter four results hold under scrutiny."]);
    expect(harness.assistants).toEqual([{ text: "Which claim carries your defense?", type: "normal" }]);
  });

  test("boardroom interrupts mid-presentation and recovers with a normal follow-up turn", async () => {
    const fourHedges = detectTriggers("I think maybe we sort of perhaps see growth", 12);
    expect(fourHedges.agitation.skeptic).toBe(120);
    expect(fourHedges.agitation.skeptic!).toBeGreaterThanOrEqual(getThreshold("skeptic", "pure-spar"));

    const harness = serviceHarness("Hold on. Where is the number from?");
    const interrupt = await harness.run("boardroom", "I think maybe we sort of perhaps see growth", {
      isInterrupt: true,
    });
    const completion = interrupt.find((event) => event.type === "complete");
    expect(completion && completion.type === "complete" && completion.metadata.type).toBe("interruption");
    expect(harness.assistants.at(-1)?.type).toBe("interruption");

    // Recovery: the next turn returns the exchange to normal Q&A and both
    // sides persist, so the present/interrupt/recover loop can continue.
    await harness.run("boardroom", "The number is forty percent quarter over quarter.");
    expect(harness.users).toHaveLength(2);
    expect(harness.assistants.at(-1)).toEqual({ text: "Hold on. Where is the number from?", type: "normal" });
  });

  test("open spar alternates panel and user turns inside the context budget", async () => {
    expect(EXPERIENCES.open_spar.userPresentsFirst).toBe(false);
    const harness = serviceHarness("What is the so-what of that claim?");

    const history: Array<{ role: "user" | "assistant"; content: string }> = [];
    for (let turn = 0; turn < 8; turn += 1) {
      await harness.run("open_spar", `Answer number ${turn} with specific evidence.`);
      history.push({ role: "user", content: `Answer number ${turn} with specific evidence.` });
      history.push({ role: "assistant", content: "What is the so-what of that claim?" });

      const rollingSummary = history
        .slice(0, Math.max(0, history.length - 6))
        .map((message) => `${message.role === "user" ? "User" : "Panelist"}: ${message.content}`)
        .join("\n")
        .slice(-875);
      const context = buildPersonaContext({
        stablePrefix: "STABLE PREFIX",
        sessionRules: "One focused challenge.",
        rollingSummary,
        deterministicState: { experience: "open_spar" },
        history,
        newestUtterance: `Answer number ${turn} with specific evidence.`,
      });
      expect(context.totalEstimatedTokens).toBeLessThanOrEqual(MAX_CONTEXT_TOKENS);
      expect(estimateInputTokens(context.messages)).toBeLessThanOrEqual(2_000);
    }
    expect(harness.users).toHaveLength(8);
    expect(harness.assistants).toHaveLength(8);
  });

  describe("drill", () => {
    test("target selection, correction, and retry stay deterministic without any model call", async () => {
      for (const target of DRILL_TARGETS.map((item) => item.id)) {
        const harness = serviceHarness("MODEL MUST NOT BE CALLED");
        const first = await harness.run("drill", "I think maybe we should hedge here", {
          drillInterrupt: true,
          drillTarget: target,
        });
        const retry = await harness.run("drill", "I think maybe we should hedge again", {
          drillInterrupt: true,
          drillTarget: target,
        });

        expect(harness.recorded.calls).toBe(0);
        expect(joinedText(first)).toBe(getDrillCorrection(target));
        expect(joinedText(retry)).toBe(getDrillCorrection(target));
        expect(harness.assistants.map((entry) => entry.type)).toEqual(["interruption", "interruption"]);
        const completion = first.find((event) => event.type === "complete");
        expect(completion && completion.type === "complete" && completion.metadata.type).toBe("interruption");
      }
    });

    test("detection targets the drilled archetype at first-instance sensitivity", () => {
      for (const target of DRILL_TARGETS) {
        expect(getThreshold(target.leadArchetype, "drill", target.id)).toBe(30);
      }
      const singleHedge = detectTriggers("I think we ship now", 8);
      expect(singleHedge.agitation.skeptic).toBe(30);
      expect(singleHedge.agitation.skeptic!).toBeGreaterThanOrEqual(getThreshold("skeptic", "drill", "hedging"));
      expect(getThreshold("skeptic", "drill", "evidence-gaps")).toBe(100);
      expect(DRILL_DEFINITIONS.hedging.correctionPhrase).toBe(getDrillCorrection("hedging"));
      expect(DRILL_DEFINITIONS.hedging.acknowledgmentPhrase).toBe(getDrillAcknowledgment("hedging"));
    });

    test("a clean answer advances with a deterministic acknowledgment and exactly one model question", async () => {
      const harness = serviceHarness("Name the metric you would track next.");
      const events = await harness.run("drill", "We ship the beta now.", { drillClean: true });

      expect(harness.recorded.calls).toBe(1);
      expect(joinedText(events)).toBe(`${getDrillAcknowledgment("hedging")} Name the metric you would track next.`);
      expect(harness.assistants.at(-1)?.type).toBe("normal");
    });

    test("attempt scoring and drill statistics stay deterministic across every target", () => {
      expect([1, 2, 3, 4].map(scoreAttempt)).toEqual([3, 2, 1, 0]);
      for (const target of DRILL_TARGETS.map((item) => item.id)) {
        expect(DRILL_DEFINITIONS[target].scoring).toEqual({ 1: 3, 2: 2, 3: 1 });
        const stats = emptyDrillStats(target);
        expect(stats.target).toBe(target);
        expect(stats.totalChallenges).toBe(0);
        expect(stats.totalScore).toBe(0);
      }
    });
  });
});
