// SharkPit — current user endpoint (v1: single hardcoded user)

import { NextResponse } from "next/server";
import { getDefaultUser } from "@/lib/user";

export async function GET() {
  const user = await getDefaultUser();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
  });
}
