// Spar — Auth session endpoint (Supabase Auth token verification + per-tester isolation)

import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSupabaseConfig, verifySupabaseToken } from "@/lib/supabase";
import {
  SPAR_EMAIL_COOKIE,
  SPAR_USER_COOKIE,
  getDefaultUserId,
  parseUserPreferences,
  upsertAuthenticatedUser,
} from "@/lib/user";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function attachSessionCookies(
  res: NextResponse,
  user: { id: string; email: string },
) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookies.set(SPAR_USER_COOKIE, user.id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
  res.cookies.set(SPAR_EMAIL_COOKIE, user.email, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export async function GET(req: NextRequest) {
  const cfg = getSupabaseConfig();
  const hasCookie = Boolean(req.cookies.get(SPAR_USER_COOKIE)?.value);
  const userId = await getDefaultUserId();
  const user = await db.user.findUnique({ where: { id: userId } });

  if (!user) {
    return NextResponse.json({
      authenticated: false,
      supabaseConfigured: cfg.configured,
      user: null,
    });
  }

  return NextResponse.json({
    authenticated: hasCookie || user.email !== "founder@spar.local",
    supabaseConfigured: cfg.configured,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      onboardedAt: user.onboardedAt ? user.onboardedAt.toISOString() : null,
      hasCompletedOnboarding: Boolean(
        user.onboardedAt ||
          (user.name && user.name !== "Founder" && user.preferences),
      ),
      preferences: parseUserPreferences(user.preferences),
    },
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    accessToken?: string;
    email?: string;
    name?: string;
    createGuestSession?: boolean;
  };

  const cfg = getSupabaseConfig();
  let resolvedEmail: string | undefined;
  let resolvedName: string | undefined = body.name?.trim() || undefined;

  if (body.accessToken && cfg.configured) {
    const verified = await verifySupabaseToken(body.accessToken);
    if (!verified) {
      return NextResponse.json(
        { error: "Invalid or expired Supabase session token" },
        { status: 401 },
      );
    }
    resolvedEmail = verified.email;
    resolvedName = resolvedName || verified.name;
  } else if (body.email && body.email.includes("@")) {
    resolvedEmail = body.email.trim().toLowerCase();
  } else if (body.createGuestSession || resolvedName) {
    const suffix = randomBytes(6).toString("hex");
    resolvedEmail = `tester-${suffix}@spar.local`;
    resolvedName = resolvedName || "Tester";
  }

  if (!resolvedEmail) {
    return NextResponse.json(
      { error: "Provide accessToken, email, or name to start a session" },
      { status: 400 },
    );
  }

  const user = await upsertAuthenticatedUser({
    email: resolvedEmail,
    name: resolvedName,
  });

  const res = NextResponse.json({
    authenticated: true,
    supabaseConfigured: cfg.configured,
    user,
  });
  attachSessionCookies(res, user);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SPAR_USER_COOKIE);
  res.cookies.delete(SPAR_EMAIL_COOKIE);
  return res;
}
