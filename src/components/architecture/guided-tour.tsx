"use client";

import { useState } from "react";
import type {
  ArchitectureNode,
  GuidedTour as GuidedTourDefinition,
} from "@/architecture/types";
import { cn } from "@/lib/utils";
import { ComponentDetail } from "./component-detail";

interface GuidedTourProps {
  tours: GuidedTourDefinition[];
  nodes: ArchitectureNode[];
  tourIndex: number;
  onSelectTour: (nodeIds: string[]) => void;
  onPrevious: (nodeIds: string[]) => void;
  onNext: (nodeIds: string[]) => void;
}

export function GuidedTour({
  tours,
  nodes,
  tourIndex,
  onSelectTour,
  onPrevious,
  onNext,
}: GuidedTourProps) {
  const [selectedTourId, setSelectedTourId] = useState(tours[0]?.id ?? "");
  const selectedTour = tours.find((tour) => tour.id === selectedTourId) ?? tours[0];

  if (!selectedTour) {
    return null;
  }

  const currentIndex = Math.min(Math.max(tourIndex, 0), Math.max(selectedTour.nodeIds.length - 1, 0));
  const currentNodeId = selectedTour.nodeIds[currentIndex];
  const currentNode = nodes.find((node) => node.id === currentNodeId) ?? null;
  const isFirstNode = currentIndex === 0;
  const isLastNode = currentIndex === selectedTour.nodeIds.length - 1;

  function selectTour(tour: GuidedTourDefinition) {
    setSelectedTourId(tour.id);
    onSelectTour(tour.nodeIds);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-card/45 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Guided routes
            </p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight">Choose a system journey</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            Each route advances one subsystem at a time. Nothing advances automatically.
          </p>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Guided tours">
          {tours.map((tour) => {
            const isSelected = selectedTour.id === tour.id;
            return (
              <button
                key={tour.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => selectTour(tour)}
                className={cn(
                  "rounded-lg border px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  isSelected
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background/55 text-foreground hover:border-foreground/30 hover:bg-secondary/50",
                )}
              >
                <span className="block text-xs font-medium">{tour.label}</span>
                <span className={cn("mt-1 block font-mono text-[9px] uppercase tracking-[0.14em]", isSelected ? "text-background/65" : "text-muted-foreground")}>
                  {tour.nodeIds.length} subsystems
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
        <div className="rounded-xl border border-border bg-card/45 p-5 sm:p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Current subsystem
          </p>
          <p aria-live="polite" aria-atomic="true" className="mt-2 font-mono text-xs text-foreground/75">
            Step {currentIndex + 1} of {selectedTour.nodeIds.length}
            {currentNode ? ` · ${currentNode.label}` : " · Missing manifest node"}
          </p>

          {currentNode ? (
            <div className="mt-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {currentNode.layer} layer
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">{currentNode.label}</h3>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                {currentNode.purpose}
              </p>
            </div>
          ) : null}

          <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-5">
            <button
              type="button"
              disabled={isFirstNode}
              onClick={() => onPrevious(selectedTour.nodeIds)}
              className="rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Back
            </button>
            <button
              type="button"
              disabled={isLastNode}
              onClick={() => onNext(selectedTour.nodeIds)}
              className="rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Next
            </button>
          </div>
        </div>

        <ComponentDetail node={currentNode} />
      </section>
    </div>
  );
}
