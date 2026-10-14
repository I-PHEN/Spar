import { getServerProviderConfig } from "@/lib/config/server-env";
import { mintGeminiEphemeralToken } from "@/lib/providers/gemini-ephemeral-token";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

export async function GET(request: Request): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (origin !== null && origin !== new URL(request.url).origin) {
    return jsonResponse({ error: "Forbidden." }, 403);
  }

  try {
    const config = getServerProviderConfig(process.env);
    if (!config.geminiApiKey) {
      // The key is optional env: absent means the voice engine is disabled,
      // not that the server is misconfigured.
      return jsonResponse({ error: "gemini-unconfigured" }, 503);
    }

    const minted = await mintGeminiEphemeralToken(
      globalThis.fetch,
      config.geminiApiKey,
    );

    return jsonResponse(
      { token: minted.token, expiresIn: minted.expiresIn },
      200,
    );
  } catch {
    // Error details are discarded wholesale: upstream failures can echo the
    // API key, so the response surface stays a single safe literal.
    return jsonResponse({ error: "gemini-mint-failed" }, 502);
  }
}
