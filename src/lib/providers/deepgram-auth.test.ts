import { describe, expect, mock, test } from "bun:test";
import { grantDeepgramToken } from "./deepgram-auth";

describe("grantDeepgramToken", () => {
  test("requests and normalizes a short-lived Deepgram grant", async () => {
    const fetcher = mock((_input: string, _init: RequestInit) =>
      Promise.resolve(
        new Response(
          JSON.stringify({ access_token: "temporary-token", expires_in: 60 }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const grant = await grantDeepgramToken(fetcher, "dg-secret", 60);

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.deepgram.com/v1/auth/grant",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      headers: {
        Authorization: "Token dg-secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl_seconds: 60 }),
    });
    expect(grant).toEqual({ accessToken: "temporary-token", expiresIn: 60 });
  });

  test("redacts the API key and upstream body when the grant fails", async () => {
    const apiKey = "dg-secret-that-must-not-leak";
    const upstreamBody = "upstream failure body that must not leak";
    const fetcher = mock(() =>
      Promise.resolve(new Response(upstreamBody, { status: 500 })),
    );

    await expect(grantDeepgramToken(fetcher, apiKey, 60)).rejects.toThrow(
      "Unable to grant a temporary Deepgram token",
    );

    try {
      await grantDeepgramToken(fetcher, apiKey, 60);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(apiKey);
      expect((error as Error).message).not.toContain(upstreamBody);
    }
  });
});
