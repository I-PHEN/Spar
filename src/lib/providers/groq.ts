import "server-only";
import { createChatStream } from "./chat-stream";
import type { PersonaGenerator, ProviderFetcher } from "./types";

export function createGroqGenerator(apiKey: string, fetcher: ProviderFetcher = fetch): PersonaGenerator {
  return createChatStream("groq", "https://api.groq.com/openai/v1/chat/completions", apiKey, fetcher);
}
