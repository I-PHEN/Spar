// Spar — persist one finalized Gemini Live exchange
//
// Live rooms bypass POST /spar-stream entirely (the Live socket owns
// generation), so without this route their Q&A would exist only in client
// state and the end-of-session debrief would run on an empty transcript.
// The client fires this route fire-and-forget each time a live turn
// finalizes (turn-complete): the user transcript(s) finalized since the last
// exchange plus the finalized assistant caption. Messages are written with
// the same shapes, role vocabulary, and length limits as /spar-stream
// (user 5 000, persona 2 000), attributed to the panel's lead (lowest seat)
// panelist — the room's one-socket, one-voice rule — so the debrief, drill
// stats, and pattern memory read a coherent transcript whichever engine
// served the room.

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

const liveExchangeBodySchema = z.object({
  turnId: z.string().min(1).max(128),
  userTranscripts: z.array(z.string().trim().min(1).max(20_000)).min(1).max(8),
  assistantTranscript: z.string().trim().min(1).max(20_000),
}).strict();

function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (origin !== null && origin !== new URL(request.url).origin) {
    return jsonResponse({ error: "Forbidden." }, 403);
  }

  const { id } = await params;
  const payload = await request.json().catch(() => null);
  const parsed = liveExchangeBodySchema.safeParse(payload);
  if (!parsed.success) {
    return jsonResponse({ error: "Invalid live exchange." }, 400);
  }

  const session = await db.session.findUnique({
    where: { id },
    include: { personas: { orderBy: { seatOrder: "asc" }, take: 1 } },
  });
  if (!session) {
    return jsonResponse({ error: "Session not found" }, 404);
  }
  // Same status contract as POST /spar-stream: Q&A exchanges belong to an
  // active room (a Boardroom mid-presentation exchange stays "presenting").
  if (session.status !== "active" && session.status !== "presenting") {
    return jsonResponse(
      { error: `Session not active (status: ${session.status})` },
      400,
    );
  }
  // The Live session is voiced by the panel's lead panelist, so attribution
  // is derived server-side from the panel instead of trusted from the client.
  const leadPanelist = session.personas[0];
  if (!leadPanelist) {
    return jsonResponse({ error: "No persona available" }, 500);
  }

  try {
    // User half(s) first, then the assistant half — the transcript order the
    // debrief, drill stats, and pattern memory already read.
    for (const transcript of parsed.data.userTranscripts) {
      await db.sessionMessage.create({
        data: {
          sessionId: id,
          role: "user",
          content: transcript.trim().slice(0, 5_000),
          type: "normal",
        },
      });
    }
    await db.sessionMessage.create({
      data: {
        sessionId: id,
        personaId: leadPanelist.id,
        role: "persona",
        content: parsed.data.assistantTranscript.trim().slice(0, 2_000),
        type: "normal",
        claimRef: null,
      },
    });
    return jsonResponse({ accepted: true }, 202);
  } catch {
    // Error details are discarded: the client treats this write as
    // fire-and-forget and must not surface persistence failures.
    return jsonResponse({ error: "Unable to persist live exchange." }, 500);
  }
}
