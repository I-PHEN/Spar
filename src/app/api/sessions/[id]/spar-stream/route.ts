// Spar — Streaming spar endpoint (SSE) with caching + pipelining
//
// Optimizations:
//   1. Caches the system prompt + session data after the first call (~2s saved)
//   2. Uses OpenRouter (gpt-oss-20b) with true token streaming (~1s to first token)
//   3. Pipelines TTS: fires Deepgram per sentence as it completes from the LLM stream
//   4. Sends each sentence + audio to the client immediately via SSE
//
// Target perceived latency: ~2-3s from "stop speaking" to "first audio"

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { liveTurnService, type LiveTurnRequest } from "@/lib/spar/live-turn-service";
import {
  buildPersonaSessionRules,
  buildPersonaStablePrefix,
} from "@/lib/personas";
import { buildPatternMemoryContext } from "@/lib/llm";
import {
  MAX_RECENT_MESSAGES,
  MAX_ROLLING_SUMMARY_TOKENS,
  buildPersonaContext,
} from "@/lib/persona/context-builder";
import { generatePersonaAudio } from "@/lib/voice";
import {
  buildDrillPrompt,
  buildDrillInterruptInstruction,
  buildDrillNextQuestionInstruction,
  buildBoardroomInterruptInstruction,
  getDrillCorrection,
  getDrillAcknowledgment,
} from "@/lib/drills";
import {
  streamPersonaResponse,
  parseStreamedPersonaResponse,
  extractPartialContent,
} from "@/lib/openrouter";
import {
  getCachedSession,
  setCachedSession,
  getCachedPrompt,
  setCachedPrompt,
} from "@/lib/session-cache";
import { SCENARIOS } from "@/lib/scenarios";
import type { ArchetypeKey, DrillTarget, ExtractedClaim } from "@/lib/types";

const PERSONAS_PER_USER_TURN = 1;
const PATTERN_MEMORY_CACHE_KEY = "__pattern-memory__";

const liveTurnBodySchema = z.object({
  turnId: z.string().min(1).max(128),
  transcript: z.string().min(1).max(5_000),
  confidence: z.number().finite().min(0).max(1),
  forcedPersonaId: z.string().min(1).max(128).optional(),
  isInterrupt: z.boolean().optional(),
  drillInterrupt: z.boolean().optional(),
  drillClean: z.boolean().optional(),
  presentationHandoff: z.boolean().optional(),
}).strict();

const LIVE_PROTOCOL_FIELDS = [
  "turnId", "transcript", "confidence", "forcedPersonaId", "isInterrupt",
  "drillInterrupt", "drillClean", "presentationHandoff",
] as const;

function liveTurnResponse(request: LiveTurnRequest, signal: AbortSignal): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of liveTurnService(request, signal)) {
          if (signal.aborted) break;
          controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
        }
      } finally {
        try { controller.close(); } catch { /* request disconnected */ }
      }
    },
    cancel() { /* request.signal is the single cancellation authority */ },
  });
  return new Response(stream, { headers: {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
    Connection: "keep-alive",
  } });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const livePayload = await req.clone().json().catch(() => null);
  if (livePayload && typeof livePayload === "object" && LIVE_PROTOCOL_FIELDS.some(field => field in livePayload)) {
    const parsed = liveTurnBodySchema.safeParse(livePayload);
    if (!parsed.success) return Response.json({ error: "Invalid live turn request." }, { status: 400 });
    return liveTurnResponse({ sessionId: id, ...parsed.data }, req.signal);
  }
  const body = await req.json().catch(() => ({}));

  // ─── Warmup: just compile the route, don't do any work ──────────────
  if (body._warmup) {
    return new Response(JSON.stringify({ warmup: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // ─── 1. Persist user message (fast, always needed) ──────────────────
  if (body.userMessage && body.userMessage.trim().length > 0) {
    await db.sessionMessage.create({
      data: {
        sessionId: id,
        role: "user",
        content: body.userMessage.trim().slice(0, 5000),
        type: "normal",
      },
    });
  }

  // ─── 2. Get session data (from cache or DB) ─────────────────────────
  let cached = getCachedSession(id);

  let nextPersonaId: string;
  let nextPersona: {
    id: string;
    archetype: string;
    name: string;
    behaviorStyle: string;
    seatOrder: number;
  } | undefined;
  let stablePrefix: string;
  let patternMemory: string;
  let claims: ExtractedClaim[];
  let scenarioLabel: string;
  let roomContext: string;
  let experience: string;
  let drillTarget: string | null;
  let personaIds: string[];
  let personaMap: Map<
    string,
    {
      id: string;
      archetype: string;
      name: string;
      behaviorStyle: string;
      seatOrder: number;
    }
  >;

  if (cached) {
    // ─── CACHE HIT: skip DB + prompt building ──────────────────────
    // Determine next persona (round-robin)
    const messages = await db.sessionMessage.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: "asc" },
      select: { role: true, personaId: true, content: true, type: true, createdAt: true },
    });

    // Count responses this turn
    const messagesSinceLastUser: typeof messages = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") break;
      messagesSinceLastUser.unshift(messages[i]);
    }
    const personasCount = cached.personaIds.length;
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
    if (body.forcedPersonaId) {
      nextPersonaId = body.forcedPersonaId;
    } else {
      const lastPersonaMsg = [...messagesSinceLastUser]
        .reverse()
        .find((m) => m.role === "persona");
      let nextOrder = 0;
      if (lastPersonaMsg) {
        const lastPersona = [...cached.personaMap.values()].find(
          (p) => p.id === lastPersonaMsg.personaId
        );
        if (lastPersona) {
          nextOrder = (lastPersona.seatOrder + 1) % personasCount;
        }
      }
      nextPersonaId = [...cached.personaMap.values()].find(
        (p) => p.seatOrder === nextOrder
      )?.id || cached.personaIds[0];
    }

    nextPersona = cached.personaMap.get(nextPersonaId);
    if (!nextPersona) {
      return new Response("No persona available", { status: 500 });
    }
    stablePrefix =
      getCachedPrompt(id, nextPersonaId) ||
      buildPersonaStablePrefix({
        archetype: nextPersona.archetype as ArchetypeKey,
        behaviorStyle: nextPersona.behaviorStyle as
          | "gentle"
          | "moderate"
          | "aggressive",
      });
    setCachedPrompt(id, nextPersonaId, stablePrefix);
    patternMemory = getCachedPrompt(id, PATTERN_MEMORY_CACHE_KEY) || "";
    claims = cached.claims;
    scenarioLabel = cached.scenarioLabel;
    roomContext = cached.roomContext;
    experience = cached.experience;
    drillTarget = cached.drillTarget;
    personaIds = cached.personaIds;
    personaMap = cached.personaMap;
  } else {
    // ─── CACHE MISS: full DB query + prompt building ────────────────
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

    // Allow both "active" (normal Q&A) and "presenting" (Boardroom interrupts
    // during the presentation phase). Without "presenting", boardroom
    // mid-speech interrupts would be rejected with 400.
    if (session.status !== "active" && session.status !== "presenting") {
      return new Response(`Session not active (status: ${session.status})`, { status: 400 });
    }

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
    if (body.forcedPersonaId) {
      nextPersonaId = body.forcedPersonaId;
      nextPersona = session.personas.find((p) => p.id === nextPersonaId);
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
      nextPersona = session.personas.find((p) => p.seatOrder === nextOrder) || session.personas[0];
      nextPersonaId = nextPersona.id;
    }

    if (!nextPersona) {
      return new Response("No persona available", { status: 500 });
    }

    // Build everything needed
    claims = session.extractedClaims
      ? safeParse(session.extractedClaims, [])
      : [];

    const scenario = SCENARIOS[session.scenario as keyof typeof SCENARIOS];
    scenarioLabel = scenario?.label || "Custom Session";
    roomContext = session.roomContext || scenario?.roomContext || "";
    experience = session.experience;
    drillTarget = session.drillTarget;

    patternMemory = buildPatternMemoryContext({
      patterns: session.user.patternMemories.map((p) => ({
        tag: p.tag,
        description: p.description,
        occurrences: p.occurrences,
      })),
      recentSummaries: session.user.sessions
        .filter((s) => s.summary)
        .map((s) => ({
          scenarioLabel: SCENARIOS[s.scenario as keyof typeof SCENARIOS]?.label || s.scenario,
          thePattern: s.summary!.thePattern,
          oneThingToPractice: s.summary!.oneThingToPractice,
          createdAt: s.endedAt || s.createdAt,
        })),
    });

    stablePrefix = buildPersonaStablePrefix({
      archetype: nextPersona.archetype as ArchetypeKey,
      behaviorStyle: nextPersona.behaviorStyle as "gentle" | "moderate" | "aggressive",
    });

    personaIds = session.personas.map((p) => p.id);

    // Build the persona map for caching
    personaMap = new Map();
    for (const p of session.personas) {
      personaMap.set(p.id, {
        id: p.id,
        archetype: p.archetype,
        name: p.name,
        behaviorStyle: p.behaviorStyle,
        seatOrder: p.seatOrder,
      });
    }

    // Cache everything
    setCachedSession(id, {
      systemPrompt: stablePrefix,
      personaIds,
      personaMap,
      claims,
      scenarioLabel,
      roomContext,
      experience,
      drillTarget,
      coachingEnabled: session.coachingEnabled,
    });
    setCachedPrompt(id, nextPersonaId, stablePrefix);
    setCachedPrompt(id, PATTERN_MEMORY_CACHE_KEY, patternMemory);
  }

  // ─── DETERMINISTIC DRILL INTERRUPT (skip the LLM entirely) ────────────
  // When the agitation engine fires in Drill Mode, the correction phrase is
  // FIXED. No reason to call the LLM. Makes corrections:
  //   - Instant (~1.7s TTS-only, vs 3-5s LLM + TTS)
  //   - Reliable (never paraphrased by gpt-oss-20b)
  //   - Consistent (every instance gets the same sharp correction)
  if (body.drillInterrupt && experience === "drill") {
    const target = (drillTarget as DrillTarget) || "hedging";
    const correctionText = getDrillCorrection(target);

    const encoder = new TextEncoder();
    let drillClosed = false;

    const drillStream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          if (drillClosed) return;
          try {
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
            );
          } catch {
            // closed
          }
        };

        send("start", {
          personaId: nextPersona.id,
          personaName: nextPersona.name,
          archetype: nextPersona.archetype,
          behaviorStyle: nextPersona.behaviorStyle,
          seatOrder: nextPersona.seatOrder,
        });

        try {
          const audio = await generatePersonaAudio(
            correctionText,
            nextPersona.archetype as ArchetypeKey,
            nextPersona.behaviorStyle as "gentle" | "moderate" | "aggressive"
          );

          send("sentence", {
            text: correctionText,
            audio,
            index: 0,
          });

          const message = await db.sessionMessage.create({
            data: {
              sessionId: id,
              personaId: nextPersona.id,
              role: "persona",
              content: correctionText.slice(0, 2000),
              type: "interruption",
              claimRef: null,
            },
          });

          send("done", {
            isUserTurn: true,
            type: "interruption",
            claimRef: null,
            mood: "pressing",
            messageId: message.id,
          });
        } catch (err) {
          console.error("[spar-stream] Drill interrupt TTS failed:", err);
          send("error", {
            message: "The correction couldn't be delivered. Please try again.",
          });
        } finally {
          drillClosed = true;
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      },
    });

    return new Response(drillStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // ─── 3. Build the user prompt ──────────────────────────────────────
  // Get the transcript (lightweight — just messages, no joins)
  const messages = await db.sessionMessage.findMany({
    where: { sessionId: id },
    orderBy: { createdAt: "asc" },
    select: { role: true, personaId: true, content: true, type: true },
  });

  const conversationHistory: Array<{
    role: "user" | "assistant";
    content: string;
  }> = [];
  for (const message of messages) {
    if (message.role === "user") {
      conversationHistory.push({ role: "user", content: message.content });
    } else if (message.role === "persona") {
      const persona = personaMap.get(message.personaId || "");
      conversationHistory.push({
        role: "assistant",
        content: `${persona?.name || "Panelist"}: ${message.content}`,
      });
    }
  }

  let userMessageForLlm =
    typeof body.userMessage === "string"
      ? body.userMessage.trim().slice(0, 5000)
      : "";
  if (!userMessageForLlm) {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    userMessageForLlm = lastUserMsg?.content || "(User has not yet spoken.)";
  }

  const interruptInstruction = body.isInterrupt
    ? experience === "boardroom"
      ? buildBoardroomInterruptInstruction()
      : `\n# IMPORTANT: YOU ARE INTERRUPTING\nOpen with "Hold on—" or "Wait—". Set "type": "interruption".`
    : "";

  // Drill clean-answer instruction: the user just answered cleanly after a
  // correction (no weakness detected this turn). The LLM generates ONLY the
  // next question — the deterministic acknowledgment is prepended after.
  const drillCleanInstruction =
    !body.isInterrupt && experience === "drill" && body.drillClean
      ? buildDrillNextQuestionInstruction((drillTarget as DrillTarget) || "hedging")
      : "";

  // Legacy drill interrupt instruction — only used by the non-streaming /spar
  // fallback. The streaming path uses the deterministic drillInterrupt block above.
  const drillInterruptInstruction =
    body.isInterrupt && experience === "drill"
      ? buildDrillInterruptInstruction((drillTarget as DrillTarget) || "hedging")
      : "";

  const otherPersonas = [...personaMap.values()]
    .filter((persona) => persona.id !== nextPersonaId)
    .map((persona) => ({
      name: persona.name,
      archetype: persona.archetype as ArchetypeKey,
    }));
  const sessionRules = [
    buildPersonaSessionRules({
      scenarioLabel,
      claims,
      patternMemory,
      otherPersonas,
    }),
    buildExperienceContext(experience, drillTarget),
    interruptInstruction,
    drillInterruptInstruction,
    drillCleanInstruction,
  ]
    .filter((section) => section.trim().length > 0)
    .join("\n\n");
  const omittedHistory = conversationHistory.slice(
    0,
    Math.max(0, conversationHistory.length - MAX_RECENT_MESSAGES),
  );
  const rollingSummary = buildRollingSummary(omittedHistory);
  const contextInput = {
    stablePrefix,
    sessionRules,
    rollingSummary,
    deterministicState: {
      agitationAction: body.drillClean
        ? "advance"
        : body.isInterrupt
          ? "interrupt"
          : "continue",
      drillClean: Boolean(body.drillClean),
      drillTarget: experience === "drill" ? drillTarget || "hedging" : null,
      experience,
      isInterrupt: Boolean(body.isInterrupt),
    },
    history: conversationHistory,
    newestUtterance: userMessageForLlm,
  } as const;

  // ─── 4. Stream the response with sentence-level TTS pipelining ────
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
          // Controller closed
        }
      };

      send("start", {
        personaId: nextPersona.id,
        personaName: nextPersona.name,
        archetype: nextPersona.archetype,
        behaviorStyle: nextPersona.behaviorStyle,
        seatOrder: nextPersona.seatOrder,
      });

      try {
        const context = buildPersonaContext(contextInput);
        let fullText = "";
        let accumulatedContent = "";
        let sentenceIndex = 0;
        let lastSentIndex = 0;
        let pendingTTS: Promise<void> | null = null;

        // Stream tokens from OpenRouter
        for await (const token of streamPersonaResponse(
          context.systemPrompt,
          context.userPrompt
        )) {
          fullText += token.content;

          // Extract partial content from the streaming JSON
          const partialContent = extractPartialContent(fullText);
          if (partialContent === null) continue;

          const newContent = partialContent.slice(accumulatedContent.length);
          accumulatedContent = partialContent;

          if (!newContent) continue;

          // Check for sentence boundaries — split aggressively for faster TTS
          // (shorter text = faster TTS: ~1.5s for 10 words vs ~5s for 30 words)
          const sentences = accumulatedContent.match(/[^.!?]*[.!?]+/g);
          if (!sentences) {
            // Also check for comma-separated clauses if we have enough words
            const words = accumulatedContent.split(/\s+/);
            if (words.length >= 15) {
              // Split at the last comma
              const lastComma = accumulatedContent.lastIndexOf(", ");
              if (lastComma > 0) {
                const chunk = accumulatedContent.slice(0, lastComma + 1).trim();
                if (chunk.length > 3) {
                  // Fire TTS for this chunk
                  if (pendingTTS) { await pendingTTS; pendingTTS = null; }

                  const audio = await generatePersonaAudio(
                    chunk,
                    nextPersona.archetype as ArchetypeKey,
                    nextPersona.behaviorStyle as "gentle" | "moderate" | "aggressive"
                  );
                  send("sentence", { text: chunk, audio, index: sentenceIndex });
                  sentenceIndex++;
                  accumulatedContent = accumulatedContent.slice(lastComma + 1);
                }
              }
            }
            continue;
          }

          // Process complete sentences
          let totalProcessed = 0;
          for (let i = 0; i < sentences.length; i++) {
            totalProcessed += sentences[i].length;
            if (i >= lastSentIndex) {
              const sentence = sentences[i].trim();
              if (sentence.length < 3) continue;

              // Wait for any previous TTS
              if (pendingTTS) { await pendingTTS; pendingTTS = null; }

              const currentIdx = sentenceIndex;
              sentenceIndex++;
              lastSentIndex = i + 1;
              accumulatedContent = accumulatedContent.slice(totalProcessed);

              const audio = await generatePersonaAudio(
                sentence,
                nextPersona.archetype as ArchetypeKey,
                nextPersona.behaviorStyle as "gentle" | "moderate" | "aggressive"
              );
              send("sentence", { text: sentence, audio, index: currentIdx });
            }
          }
        }

        // Wait for any pending TTS
        if (pendingTTS) {
          await pendingTTS;
        }

        // Send any remaining content (last sentence without punctuation)
        if (accumulatedContent.trim().length > 2) {
          const lastSentence = accumulatedContent.trim();
          const audio = await generatePersonaAudio(
            lastSentence,
            nextPersona.archetype as ArchetypeKey,
            nextPersona.behaviorStyle as "gentle" | "moderate" | "aggressive"
          );
          send("sentence", {
            text: lastSentence,
            audio,
            index: sentenceIndex,
          });
        }

        // Parse full JSON for metadata
        const parsed = parseStreamedPersonaResponse(fullText);
        let content = parsed?.content || accumulatedContent;

        // Drill clean-answer: prepend the deterministic acknowledgment so the
        // user hears "Good. That was declarative. Next." consistently, then
        // the LLM's generated question follows. The LLM was instructed NOT
        // to include the acknowledgment itself.
        if (body.drillClean && experience === "drill") {
          const ack = getDrillAcknowledgment(
            (drillTarget as DrillTarget) || "hedging"
          );
          content = `${ack} ${content}`.trim();
        }

        const type = parsed?.type || (body.isInterrupt ? "interruption" : "normal");
        const claimRef = parsed?.claimRef ?? null;
        const mood = parsed?.mood || "neutral";

        // Persist message
        const message = await db.sessionMessage.create({
          data: {
            sessionId: id,
            personaId: nextPersona.id,
            role: "persona",
            content: content.slice(0, 2000),
            type,
            claimRef,
          },
        });

        const newResponsesThisTurn = 1; // Always 1 per call
        const isUserTurn = true; // Always hand back to user after 1 response

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
        try {
          controller.close();
        } catch {
          // Already closed
        }
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

function buildExperienceContext(
  experience: string,
  drillTarget: string | null,
): string {
  if (experience === "defense") {
    return `# EXPERIENCE: DEFENSE
The user has already presented their material. Your first question must quote or paraphrase a specific claim, number, or statement from that presentation, then challenge it. Never open with a generic question. Attack a clear hedge, vague number, or unsupported claim first.`;
  }

  if (experience === "boardroom") {
    return `# EXPERIENCE: BOARDROOM
This is a high-pressure boardroom. Interrupt mid-speech when the user shows weakness. Interruptions must be sharp and aggressive: cut them off, challenge the specific weakness, let them answer briefly, then let them resume presenting.`;
  }

  if (experience === "drill") {
    return buildDrillPrompt((drillTarget as DrillTarget) || "hedging");
  }

  return `# EXPERIENCE: OPEN SPAR
Run direct conversational Q&A. Ask one focused challenge, listen to the answer, and probe the next weakness.`;
}

function buildRollingSummary(
  history: ReadonlyArray<{
    role: "user" | "assistant";
    content: string;
  }>,
): string {
  const lines = history.map(
    (message) =>
      `${message.role === "user" ? "User" : "Panelist"}: ${message.content}`,
  );
  const completeSummary = lines.join("\n");
  const maxCharacters = Math.floor(MAX_ROLLING_SUMMARY_TOKENS * 3.5);
  if (completeSummary.length <= maxCharacters) return completeSummary;

  const marker = "[Earlier conversation omitted.]";
  const contentLimit = maxCharacters - marker.length - 1;
  const retainedLines: string[] = [];
  let retainedLength = 0;

  for (let index = lines.length - 1; index >= 0; index--) {
    const separatorLength = retainedLines.length > 0 ? 1 : 0;
    const nextLength =
      retainedLength + separatorLength + lines[index].length;
    if (nextLength > contentLimit) break;
    retainedLines.unshift(lines[index]);
    retainedLength = nextLength;
  }

  return retainedLines.length > 0
    ? `${marker}\n${retainedLines.join("\n")}`
    : marker;
}
