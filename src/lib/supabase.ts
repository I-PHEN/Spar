// Spar — Supabase Auth & REST client helpers (zero extra dependencies)

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
  configured: boolean;
}

export interface SupabaseAuthUser {
  id: string;
  email: string;
  name?: string;
}

export interface SupabaseAuthResponse {
  accessToken: string;
  refreshToken?: string;
  user: SupabaseAuthUser;
}

export function getSupabaseConfig(
  env?: Record<string, string | undefined>,
): SupabaseConfig {
  const source = env ?? {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const url = (source.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const anonKey = (source.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  const serviceRoleKey = (source.SUPABASE_SERVICE_ROLE_KEY ?? "").trim() || undefined;

  return {
    url,
    anonKey,
    serviceRoleKey,
    configured: Boolean(url && anonKey),
  };
}

export function getSupabaseGoogleOAuthUrl(
  redirectTo: string,
  env?: Record<string, string | undefined>,
): string | null {
  const cfg = getSupabaseConfig(env);
  if (!cfg.configured) return null;
  const params = new URLSearchParams({
    provider: "google",
    redirect_to: redirectTo,
  });
  return `${cfg.url}/auth/v1/authorize?${params.toString()}`;
}

function extractSupabaseError(
  data: Record<string, unknown>,
  fallback: string,
): string {
  return (
    (typeof data.error_description === "string" && data.error_description) ||
    (typeof data.msg === "string" && data.msg) ||
    (typeof data.error === "string" && data.error) ||
    fallback
  );
}

function buildSupabaseUrl(
  baseUrl: string,
  path: string,
  redirectTo?: string,
): string {
  const cleanRedirect = redirectTo?.trim();
  if (!cleanRedirect) return `${baseUrl}${path}`;
  const sep = path.includes("?") ? "&" : "?";
  return `${baseUrl}${path}${sep}redirect_to=${encodeURIComponent(cleanRedirect)}`;
}

async function requestSupabaseAuth(
  path: string,
  body: Record<string, unknown>,
  fallbackError: string,
  options?: {
    redirectTo?: string;
    method?: "POST" | "PUT";
    accessToken?: string;
    env?: Record<string, string | undefined>;
  },
): Promise<Record<string, unknown>> {
  const cfg = getSupabaseConfig(options?.env);
  if (!cfg.configured) {
    throw new Error("Supabase is not configured");
  }

  const headers: Record<string, string> = {
    apikey: cfg.anonKey,
    "Content-Type": "application/json",
  };
  if (options?.accessToken?.trim()) {
    headers.Authorization = `Bearer ${options.accessToken.trim()}`;
  }

  const res = await fetch(buildSupabaseUrl(cfg.url, path, options?.redirectTo), {
    method: options?.method ?? "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(extractSupabaseError(data, fallbackError));
  }
  return data;
}

function mapSupabaseUser(raw: unknown): SupabaseAuthUser | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const id = typeof obj.id === "string" ? obj.id : "";
  const email = typeof obj.email === "string" ? obj.email : "";
  if (!id || !email) return null;

  const meta =
    obj.user_metadata && typeof obj.user_metadata === "object"
      ? (obj.user_metadata as Record<string, unknown>)
      : {};
  const name =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    email.split("@")[0];

  return { id, email, name };
}

function mapAuthSessionResponse(
  data: Record<string, unknown>,
  invalidMsg: string,
): SupabaseAuthResponse {
  const user = mapSupabaseUser(data.user ?? data);
  const accessToken = typeof data.access_token === "string" ? data.access_token : "";
  if (!user || !accessToken) {
    throw new Error(invalidMsg);
  }
  return {
    accessToken,
    refreshToken:
      typeof data.refresh_token === "string" ? data.refresh_token : undefined,
    user,
  };
}

export async function signInWithSupabasePassword(
  email: string,
  password: string,
): Promise<SupabaseAuthResponse> {
  const data = await requestSupabaseAuth(
    "/auth/v1/token?grant_type=password",
    { email: email.trim(), password },
    "Invalid email or password",
  );
  return mapAuthSessionResponse(data, "Supabase sign-in did not return a valid session");
}

export async function signUpWithSupabasePassword(
  email: string,
  password: string,
  name?: string,
  emailRedirectTo?: string,
): Promise<
  | ({ needsConfirmation: false } & SupabaseAuthResponse)
  | { needsConfirmation: true; user: SupabaseAuthUser | null }
> {
  const cleanName = name?.trim();
  const data = await requestSupabaseAuth(
    "/auth/v1/signup",
    {
      email: email.trim(),
      password,
      data: cleanName ? { full_name: cleanName } : undefined,
    },
    "Could not create account",
    { redirectTo: emailRedirectTo },
  );

  const user = mapSupabaseUser(data.user ?? data);
  const accessToken = typeof data.access_token === "string" ? data.access_token : "";

  if (!accessToken || !user) {
    return { needsConfirmation: true, user };
  }

  return {
    needsConfirmation: false,
    accessToken,
    refreshToken:
      typeof data.refresh_token === "string" ? data.refresh_token : undefined,
    user,
  };
}

export async function resendSupabaseSignupEmail(
  email: string,
  emailRedirectTo?: string,
): Promise<void> {
  await requestSupabaseAuth(
    "/auth/v1/resend",
    { type: "signup", email: email.trim() },
    "Could not resend confirmation email",
    { redirectTo: emailRedirectTo },
  );
}

export async function requestSupabasePasswordReset(
  email: string,
  redirectTo?: string,
): Promise<void> {
  await requestSupabaseAuth(
    "/auth/v1/recover",
    { email: email.trim() },
    "Could not send password reset email",
    { redirectTo },
  );
}

export async function updateSupabasePassword(
  accessToken: string,
  password: string,
): Promise<SupabaseAuthUser | null> {
  if (!accessToken.trim()) {
    throw new Error("Your recovery session has expired. Request a new reset link.");
  }
  const data = await requestSupabaseAuth(
    "/auth/v1/user",
    { password },
    "Could not update password",
    { method: "PUT", accessToken },
  );
  return mapSupabaseUser(data.user ?? data);
}

export type SupabaseOtpType =
  | "signup"
  | "recovery"
  | "magiclink"
  | "email"
  | "email_change";

export async function verifySupabaseTokenHash(
  tokenHash: string,
  type: SupabaseOtpType,
): Promise<SupabaseAuthResponse> {
  const data = await requestSupabaseAuth(
    "/auth/v1/verify",
    { token_hash: tokenHash.trim(), type },
    "Verification link is invalid or has expired",
  );
  return mapAuthSessionResponse(data, "Verification succeeded without an active session");
}

export async function verifySupabaseToken(
  accessToken: string,
  env?: Record<string, string | undefined>,
): Promise<SupabaseAuthUser | null> {
  const cfg = getSupabaseConfig(env);
  if (!cfg.configured || !accessToken.trim()) return null;

  try {
    const res = await fetch(`${cfg.url}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${accessToken.trim()}`,
      },
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return mapSupabaseUser(data);
  } catch {
    return null;
  }
}

export function parseSupabaseHashCallback(hash: string): {
  accessToken: string;
  refreshToken?: string;
  type?: string;
} | null {
  if (!hash) return null;
  const trimmed = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!trimmed.includes("access_token=")) return null;

  const params = new URLSearchParams(trimmed);
  const accessToken = params.get("access_token")?.trim();
  if (!accessToken) return null;

  const refreshToken = params.get("refresh_token")?.trim() || undefined;
  const type = params.get("type")?.trim() || undefined;
  return {
    accessToken,
    refreshToken,
    ...(type ? { type } : {}),
  };
}

export function parseSupabaseHashError(hash: string): string | null {
  if (!hash) return null;
  const trimmed = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(trimmed);
  const errorDescription = params.get("error_description")?.trim();
  if (errorDescription) return errorDescription;
  const errorCode = params.get("error")?.trim();
  if (errorCode) return errorCode.replace(/_/g, " ");
  return null;
}

export function parseSupabaseQueryCallback(search: string): {
  tokenHash?: string;
  type?: SupabaseOtpType;
  code?: string;
  error?: string;
} | null {
  if (!search) return null;
  const trimmed = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(trimmed);
  const tokenHash = params.get("token_hash")?.trim() || undefined;
  const rawType = params.get("type")?.trim();
  const type: SupabaseOtpType | undefined =
    rawType === "signup" ||
    rawType === "recovery" ||
    rawType === "magiclink" ||
    rawType === "email" ||
    rawType === "email_change"
      ? rawType
      : undefined;
  const code = params.get("code")?.trim() || undefined;
  const error =
    params.get("error_description")?.trim() ||
    params.get("error")?.trim().replace(/_/g, " ") ||
    undefined;

  if (!tokenHash && !code && !error) return null;
  return {
    ...(tokenHash ? { tokenHash } : {}),
    ...(type ? { type } : {}),
    ...(code ? { code } : {}),
    ...(error ? { error } : {}),
  };
}

export async function syncToSupabaseTable(
  table: string,
  payload: Record<string, unknown>,
  env?: Record<string, string | undefined>,
): Promise<boolean> {
  const cfg = getSupabaseConfig(env);
  if (!cfg.configured) return false;

  const authKey = cfg.serviceRoleKey || cfg.anonKey;
  try {
    const res = await fetch(`${cfg.url}/rest/v1/${encodeURIComponent(table)}`, {
      method: "POST",
      headers: {
        apikey: authKey,
        Authorization: `Bearer ${authKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}
