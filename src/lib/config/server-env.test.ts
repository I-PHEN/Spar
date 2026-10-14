import { describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

const { getServerProviderConfig } = await import("./server-env");

const validEnv = {
  GROQ_API_KEY: "groq-test-secret",
  OPENROUTER_API_KEY: "openrouter-test-secret",
  DEEPGRAM_API_KEY: "deepgram-test-secret",
  DEEPGRAM_REGION: "us",
};

describe("getServerProviderConfig", () => {
  test.each([
    "GROQ_API_KEY",
    "OPENROUTER_API_KEY",
    "DEEPGRAM_API_KEY",
  ])("rejects a missing %s", (missingVariable) => {
    const env = { ...validEnv, [missingVariable]: "" };

    expect(() => getServerProviderConfig(env)).toThrow(missingVariable);
  });

  test.each(["us", "eu"])('accepts the "%s" Deepgram region', (region) => {
    expect(getServerProviderConfig({ ...validEnv, DEEPGRAM_REGION: region }))
      .toMatchObject({ deepgramRegion: region });
  });

  test("treats a missing GEMINI_API_KEY as optional so boot stays healthy", () => {
    const config = getServerProviderConfig({ ...validEnv });

    expect(config.geminiApiKey).toBeUndefined();
  });

  test("returns a present GEMINI_API_KEY trimmed of surrounding whitespace", () => {
    const config = getServerProviderConfig({
      ...validEnv,
      GEMINI_API_KEY: "  gemini-test-key  ",
    });

    expect(config.geminiApiKey).toBe("gemini-test-key");
  });

  test("treats a whitespace-only GEMINI_API_KEY as absent", () => {
    const config = getServerProviderConfig({
      ...validEnv,
      GEMINI_API_KEY: "   ",
    });

    expect(config.geminiApiKey).toBeUndefined();
  });

  test("rejects an unsupported Deepgram region", () => {
    expect(() =>
      getServerProviderConfig({ ...validEnv, DEEPGRAM_REGION: "ap" }),
    ).toThrow("DEEPGRAM_REGION");
  });

  test("does not expose supplied secrets in validation errors", () => {
    const secret = "do-not-leak-this-secret";

    expect(() =>
      getServerProviderConfig({
        ...validEnv,
        GROQ_API_KEY: secret,
        DEEPGRAM_REGION: "invalid",
      }),
    ).toThrow("DEEPGRAM_REGION");

    try {
      getServerProviderConfig({
        ...validEnv,
        GROQ_API_KEY: secret,
        DEEPGRAM_REGION: "invalid",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(secret);
    }
  });
});
