import "server-only";
import { createChatStream } from "./chat-stream";
import type { PersonaGenerator, ProviderFetcher } from "./types";

export function createOpenRouterGenerator(apiKey: string, fetcher: ProviderFetcher = fetch): PersonaGenerator {
  return createChatStream("openrouter", "https://openrouter.ai/api/v1/chat/completions", apiKey, fetcher);
}
