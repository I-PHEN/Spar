import "server-only";
import type { ServerProviderConfig } from "../config/server-env";
import { abortError, checkAborted, GenerationError, isAbortError } from "./errors";
import { createGroqGenerator } from "./groq";
import { createOpenRouterGenerator } from "./openrouter";
import { PERSONA_MODEL, type GenerationFailureCode, type GenerationUsage, type PersonaGenerator, type ProviderFetcher } from "./types";

export function createPersonaGenerator(
  config: Pick<ServerProviderConfig, "groqApiKey" | "openRouterApiKey">,
  fetcher: ProviderFetcher = fetch,
): PersonaGenerator {
  const primary = createGroqGenerator(config.groqApiKey, fetcher);
  const fallback = createOpenRouterGenerator(config.openRouterApiKey, fetcher);
  return {
    async *stream(request, signal) {
      let fallbackReason: GenerationFailureCode = "provider-error";
      let primaryUsage: GenerationUsage | null = null;
      for (const provider of ["groq", "openrouter"] as const) {
        let usage: GenerationUsage | null = null;
        try {
          checkAborted(signal);
          const generator = provider === "groq" ? primary : fallback;
          for await (const event of generator.stream(request, signal)) {
            checkAborted(signal);
            if (event.type === "usage") usage = event.usage;
            yield event;
            checkAborted(signal);
            // provider-selected is yielded before fetch. Recheck the live speech
            // boundary after the consumer has had a chance to handle that event.
            if (provider === "openrouter" && event.type === "provider-selected" && request.speechStarted()) {
              yield { type: "complete", provider: "groq", model: PERSONA_MODEL, status: "provider-error", reason: fallbackReason, usage: primaryUsage };
              return;
            }
          }
          return;
        } catch (error) {
          if (signal.aborted || isAbortError(error)) throw abortError();
          const reason = error instanceof GenerationError ? error.code : "provider-error";
          if (provider === "openrouter" || request.speechStarted()) {
            yield { type: "complete", provider, model: PERSONA_MODEL, status: "provider-error", reason, usage };
            return;
          }
          fallbackReason = reason;
          primaryUsage = usage;
          yield { type: "fallback", from: "groq", to: "openrouter", reason, resetText: true };
          checkAborted(signal);
          if (request.speechStarted()) {
            yield { type: "complete", provider, model: PERSONA_MODEL, status: "provider-error", reason, usage };
            return;
          }
        }
      }
    },
  };
}
