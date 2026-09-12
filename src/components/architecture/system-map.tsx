import { ArrowRight } from "lucide-react";
import type {
  ArchitectureEdge,
  ArchitectureLayer,
  ArchitectureNode,
} from "@/architecture/types";
import { cn } from "@/lib/utils";

const LAYERS: Array<{ id: ArchitectureLayer; label: string; role: string }> = [
  { id: "browser", label: "Browser", role: "Capture and playback" },
  { id: "api", label: "API", role: "Session boundary" },
  { id: "domain", label: "Domain", role: "Debate decisions" },
  { id: "provider", label: "Provider", role: "Generation and voice" },
  { id: "storage", label: "Storage", role: "Memory and replay" },
];

interface SystemMapProps {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

export function SystemMap({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
}: SystemMapProps) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const selectedEdges = selectedNodeId
    ? edges.filter(
        (edge) => edge.from === selectedNodeId || edge.to === selectedNodeId,
      )
    : [];
  const connectedNodeIds = new Set(
    selectedEdges.flatMap((edge) => [edge.from, edge.to]),
  );

  return (
    <section
      aria-labelledby="system-map-heading"
      className="overflow-hidden rounded-xl border border-border bg-card/45"
    >
      <header className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Live topology
          </p>
          <h2 id="system-map-heading" className="mt-1 text-base font-semibold tracking-tight">
            System signal map
          </h2>
        </div>
        <div className="flex gap-5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <span><strong className="text-foreground">{nodes.length}</strong> nodes</span>
          <span><strong className="text-foreground">{edges.length}</strong> routes</span>
        </div>
      </header>

      <div className="overflow-x-auto px-4 py-5 sm:px-5">
        <div className="grid min-w-[860px] grid-cols-5 gap-3">
          {LAYERS.map((layer, layerIndex) => {
            const layerNodes = nodes.filter((node) => node.layer === layer.id);

            return (
              <section key={layer.id} aria-labelledby={`layer-${layer.id}`} className="relative">
                {layerIndex < LAYERS.length - 1 ? (
                  <div
                    className="pointer-events-none absolute -right-3 top-[2.15rem] z-10 flex w-3 items-center"
                    aria-hidden="true"
                  >
                    <span className="h-px flex-1 bg-border" />
                    <span className="size-1 rounded-full bg-muted-foreground/55" />
                  </div>
                ) : null}

                <div className="mb-3 min-h-16 border-t border-foreground/35 pt-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3
                      id={`layer-${layer.id}`}
                      className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-foreground"
                    >
                      {layer.label}
                    </h3>
                    <span className="font-mono text-[10px] text-muted-foreground/60">
                      {String(layerNodes.length).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{layer.role}</p>
                </div>

                <div className="space-y-2">
                  {layerNodes.map((node) => {
                    const isSelected = selectedNodeId === node.id;
                    const isConnected = connectedNodeIds.has(node.id);
                    const hasSelection = selectedNodeId !== null;

                    return (
                      <button
                        key={node.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => onSelectNode(node.id)}
                        className={cn(
                          "group relative min-h-20 w-full rounded-lg border px-3 py-3 text-left transition-[background-color,border-color,opacity] motion-reduce:transition-none",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                          isSelected
                            ? "border-foreground/80 bg-foreground text-background"
                            : isConnected
                              ? "border-foreground/35 bg-secondary/70 text-foreground"
                              : "border-border bg-background/55 text-foreground hover:border-foreground/25 hover:bg-secondary/50",
                          hasSelection && !isSelected && !isConnected && "opacity-45 hover:opacity-100",
                        )}
                      >
                        <span
                          className={cn(
                            "absolute -left-1 top-1/2 size-2 -translate-y-1/2 rounded-full border",
                            isSelected
                              ? "border-background bg-background"
                              : "border-border bg-card group-hover:border-foreground/40",
                          )}
                          aria-hidden="true"
                        />
                        <span
                          className={cn(
                            "absolute -right-1 top-1/2 size-2 -translate-y-1/2 rounded-full border",
                            isSelected
                              ? "border-background bg-background"
                              : "border-border bg-card group-hover:border-foreground/40",
                          )}
                          aria-hidden="true"
                        />
                        <span className="block text-xs font-medium leading-4">{node.label}</span>
                        <span
                          className={cn(
                            "mt-2 block truncate font-mono text-[9px]",
                            isSelected ? "text-background/65" : "text-muted-foreground/65",
                          )}
                        >
                          {node.id}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <div className="border-t border-border bg-background/35 px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Selected signal
          </p>
          {selectedNodeId ? (
            <span className="font-mono text-[10px] text-foreground/70">
              {selectedEdges.length} direct {selectedEdges.length === 1 ? "route" : "routes"}
            </span>
          ) : null}
        </div>

        {selectedNodeId ? (
          selectedEdges.length > 0 ? (
            <ul className="mt-3 grid gap-2 xl:grid-cols-2">
              {selectedEdges.map((edge) => (
                <li
                  key={`${edge.from}-${edge.to}-${edge.label}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-2.5"
                >
                  <button
                    type="button"
                    onClick={() => onSelectNode(edge.from)}
                    className="truncate text-left text-[11px] font-medium text-foreground/80 underline-offset-4 hover:text-foreground hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
                  >
                    {nodeById.get(edge.from)?.label ?? edge.from}
                  </button>
                  <span className="flex min-w-16 items-center gap-1.5" aria-label={edge.label}>
                    <span className="h-px flex-1 bg-foreground/35" />
                    <ArrowRight className="size-3 text-foreground/70" aria-hidden="true" />
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectNode(edge.to)}
                    className="truncate text-left text-[11px] font-medium text-foreground/80 underline-offset-4 hover:text-foreground hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
                  >
                    {nodeById.get(edge.to)?.label ?? edge.to}
                  </button>
                  <span className="col-span-3 truncate font-mono text-[9px] text-muted-foreground">
                    {edge.label}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              This subsystem has no direct routes in the manifest.
            </p>
          )
        ) : (
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Select a subsystem to isolate its incoming and outgoing routes.
          </p>
        )}
      </div>
    </section>
  );
}
