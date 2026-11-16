// Spar — user session resolution helper
//
// Resolves the authenticated Supabase/cookie tester user when running inside a
// Next.js request, falling back to the single local founder user for CLI/test runs.

import { cookies } from "next/headers";
import { db } from "./db";
import { syncToSupabaseTable } from "./supabase";
import {
  DEFAULT_USER_PREFERENCES,
  parseUserPreferences,
  type PanelIntensityKey,
  type PrimaryTrackKey,
  type UserPreferences,
} from "./user-preferences";

export {
  DEFAULT_USER_PREFERENCES,
  parseUserPreferences,
  type PanelIntensityKey,
  type PrimaryTrackKey,
  type UserPreferences,
};

export const SPAR_USER_COOKIE = "spar_user_id";
export const SPAR_EMAIL_COOKIE = "spar_user_email";

const DEFAULT_USER_EMAIL = "founder@spar.local";
const DEFAULT_USER_NAME = "Founder";

export function mergeUserPreferences(
  rawExisting: string | null | undefined,
  patch?: Partial<UserPreferences> | null,
): Required<UserPreferences> {
  const existing = parseUserPreferences(rawExisting);
  if (!patch) return existing;
  return parseUserPreferences(JSON.stringify({ ...existing, ...patch }));
}

export interface AuthenticatedUserSummary {
  id: string;
  email: string;
  name: string;
  onboardedAt: string | null;
  hasCompletedOnboarding: boolean;
  preferences: Required<UserPreferences>;
}

let cachedFounderUserId: string | null = null;

async function readRequestCookies(): Promise<{
  cookieUserId?: string;
  cookieEmail?: string;
}> {
  try {
    const store = await cookies();
    const cookieUserId = store.get(SPAR_USER_COOKIE)?.value?.trim();
    const cookieEmail = store.get(SPAR_EMAIL_COOKIE)?.value?.trim();
    return {
      cookieUserId: cookieUserId || undefined,
      cookieEmail: cookieEmail || undefined,
    };
  } catch {
    // Outside a Next.js request context (e.g., unit tests or background scripts)
    return {};
  }
}

export async function upsertAuthenticatedUser(params: {
  email: string;
  name?: string;
}): Promise<AuthenticatedUserSummary> {
  const normalizedEmail = params.email.trim().toLowerCase();
  const cleanName = params.name?.trim().slice(0, 60);

  const existing = await db.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    const existingPrefs = parseUserPreferences(existing.preferences);
    if (cleanName && cleanName.length >= 1 && existing.name !== cleanName) {
      const updated = await db.user.update({
        where: { id: existing.id },
        data: { name: cleanName },
      });
      void syncToSupabaseTable("User", {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        onboardedAt: updated.onboardedAt?.toISOString() ?? null,
        preferences: updated.preferences ?? null,
        updatedAt: new Date().toISOString(),
      });
      const onboardedIso = updated.onboardedAt?.toISOString() ?? null;
      return {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        onboardedAt: onboardedIso,
        hasCompletedOnboarding: Boolean(
          updated.onboardedAt ||
            (updated.name && updated.name !== "Founder" && updated.preferences),
        ),
        preferences: existingPrefs,
      };
    }
    void syncToSupabaseTable("User", {
      id: existing.id,
      email: existing.email,
      name: existing.name,
      onboardedAt: existing.onboardedAt?.toISOString() ?? null,
      preferences: existing.preferences ?? null,
      updatedAt: new Date().toISOString(),
    });
    const onboardedIso = existing.onboardedAt?.toISOString() ?? null;
    return {
      id: existing.id,
      email: existing.email,
      name: existing.name,
      onboardedAt: onboardedIso,
      hasCompletedOnboarding: Boolean(
        existing.onboardedAt ||
          (existing.name && existing.name !== "Founder" && existing.preferences),
      ),
      preferences: existingPrefs,
    };
  }

  const fallbackName = normalizedEmail.split("@")[0] || "Tester";
  const created = await db.user.create({
    data: {
      email: normalizedEmail,
      name: cleanName || fallbackName,
    },
  });
  void syncToSupabaseTable("User", {
    id: created.id,
    email: created.email,
    name: created.name,
    onboardedAt: null,
    preferences: null,
    updatedAt: new Date().toISOString(),
  });
  return {
    id: created.id,
    email: created.email,
    name: created.name,
    onboardedAt: null,
    hasCompletedOnboarding: false,
    preferences: { ...DEFAULT_USER_PREFERENCES },
  };
}

export async function getDefaultUserId(): Promise<string> {
  const { cookieUserId, cookieEmail } = await readRequestCookies();

  if (cookieUserId) {
    const cookieUser = await db.user.findUnique({
      where: { id: cookieUserId },
    });
    if (cookieUser) {
      return cookieUser.id;
    }
  }

  if (cookieEmail) {
    const byEmail = await upsertAuthenticatedUser({ email: cookieEmail });
    return byEmail.id;
  }

  if (cachedFounderUserId) return cachedFounderUserId;

  let user = await db.user.findUnique({
    where: { email: DEFAULT_USER_EMAIL },
  });

  if (!user) {
    user = await db.user.create({
      data: {
        email: DEFAULT_USER_EMAIL,
        name: DEFAULT_USER_NAME,
      },
    });
  }

  cachedFounderUserId = user.id;
  return user.id;
}

export async function getDefaultUser() {
  const id = await getDefaultUserId();
  return db.user.findUnique({ where: { id } });
}
