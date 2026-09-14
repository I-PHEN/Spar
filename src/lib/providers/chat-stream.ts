import "server-only";
import { abortError, checkAborted, GenerationError, isAbortError } from "./errors";
import { estimateGenerationCost } from "./pricing";
import { readSseData } from "./sse";
import { PERSONA_MODEL, type GenerationProvider, type GenerationUsage, type PersonaGenerator, type ProviderFetcher } from "./types";

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

function tokenCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function normalizeUsage(raw: unknown, provider: GenerationProvider): GenerationUsage | null {
  const usage = object(raw);
  if (!usage || !tokenCount(usage.prompt_tokens) || !tokenCount(usage.completion_tokens)) return null;
  const cachedTokens = object(usage.prompt_tokens_details)?.cached_tokens ?? 0;
  if (!tokenCount(cachedTokens) || cachedTokens > usage.prompt_tokens) return null;
  const counts = { inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens, cachedTokens };
  return { ...counts, ...estimateGenerationCost(provider, PERSONA_MODEL, counts) };
}

export function createChatStream(
  provider: GenerationProvider,
  endpoint: string,
  apiKey: string,
  fetcher: ProviderFetcher,
): PersonaGenerator {
  return {
    async *stream(request, signal) {
      const identity = { provider, model: PERSONA_MODEL };
      let usage: GenerationUsage | null = null;
      try {
        checkAborted(signal);
        yield { type: "provider-selected", ...identity };
        checkAborted(signal);
        if (!apiKey.trim()) throw new GenerationError(provider, "missing-credentials");
        const response = await fetcher(endpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: PERSONA_MODEL,
            messages: request.messages.map(({ role, content }) => ({ role, content })),
            stream: true,
            stream_options: { include_usage: true },
            max_completion_tokens: 80,
            temperature: 0.5,
            ...(provider === "groq" ? { reasoning_effort: "low" } : { reasoning: { effort: "low" } }),
          }),
          signal,
        });
        checkAborted(signal);
        if (!response.ok) throw new GenerationError(provider, "http-error", response.status);
        if (!response.body) throw new GenerationError(provider, "missing-body");

        for await (const data of readSseData(response.body, signal)) {
          checkAborted(signal);
          if (data.trim() === "[DONE]") {
            yield { type: "complete", ...identity, status: "success", usage };
            return;
          }
          let raw: unknown;
          try { raw = JSON.parse(data); }
          catch { throw new GenerationError(provider, "invalid-stream"); }
          const parsed = object(raw);
          if (!parsed) throw new GenerationError(provider, "invalid-stream");
          if (parsed.error) throw new GenerationError(provider, "provider-error");
          const choices = parsed.choices;
          if (choices !== undefined && !Array.isArray(choices)) throw new GenerationError(provider, "invalid-stream");
          const choice = object(choices?.[0]);
          if (choice?.error || choice?.finish_reason === "error") throw new GenerationError(provider, "provider-error");
          const content = object(choice?.delta)?.content;
          if (content !== undefined && content !== null && typeof content !== "string") {
            throw new GenerationError(provider, "invalid-stream");
          }
          if (typeof content === "string" && content.length > 0) {
            yield { type: "text-delta", ...identity, text: content };
            checkAborted(signal);
          }
          const measured = normalizeUsage(parsed.usage ?? object(parsed.x_groq)?.usage, provider);
          if (measured) {
            usage = measured;
            yield { type: "usage", ...identity, usage };
          }
        }
        throw new GenerationError(provider, "unexpected-eof");
      } catch (error) {
        if (signal.aborted || isAbortError(error)) throw abortError();
        if (error instanceof GenerationError) throw error;
        throw new GenerationError(provider, "network-error");
      }
    },
  };
}
