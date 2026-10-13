"use client";

import { ArrowRight, CornerDownRight } from "lucide-react";
import { useState } from "react";
import { CURRENT_VOICE_FALLBACKS } from "@/architecture/voice-pipeline";
import { cn } from "@/lib/utils";

type PipelineMode = "live" | "cascade" | "legacy";

interface PipelineStage {
  name: string;
  owner: string;
  detail: string;
}

const PIPELINES: Record<
  PipelineMode,
  { status: string; description: string; stages: PipelineStage[]; edges: string[] }
> = {
  live: {
    status: "Running today · primary voice engine",
    description:
      "When GEMINI_API_KEY is configured, the room runs one speech-to-speech Gemini Live session with the lead panelist: a single mic activation starts continuous capture, the Live socket owns generation and turn-taking per the mode's VAD contract, and 24 kHz PCM answers stream back with native barge-in in both directions.",
    stages: [
      {
        name: "Mic",
        owner: "Browser · continuous capture",
        detail: "One activation; 16 kHz PCM streams while the room is live",
      },
      {
        name: "Token",
        owner: "Server · ephemeral grant",
        detail: "GET /api/gemini-live-token mints a short-lived token from the server-held key",
      },
      {
        name: "Live socket",
        owner: "Browser → Google · BidiGenerateContent",
        detail: "Speech-to-speech; mode-routed model and VAD contract in the setup",
      },
      {
        name: "Turn-taking",
        owner: "Google · server VAD",
        detail: "End-of-speech patience per mode; barge-in is native both ways",
      },
      {
        name: "Playback",
        owner: "Browser · 24 kHz PCM queue",
        detail: "Frames enqueue in order; an interrupt discards them instantly",
      },
      {
        name: "Captions",
        owner: "Browser · live transcripts",
        detail: "Interim user speech and the panelist's spoken answer as captions",
      },
    ],
    edges: ["PCM base64", "access token", "audio + transcripts", "interrupt / turn-complete", "captions"],
  },
  cascade: {
    status: "Automatic fallback · Deepgram → Groq → Aura-2",
    description:
      "The cascade the room falls back to whenever Gemini Live cannot run — and the only path when GEMINI_API_KEY is absent: the browser streams microphone audio to Flux STT, one controller owns the turn, the server generates on Groq with a pre-speech OpenRouter fallback, and the browser speaks each phrase through Aura-2 as it arrives.",
    stages: [
      {
        name: "STT",
        owner: "Browser · Flux socket",
        detail: "Streams PCM; interim and finalized transcripts",
      },
      {
        name: "Turn controller",
        owner: "Browser · turn owner",
        detail: "Owns one lifecycle and cancel signal",
      },
      {
        name: "Generator",
        owner: "Server · Groq primary",
        detail: "Streams tokens under an 80-token cap",
      },
      {
        name: "Phrase chunker",
        owner: "Server · /spar-stream",
        detail: "Emits speakable phrases incrementally",
      },
      {
        name: "TTS",
        owner: "Browser · Aura-2 stream",
        detail: "Speaks phrases behind one cancel scope",
      },
      {
        name: "Playback",
        owner: "Browser · PCM queue",
        detail: "Starts at the first frame, drains in order",
      },
    ],
    edges: ["PCM stream", "final transcript", "turn-tagged SSE", "phrase events", "audio frames"],
  },
  legacy: {
    status: "Legacy buffered path · fallback only",
    description:
      "The pre-streaming path, kept as fallback and history: a completed turn is posted to the session API, OpenRouter generates the full reply, sentences are synthesized through Deepgram REST, and base64 audio returns for sequential playback. It still serves the opening line and non-live clients.",
    stages: [
      {
        name: "STT",
        owner: "Browser · Web Speech",
        detail: "Interim and final transcript",
      },
      {
        name: "Turn controller",
        owner: "Browser · Sparring room",
        detail: "Stops listening and posts the turn",
      },
      {
        name: "Generator",
        owner: "Server · OpenRouter",
        detail: "Streams persona response tokens",
      },
      {
        name: "Phrase chunker",
        owner: "Server · /spar-stream",
        detail: "Splits on sentences and long clauses",
      },
      {
        name: "TTS",
        owner: "Server · Deepgram REST",
        detail: "Synthesizes one completed phrase",
      },
      {
        name: "Playback",
        owner: "Browser · Audio",
        detail: "Plays returned phrase audio in order",
      },
    ],
    edges: ["final text", "POST /spar-stream", "token stream", "phrase text", "SSE sentence"],
  },
};

function PipelineRail({ mode }: { mode: PipelineMode }) {
  const pipeline = PIPELINES[mode];

  return (
    <div className="overflow-x-auto pb-2">
      <ol className="grid min-w-[1080px] grid-cols-[repeat(5,minmax(0,1fr)_4rem)_minmax(0,1fr)] items-stretch">
        {pipeline.stages.map((stage, index) => (
          <li key={stage.name} className="contents">
            <article className="relative min-h-40 rounded-lg border border-border bg-background/55 p-4">
              <span className="font-mono text-[9px] text-muted-foreground/60">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-6 text-sm font-semibold tracking-tight">
                {stage.name}
              </h3>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-foreground/55">
                {stage.owner}
              </p>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                {stage.detail}
              </p>
              <span
                className="absolute -left-1 top-1/2 size-2 -translate-y-1/2 rounded-full border border-border bg-card"
                aria-hidden="true"
              />
              <span
                className="absolute -right-1 top-1/2 size-2 -translate-y-1/2 rounded-full border border-border bg-card"
                aria-hidden="true"
              />
            </article>
            {index < pipeline.edges.length ? (
              <div
                className="flex flex-col items-center justify-center gap-2 px-1"
                aria-label={pipeline.edges[index]}
              >
                <span className="whitespace-nowrap font-mono text-[8px] text-muted-foreground/65">
                  {pipeline.edges[index]}
                </span>
                <div className="flex w-full items-center">
                  <span className="h-px flex-1 bg-foreground/30" />
                  <ArrowRight className="size-3 text-foreground/55" aria-hidden="true" />
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function VoicePipeline() {
  const [mode, setMode] = useState<PipelineMode>("live");
  const pipeline = PIPELINES[mode];

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-card/45 p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Voice signal path
            </p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight">
              From speech to first playback
            </h2>
          </div>
          <div
            className="inline-flex self-start rounded-lg border border-border bg-background/60 p-1"
            aria-label="Voice architecture version"
          >
            {(["live", "cascade", "legacy"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={mode === option}
                onClick={() => setMode(option)}
                className={cn(
                  "rounded-md px-3 py-2 text-xs font-medium capitalize transition-colors motion-reduce:transition-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  mode === option
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 border-t border-border pt-5" aria-live="polite">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/75">
              {pipeline.status}
            </p>
            <p className="max-w-2xl text-xs leading-5 text-muted-foreground sm:text-right">
              {pipeline.description}
            </p>
          </div>
          <div className="mt-5">
            <PipelineRail mode={mode} />
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card/45 p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Cancellation edge
          </p>
          {mode === "live" ? (
            <div className="mt-4">
              <p className="text-sm font-medium">Interruption is native and server-side.</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                The Live socket emits <code className="font-mono text-[10px] text-foreground/80">interrupted</code> the moment you barge in; the room discards queued playback immediately and cancels the turn. No user action and no teardown budget are involved — the model stops talking because it heard you.
              </p>
            </div>
          ) : mode === "cascade" ? (
            <div className="mt-4">
              <p className="text-sm font-medium">One cancel signal fans out across the turn.</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                A new StartOfTurn or ending the session aborts generation, retires the phrase queue, stops playback, and clears the speech socket inside a 200 ms teardown budget that the Chromium harness measures deterministically.
              </p>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-sm font-medium">Recognition stops at turn submission.</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                In the legacy buffered path, the browser stops Web Speech before posting. The provider request and each created Audio element do not share an abort signal, so end-to-end turn cancellation is not implemented there. This path remains only as fallback and history.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card/45 p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Fallback edges · Current behavior
          </p>
          <ul className="mt-4 space-y-3 text-xs leading-5 text-muted-foreground">
            {CURRENT_VOICE_FALLBACKS.map((fallback) => (
              <li key={fallback.trigger} className="flex gap-2">
                <CornerDownRight className="mt-0.5 size-3.5 shrink-0 text-foreground/65" aria-hidden="true" />
                <span>
                  <strong className="font-medium text-foreground/85">
                    {fallback.label}:
                  </strong>{" "}
                  {fallback.detail}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
