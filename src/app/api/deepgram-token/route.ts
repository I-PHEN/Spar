import { getServerProviderConfig } from "@/lib/config/server-env";
import {
  DeepgramGrantError,
  grantDeepgramToken,
} from "@/lib/providers/deepgram-auth";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const DEEPGRAM_TOKEN_TTL_SECONDS = 60;

function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV !== "development") {
    return jsonResponse({ error: "Not found." }, 404);
  }

  const origin = request.headers.get("Origin");
  if (origin !== null && origin !== new URL(request.url).origin) {
    return jsonResponse({ error: "Forbidden." }, 403);
  }

  try {
    const config = getServerProviderConfig(process.env);
    const grant = await grantDeepgramToken(
      globalThis.fetch,
      config.deepgramApiKey,
      DEEPGRAM_TOKEN_TTL_SECONDS,
    );

    // The public region string rides along with the grant so browser sockets
    // structurally cannot diverge from the server's selected Deepgram region
    // (the same value the server records in its turn metrics).
    return jsonResponse({ ...grant, region: config.deepgramRegion }, 200);
  } catch (error) {
    const message =
      error instanceof DeepgramGrantError
        ? error.message
        : "Unable to grant a temporary Deepgram token.";

    return jsonResponse({ error: message }, 500);
  }
}
