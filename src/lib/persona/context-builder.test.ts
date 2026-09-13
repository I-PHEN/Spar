import { describe, expect, test } from "bun:test";
import {
  ContextBudgetError,
  MAX_CONTEXT_TOKENS,
  MAX_RECENT_MESSAGES,
  MAX_ROLLING_SUMMARY_TOKENS,
  buildPersonaContext,
  estimateInputTokens,
} from "./context-builder";

const baseInput = {
  stablePrefix: "You are The Skeptic. Return strict JSON.",
  sessionRules: "Experience: Open Spar. Ask one direct question.",
  rollingSummary: "The user is defending a launch plan.",
  deterministicState: {
    experience: "open_spar",
    isInterrupt: false,
  },
  newestUtterance: "We can launch in October.",
} as const;

describe("estimateInputTokens", () => {
  test("uses the conservative character-count estimator across messages", () => {
    expect(
      estimateInputTokens([
        { role: "system", content: "abc" },
        { role: "user", content: "defg" },
      ]),
    ).toBe(2);
  });
});

describe("buildPersonaContext", () => {
  test("keeps the cacheable prefix byte-identical when only history changes", () => {
    const first = buildPersonaContext({
      ...baseInput,
      history: [{ role: "assistant", content: "Why October?" }],
    });
    const second = buildPersonaContext({
      ...baseInput,
      history: [
        { role: "assistant", content: "What is the evidence?" },
        { role: "user", content: "Three signed pilots." },
      ],
    });

    expect(new TextEncoder().encode(first.systemPrompt)).toEqual(
      new TextEncoder().encode(second.systemPrompt),
    );
    expect(first.systemPrompt).toBe(baseInput.stablePrefix);
  });

  test("caps the rolling summary and retains only the newest six messages", () => {
    const history = Array.from({ length: 9 }, (_, index) => ({
      role: index % 2 === 0 ? ("assistant" as const) : ("user" as const),
      content: `message-${index}`,
    }));
    const context = buildPersonaContext({
      ...baseInput,
      rollingSummary: "s".repeat(2_000),
      history,
    });

    expect(context.rollingSummaryEstimatedTokens).toBeLessThanOrEqual(
      MAX_ROLLING_SUMMARY_TOKENS,
    );
    expect(context.recentMessages).toHaveLength(MAX_RECENT_MESSAGES);
    expect(context.recentMessages.map((message) => message.content)).toEqual([
      "message-4",
      "message-5",
      "message-6",
      "message-7",
      "message-8",
      baseInput.newestUtterance,
    ]);
  });

  test("drops an overlong factual fragment instead of emitting a partial value", () => {
    const context = buildPersonaContext({
      ...baseInput,
      rollingSummary: `Earlier decision is final. ${"x".repeat(
        850,
      )} Approved budget: $1000000.`,
      history: [],
    });

    expect(context.rollingSummary).toBe(
      "Earlier decision is final. [Earlier context omitted.]",
    );
    expect(context.rollingSummary).not.toContain("$1");
  });

  test("never leaves a lone surrogate when truncating a rolling summary", () => {
    const context = buildPersonaContext({
      ...baseInput,
      rollingSummary: `${"x".repeat(873)}😀 Corrected forecast is 12%.`,
      history: [],
    });

    expect(context.rollingSummary).toBe("[Earlier context omitted.]");
    expect(context.rollingSummary.isWellFormed()).toBe(true);
  });

  test("includes the newest utterance exactly once when history already ends with it", () => {
    const context = buildPersonaContext({
      ...baseInput,
      history: [
        { role: "assistant", content: "When can you launch?" },
        { role: "user", content: baseInput.newestUtterance },
      ],
    });

    const occurrences = context.recentMessages.filter(
      (message) => message.content === baseInput.newestUtterance,
    );

    expect(occurrences).toHaveLength(1);
    expect(context.recentMessages.at(-1)).toEqual({
      role: "user",
      content: baseInput.newestUtterance,
    });
  });

  test("preserves an earlier legitimate reply that matches the newest text", () => {
    const context = buildPersonaContext({
      ...baseInput,
      newestUtterance: "yes",
      history: [
        { role: "user", content: "yes" },
        { role: "assistant", content: "Can you cite the source?" },
        { role: "user", content: "yes" },
      ],
    });

    expect(context.recentMessages).toEqual([
      { role: "user", content: "yes" },
      { role: "assistant", content: "Can you cite the source?" },
      { role: "user", content: "yes" },
    ]);
  });

  test("appends the newest utterance once when it is not the final history item", () => {
    const context = buildPersonaContext({
      ...baseInput,
      history: [{ role: "assistant", content: "When can you launch?" }],
    });

    expect(
      context.recentMessages.filter(
        (message) => message.content === baseInput.newestUtterance,
      ),
    ).toHaveLength(1);
    expect(context.recentMessages.at(-1)).toEqual({
      role: "user",
      content: baseInput.newestUtterance,
    });
  });

  test("removes the oldest history pair before truncating the summary", () => {
    const history = Array.from({ length: 5 }, (_, index) => ({
      role: index % 2 === 0 ? ("assistant" as const) : ("user" as const),
      content: `history-${index}-${"h".repeat(990)}`,
    }));
    const rollingSummary = "r".repeat(850);
    const context = buildPersonaContext({
      ...baseInput,
      rollingSummary,
      history,
      newestUtterance: `newest-${"n".repeat(990)}`,
    });

    expect(context.totalEstimatedTokens).toBeLessThanOrEqual(
      MAX_CONTEXT_TOKENS,
    );
    expect(context.rollingSummary).toContain(rollingSummary);
    expect(context.recentMessages.map((message) => message.content)).toEqual([
      history[2].content,
      history[3].content,
      history[4].content,
      `newest-${"n".repeat(990)}`,
    ]);
  });

  test("keeps deterministic Drill state in dynamic context before prose history", () => {
    const context = buildPersonaContext({
      ...baseInput,
      deterministicState: {
        drillTarget: "hedging",
        agitationAction: "advance",
        correctionAttempts: 2,
      },
      history: [{ role: "assistant", content: "Defend the forecast." }],
    });
    const stateIndex = context.userPrompt.indexOf("# DETERMINISTIC STATE");
    const historyIndex = context.userPrompt.indexOf("# RECENT CONVERSATION");

    expect(context.userPrompt).toContain(
      '"agitationAction":"advance"',
    );
    expect(stateIndex).toBeLessThan(historyIndex);
    expect(
      context.recentMessages.some((message) =>
        message.content.includes("agitationAction"),
      ),
    ).toBe(false);
  });

  test("reports the exact two-message payload sent to the provider", () => {
    const context = buildPersonaContext({
      ...baseInput,
      history: [{ role: "assistant", content: "Why October?" }],
    });

    expect(context.messages).toEqual([
      {
        role: "system",
        content: context.systemPrompt,
        section: "stable-prefix",
      },
      {
        role: "user",
        content: context.userPrompt,
        section: "dynamic-context",
      },
    ]);
  });

  test("returns cacheable-prefix and total estimates for the actual prompts", () => {
    const context = buildPersonaContext({
      ...baseInput,
      history: [{ role: "assistant", content: "Why October?" }],
    });

    expect(context.cacheablePrefixEstimatedTokens).toBe(
      estimateInputTokens([
        { role: "system", content: context.systemPrompt },
      ]),
    );
    expect(context.totalEstimatedTokens).toBe(
      estimateInputTokens(context.messages),
    );
  });

  test("throws an explicit budget error when immutable instructions exceed the limit", () => {
    expect(() =>
      buildPersonaContext({
        ...baseInput,
        stablePrefix: "i".repeat(MAX_CONTEXT_TOKENS * 4),
        history: [],
      }),
    ).toThrow(ContextBudgetError);
  });
});
