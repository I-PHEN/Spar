import { ArrowRight, Database, HardDrive } from "lucide-react";

interface EntityCardProps {
  name: string;
  cardinality: string;
  detail: string;
}

function EntityCard({ name, cardinality, detail }: EntityCardProps) {
  return (
    <article className="rounded-lg border border-border bg-background/55 p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-tight">{name}</h3>
        <span className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-muted-foreground">
          {cardinality}
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">{detail}</p>
    </article>
  );
}

const RELATIONSHIPS = [
  ["User", "1 → many", "Session", "the durable practice history"],
  ["Session", "1 → many", "SessionPersona", "the configured panel"],
  ["Session", "1 → many", "SessionMessage", "the complete transcript"],
  ["SessionPersona", "0/1 → many", "SessionMessage", "persona-authored turns only"],
  ["Session", "1 → many", "TurnMetric", "per-turn latency, usage, and fallback telemetry"],
  ["Session", "1 → 0/1", "SessionSummary", "one generated debrief"],
  ["User", "1 → many", "PatternMemory", "patterns accumulated across sessions"],
  ["Session", "1 → 0/1", "SkillSnapshot", "one five-dimension score snapshot"],
] as const;

export function DataMemory() {
  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-card/45 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Database className="size-4 text-foreground/70" aria-hidden="true" />
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Server-owned · Prisma / SQLite
              </p>
            </div>
            <h2 className="mt-2 text-lg font-semibold tracking-tight">
              A session is the persistence spine
            </h2>
          </div>
          <p className="max-w-lg text-xs leading-5 text-muted-foreground sm:text-right">
            Transcript evidence stays attached to its session. Summaries condense one session; patterns accumulate for a user; skill snapshots preserve change over time.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <EntityCard name="Session" cardinality="Core record" detail="Owns experience state, material, telemetry, timestamps, panel, messages, summary, and skill snapshot." />
          <EntityCard name="SessionPersona" cardinality="Many / session" detail="Stores each configured panelist and optionally identifies the persona behind a transcript message." />
          <EntityCard name="SessionMessage" cardinality="Many / session" detail="Stores user, persona, coach, and system transcript entries; personaId is nullable." />
          <EntityCard name="TurnMetric" cardinality="Many / session" detail="Stores one live-voice turn's latency milestones, providers, token usage, cost, and fallback reason, plus voice-engine attribution: voiceEngine (gemini-live, cascade, or browser) with the Live engine's firstLiveAudioMs and interruption count. turnId is unique per browser turn; rows are owned by the session and deleted with it." />
          <EntityCard name="SessionSummary" cardinality="Zero or one" detail="Stores the six-section coaching debrief after the session is ended and analyzed." />
          <EntityCard name="PatternMemory" cardinality="Many / user" detail="Upserts recurring behavior by user and tag so later sessions can receive cross-session context." />
          <EntityCard name="SkillSnapshot" cardinality="Zero or one" detail="Records clarity, recovery, concision, presence, and evidence for one session and one user." />
        </div>
      </section>

      <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]">
        <section className="rounded-xl border border-border bg-card/45 p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Relationship index
          </p>
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {RELATIONSHIPS.map(([from, cardinality, to, meaning]) => (
              <li
                key={`${from}-${to}`}
                className="grid gap-2 py-3 sm:grid-cols-[8rem_5.5rem_8rem_minmax(0,1fr)] sm:items-center"
              >
                <code className="font-mono text-[10px] text-foreground/80">{from}</code>
                <span className="flex items-center gap-1 font-mono text-[9px] text-muted-foreground">
                  {cardinality}
                  <ArrowRight className="size-3" aria-hidden="true" />
                </span>
                <code className="font-mono text-[10px] text-foreground/80">{to}</code>
                <span className="text-xs text-muted-foreground">{meaning}</span>
              </li>
            ))}
          </ul>
        </section>

        <aside className="rounded-xl border border-dashed border-foreground/30 bg-background/35 p-5">
          <div className="flex items-center gap-2">
            <HardDrive className="size-4 text-foreground/70" aria-hidden="true" />
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Browser-owned · IndexedDB
            </p>
          </div>
          <h2 className="mt-3 text-base font-semibold tracking-tight">Audio clips stay local</h2>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Microphone recordings live in the browser’s <code className="font-mono text-[10px] text-foreground/80">spar-audio</code> database, keyed as <code className="font-mono text-[10px] text-foreground/80">sessionId:messageIndex</code> for debrief replay.
          </p>
          <div className="mt-5 rounded-lg border border-border bg-card/55 p-4">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-foreground/65">
              Ownership boundary
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              The key associates a clip with a turn by convention. It is not a Prisma relation, is not written to SQLite, and is not synchronized across browsers or devices.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
