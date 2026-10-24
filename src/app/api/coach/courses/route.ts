// Spar — Coach Courses API (Learner Catalog + Creator Studio CRUD)

import { NextRequest, NextResponse } from "next/server";
import {
  deleteCourse,
  listCompletions,
  listCourses,
  upsertCourse,
} from "@/lib/course-store";
import type { Course } from "@/lib/courses";

export async function GET(req: NextRequest) {
  const isStudio = req.nextUrl.searchParams.get("studio") === "1";
  const courses = listCourses({ includeDrafts: isStudio });
  const completions = listCompletions();
  return NextResponse.json({ courses, completions });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { course?: Course };
  if (!body.course || typeof body.course.id !== "string") {
    return NextResponse.json(
      { error: "Valid course payload is required" },
      { status: 400 }
    );
  }

  const saved = upsertCourse(body.course);
  return NextResponse.json({ course: saved });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: "Course id is required" },
      { status: 400 }
    );
  }
  const deleted = deleteCourse(id);
  return NextResponse.json({ deleted });
}
