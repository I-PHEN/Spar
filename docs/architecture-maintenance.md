# Architecture Explorer maintenance

The Architecture Explorer at `/architecture` is curated from several static sources. Keep all affected sources synchronized whenever architecture changes:

- `src/architecture/manifest.ts` defines system-map nodes, edges, tours, experience step summaries, and critical routes.
- `src/architecture/experience-flows.ts` defines the detailed experience narratives, execution boundaries, stored results, and failure behavior.
- `src/architecture/voice-pipeline.ts` defines current voice fallback facts, while `src/components/architecture/voice-pipeline.tsx` defines the current and target pipeline narratives and stages.
- `src/components/architecture/data-memory.tsx` defines the persistence entities, cardinalities, ownership boundaries, and relationship descriptions.

Changes to an experience, session route, voice provider or fallback, persistence model, turn state, or debrief flow must update every affected source above in the same change.

## Adding or changing a node

Each new node must define all five of these fields:

- **Purpose** — what responsibility the component or subsystem owns.
- **Inputs** — the data, events, or dependencies it receives.
- **Outputs** — the values, side effects, or events it produces.
- **Important files** — the implementation files that let a contributor inspect the behavior.
- **Failure behavior** — what fails, degrades, or remains available if the component cannot complete its work.

One short analogy is allowed when it makes an unfamiliar component easier to understand. Keep it optional and subordinate to the concrete description.

The manifest is static documentation data. Do not add runtime model calls to generate, enrich, or explain its content.
