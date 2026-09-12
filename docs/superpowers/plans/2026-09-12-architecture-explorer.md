# Spar Architecture Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a development-only `/architecture` learning surface that explains Spar's important systems, four experiences, voice flow, data, failure paths, and measured latency without runtime model calls.

**Architecture:** A typed static manifest is the source of truth. Small focused React views render a clickable map, guided tours, experience state machines, voice/data views, and a latency-lab shell. Pure validators keep manifest references synchronized with the actual experience keys and critical route inventory.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS 4, Bun test runner, Lucide React.

## Global Constraints

- `/architecture` is available only when `NODE_ENV === "development"`; production requests return `notFound()`.
- The explorer imports no provider client and performs no runtime AI/model request.
- Every `ExperienceKey` and critical session API route must be represented.
- Each component explanation answers: purpose, input, output, important files, and failure behavior.
- Use at most one concise analogy per subsystem; keep implementation details collapsible.
- Do not include theme/shadcn implementation details in primary learning paths.
- Keep the main application runnable after every task.

---

## Planned File Structure

- `src/architecture/types.ts` — manifest, node, edge, tour, flow, and metric-view contracts.
- `src/architecture/manifest.ts` — curated architecture content and relationships.
- `src/architecture/validate.ts` — pure structural and repository-reference validation.
- `src/architecture/navigation.ts` — pure explorer tab/selection reducer.
- `src/architecture/*.test.ts` — manifest and navigation tests.
- `src/app/architecture/page.tsx` — development-only server route guard.
- `src/components/architecture/architecture-explorer.tsx` — explorer shell and navigation.
- `src/components/architecture/system-map.tsx` — clickable system relationship map.
- `src/components/architecture/component-detail.tsx` — five-question node explanation.
- `src/components/architecture/guided-tour.tsx` — next/back walkthrough.
- `src/components/architecture/experience-flows.tsx` — four mode state machines.
- `src/components/architecture/voice-pipeline.tsx` — current and target voice paths.
- `src/components/architecture/data-memory.tsx` — persistence and memory relationships.
- `src/components/architecture/latency-lab.tsx` — metric empty state and later live data view.
- `src/app/api/dev/metrics/route.ts` — development-only metric endpoint returning a stable contract.

### Task 1: Add the Test Harness and Development Route Guard

**Files:**
- Modify: `package.json`
- Create: `src/architecture/access.ts`
- Test: `src/architecture/access.test.ts`
- Create: `src/app/architecture/page.tsx`

**Interfaces:**
- Produces: `isArchitectureEnabled(nodeEnv: string | undefined): boolean`
- Produces: `/architecture` route that calls `notFound()` outside development.

- [ ] **Step 1: Add test/typecheck scripts and make standalone packaging cross-platform**

Add these scripts to `package.json` without changing dependency versions. Preserve the existing standalone asset-copy behavior, but replace the Unix-only `cp -r` commands with Node's cross-platform `cpSync`:

```json
"build": "next build && node -e \"const fs=require('node:fs');fs.cpSync('.next/static','.next/standalone/.next/static',{recursive:true});fs.cpSync('public','.next/standalone/public',{recursive:true})\"",
"test": "bun test",
"test:watch": "bun test --watch",
"typecheck": "tsc --noEmit"
```

- [ ] **Step 2: Write the failing access test**

```ts
import { describe, expect, test } from "bun:test";
import { isArchitectureEnabled } from "./access";

describe("isArchitectureEnabled", () => {
  test("allows development only", () => {
    expect(isArchitectureEnabled("development")).toBe(true);
    expect(isArchitectureEnabled("production")).toBe(false);
    expect(isArchitectureEnabled("test")).toBe(false);
    expect(isArchitectureEnabled(undefined)).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test and confirm the expected failure**

Run: `bun test src/architecture/access.test.ts`

Expected: FAIL because `./access` does not exist.

- [ ] **Step 4: Implement the guard and minimal page**

```ts
// src/architecture/access.ts
export function isArchitectureEnabled(nodeEnv: string | undefined): boolean {
  return nodeEnv === "development";
}
```

```tsx
// src/app/architecture/page.tsx
import { notFound } from "next/navigation";
import { isArchitectureEnabled } from "@/architecture/access";

export default function ArchitecturePage() {
  if (!isArchitectureEnabled(process.env.NODE_ENV)) notFound();
  return <main><h1>Spar architecture</h1></main>;
}
```

- [ ] **Step 5: Verify test and typecheck**

Run: `bun test src/architecture/access.test.ts && bun run typecheck && bun run build`

Expected: 1 test passes; TypeScript and the complete Windows-compatible standalone build exit 0.

- [ ] **Step 6: Commit**

```bash
git add package.json src/architecture/access.ts src/architecture/access.test.ts src/app/architecture/page.tsx
git commit -m "test: add architecture route guard"
```

### Task 2: Define and Validate the Architecture Manifest

**Files:**
- Create: `src/architecture/types.ts`
- Create: `src/architecture/manifest.ts`
- Create: `src/architecture/validate.ts`
- Test: `src/architecture/validate.test.ts`

**Interfaces:**
- Produces: `ArchitectureManifest`, `ArchitectureNode`, `ArchitectureEdge`, `ExperienceFlow`, and `GuidedTour`.
- Produces: `architectureManifest: ArchitectureManifest`.
- Produces: `validateManifest(manifest, repositoryRoot): string[]`.

- [ ] **Step 1: Define manifest contracts**

```ts
export type ArchitectureLayer = "browser" | "api" | "domain" | "provider" | "storage";

export interface ArchitectureNode {
  id: string;
  label: string;
  layer: ArchitectureLayer;
  purpose: string;
  inputs: string[];
  outputs: string[];
  files: string[];
  failure: string;
  analogy?: string;
}

export interface ArchitectureEdge { from: string; to: string; label: string }
export interface FlowStep { id: string; label: string; kind: "user" | "code" | "ai" | "storage" }
export interface ExperienceFlow { id: "defense" | "boardroom" | "open_spar" | "drill"; summary: string; steps: FlowStep[] }
export interface GuidedTour { id: string; label: string; nodeIds: string[] }
export interface ArchitectureManifest {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  experiences: ExperienceFlow[];
  tours: GuidedTour[];
  criticalRoutes: string[];
}
```

- [ ] **Step 2: Write failing validator tests**

Tests must assert: duplicate node IDs fail; dangling edges fail; missing experience keys fail; missing files fail; missing critical routes fail; valid repository manifest returns `[]`.

```ts
import { describe, expect, test } from "bun:test";
import { architectureManifest } from "./manifest";
import { validateManifest } from "./validate";

describe("architecture manifest", () => {
  test("matches the repository", () => {
    expect(validateManifest(architectureManifest, process.cwd())).toEqual([]);
  });

  test("rejects a dangling edge", () => {
    const broken = { ...architectureManifest, edges: [{ from: "missing", to: "ui", label: "bad" }] };
    expect(validateManifest(broken, process.cwd())).toContain("Unknown edge source: missing");
  });
});
```

- [ ] **Step 3: Run the tests and confirm failure**

Run: `bun test src/architecture/validate.test.ts`

Expected: FAIL because manifest and validator modules do not exist.

- [ ] **Step 4: Implement deterministic validation**

`validateManifest` must use `EXPERIENCE_LIST.map(item => item.key)`, `existsSync(resolve(repositoryRoot, file))`, and the manifest's `criticalRoutes`. Return stable human-readable errors rather than throwing.

```ts
const expectedRoutes = [
  "src/app/api/sessions/route.ts",
  "src/app/api/sessions/[id]/open/route.ts",
  "src/app/api/sessions/[id]/present/route.ts",
  "src/app/api/sessions/[id]/spar-stream/route.ts",
  "src/app/api/sessions/[id]/end/route.ts",
  "src/app/api/sessions/[id]/debrief/route.ts",
];
```

- [ ] **Step 5: Populate the complete initial manifest**

Include nodes for: page/view navigation, practice configuration, experiences, sparring room, session API, agitation engine, drill engine, persona prompt, OpenRouter live generation, Web Speech recognition, Deepgram REST TTS, Prisma/SQLite, IndexedDB audio, telemetry, and debrief generation. Include separate `current` and `target` voice edges so the explorer is honest before the latency refactor.

Include exactly four experience flows using `defense`, `boardroom`, `open_spar`, and `drill`. Include tours named `start-session`, `one-voice-turn`, `boardroom-interruption`, and `end-and-debrief`.

- [ ] **Step 6: Verify manifest tests**

Run: `bun test src/architecture/validate.test.ts`

Expected: all validator tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/architecture
git commit -m "feat: define architecture manifest"
```

### Task 3: Build the Explorer Shell, Navigation, and System Map

**Files:**
- Create: `src/architecture/navigation.ts`
- Test: `src/architecture/navigation.test.ts`
- Create: `src/components/architecture/architecture-explorer.tsx`
- Create: `src/components/architecture/system-map.tsx`
- Create: `src/components/architecture/component-detail.tsx`
- Modify: `src/app/architecture/page.tsx`

**Interfaces:**
- Consumes: `architectureManifest` and `ArchitectureNode` from Task 2.
- Produces: `ExplorerState`, `ExplorerAction`, and `reduceExplorerState`.
- Produces: `<ArchitectureExplorer manifest={architectureManifest} />`.

- [ ] **Step 1: Write failing navigation reducer tests**

```ts
import { expect, test } from "bun:test";
import { initialExplorerState, reduceExplorerState } from "./navigation";

test("selecting a node opens its detail", () => {
  const next = reduceExplorerState(initialExplorerState, { type: "select-node", nodeId: "session-api" });
  expect(next.selectedNodeId).toBe("session-api");
});

test("changing tabs clears stale node detail", () => {
  const next = reduceExplorerState({ tab: "map", selectedNodeId: "session-api", tourIndex: 0 }, { type: "select-tab", tab: "experiences" });
  expect(next).toEqual({ tab: "experiences", selectedNodeId: null, tourIndex: 0 });
});
```

- [ ] **Step 2: Run the reducer test and confirm failure**

Run: `bun test src/architecture/navigation.test.ts`

Expected: FAIL because `navigation.ts` does not exist.

- [ ] **Step 3: Implement the reducer**

Define tabs as `"map" | "tour" | "experiences" | "voice" | "data" | "latency"`. Support `select-tab`, `select-node`, `next-tour-step`, `previous-tour-step`, and `select-tour` actions with bounded indices.

- [ ] **Step 4: Build the client shell**

Use semantic `<button>` tabs with `aria-selected`, one active panel, and a single `useReducer`. Render labels exactly as: System map, Guided tour, Experiences, Voice pipeline, Data & memory, Latency lab.

- [ ] **Step 5: Build the system map and detail view**

Group nodes by `ArchitectureLayer`. Node buttons select a node. The detail view renders headings for Purpose, Inputs, Outputs, Important files, and Failure behavior, plus an optional one-line Analogy.

- [ ] **Step 6: Wire the route**

```tsx
import { ArchitectureExplorer } from "@/components/architecture/architecture-explorer";
import { architectureManifest } from "@/architecture/manifest";

// after the development guard
return <ArchitectureExplorer manifest={architectureManifest} />;
```

- [ ] **Step 7: Verify**

Run: `bun test src/architecture/navigation.test.ts && bun run typecheck && bun run lint`

Expected: tests pass and both static checks exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/app/architecture src/architecture/navigation.ts src/architecture/navigation.test.ts src/components/architecture
git commit -m "feat: add architecture system map"
```

### Task 4: Add Guided Tours and Experience State Machines

**Files:**
- Create: `src/components/architecture/guided-tour.tsx`
- Create: `src/components/architecture/experience-flows.tsx`
- Test: `src/architecture/experience-flows.test.ts`
- Modify: `src/components/architecture/architecture-explorer.tsx`

**Interfaces:**
- Consumes: `GuidedTour`, `ExperienceFlow`, and manifest nodes.
- Produces: guided next/back learning flow and all four experience diagrams.

- [ ] **Step 1: Write the failing mode-flow test**

Assert these ordered semantic checkpoints:

```ts
const expected = {
  defense: ["configure", "present", "analyze", "qa", "end", "debrief"],
  boardroom: ["configure", "present", "interrupt", "recover", "qa", "end", "debrief"],
  open_spar: ["configure", "panel-opens", "answer", "challenge", "end", "debrief"],
  drill: ["choose-target", "question", "answer", "detect", "correct-or-advance", "end", "debrief"],
};
```

Compare each manifest flow's step IDs to its expected array.

- [ ] **Step 2: Run the test and confirm any manifest mismatch fails**

Run: `bun test src/architecture/experience-flows.test.ts`

Expected: FAIL until Task 2 manifest steps exactly match the approved flow IDs.

- [ ] **Step 3: Align manifest steps and make the test pass**

Each step must be classified as `user`, `code`, `ai`, or `storage`. Drill `detect` and `correct-or-advance` must be `code`; Drill `question` must be `ai`.

- [ ] **Step 4: Implement GuidedTour**

Render one node at a time with Back and Next buttons, an `aria-live="polite"` progress label, the node's five-question detail, and no automatic animation.

- [ ] **Step 5: Implement ExperienceFlows**

Render shared lifecycle once, then four selectable flow summaries. Selecting a mode reveals ordered steps, who speaks first, presentation rules, interruption policy, AI steps, deterministic steps, stored results, and failure behavior.

- [ ] **Step 6: Verify**

Run: `bun test src/architecture/experience-flows.test.ts && bun run typecheck && bun run lint`

Expected: all checks pass.

- [ ] **Step 7: Commit**

```bash
git add src/architecture src/components/architecture
git commit -m "feat: explain Spar experience flows"
```

### Task 5: Add Voice, Data, and Latency-Lab Views

**Files:**
- Create: `src/architecture/metrics.ts`
- Test: `src/architecture/metrics.test.ts`
- Create: `src/components/architecture/voice-pipeline.tsx`
- Create: `src/components/architecture/data-memory.tsx`
- Create: `src/components/architecture/latency-lab.tsx`
- Create: `src/app/api/dev/metrics/route.ts`
- Modify: `src/components/architecture/architecture-explorer.tsx`

**Interfaces:**
- Produces: `TurnMetricView`, `MetricSummary`, and `summarizeMetrics(metrics)`.
- Produces: `GET /api/dev/metrics` returning `{ turns: TurnMetricView[], summary: MetricSummary }` in development and 404 otherwise.

- [ ] **Step 1: Write failing percentile tests**

```ts
import { expect, test } from "bun:test";
import { summarizeMetrics } from "./metrics";

test("summarizes playback latency and token use", () => {
  const summary = summarizeMetrics([
    { turnId: "1", playbackMs: 800, inputTokens: 900, outputTokens: 40, cachedTokens: 600, costUsd: 0.0001 },
    { turnId: "2", playbackMs: 1200, inputTokens: 1100, outputTokens: 55, cachedTokens: 700, costUsd: 0.0002 },
  ]);
  expect(summary.p50PlaybackMs).toBe(1000);
  expect(summary.maxInputTokens).toBe(1100);
  expect(summary.totalCostUsd).toBeCloseTo(0.0003);
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `bun test src/architecture/metrics.test.ts`

Expected: FAIL because `metrics.ts` does not exist.

- [ ] **Step 3: Implement metric contracts and aggregation**

Use a linear-interpolation percentile function. Empty input returns null percentiles and zero totals. Do not invent metrics.

- [ ] **Step 4: Implement development-only metrics API**

Initially return an empty `turns` array and `summarizeMetrics([])`. Plan 2 replaces the empty source with persisted turn traces. Apply the same `isArchitectureEnabled` guard and never return environment values.

- [ ] **Step 5: Implement the three views**

- Voice pipeline: toggle Current and Target; show STT, turn controller, generator, phrase chunker, TTS, playback, cancellation, and fallback edges.
- Data & memory: show Prisma session/persona/message/summary/pattern/skill relationships and separate IndexedDB audio ownership.
- Latency lab: fetch `/api/dev/metrics`, show an honest “No measured turns yet” state, and render p50, p95, token maxima, cache ratio, cost, and fallback count only when data exists.

- [ ] **Step 6: Verify complete explorer**

Run: `bun test && bun run typecheck && bun run lint && bun run build`

Expected: all commands exit 0. Production build succeeds while the route guard remains enforced at request time.

- [ ] **Step 7: Manually verify the development route**

Run: `bunx next dev -p 3000`

Open: `http://localhost:3000/architecture`

Expected: all six tabs work; node and mode selections update; the latency lab shows the empty state; browser network activity contains no provider request.

- [ ] **Step 8: Commit**

```bash
git add src/architecture src/components/architecture src/app/api/dev/metrics
git commit -m "feat: complete architecture explorer"
```

### Task 6: Document Maintenance Rules and Final Verification

**Files:**
- Modify: `README.md`
- Create: `docs/architecture-maintenance.md`

**Interfaces:**
- Produces: contributor instructions for keeping the manifest current.

- [ ] **Step 1: Document the route and maintenance trigger**

Add a README Development section with `http://localhost:3000/architecture`. Document that changes to `ExperienceKey`, session routes, voice providers, persistence models, turn state, or debrief flow must update `src/architecture/manifest.ts`.

- [ ] **Step 2: Document the five-question content rule**

In `docs/architecture-maintenance.md`, require each new node to define purpose, inputs, outputs, important files, and failure behavior; allow one short analogy; prohibit runtime model calls.

- [ ] **Step 3: Run final verification**

Run: `bun test && bun run typecheck && bun run lint && bun run build && git diff --check`

Expected: all commands exit 0; no test failures; no whitespace errors.

- [ ] **Step 4: Inspect tracked output**

Run: `git status --short`

Expected: only `README.md` and `docs/architecture-maintenance.md` are uncommitted at this task boundary; `.env`, `prisma/dev.db`, `.next`, and `.superpowers` do not appear.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/architecture-maintenance.md
git commit -m "docs: explain architecture explorer maintenance"
```
