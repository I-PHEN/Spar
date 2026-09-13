export type DeepgramGrant = {
  accessToken: string;
  expiresIn: number;
};

export type DeepgramFetcher = (
  input: string,
  init: RequestInit,
) => Promise<Response>;

export class DeepgramGrantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeepgramGrantError";
  }
}

export async function grantDeepgramToken(
  fetcher: DeepgramFetcher,
  apiKey: string,
  ttlSeconds: number,
): Promise<DeepgramGrant> {
  const response = await fetcher("https://api.deepgram.com/v1/auth/grant", {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ttl_seconds: ttlSeconds }),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new DeepgramGrantError(
        "Configured Deepgram API key needs permission to grant temporary tokens.",
      );
    }

    throw new DeepgramGrantError("Unable to grant a temporary Deepgram token.");
  }

  const grant = (await response.json()) as {
    access_token?: unknown;
    expires_in?: unknown;
  };

  if (
    typeof grant.access_token !== "string" ||
    typeof grant.expires_in !== "number"
  ) {
    throw new DeepgramGrantError(
      "Deepgram returned an invalid temporary token grant.",
    );
  }

  return {
    accessToken: grant.access_token,
    expiresIn: grant.expires_in,
  };
}
