// Spar — Learner Course Progress API

import { NextRequest, NextResponse } from "next/server";
import { listCompletions, recordLessonCompletion } from "@/lib/course-store";

export async function GET() {
  const completions = listCompletions();
  return NextResponse.json({ completions });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    courseId?: string;
    lessonId?: string;
    sessionId?: string | null;
  };

  if (!body.courseId || !body.lessonId) {
    return NextResponse.json(
      { error: "courseId and lessonId are required" },
      { status: 400 }
    );
  }

  const completion = recordLessonCompletion({
    courseId: body.courseId,
    lessonId: body.lessonId,
    sessionId: body.sessionId ?? null,
  });

  return NextResponse.json({
    completion,
    completions: listCompletions(),
  });
}
