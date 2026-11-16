// Spar — current user endpoint (cookie/Supabase isolated per tester)

import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  SPAR_EMAIL_COOKIE,
  SPAR_USER_COOKIE,
  type UserPreferences,
  getDefaultUserId,
  mergeUserPreferences,
  parseUserPreferences,
  upsertAuthenticatedUser,
} from "@/lib/user";
import { getSupabaseConfig, syncToSupabaseTable } from "@/lib/supabase";
import { db } from "@/lib/db";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export async function GET(req?: NextRequest) {
  const hasCookie = Boolean(req?.cookies?.get(SPAR_USER_COOKIE)?.value);
  const userId = await getDefaultUserId();
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const authenticated = Boolean(hasCookie || user.email !== "founder@spar.local");
  const supabaseConfigured = getSupabaseConfig().configured;
  const cloudSyncEnabled = Boolean(
    supabaseConfigured && user.email !== "founder@spar.local",
  );
  const hasCompletedOnboarding = Boolean(
    user.onboardedAt ||
      (user.name && user.name !== "Founder" && user.preferences),
  );
  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    authenticated,
    supabaseConfigured,
    cloudSyncEnabled,
    hasCompletedOnboarding,
    onboardedAt: user.onboardedAt ? user.onboardedAt.toISOString() : null,
    preferences: parseUserPreferences(user.preferences),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { name, completeOnboarding, preferences } = body as {
    name?: string;
    completeOnboarding?: boolean;
    preferences?: Partial<UserPreferences>;
  };

  if (typeof name === "string" && name.trim().length > 0 && name.trim().length < 2) {
    return NextResponse.json(
      { error: "Name must be at least 2 characters" },
      { status: 400 },
    );
  }

  const hasNameInput = typeof name === "string" && name.trim().length >= 2;
  const hasPrefsUpdate = Boolean(preferences && typeof preferences === "object");
  if (!hasNameInput && !hasPrefsUpdate && completeOnboarding !== true) {
    return NextResponse.json(
      { error: "Name must be at least 2 characters" },
      { status: 400 },
    );
  }

  const hasCookie = Boolean(req.cookies.get(SPAR_USER_COOKIE)?.value);
  const currentUserId = await getDefaultUserId();
  const currentUser = await db.user.findUnique({
    where: { id: currentUserId },
  });

  const resolvedName = hasNameInput
    ? name.trim().slice(0, 60)
    : currentUser?.name || "Operator";

  // If no tester cookie exists and we're still on the default founder record,
  // create an isolated tester user row so concurrent browsers don't collide.
  if (!hasCookie && (!currentUser || currentUser.email === "founder@spar.local")) {
    const suffix = randomBytes(6).toString("hex");
    const isolated = await upsertAuthenticatedUser({
      email: `tester-${suffix}@spar.local`,
      name: resolvedName,
    });
    const mergedPrefs = mergeUserPreferences(null, preferences);
    const onboardedDate = completeOnboarding ? new Date() : null;
    const saved = await db.user.update({
      where: { id: isolated.id },
      data: {
        preferences: JSON.stringify(mergedPrefs),
        ...(onboardedDate ? { onboardedAt: onboardedDate } : {}),
      },
    });
    void syncToSupabaseTable("User", {
      id: saved.id,
      email: saved.email,
      name: saved.name,
      onboardedAt: saved.onboardedAt?.toISOString() ?? null,
      preferences: saved.preferences ?? null,
      updatedAt: new Date().toISOString(),
    });
    const supabaseConfigured = getSupabaseConfig().configured;
    const res = NextResponse.json({
      id: saved.id,
      name: saved.name,
      email: saved.email,
      authenticated: true,
      supabaseConfigured,
      cloudSyncEnabled: supabaseConfigured,
      hasCompletedOnboarding: Boolean(saved.onboardedAt),
      onboardedAt: saved.onboardedAt ? saved.onboardedAt.toISOString() : null,
      preferences: mergedPrefs,
    });
    const isProd = process.env.NODE_ENV === "production";
    res.cookies.set(SPAR_USER_COOKIE, saved.id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      maxAge: COOKIE_MAX_AGE_SECONDS,
    });
    res.cookies.set(SPAR_EMAIL_COOKIE, saved.email, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      maxAge: COOKIE_MAX_AGE_SECONDS,
    });
    return res;
  }

  const mergedPrefs = mergeUserPreferences(currentUser?.preferences, preferences);
  const nextOnboardedAt =
    completeOnboarding === true
      ? currentUser?.onboardedAt ?? new Date()
      : currentUser?.onboardedAt ?? null;

  const updated = await db.user.update({
    where: { id: currentUserId },
    data: {
      name: resolvedName,
      preferences: JSON.stringify(mergedPrefs),
      ...(completeOnboarding === true && !currentUser?.onboardedAt
        ? { onboardedAt: nextOnboardedAt ?? new Date() }
        : {}),
    },
  });

  void syncToSupabaseTable("User", {
    id: updated.id,
    email: updated.email,
    name: updated.name,
    onboardedAt: updated.onboardedAt?.toISOString() ?? null,
    preferences: updated.preferences ?? null,
    updatedAt: new Date().toISOString(),
  });

  const supabaseConfigured = getSupabaseConfig().configured;
  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    authenticated: true,
    supabaseConfigured,
    cloudSyncEnabled: Boolean(
      supabaseConfigured && updated.email !== "founder@spar.local",
    ),
    hasCompletedOnboarding: Boolean(
      updated.onboardedAt ||
        (updated.name && updated.name !== "Founder" && updated.preferences),
    ),
    onboardedAt: updated.onboardedAt ? updated.onboardedAt.toISOString() : null,
    preferences: mergedPrefs,
  });
}
