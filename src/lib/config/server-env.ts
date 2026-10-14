import "server-only";

export type ServerProviderConfig = {
  groqApiKey: string;
  openRouterApiKey: string;
  deepgramApiKey: string;
  deepgramRegion: "us" | "eu";
  /**
   * Optional by design: unlike the required keys above, an absent Gemini key
   * is a healthy boot with the Live voice engine disabled (the token route
   * answers 503 "gemini-unconfigured"), not a server misconfiguration.
   */
  geminiApiKey?: string;
};

type ServerEnvironment = Record<string, string | undefined>;

const REQUIRED_KEYS = [
  "GROQ_API_KEY",
  "OPENROUTER_API_KEY",
  "DEEPGRAM_API_KEY",
] as const;

export function getServerProviderConfig(
  env: ServerEnvironment,
): ServerProviderConfig {
  const missingKeys = REQUIRED_KEYS.filter((key) => !env[key]?.trim());

  if (missingKeys.length > 0) {
    throw new Error(
      `Missing required server environment variables: ${missingKeys.join(", ")}`,
    );
  }

  const region = env.DEEPGRAM_REGION;
  if (region !== "us" && region !== "eu") {
    throw new Error("DEEPGRAM_REGION must be either \"us\" or \"eu\".");
  }

  const geminiApiKey = env.GEMINI_API_KEY?.trim();

  return {
    groqApiKey: env.GROQ_API_KEY!,
    openRouterApiKey: env.OPENROUTER_API_KEY!,
    deepgramApiKey: env.DEEPGRAM_API_KEY!,
    deepgramRegion: region,
    geminiApiKey: geminiApiKey ? geminiApiKey : undefined,
  };
}
