// Spar — Creator Studio Passkey Verification API

import { NextRequest, NextResponse } from "next/server";
import { verifyCreatorPasskey } from "@/lib/course-store";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { passkey?: string };
  if (!body.passkey || typeof body.passkey !== "string") {
    return NextResponse.json(
      { valid: false, error: "Passkey is required" },
      { status: 400 }
    );
  }

  const valid = verifyCreatorPasskey(body.passkey);
  if (!valid) {
    return NextResponse.json(
      { valid: false, error: "Invalid Creator Passkey" },
      { status: 401 }
    );
  }

  return NextResponse.json({ valid: true });
}
