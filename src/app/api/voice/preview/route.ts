import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerProviderConfig } from "@/lib/config/server-env";
import {
  ACCENT_PRESETS,
  DEFAULT_PREVIEW_SENTENCE,
  resolveDeepgramVoiceModel,
  type AccentKey,
  type VoiceToneKey,
} from "@/lib/voice-accents";

const previewSchema = z
  .object({
    accent: z.enum([
      "american",
      "british",
      "australian",
      "irish",
      "indian",
      "mixed",
    ]),
    voiceTone: z.enum(["authoritative", "warm", "crisp"]).optional(),
  })
  .strict();

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

async function fetchDeepgramRestAudio(params: {
  endpoint: "v1" | "v2";
  model: string;
  text: string;
  apiKey: string;
  region: "us" | "eu";
}): Promise<Response> {
  const host =
    params.region === "eu" ? "api.eu.deepgram.com" : "api.deepgram.com";
  const url =
    params.endpoint === "v2"
      ? `https://${host}/v2/speak?model=${encodeURIComponent(params.model)}`
      : `https://${host}/v1/speak?model=${encodeURIComponent(params.model)}`;

  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${params.apiKey}`,
    },
    body: JSON.stringify({ text: params.text }),
  });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("Origin");
  if (origin !== null && origin !== new URL(request.url).origin) {
    return NextResponse.json(
      { error: "Forbidden." },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = previewSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid voice preview parameters." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const accent = parsed.data.accent as AccentKey;
  const voiceTone = (parsed.data.voiceTone ?? "authoritative") as VoiceToneKey;
  const sampleText =
    ACCENT_PRESETS[accent]?.previewSample || DEFAULT_PREVIEW_SENTENCE;

  const resolved = resolveDeepgramVoiceModel({
    archetype: "skeptic",
    seatOrder: 0,
    accent,
    voiceTone,
  });

  let deepgramKey = process.env.DEEPGRAM_API_KEY?.trim() || "";
  let deepgramRegion: "us" | "eu" =
    process.env.DEEPGRAM_REGION === "eu" ? "eu" : "us";
  try {
    const cfg = getServerProviderConfig(process.env);
    deepgramKey = cfg.deepgramApiKey;
    deepgramRegion = cfg.deepgramRegion;
  } catch {
    // Allow isolated preview if DEEPGRAM_API_KEY is present even when other provider keys are unset
  }

  if (!deepgramKey) {
    return NextResponse.json(
      { error: "Deepgram TTS is not configured.", fallbackText: sampleText },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  try {
    let dgRes = await fetchDeepgramRestAudio({
      endpoint: resolved.previewEndpoint,
      model: resolved.previewModel,
      text: sampleText,
      apiKey: deepgramKey,
      region: deepgramRegion,
    });

    // If Flux /v2/speak is unavailable for this key, fall back cleanly to /v1/speak
    if (!dgRes.ok && resolved.previewEndpoint === "v2") {
      dgRes = await fetchDeepgramRestAudio({
        endpoint: "v1",
        model: resolved.v1Model,
        text: sampleText,
        apiKey: deepgramKey,
        region: deepgramRegion,
      });
    }

    if (!dgRes.ok) {
      return NextResponse.json(
        { error: "Preview synthesis failed.", fallbackText: sampleText },
        { status: 502, headers: NO_STORE_HEADERS },
      );
    }

    const audioBytes = await dgRes.arrayBuffer();
    return new Response(audioBytes, {
      status: 200,
      headers: {
        "Content-Type": dgRes.headers.get("content-type") || "audio/mpeg",
        "Cache-Control": "no-store",
        "X-Spar-Voice-Model": resolved.previewModel,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Preview request failed.", fallbackText: sampleText },
      { status: 502, headers: NO_STORE_HEADERS },
    );
  }
}
