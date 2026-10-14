export type GeminiEphemeralToken = {
  token: string;
  expiresIn: number;
};

export type GeminiTokenFetcher = (
  input: string,
  init: RequestInit,
) => Promise<Response>;

export class GeminiMintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiMintError";
  }
}

const AUTH_TOKENS_BASE_URL = "https://generativelanguage.googleapis.com";
const TOKEN_TTL_SECONDS = 30 * 60;
const NEW_SESSION_TTL_SECONDS = 60;
const DEFAULT_EXPIRES_IN_SECONDS = 30 * 60;

/**
 * Docs mint at v1beta, but the js-genai SDK warns that ephemeral-token
 * support is v1alpha-only (protocol reference Open Question Q2). v1beta is
 * tried first because it is what the docs print; on a 404 the mint retries
 * once against v1alpha. The version that last minted successfully is
 * recorded here so operators can see which path their project resolves to.
 */
type AuthTokensApiVersion = "v1beta" | "v1alpha";
const AUTH_TOKENS_API_VERSIONS: readonly AuthTokensApiVersion[] = [
  "v1beta",
  "v1alpha",
];
let resolvedAuthTokensApiVersion: AuthTokensApiVersion = "v1beta";

export function getResolvedAuthTokensApiVersion(): AuthTokensApiVersion {
  return resolvedAuthTokensApiVersion;
}

export async function mintGeminiEphemeralToken(
  fetcher: GeminiTokenFetcher,
  apiKey: string,
): Promise<GeminiEphemeralToken> {
  for (const apiVersion of AUTH_TOKENS_API_VERSIONS) {
    const response = await fetcher(
      `${AUTH_TOKENS_BASE_URL}/${apiVersion}/auth_tokens`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uses: 1,
          expireTime: new Date(
            Date.now() + TOKEN_TTL_SECONDS * 1000,
          ).toISOString(),
          newSessionExpireTime: new Date(
            Date.now() + NEW_SESSION_TTL_SECONDS * 1000,
          ).toISOString(),
        }),
      },
    );

    if (response.ok) {
      resolvedAuthTokensApiVersion = apiVersion;
      return parseMintedToken(response);
    }

    // A 404 means this API version has no auth_tokens endpoint (the
    // documented v1beta/v1alpha ambiguity) — fall through to the other
    // version once. Any other failure is real and fails fast.
    if (response.status !== 404) {
      throw new GeminiMintError("Unable to mint a Gemini ephemeral token.");
    }
  }

  throw new GeminiMintError("Unable to mint a Gemini ephemeral token.");
}

async function parseMintedToken(
  response: Response,
): Promise<GeminiEphemeralToken> {
  const minted = (await response.json()) as {
    token?: { name?: unknown; expireTime?: unknown };
  };

  // The credential the browser needs is the minted token's resource name
  // ("auth_tokens/..."); per the protocol reference it is the only
  // documented response field.
  const mintedToken = minted.token;
  if (typeof mintedToken?.name !== "string" || mintedToken.name === "") {
    throw new GeminiMintError(
      "Gemini returned an ephemeral token without a name.",
    );
  }

  const parsedExpiry =
    typeof mintedToken.expireTime === "string"
      ? Date.parse(mintedToken.expireTime)
      : Number.NaN;
  const expiresAtMs = Number.isFinite(parsedExpiry)
    ? parsedExpiry
    : Date.now() + DEFAULT_EXPIRES_IN_SECONDS * 1000;

  return {
    token: mintedToken.name,
    expiresIn: Math.max(0, Math.round((expiresAtMs - Date.now()) / 1000)),
  };
}
