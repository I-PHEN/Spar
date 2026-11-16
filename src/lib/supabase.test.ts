import { describe, expect, test } from "bun:test";
import {
  getSupabaseConfig,
  getSupabaseGoogleOAuthUrl,
  parseSupabaseHashCallback,
  parseSupabaseHashError,
  parseSupabaseQueryCallback,
  requestSupabasePasswordReset,
  resendSupabaseSignupEmail,
  signUpWithSupabasePassword,
} from "./supabase";

describe("Supabase helpers", () => {
  test("getSupabaseConfig reports configured=false when env vars are missing", () => {
    const cfg = getSupabaseConfig({});
    expect(cfg.configured).toBe(false);
    expect(cfg.url).toBe("");
    expect(cfg.anonKey).toBe("");
  });

  test("getSupabaseConfig trims trailing slash and enables configured=true when set", () => {
    const cfg = getSupabaseConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://demo-proj.supabase.co/",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-secret-123",
    });
    expect(cfg.configured).toBe(true);
    expect(cfg.url).toBe("https://demo-proj.supabase.co");
    expect(cfg.anonKey).toBe("anon-secret-123");
  });

  test("getSupabaseGoogleOAuthUrl constructs the Google authorize URL", () => {
    const url = getSupabaseGoogleOAuthUrl("http://localhost:3000", {
      NEXT_PUBLIC_SUPABASE_URL: "https://demo-proj.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-secret-123",
    });
    expect(url).toBe(
      "https://demo-proj.supabase.co/auth/v1/authorize?provider=google&redirect_to=http%3A%2F%2Flocalhost%3A3000",
    );
  });

  test("parseSupabaseHashCallback extracts accessToken, refreshToken, and optional type", () => {
    const tokens = parseSupabaseHashCallback(
      "#access_token=jwt-abc-123&expires_in=3600&refresh_token=ref-xyz&token_type=bearer",
    );
    expect(tokens).toEqual({
      accessToken: "jwt-abc-123",
      refreshToken: "ref-xyz",
    });

    const recovery = parseSupabaseHashCallback(
      "#access_token=jwt-rec-456&refresh_token=ref-rec&type=recovery",
    );
    expect(recovery).toEqual({
      accessToken: "jwt-rec-456",
      refreshToken: "ref-rec",
      type: "recovery",
    });

    expect(parseSupabaseHashCallback("")).toBeNull();
    expect(parseSupabaseHashCallback("#error=access_denied")).toBeNull();
  });

  test("parseSupabaseHashError and parseSupabaseQueryCallback parse errors, token_hash, and code", () => {
    expect(
      parseSupabaseHashError(
        "#error=access_denied&error_description=Email+link+is+invalid+or+has+expired",
      ),
    ).toBe("Email link is invalid or has expired");
    expect(parseSupabaseHashError("#access_token=abc")).toBeNull();

    expect(parseSupabaseQueryCallback("")).toBeNull();
    expect(
      parseSupabaseQueryCallback("?token_hash=hash_123&type=signup"),
    ).toEqual({
      tokenHash: "hash_123",
      type: "signup",
    });
    expect(parseSupabaseQueryCallback("?code=pkce_abc")).toEqual({
      code: "pkce_abc",
    });
    expect(
      parseSupabaseQueryCallback("?error=otp_expired&error_description=Link+expired"),
    ).toEqual({
      error: "Link expired",
    });
  });

  test("signUp, resend, and password reset send expected Supabase Auth endpoints and redirect_to", async () => {
    const originalFetch = globalThis.fetch;
    const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const prevKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const calls: Array<{ url: string; method?: string; body?: string }> = [];

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo-proj.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-secret-123";
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        method: init?.method,
        body: typeof init?.body === "string" ? init.body : undefined,
      });
      if (String(input).includes("/auth/v1/signup")) {
        return new Response(
          JSON.stringify({ id: "u-1", email: "ada@example.com" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const res = await signUpWithSupabasePassword(
        "ada@example.com",
        "supersecret99",
        "Ada",
        "http://localhost:3000",
      );
      expect(res.needsConfirmation).toBe(true);

      await resendSupabaseSignupEmail("ada@example.com", "http://localhost:3000");
      await requestSupabasePasswordReset("ada@example.com", "http://localhost:3000");

      expect(calls[0]?.url).toBe(
        "https://demo-proj.supabase.co/auth/v1/signup?redirect_to=http%3A%2F%2Flocalhost%3A3000",
      );
      expect(calls[1]?.url).toBe(
        "https://demo-proj.supabase.co/auth/v1/resend?redirect_to=http%3A%2F%2Flocalhost%3A3000",
      );
      expect(JSON.parse(calls[1]?.body ?? "{}")).toEqual({
        type: "signup",
        email: "ada@example.com",
      });
      expect(calls[2]?.url).toBe(
        "https://demo-proj.supabase.co/auth/v1/recover?redirect_to=http%3A%2F%2Flocalhost%3A3000",
      );
      expect(JSON.parse(calls[2]?.body ?? "{}")).toEqual({
        email: "ada@example.com",
      });
    } finally {
      globalThis.fetch = originalFetch;
      if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
      if (prevKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevKey;
    }
  });
});
