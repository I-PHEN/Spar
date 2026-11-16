// Spar — upcoming moment (drives the Home countdown & calendar sync)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  formatMomentDisplayDate,
  isMomentUpcoming,
  parseServerMomentDate,
} from "@/lib/moment-calendar";
import { getDefaultUser, getDefaultUserId } from "@/lib/user";
import { getSupabaseConfig, syncToSupabaseTable } from "@/lib/supabase";

async function syncMomentToSupabase(moment: {
  id: string;
  userId: string;
  title: string;
  detail: string | null;
  date: Date;
  createdAt: Date;
}) {
  const cfg = getSupabaseConfig();
  if (!cfg.configured) return;

  const user = await db.user.findUnique({ where: { id: moment.userId } });
  if (user) {
    await syncToSupabaseTable("User", {
      id: user.id,
      email: user.email,
      name: user.name,
      onboardedAt: user.onboardedAt?.toISOString() ?? null,
      preferences: user.preferences ?? null,
      updatedAt: new Date().toISOString(),
    });
  }

  await syncToSupabaseTable("UpcomingMoment", {
    id: moment.id,
    userId: moment.userId,
    title: moment.title,
    detail: moment.detail,
    date: moment.date.toISOString(),
    createdAt: moment.createdAt.toISOString(),
  });
}

async function sendMomentConfirmationEmail(params: {
  to: string;
  userName: string;
  title: string;
  detail: string | null;
  date: Date;
}): Promise<"sent" | "skipped_missing_key" | "skipped_local_email" | "failed"> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return "skipped_missing_key";
  if (!params.to || params.to.endsWith("@spar.local")) {
    return "skipped_local_email";
  }

  const fromEmail =
    process.env.SPAR_EMAIL_FROM?.trim() || "Spar <onboarding@resend.dev>";
  const displayWhen = formatMomentDisplayDate(params.date);
  const safeDetail = params.detail
    ? `<p style="color:#a1a1aa;font-size:14px;margin:8px 0 0;">Focus: ${params.detail.replace(/</g, "&lt;")}</p>`
    : "";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [params.to],
        subject: `Spar Moment Scheduled: ${params.title} (${displayWhen})`,
        html: `<div style="font-family:Inter,system-ui,sans-serif;background:#0a0a0e;color:#f5f5f7;padding:24px;border-radius:12px;">
          <p style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#6d93f9;margin:0 0 8px;">Spar Preparation Ledger</p>
          <h2 style="font-size:20px;margin:0 0 6px;">${params.title.replace(/</g, "&lt;")}</h2>
          <p style="font-size:14px;color:#d4d4d8;margin:0;">Target date: <strong>${displayWhen}</strong></p>
          ${safeDetail}
          <p style="font-size:13px;color:#a1a1aa;margin:16px 0 0;">Open Spar before then to run targeted Q&amp;A rounds and tighten your weak spots, ${params.userName.replace(/</g, "&lt;")}.</p>
        </div>`,
      }),
    });
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

export async function GET() {
  const userId = await getDefaultUserId();
  const moments = await db.upcomingMoment.findMany({
    where: { userId },
    orderBy: { date: "asc" },
  });
  const now = new Date();
  const upcoming = moments.find((m) => isMomentUpcoming(m.date, now)) ?? null;
  return NextResponse.json({ upcoming, all: moments });
}

export async function POST(req: NextRequest) {
  const user = await getDefaultUser();
  const userId = user?.id ?? (await getDefaultUserId());
  const body = await req.json().catch(() => ({}));
  const { title, detail, date, sendEmailConfirmation } = body as {
    title?: string;
    detail?: string;
    date?: string;
    sendEmailConfirmation?: boolean;
  };

  if (!title?.trim() || !date?.trim()) {
    return NextResponse.json(
      { error: "Title and target date are required." },
      { status: 400 },
    );
  }

  const parsedDate = parseServerMomentDate(date);
  if (!parsedDate) {
    return NextResponse.json({ error: "Invalid date format." }, { status: 400 });
  }

  // v1: only one active upcoming moment per user at a time (deterministic id mirrors cleanly to Supabase).
  await db.upcomingMoment.deleteMany({ where: { userId } });
  const moment = await db.upcomingMoment.create({
    data: {
      id: `moment-${userId}`,
      userId,
      title: String(title).trim().slice(0, 120),
      detail: detail?.trim() ? String(detail).trim().slice(0, 500) : null,
      date: parsedDate,
    },
  });

  void syncMomentToSupabase(moment);

  let emailStatus: string | undefined;
  if (sendEmailConfirmation && user?.email) {
    emailStatus = await sendMomentConfirmationEmail({
      to: user.email,
      userName: user.name,
      title: moment.title,
      detail: moment.detail,
      date: moment.date,
    });
  }

  return NextResponse.json({
    ...moment,
    ...(emailStatus ? { emailStatus } : {}),
  });
}

export async function DELETE() {
  const userId = await getDefaultUserId();
  await db.upcomingMoment.deleteMany({ where: { userId } });
  return NextResponse.json({ ok: true });
}
