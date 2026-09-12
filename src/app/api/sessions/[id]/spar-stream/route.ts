// Spar — Streaming spar endpoint (SSE)
//
// This endpoint streams the persona response token-by-token via Server-Sent Events.
// As the LLM generates text, we:
//   1. Accumulate tokens
//   2. Detect sentence boundaries
//   3. Fire Deepgram TTS for each completed sentence (in parallel)
//   4. Send each sentence + its audio to the client immediately
//
// The client receives sentences as they're ready and plays audio sequentially.
// This reduces perceived latency from ~4.3s to ~2-2.5s.
//
// SSE events:
//   event: start    → { personaId, personaName, archetype }
//   event: sentence → { text, audio, index }
//   event: done      → { isUserTurn, type, claimRef, mood, messageId }

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { buildPersonaSystemPrompt } from "@/lib/personas";
import { buildPatternMemoryContext, classifyPatternTag } from "@/lib/llm";
import { generatePersonaAudio } from "@/lib/voice";
import { buildDrillPrompt, buildDrillInterruptInstruction } from "@/lib/drills";
import {
  streamPersonaResponse,
  parseStreamedPersonaResponse,
  extractPartialContent,
  splitSentences,
} from "@/lib/openrouter";
import { SCENARIOS } from "@/lib/scenarios";
import type { ArchetypeKey, ExtractedClaim } from "@/lib/types";

const PERSONAS_PER_USER_TURN = 1;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const session = await db.session.findUnique({
    where: { id },
    include: {
      personas: { orderBy: { seatOrder: "asc" } },
      messages: { orderBy: { createdAt: "asc" } },
      user: {
        include: {
          patternMemories: { orderBy: { lastSeen: "desc" }, take: 5 },
          sessions: {
            where: { status: "debriefed" },
            orderBy: { endedAt: "desc" },
            take: 2,
            include: { summary: true, personas: true },
          },
        },
      },
    },
  });

  if (!session) {
    return new Response("Session not found", { status: 404 });
  }

  if (session.status !== "active") {
    return new Response(`Session not active (status: ${session.status})`, { status: 400 });
  }

  // Persist user message if provided
  if (body.userMessage && body.userMessage.trim().length > 0) {
    await db.sessionMessage.create({
      data: {
        sessionId: session.id,
        role: "user",
        content: body.userMessage.trim().slice(0, 5000),
        type: "normal",
      },
    });
    session.messages = await db.sessionMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "asc" },
    });
  }

  // Count responses this turn
  const messagesSinceLastUser: typeof session.messages = [];
  for (let i = session.messages.length - 1; i >= 0; i--) {
    if (session.messages[i].role === "user") break;
    messagesSinceLastUser.unshift(session.messages[i]);
  }
  const personasCount = session.personas.length;
  const responsesThisTurn = messagesSinceLastUser.filter(
    (m) => m.role === "persona"
  ).length;

  if (responsesThisTurn >= Math.min(PERSONAS_PER_USER_TURN, personasCount)) {
    return new Response(
      JSON.stringify({ isUserTurn: true, personaResponse: null }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // Determine next persona
  let nextPersona;
  if (body.forcedPersonaId) {
    nextPersona = session.personas.find((p) => p.id === body.forcedPersonaId);
  } else {
    const lastPersonaMsg = [...messagesSinceLastUser]
      .reverse()
      .find((m) => m.role === "persona");
    let nextOrder = 0;
    if (lastPersonaMsg) {
      const lastPersona = session.personas.find(
        (p) => p.id === lastPersonaMsg.personaId
      );
      if (lastPersona) {
        nextOrder = (lastPersona.seatOrder + 1) % personasCount;
      }
    }
    nextPersona = session.personas.find((p) => p.seatOrder === nextOrder);
  }

  if (!nextPersona) {
    return new Response("No persona available", { status: 500 });
  }

  // Build prompts (same as the non-streaming spar endpoint)
  const transcriptStr = session.messages
    .map((m) => {
      if (m.role === "user") return `User: ${m.content}`;
      if (m.role === "persona") {
        const p = session.personas.find((pp) => pp.id === m.personaId);
        return `${p?.name || "Panelist"}: ${m.content}`;
      }
      return null;
    })
    .filter(Boolean)
    .join("\n");

  const claims: ExtractedClaim[] = session.extractedClaims
    ? safeParse(session.extractedClaims, [])
    : [];

  const scenario = SCENARIOS[session.scenario as keyof typeof SCENARIOS];
  const scenarioLabel = scenario?.label || "Custom Session";

  const experienceContext =
    session.experience === "defense"
      ? "\n## EXPERIENCE: DEFENSE\nThe user has already presented their material. The transcript above includes their full presentation. Ask questions about what they actually said."
      : session.experience === "boardroom"
      ? "\n## EXPERIENCE: BOARDROOM\nYou are in a high-pressure boardroom. The user is presenting and you may interrupt mid-speech."
      : session.experience === "drill"
      ? buildDrillPrompt((session.drillTarget as any) || "hedging")
      : "";

  const otherPersonas = session.personas
    .filter((p) => p.id !== nextPersona.id)
    .map((p) => ({ name: p.name, archetype: p.archetype as ArchetypeKey }));

  const patternMemory = buildPatternMemoryContext({
    patterns: session.user.patternMemories.map((p) => ({
      tag: p.tag,
      description: p.description,
      occurrences: p.occurrences,
    })),
    recentSummaries: session.user.sessions
      .filter((s) => s.summary)
      .map((s) => ({
        scenarioLabel:
          SCENARIOS[s.scenario as keyof typeof SCENARIOS]?.label || s.scenario,
        thePattern: s.summary!.thePattern,
        oneThingToPractice: s.summary!.oneThingToPractice,
        createdAt: s.endedAt || s.createdAt,
      })),
  });

  const systemPrompt = buildPersonaSystemPrompt({
    archetype: nextPersona.archetype as ArchetypeKey,
    behaviorStyle: nextPersona.behaviorStyle as "gentle" | "moderate" | "aggressive",
    scenarioLabel,
    claims,
    patternMemory: patternMemory + experienceContext,
    otherPersonas,
  });

  // Get the user message for the LLM
  let userMessageForLlm = body.userMessage;
  if (!userMessageForLlm) {
    const lastUserMsg = [...session.messages]
      .reverse()
      .find((m) => m.role === "user");
    userMessageForLlm = lastUserMsg?.content || "(User has not yet spoken.)";
  }

  // Build the user prompt (same structure as the non-streaming endpoint)
  const interruptInstruction = body.isInterrupt
    ? `\n# IMPORTANT: YOU ARE INTERRUPTING\nThe user was still speaking when you cut in. Open with a sharp cutting-in phrase — "Hold on—", "Let me stop you there—", "Wait—". Set "type": "interruption" in your JSON response.`
    : "";

  const drillInterruptInstruction =
    body.isInterrupt && session.experience === "drill"
      ? buildDrillInterruptInstruction(
          (session.drillTarget as any) || "hedging"
        )
      : "";

  const userPrompt = `# CONVERSATION SO FAR
${transcriptStr || "(Session just started.)"}

# WHAT THE USER JUST SAID
${userMessageForLlm}
${interruptInstruction}
${drillInterruptInstruction}

Respond now with your JSON object. Remember: 1-3 sentences max, in-character, strict JSON.`;

  // ─── Stream the response ────────────────────────────────────────────

  const encoder = new TextEncoder();
  let isClosed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (isClosed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Controller may have been closed — ignore
        }
      };

      // Send start event
      send("start", {
        personaId: nextPersona.id,
        personaName: nextPersona.name,
        archetype: nextPersona.archetype,
        behaviorStyle: nextPersona.behaviorStyle,
        seatOrder: nextPersona.seatOrder,
      });

      try {
        let fullText = "";

        // Stream tokens from OpenRouter — accumulate the full response
        for await (const token of streamPersonaResponse(systemPrompt, userPrompt)) {
          fullText += token.content;
        }

        // Parse the full JSON response
        const parsed = parseStreamedPersonaResponse(fullText);
        const content = parsed?.content || "";
        const type = parsed?.type || (body.isInterrupt ? "interruption" : "normal");
        const claimRef = parsed?.claimRef ?? null;
        const mood = parsed?.mood || "neutral";

        if (!content) {
          send("error", { message: "Empty persona response" });
          return;
        }

        // Generate TTS for the full content
        const audio = await generatePersonaAudio(
          content,
          nextPersona.archetype as ArchetypeKey,
          nextPersona.behaviorStyle as "gentle" | "moderate" | "aggressive"
        );

        // Send the sentence + audio to the client
        send("sentence", {
          text: content,
          audio,
          index: 0,
        });

        // Persist the message
        const message = await db.sessionMessage.create({
          data: {
            sessionId: session.id,
            personaId: nextPersona.id,
            role: "persona",
            content: content.slice(0, 2000),
            type,
            claimRef,
          },
        });

        // Determine if this was the last response for this turn
        const newResponsesThisTurn = responsesThisTurn + 1;
        const isUserTurn =
          newResponsesThisTurn >= Math.min(PERSONAS_PER_USER_TURN, personasCount);

        // Send done event
        send("done", {
          isUserTurn,
          type,
          claimRef,
          mood,
          messageId: message.id,
        });
      } catch (err) {
        console.error("[spar-stream] Error:", err);
        send("error", {
          message: err instanceof Error ? err.message : "Streaming failed",
        });
      } finally {
        isClosed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function safeParse<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
