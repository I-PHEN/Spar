# Architecture Explorer maintenance

`src/architecture/manifest.ts` is the source of truth for the Architecture Explorer at `/architecture`. Keep it synchronized whenever a change affects an experience, session route, voice provider, persistence model, turn state, or debrief flow.

## Adding or changing a node

Each new node must define all five of these fields:

- **Purpose** — what responsibility the component or subsystem owns.
- **Inputs** — the data, events, or dependencies it receives.
- **Outputs** — the values, side effects, or events it produces.
- **Important files** — the implementation files that let a contributor inspect the behavior.
- **Failure behavior** — what fails, degrades, or remains available if the component cannot complete its work.

One short analogy is allowed when it makes an unfamiliar component easier to understand. Keep it optional and subordinate to the concrete description.

The manifest is static documentation data. Do not add runtime model calls to generate, enrich, or explain its content.
