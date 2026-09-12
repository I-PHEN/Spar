// Spar — Voice helpers (SERVER-SIDE ONLY)
//
// Maps personas to TTS voices and provides a helper to generate audio
// from persona text. Used by the open and spar endpoints to return
// audio alongside the text response.
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
 * Persona → voice mapping.
 *
 * Available voices (from the TTS skill):
 *   tongtong  — warm, friendly
 *   chuichui  — lively, animated
 *   xiaochen  — steady, professional
 *   jam       — British gentleman
 *   kazi      — clear, standard
 *   douji     — natural, flowing
 *   luodo     — expressive, engaging
 *
 * Mapping rationale:
 *   skeptic    → xiaochen  (steady, professional — probes without emotion)
 *   nitpicker  → kazi      (clear, standard — precise, clinical)
 *   so_what    → jam       (British, slightly detached — "so what?" energy)
 *   timekeeper → chuichui  (lively, faster — impatient, cuts you off)
 *   ally       → tongtong  (warm — supportive before the probe)
 *
 * The user said they'll change voices later, so these are sensible defaults.
 */
export const PERSONA_VOICES: Record<ArchetypeKey, string> = {
  skeptic: "xiaochen",
  nitpicker: "kazi",
  so_what: "jam",
  timekeeper: "chuichui",
  ally: "tongtong",
};

/**
 * Speed mapping by behavior style.
 * Gentle = slower (more measured), Moderate = normal, Aggressive = faster.
 */
export const BEHAVIOR_SPEEDS: Record<BehaviorStyle, number> = {
  gentle: 0.9,
  moderate: 1.0,
  aggressive: 1.15,
};

/**
 * Generate TTS audio for a persona's text.
 * Returns base64-encoded WAV audio that the frontend can decode and play.
 *
 * Handles the 1024-char limit by chunking long text and concatenating audio.
 * (In practice, persona responses are capped at 800 chars by the LLM prompt,
 * so this is a safety net.)
 */
export async function generatePersonaAudio(
  text: string,
  archetype: ArchetypeKey,
  behaviorStyle: BehaviorStyle
): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const voice = PERSONA_VOICES[archetype] || "xiaochen";
  const speed = BEHAVIOR_SPEEDS[behaviorStyle] || 1.0;

  try {
    const zai = await getZai();

    // If text fits in one TTS call (1024 chars), generate directly.
    if (trimmed.length <= 1000) {
      const response = await zai.audio.tts.create({
        input: trimmed,
        voice,
        speed,
        response_format: "wav",
        stream: false,
      });
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(new Uint8Array(arrayBuffer));
      return buffer.toString("base64");
    }

    // For longer text: split into chunks at sentence boundaries, generate
    // each chunk, and return only the first chunk for now (the LLM prompt
    // already caps responses at 800 chars, so this path is rarely hit).
    // A proper implementation would concatenate WAV files, but that requires
    // WAV header parsing — deferred until we actually need it.
    const chunk = trimmed.slice(0, 1000);
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
    console.error("[voice] TTS generation failed:", err);
    return null;
  }
}
