"use client";

import { type KeyboardEvent, useReducer } from "react";
import { Swords } from "lucide-react";
import {
  getKeyboardTab,
  initialExplorerState,
  reduceExplorerState,
  type ExplorerTab,
} from "@/architecture/navigation";
import type { ArchitectureManifest } from "@/architecture/types";
import { cn } from "@/lib/utils";
import { ComponentDetail } from "./component-detail";
import { DataMemory } from "./data-memory";
import { ExperienceFlows } from "./experience-flows";
import { GuidedTour } from "./guided-tour";
import { LatencyLab } from "./latency-lab";
import { SystemMap } from "./system-map";
import { VoicePipeline } from "./voice-pipeline";

const TABS: Array<{ id: ExplorerTab; label: string }> = [
  { id: "map", label: "System map" },
  { id: "tour", label: "Guided tour" },
  { id: "experiences", label: "Experiences" },
  { id: "voice", label: "Voice pipeline" },
  { id: "data", label: "Data & memory" },
  { id: "latency", label: "Latency lab" },
];

interface ArchitectureExplorerProps {
  manifest: ArchitectureManifest;
}

export function ArchitectureExplorer({ manifest }: ArchitectureExplorerProps) {
  const [state, dispatch] = useReducer(reduceExplorerState, initialExplorerState);
  const selectedNode =
    manifest.nodes.find((node) => node.id === state.selectedNodeId) ?? null;

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentTab: ExplorerTab,
  ) {
    const nextTab = getKeyboardTab(currentTab, event.key);
    if (nextTab === currentTab) return;

    event.preventDefault();
    dispatch({ type: "select-tab", tab: nextTab });
    document.getElementById(`architecture-tab-${nextTab}`)?.focus();
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1680px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-md border border-border bg-card">
                <Swords className="size-4" aria-hidden="true" />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Development instrument
              </span>
            </div>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">
              Spar architecture
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Navigate how a spoken challenge becomes a persona response, an interruption, and durable coaching memory.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start rounded-full border border-border bg-card/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:self-auto">
            <span className="size-1.5 rounded-full bg-foreground" aria-hidden="true" />
            Static manifest
          </div>
        </header>

        <div className="-mx-4 overflow-x-auto border-b border-border px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div
            role="tablist"
            aria-label="Architecture learning paths"
            className="flex min-w-max gap-1 py-3"
          >
            {TABS.map((tab) => {
              const isActive = state.tab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`architecture-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`architecture-panel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => dispatch({ type: "select-tab", tab: tab.id })}
                  onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
                  className={cn(
                    "rounded-md px-3 py-2 text-xs font-medium transition-colors motion-reduce:transition-none",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isActive
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-card hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {TABS.map((tab) => {
          const isActive = state.tab === tab.id;

          return (
            <section
              key={tab.id}
              id={`architecture-panel-${tab.id}`}
              role="tabpanel"
              aria-labelledby={`architecture-tab-${tab.id}`}
              tabIndex={0}
              hidden={!isActive}
              className="pt-5 focus-visible:outline-none"
            >
              {tab.id === "map" ? (
                <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(20rem,0.8fr)]">
                  <SystemMap
                    nodes={manifest.nodes}
                    edges={manifest.edges}
                    selectedNodeId={state.selectedNodeId}
                    onSelectNode={(nodeId) =>
                      dispatch({ type: "select-node", nodeId })
                    }
                  />
                  <ComponentDetail node={selectedNode} />
                </div>
              ) : tab.id === "tour" ? (
                <GuidedTour
                  tours={manifest.tours}
                  nodes={manifest.nodes}
                  tourIndex={state.tourIndex}
                  onSelectTour={(nodeIds) =>
                    dispatch({ type: "select-tour", nodeIds })
                  }
                  onPrevious={(nodeIds) =>
                    dispatch({ type: "previous-tour-step", nodeIds })
                  }
                  onNext={(nodeIds) =>
                    dispatch({ type: "next-tour-step", nodeIds })
                  }
                />
              ) : tab.id === "experiences" ? (
                <ExperienceFlows flows={manifest.experiences} />
              ) : tab.id === "voice" ? (
                <VoicePipeline />
              ) : tab.id === "data" ? (
                <DataMemory />
              ) : (
                <LatencyLab />
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
