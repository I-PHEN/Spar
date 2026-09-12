"use client";

import { ArrowRight, CornerDownRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type PipelineMode = "current" | "target";

interface PipelineStage {
  name: string;
  owner: string;
  detail: string;
}

const PIPELINES: Record<
  PipelineMode,
  { status: string; description: string; stages: PipelineStage[]; edges: string[] }
> = {
  current: {
    status: "Running today",
    description:
      "The browser sends a completed turn to the session API. The server streams generation, slices phrases, synthesizes each slice, and returns audio events for sequential playback.",
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
  target: {
    status: "Design target · not shipped",
    description:
      "The target moves live response coordination into one cancellable browser-owned turn, with direct provider streaming and an explicit phrase and playback queue.",
    stages: [
      {
        name: "STT",
        owner: "Browser · recognition",
        detail: "Feeds committed transcript segments",
      },
      {
        name: "Turn controller",
        owner: "Browser · turn owner",
        detail: "Owns one lifecycle and cancel signal",
      },
      {
        name: "Generator",
        owner: "Target · direct stream",
        detail: "Streams response under turn control",
      },
      {
        name: "Phrase chunker",
        owner: "Browser · queue",
        detail: "Emits speakable phrases incrementally",
      },
      {
        name: "TTS",
        owner: "Target · streaming voice",
        detail: "Accepts phrases behind cancellation",
      },
      {
        name: "Playback",
        owner: "Browser · queue",
        detail: "Starts early and drains in order",
      },
    ],
    edges: ["committed text", "controlled request", "token stream", "phrase queue", "audio queue"],
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
  const [mode, setMode] = useState<PipelineMode>("current");
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
            {(["current", "target"] as const).map((option) => (
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
          {mode === "current" ? (
            <div className="mt-4">
              <p className="text-sm font-medium">Recognition stops at turn submission.</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Today, the browser stops Web Speech before posting. The provider request and each created Audio element do not share an abort signal, so end-to-end turn cancellation is not implemented.
              </p>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-sm font-medium">One cancel signal fans out across the turn.</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Target behavior would abort recognition, generation, pending phrase synthesis, and queued playback together. This is an intended boundary, not current behavior.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card/45 p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Fallback edges
          </p>
          <ul className="mt-4 space-y-3 text-xs leading-5 text-muted-foreground">
            <li className="flex gap-2">
              <CornerDownRight className="mt-0.5 size-3.5 shrink-0 text-foreground/65" aria-hidden="true" />
              <span><strong className="font-medium text-foreground/85">STT unavailable:</strong> continue with typed input.</span>
            </li>
            <li className="flex gap-2">
              <CornerDownRight className="mt-0.5 size-3.5 shrink-0 text-foreground/65" aria-hidden="true" />
              <span><strong className="font-medium text-foreground/85">Deepgram fails:</strong> current server code tries the legacy z-ai voice path.</span>
            </li>
            <li className="flex gap-2">
              <CornerDownRight className="mt-0.5 size-3.5 shrink-0 text-foreground/65" aria-hidden="true" />
              <span><strong className="font-medium text-foreground/85">Voice fallback fails:</strong> the text response remains the durable output.</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
