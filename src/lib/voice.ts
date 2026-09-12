// Spar — Voice helpers (SERVER-SIDE ONLY)
//
// Uses Deepgram TTS (aura-2) for fast, high-quality voice generation.
// Deepgram's TTS has ~300-500ms first-byte latency vs z-ai's 2-5s.
//
// IMPORTANT: z-ai-web-dev-sdk MUST be used in backend code only.

import ZAI from "z-ai-web-dev-sdk";
import type { ArchetypeKey, BehaviorStyle } from "./types";

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZai() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

/**
 * Persona → Deepgram voice mapping.
 *
 * Deepgram aura-2 voices:
 *   zeus     — male, authoritative
 *   orion    — male, deep
 *   apollo   — male, warm
 *   arcas    — male, neutral
 *   athena   — female, professional
 *   hera     — female, authoritative
 *   thalia   — female, warm
 *   luna     — female, soft
 *
 * Mapping rationale (can be changed later — the user said they'll change voices):
 *   skeptic    → zeus     (authoritative — probes without emotion)
 *   nitpicker  → athena   (professional, precise)
 *   so_what    → orion    (deep, slightly detached — "so what?" energy)
 *   timekeeper → arcas    (neutral — cuts you off)
 *   ally       → apollo   (warm — supportive before the probe)
 */
export const PERSONA_VOICES: Record<ArchetypeKey, string> = {
  skeptic: "aura-2-zeus-en",
  nitpicker: "aura-2-athena-en",
  so_what: "aura-2-orion-en",
  timekeeper: "aura-2-arcas-en",
  ally: "aura-2-apollo-en",
};

/**
 * Speed mapping by behavior style.
 * Deepgram supports speed adjustment via the `speed` parameter (not in the
 * basic REST API, but we can adjust by choosing different models or using
 * the streaming API). For now, all speeds are 1.0 — the voice character
 * is defined by the model choice.
 */
export const BEHAVIOR_SPEEDS: Record<BehaviorStyle, number> = {
  gentle: 0.9,
  moderate: 1.0,
  aggressive: 1.15,
};

/**
 * Generate TTS audio for a persona's text using Deepgram.
 * Returns base64-encoded audio (MP3 format — smaller than WAV, faster to transfer).
 *
 * Deepgram TTS REST API:
 *   POST https://api.deepgram.com/v1/speak?model=aura-2-zeus-en
 *   Returns audio bytes directly (binary response)
 *
 * Latency: ~300-500ms (vs z-ai's 2-5s)
 */
export async function generatePersonaAudio(
  text: string,
  archetype: ArchetypeKey,
  behaviorStyle: BehaviorStyle
): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const voice = PERSONA_VOICES[archetype] || "aura-2-zeus-en";

  try {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      // Fallback to z-ai TTS if Deepgram key is not set
      console.warn("[voice] No DEEPGRAM_API_KEY — falling back to z-ai TTS");
      return await generateZaiTTS(trimmed, archetype, behaviorStyle);
    }

    const response = await fetch(
      `https://api.deepgram.com/v1/speak?model=${voice}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${apiKey}`,
        },
        body: JSON.stringify({ text: trimmed.slice(0, 1000) }),
      }
    );

    if (!response.ok) {
      console.error(
        `[voice] Deepgram TTS failed: ${response.status} ${response.statusText}`
      );
      // Fallback to z-ai TTS
      return await generateZaiTTS(trimmed, archetype, behaviorStyle);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));
    return buffer.toString("base64");
  } catch (err) {
    console.error("[voice] Deepgram TTS error:", err);
    // Fallback to z-ai TTS
    return await generateZaiTTS(trimmed, archetype, behaviorStyle);
  }
}

/**
 * Fallback: generate TTS using z-ai SDK (slower but always available).
 */
async function generateZaiTTS(
  text: string,
  archetype: ArchetypeKey,
  behaviorStyle: BehaviorStyle
): Promise<string | null> {
  try {
    // Legacy z-ai voice mapping
    const zaiVoices: Record<ArchetypeKey, string> = {
      skeptic: "xiaochen",
      nitpicker: "kazi",
      so_what: "jam",
      timekeeper: "chuichui",
      ally: "tongtong",
    };
    const voice = zaiVoices[archetype] || "xiaochen";
    const speed = BEHAVIOR_SPEEDS[behaviorStyle] || 1.0;

    const zai = await getZai();
    const chunk = text.slice(0, 1000);
    const response = await zai.audio.tts.create({
      input: chunk,
      voice,
      speed,
      response_format: "wav",
      stream: false,
    });
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));
    return buffer.toString("base64");
  } catch (err) {
    console.error("[voice] z-ai TTS fallback failed:", err);
    return null;
  }
}
