import type { ArchitectureNode } from "@/architecture/types";

interface ComponentDetailProps {
  node: ArchitectureNode | null;
}

function DetailList({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2 text-sm leading-6 text-foreground/80">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5">
          <span aria-hidden="true" className="mt-[0.7rem] size-1 shrink-0 rounded-full bg-foreground/45" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function ComponentDetail({ node }: ComponentDetailProps) {
  if (!node) {
    return (
      <aside className="flex min-h-72 items-center justify-center rounded-xl border border-dashed border-border bg-card/30 p-8 lg:sticky lg:top-6">
        <div className="max-w-64 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Detail channel idle
          </p>
          <h2 className="mt-3 text-base font-semibold tracking-tight text-foreground">
            Select a subsystem
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Choose any node to inspect its contract, files, and failure boundary.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="rounded-xl border border-border bg-card/70 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto"
      aria-label={`${node.label} details`}
    >
      <header className="border-b border-border px-5 py-5 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {node.layer} layer
          </p>
          <span className="size-1.5 rounded-full bg-foreground" aria-hidden="true" />
        </div>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
          {node.label}
        </h2>
        <p className="mt-1 font-mono text-[11px] text-muted-foreground/70">{node.id}</p>
      </header>

      <div className="divide-y divide-border">
        <section className="px-5 py-5 sm:px-6">
          <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Purpose
          </h3>
          <p className="mt-3 text-sm leading-6 text-foreground/85">{node.purpose}</p>
        </section>

        <div className="grid sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <section className="px-5 py-5 sm:px-6 xl:border-r xl:border-border">
            <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Inputs
            </h3>
            <DetailList items={node.inputs} />
          </section>
          <section className="border-t border-border px-5 py-5 sm:border-t-0 sm:px-6 lg:border-t lg:border-l-0 xl:border-t-0">
            <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Outputs
            </h3>
            <DetailList items={node.outputs} />
          </section>
        </div>

        <details className="px-5 py-5 sm:px-6">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground marker:text-foreground/55">
            Important files
          </summary>
          <ul className="mt-3 space-y-2">
            {node.files.map((file) => (
              <li key={file}>
                <code className="block overflow-x-auto rounded-md border border-border bg-background/70 px-3 py-2 font-mono text-[11px] leading-5 text-foreground/75">
                  {file}
                </code>
              </li>
            ))}
          </ul>
        </details>

        <section className="px-5 py-5 sm:px-6">
          <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Failure behavior
          </h3>
          <p className="mt-3 border-l-2 border-destructive/60 pl-3 text-sm leading-6 text-foreground/80">
            {node.failure}
          </p>
        </section>

        {node.analogy ? (
          <section className="px-5 py-4 sm:px-6">
            <p className="text-xs leading-5 text-muted-foreground">
              <span className="mr-2 font-medium text-foreground/75">Analogy</span>
              {node.analogy}
            </p>
          </section>
        ) : null}
      </div>
    </aside>
  );
}
