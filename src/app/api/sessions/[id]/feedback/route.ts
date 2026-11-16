// Spar — Post-session tester feedback endpoint (rating, tags, comment)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { syncToSupabaseTable } from "@/lib/supabase";
import { getDefaultUserId } from "@/lib/user";

export interface SessionFeedbackEntry {
  id: string;
  sessionId: string;
  userId: string;
  rating: number;
  tags: string[];
  comment: string | null;
  createdAt: string;
}

const FEEDBACK_PATH = join(process.cwd(), "data", "feedback-store.json");

function readFeedbackStore(): SessionFeedbackEntry[] {
  try {
    if (!existsSync(FEEDBACK_PATH)) return [];
    const raw = readFileSync(FEEDBACK_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SessionFeedbackEntry[]) : [];
  } catch {
    return [];
  }
}

function writeFeedbackStore(entries: SessionFeedbackEntry[]) {
  try {
    const dir = dirname(FEEDBACK_PATH);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(FEEDBACK_PATH, JSON.stringify(entries, null, 2), "utf8");
  } catch {
    // Non-fatal in read-only serverless environments (Supabase REST stores remotely)
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const entries = readFeedbackStore();
  const feedback = entries.find((entry) => entry.sessionId === id) ?? null;
  return NextResponse.json({ feedback });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await getDefaultUserId();
  const body = (await req.json().catch(() => ({}))) as {
    rating?: number;
    tags?: string[];
    comment?: string;
  };

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "Rating must be an integer between 1 and 5" },
      { status: 400 },
    );
  }

  const tags = Array.isArray(body.tags)
    ? body.tags
        .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        .map((t) => t.trim().slice(0, 60))
        .slice(0, 8)
    : [];

  const comment =
    typeof body.comment === "string" && body.comment.trim().length > 0
      ? body.comment.trim().slice(0, 1000)
      : null;

  const entry: SessionFeedbackEntry = {
    id: `fb-${id}`,
    sessionId: id,
    userId,
    rating,
    tags,
    comment,
    createdAt: new Date().toISOString(),
  };

  const existing = readFeedbackStore().filter((e) => e.sessionId !== id);
  existing.push(entry);
  writeFeedbackStore(existing);

  const syncedToSupabase = await syncToSupabaseTable("spar_feedback", {
    id: entry.id,
    session_id: entry.sessionId,
    user_id: entry.userId,
    rating: entry.rating,
    tags: entry.tags,
    comment: entry.comment,
    created_at: entry.createdAt,
  });

  return NextResponse.json({
    feedback: entry,
    syncedToSupabase,
  });
}
