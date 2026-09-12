# Task 2 Report: Define and Validate the Architecture Manifest

## Implementation

- Added typed contracts for the architecture manifest, nodes, edges, experience flows, and guided tours.
- Added `architectureManifest` as a static, provider-free representation of the current Spar architecture. It covers navigation, session configuration, all four experiences, the sparring room, session APIs, agitation and drill logic, persona prompts, OpenRouter streaming, browser speech recognition, Deepgram REST TTS, Prisma/SQLite, IndexedDB clips, telemetry, and debrief generation.
- Modelled the current server-mediated OpenRouter/Deepgram voice path separately from the explicitly labelled target voice edge, so the explorer does not present the latency-refactor target as already implemented.
- Added deterministic validation for duplicate IDs, dangling edge endpoints, guided-tour node references, required experience keys from `EXPERIENCE_LIST.map((item) => item.key)`, file existence through `existsSync(resolve(repositoryRoot, file))`, and the six required session API routes declared by the manifest.
- Added real validator behavior tests with literal expected errors, plus an exact flow-state-machine contract for all four experiences.

## Files Changed

- `src/architecture/types.ts`
- `src/architecture/manifest.ts`
- `src/architecture/validate.ts`
- `src/architecture/validate.test.ts`
- `.superpowers/sdd/2026-09-12-architecture-explorer/task-2-report.md`

## RED Evidence

### Initial validator contract

Command:

```text
bun test src/architecture/validate.test.ts
```

Output:

```text
bun test v1.4.2 (744846f84)

src\architecture\validate.test.ts:

# Unhandled error between tests
-------------------------------
error: Cannot find module './manifest' from 'C:\Users\Michael\Spar\.worktrees\spar-performance\src\architecture\validate.test.ts'
-------------------------------


 0 pass
 1 fail
 1 error
Ran 1 test across 1 file. [40.00ms]
```

This failed for the intended reason: the test imported the non-existent manifest module before any production manifest or validator code existed.

### Experience-flow contract

Command:

```text
bun test src/architecture/validate.test.ts
```

Output:

```text
bun test v1.4.2 (744846f84)

src\architecture\validate.test.ts:
(pass) architecture manifest > matches the repository [3.00ms]
(pass) architecture manifest > rejects duplicate node IDs [2.56ms]
(pass) architecture manifest > rejects dangling edges [2.18ms]
(pass) architecture manifest > rejects a missing experience key [2.39ms]
(pass) architecture manifest > rejects node files that do not exist [2.49ms]
(pass) architecture manifest > rejects a missing critical session route [2.42ms]
81 |         experience.id,
82 |         experience.steps.map((step) => step.id),
83 |       ])
84 |     );
85 |
86 |     expect(stepsByExperience).toEqual({
                                   ^
error: expect(received).toEqual(expected)

  {
    "boardroom": [
-     "configure",
-     "present",
-     "interrupt",
-     "recover",
-     "qa",
-     "end",
-     "debrief",
+     "practice-configuration",
+     "session-api",
+     "web-speech-recognition",
+     "agitation-engine",
+     "openrouter-live-generation",
    ],
    "defense": [
-     "configure",
-     "present",
-     "analyze",
-     "qa",
-     "end",
-     "debrief",
+     "practice-configuration",
+     "session-api",
+     "sparring-room",
+     "openrouter-live-generation",
+     "debrief-generation",
    ],
    "drill": [
-     "choose-target",
-     "question",
-     "answer",
-     "detect",
-     "correct-or-advance",
-     "end",
-     "debrief",
+     "practice-configuration",
+     "drill-engine",
+     "agitation-engine",
+     "sparring-room",
+     "debrief-generation",
    ],
    "open_spar": [
-     "configure",
-     "panel-opens",
-     "answer",
-     "challenge",
-     "end",
-     "debrief",
+     "practice-configuration",
+     "session-api",
+     "openrouter-live-generation",
+     "sparring-room",
+     "telemetry",
    ],
  }

- Expected  - 26
+ Received  + 20

      at <anonymous> (C:\Users\Michael\Spar\.worktrees\spar-performance\src\architecture\validate.test.ts:86:31)
(fail) architecture manifest > defines the approved experience state machines [17.09ms]

 6 pass
 1 fail
 7 expect() calls
Ran 7 tests across 1 file. [66.00ms]
```

This intentionally caught the first implementation's node-oriented step IDs before the flow renderer could depend on them. The manifest was then aligned to the approved semantic checkpoints.

### Guided-tour reference validation

Command:

```text
bun test src/architecture/validate.test.ts
```

Output:

```text
bun test v1.4.2 (744846f84)

src\architecture\validate.test.ts:
(pass) architecture manifest > matches the repository [5.09ms]
(pass) architecture manifest > rejects duplicate node IDs [6.88ms]
(pass) architecture manifest > rejects dangling edges [6.57ms]
43 |           nodeIds: ["missing"],
44 |         },
45 |       ],
46 |     };
47 |
48 |     expect(validateManifest(broken, process.cwd())).toContain(
                                                         ^
error: expect(received).toContain(expected)

Expected to contain: "Unknown tour node: missing"
Received: []

      at <anonymous> (C:\Users\Michael\Spar\.worktrees\spar-performance\src\architecture\validate.test.ts:48:53)
(fail) architecture manifest > rejects guided tours that reference an unknown node [7.90ms]
(pass) architecture manifest > rejects a missing experience key [4.28ms]
(pass) architecture manifest > rejects node files that do not exist [3.48ms]
(pass) architecture manifest > rejects a missing critical session route [3.72ms]
(pass) architecture manifest > defines the approved experience state machines [1.20ms]

 7 pass
 1 fail
 8 expect() calls
Ran 8 tests across 1 file. [125.00ms]
```

This failed for the intended missing validator branch, then drove the minimal guided-tour validation loop.

## GREEN Evidence

Focused command:

```text
bun test src/architecture/validate.test.ts
```

Output:

```text
bun test v1.4.2 (744846f84)

src\architecture\validate.test.ts:
(pass) architecture manifest > matches the repository [5.40ms]
(pass) architecture manifest > rejects duplicate node IDs [4.81ms]
(pass) architecture manifest > rejects dangling edges [6.92ms]
(pass) architecture manifest > rejects guided tours that reference an unknown node [6.06ms]
(pass) architecture manifest > rejects a missing experience key [4.20ms]
(pass) architecture manifest > rejects node files that do not exist [4.95ms]
(pass) architecture manifest > rejects a missing critical session route [6.29ms]
(pass) architecture manifest > defines the approved experience state machines [0.54ms]

 8 pass
 0 fail
 8 expect() calls
Ran 8 tests across 1 file. [88.00ms]
```

## Full Verification

Command:

```text
bun test
```

Output:

```text
bun test v1.4.2 (744846f84)

src\architecture\access.test.ts:
(pass) isArchitectureEnabled > allows development only [0.37ms]

src\architecture\validate.test.ts:
(pass) architecture manifest > matches the repository [9.57ms]
(pass) architecture manifest > rejects duplicate node IDs [27.93ms]
(pass) architecture manifest > rejects dangling edges [22.83ms]
(pass) architecture manifest > rejects guided tours that reference an unknown node [10.64ms]
(pass) architecture manifest > rejects a missing experience key [4.85ms]
(pass) architecture manifest > rejects node files that do not exist [5.90ms]
(pass) architecture manifest > rejects a missing critical session route [4.84ms]
(pass) architecture manifest > defines the approved experience state machines [0.69ms]

 9 pass
 0 fail
 12 expect() calls
Ran 9 tests across 2 files. [229.00ms]
```

Command:

```text
bun run typecheck
```

Output:

```text
$ tsc --noEmit
examples/websocket/frontend.tsx(4,20): error TS2307: Cannot find module 'socket.io-client' or its corresponding type declarations.
examples/websocket/server.ts(2,24): error TS2307: Cannot find module 'socket.io' or its corresponding type declarations.
src/app/api/sessions/[id]/end/route.ts(58,49): error TS2339: Property 'summary' does not exist on type '{ user: { sessions: ({ summary: { id: string; createdAt: Date; sessionId: string; momentDescription: string; whatWentWell: string; thePattern: string; oneThingToPractice: string; telemetryInsights: string; shareableSummary: string; } | null; } & { ...; })[]; patternMemories: { ...; }[]; } & { ...; }; personas: { ......'.
src/app/api/sessions/[id]/end/route.ts(61,24): error TS2339: Property 'summary' does not exist on type '{ user: { sessions: ({ summary: { id: string; createdAt: Date; sessionId: string; momentDescription: string; whatWentWell: string; thePattern: string; oneThingToPractice: string; telemetryInsights: string; shareableSummary: string; } | null; } & { ...; })[]; patternMemories: { ...; }[]; } & { ...; }; personas: { ......'.
src/app/api/sessions/[id]/end/route.ts(89,9): error TS2322: Type '{ content: string; id: string; createdAt: Date; sessionId: string; personaId: string | null; role: string; type: string; claimRef: number | null; }' is not assignable to type 'null'.
src/app/api/sessions/[id]/end/route.ts(95,39): error TS2339: Property 'content' does not exist on type 'never'.
src/app/api/sessions/[id]/end/route.ts(103,63): error TS2339: Property 'createdAt' does not exist on type 'never'.
src/app/api/sessions/[id]/end/route.ts(312,7): error TS2561: Object literal may only specify known properties, but 'unresolvedChallenges' does not exist in type '{ target: string; label: string; totalChallenges: number; resolvedChallenges: number; attempt1Clean: number; attempt2Clean: number; attempt3Plus: number; fastestRecovery: number; slowestRecovery: number; avgRecovery: number; totalScore: number; maxScore: number; }'. Did you mean to write 'resolvedChallenges'?
src/app/api/sessions/[id]/present/route.ts(87,7): error TS2322: Type 'PresentationAnalysis' is not assignable to type 'null'.
src/app/api/sessions/[id]/spar-stream/route.ts(210,10): error TS2454: Variable 'nextPersona' is used before being assigned.
src/components/spar/debrief-view.tsx(130,17): error TS2339: Property 'pause' does not exist on type 'never'.
src/lib/llm.ts(453,37): error TS2551: Property 'unresolvedChallenges' does not exist on type '{ target: string; label: string; totalChallenges: number; resolvedChallenges: number; attempt1Clean: number; attempt2Clean: number; attempt3Plus: number; fastestRecovery: number; slowestRecovery: number; avgRecovery: number; totalScore: number; maxScore: number; }'. Did you mean 'resolvedChallenges'?
```

The typecheck diagnostics exactly match the known pre-existing ledger items from Task 1. No diagnostic is in `src/architecture`.

Command:

```text
git diff --check
```

Output:

```text
(no output; exit code 0)
```

Command:

```text
rg -n "(from .*openrouter|from .*voice|from .*llm|fetch\\()" src/architecture
```

Output:

```text
(no output; exit code 1)
```

The empty architecture search confirms that the explorer's static source files import no provider client and perform no runtime request.

## Self-Review

- Every required architecture component is represented by a node with non-empty purpose, inputs, outputs, files, and failure behavior. No node relies on an analogy for its explanation; no theme or component-library detail is included.
- The manifest has exactly the four real `ExperienceKey` values and the four required guided tours: `start-session`, `one-voice-turn`, `boardroom-interruption`, and `end-and-debrief`.
- All six critical session API paths are present in both the session node and the manifest route list.
- Manifest file references are validated against the repository root. The validator returns stable errors instead of throwing.
- All guided-tour node IDs are valid, and the extra regression test protects that route-level learning content.
- No provider code, provider client import, package change, or runtime application route changed. The main application remains untouched by this task.

## Concerns

- Project-wide TypeScript remains non-green only because of the pre-existing diagnostics listed above. They are outside this task's allowed files; the architecture additions introduced none.
