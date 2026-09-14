import type { PersonaContextMessage } from "../persona/context-builder";

export type GenerationProvider = "groq" | "openrouter";
export const PERSONA_MODEL = "openai/gpt-oss-20b";

export interface GenerationRequest {
  messages: ReadonlyArray<Pick<PersonaContextMessage, "role" | "content">>;
  /** Live, monotonic turn state owned by the speech orchestrator. */
  speechStarted: () => boolean;
}

export interface GenerationUsage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  estimatedCostUsd: number | null;
  priceVersion: string | null;
}

export type GenerationFailureCode =
  | "http-error"
  | "network-error"
  | "provider-error"
  | "invalid-stream"
  | "unexpected-eof"
  | "missing-body"
  | "missing-credentials";

type ProviderIdentity = { provider: GenerationProvider; model: string };

export type GenerationEvent =
  | (ProviderIdentity & { type: "provider-selected" })
  | (ProviderIdentity & { type: "text-delta"; text: string })
  | (ProviderIdentity & { type: "usage"; usage: GenerationUsage })
  | {
      type: "fallback";
      from: "groq";
      to: "openrouter";
      reason: GenerationFailureCode;
      /** Discard the failed attempt's text and queued, unspoken audio before continuing. */
      resetText: true;
    }
  | (ProviderIdentity & {
      type: "complete";
      status: "success" | "provider-error";
      usage: GenerationUsage | null;
      reason?: GenerationFailureCode;
    });

export interface PersonaGenerator {
  stream(request: GenerationRequest, signal: AbortSignal): AsyncIterable<GenerationEvent>;
}

export type ProviderFetcher = (input: string, init: RequestInit) => Promise<Response>;
