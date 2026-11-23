import { NextRequest, NextResponse } from "next/server";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB

async function transcribeWithGroq(
  audio: File,
  apiKey: string,
): Promise<string | null> {
  const form = new FormData();
  form.append("file", audio, audio.name || "drill-recording.webm");
  form.append("model", "whisper-large-v3-turbo");
  form.append("language", "en");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as { text?: unknown } | null;
  return typeof data?.text === "string" ? data.text.trim() : null;
}

async function transcribeWithDeepgram(
  audio: File,
  apiKey: string,
  region: string | undefined,
): Promise<string | null> {
  const host = region === "eu" ? "api.eu.deepgram.com" : "api.deepgram.com";
  const bytes = await audio.arrayBuffer();
  const res = await fetch(
    `https://${host}/v1/listen?model=nova-2&smart_format=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": audio.type || "audio/webm",
      },
      body: bytes,
    },
  );

  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as {
    results?: { channels?: Array<{ alternatives?: Array<{ transcript?: unknown }> }> };
  } | null;
  const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
  return typeof transcript === "string" ? transcript.trim() : null;
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("Origin");
  if (origin !== null && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart audio form data." },
      { status: 400 },
    );
  }

  const audio = formData.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json(
      { error: "Audio recording is required." },
      { status: 400 },
    );
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Recording exceeds 10 MB limit." },
      { status: 413 },
    );
  }

  const groqKey = process.env.GROQ_API_KEY?.trim();
  const deepgramKey = process.env.DEEPGRAM_API_KEY?.trim();
  const deepgramRegion = process.env.DEEPGRAM_REGION?.trim();

  if (!groqKey && !deepgramKey) {
    return NextResponse.json(
      { error: "Speech transcription is unavailable in this session. Type your response below." },
      { status: 503 },
    );
  }

  try {
    if (groqKey) {
      const transcript = await transcribeWithGroq(audio, groqKey);
      if (transcript !== null) {
        return NextResponse.json({ transcript });
      }
    }

    if (deepgramKey) {
      const transcript = await transcribeWithDeepgram(audio, deepgramKey, deepgramRegion);
      if (transcript !== null) {
        return NextResponse.json({ transcript });
      }
    }

    return NextResponse.json(
      { error: "Could not transcribe audio. Try again or type your response below." },
      { status: 502 },
    );
  } catch {
    return NextResponse.json(
      { error: "Transcription request failed. Type your response below." },
      { status: 502 },
    );
  }
}
