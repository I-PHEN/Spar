import type { GenerationProvider, GenerationUsage } from "./types";

// USD / million tokens, standard on-demand tier; verified 2026-09-13.
// https://console.groq.com/docs/model/openai/gpt-oss-20b
// OpenRouter routing prices are not pinned: do not assume a Groq rate there.
const PRICE_TABLE = {
  version: "2026-09-13",
  rates: { "groq:openai/gpt-oss-20b": { input: 0.075, cached: 0.037, output: 0.30 } },
} as const;

export function estimateGenerationCost(
  provider: GenerationProvider,
  model: string,
  usage: Pick<GenerationUsage, "inputTokens" | "outputTokens" | "cachedTokens"> | null,
): Pick<GenerationUsage, "estimatedCostUsd" | "priceVersion"> {
  const key = `${provider}:${model}`;
  const rates = PRICE_TABLE.rates[key as keyof typeof PRICE_TABLE.rates];
  if (!usage || !rates) return { estimatedCostUsd: null, priceVersion: null };
  return {
    estimatedCostUsd: ((usage.inputTokens - usage.cachedTokens) * rates.input +
      usage.cachedTokens * rates.cached + usage.outputTokens * rates.output) / 1_000_000,
    priceVersion: PRICE_TABLE.version,
  };
}
