"use client";

import { useState } from "react";
import { selectExperienceDetail } from "@/architecture/experience-flows";
import type { ExperienceFlow } from "@/architecture/types";
import { cn } from "@/lib/utils";

const SHARED_LIFECYCLE = [
  "Configure the session",
  "Run the selected conversation loop",
  "End the session",
  "Generate the coaching debrief",
  "Persist session memory",
];

const EXPERIENCE_LABELS: Record<ExperienceFlow["id"], string> = {
  defense: "Defense",
  boardroom: "Boardroom",
  open_spar: "Open Spar",
  drill: "Drill",
};

interface ExperienceFlowsProps {
  flows: ExperienceFlow[];
}

function StepList({
  title,
  stepIds,
  flow,
  emptyCopy,
}: {
  title: string;
  stepIds: string[];
  flow: ExperienceFlow;
  emptyCopy: string;
}) {
  const steps = flow.steps.filter((step) => stepIds.includes(step.id));

  return (
    <section className="rounded-lg border border-border bg-background/45 p-4">
      <h4 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{title}</h4>
      {steps.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm text-foreground/85">
          {steps.map((step) => (
            <li key={step.id} className="flex items-center justify-between gap-3">
              <span>{step.label}</span>
              <code className="shrink-0 rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {step.id}
              </code>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{emptyCopy}</p>
      )}
    </section>
  );
}

export function ExperienceFlows({ flows }: ExperienceFlowsProps) {
  const [selectedId, setSelectedId] = useState<ExperienceFlow["id"] | null>(flows[0]?.id ?? null);
  const detail = selectedId ? selectExperienceDetail(flows, selectedId) : null;

  if (!detail) {
    return null;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-card/45 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Shared lifecycle
            </p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight">Every experience reaches the same coaching loop</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            The middle conversation changes by mode; setup, closure, debrief, and memory remain shared.
          </p>
        </div>
        <ol className="mt-5 grid gap-2 sm:grid-cols-5">
          {SHARED_LIFECYCLE.map((stage, index) => (
            <li key={stage} className="rounded-lg border border-border bg-background/55 px-3 py-3">
              <span className="font-mono text-[10px] text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
              <span className="mt-2 block text-xs font-medium leading-5">{stage}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-xl border border-border bg-card/45 p-5 sm:p-6" aria-labelledby="experience-mode-heading">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Experience modes</p>
        <h2 id="experience-mode-heading" className="mt-2 text-lg font-semibold tracking-tight">Choose a conversation state machine</h2>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Experience modes">
          {flows.map((flow) => {
            const isSelected = flow.id === detail.flow.id;
            return (
              <button
                key={flow.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedId(flow.id)}
                className={cn(
                  "rounded-lg border px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  isSelected
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background/55 text-foreground hover:border-foreground/30 hover:bg-secondary/50",
                )}
              >
                <span className="block text-xs font-medium">{EXPERIENCE_LABELS[flow.id]}</span>
                <span className={cn("mt-1 block text-[11px] leading-4", isSelected ? "text-background/70" : "text-muted-foreground")}>
                  {flow.summary}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 border-t border-border pt-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{EXPERIENCE_LABELS[detail.flow.id]}</p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight">{detail.flow.summary}</h3>
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{detail.flow.steps.length} ordered steps</p>
          </div>

          <ol className="mt-6 grid gap-2 lg:grid-cols-7" aria-label={`${detail.flow.id} ordered steps`}>
            {detail.flow.steps.map((step, index) => (
              <li key={step.id} className="rounded-lg border border-border bg-background/55 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                  <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">{step.kind}</span>
                </div>
                <span className="mt-3 block text-xs font-medium leading-5">{step.label}</span>
                <code className="mt-2 block font-mono text-[10px] text-muted-foreground">{step.id}</code>
              </li>
            ))}
          </ol>

          <dl className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-background/45 p-4">
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Who speaks first</dt>
              <dd className="mt-3 text-sm leading-6 text-foreground/85">{detail.whoSpeaksFirst}</dd>
            </div>
            <div className="rounded-lg border border-border bg-background/45 p-4">
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Presentation rules</dt>
              <dd className="mt-3 text-sm leading-6 text-foreground/85">{detail.presentationRule}</dd>
            </div>
            <div className="rounded-lg border border-border bg-background/45 p-4">
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Interruption policy</dt>
              <dd className="mt-3 text-sm leading-6 text-foreground/85">{detail.interruptionPolicy}</dd>
            </div>
            <div className="rounded-lg border border-border bg-background/45 p-4">
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Stored results</dt>
              <dd className="mt-3 text-sm leading-6 text-foreground/85">{detail.storedResults}</dd>
            </div>
            <div className="rounded-lg border border-border bg-background/45 p-4 lg:col-span-2">
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Failure behavior</dt>
              <dd className="mt-3 border-l-2 border-destructive/60 pl-3 text-sm leading-6 text-foreground/85">{detail.failureBehavior}</dd>
            </div>
          </dl>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <StepList title="AI work" stepIds={detail.aiStepIds} flow={detail.flow} emptyCopy="This mode has no AI-labeled flow step." />
            <StepList title="Deterministic code" stepIds={detail.deterministicStepIds} flow={detail.flow} emptyCopy="This mode has no deterministic code-labeled flow step." />
          </div>
        </div>
      </section>
    </div>
  );
}
