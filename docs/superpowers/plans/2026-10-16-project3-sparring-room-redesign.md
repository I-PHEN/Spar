# Project 3 — Sparring Room Redesign Implementation Plan

**Goal:** Rebuild the sparring room as a voice-first stage: bold panelist
presence rail, caption-style conversation column with guarded auto-scroll,
one engine-agnostic mic control, live barge-in acknowledgment, fixed "I need
a moment" in live mode, drill framing, audited dead weight deleted, and every
existing behavior contract (engine chip, deck strings, e2e flows, old
Defense/Boardroom sessions) intact.

**Spec:** `docs/superpowers/specs/2026-10-16-project3-sparring-room-redesign-design.md`
(approved: bold presence, quiet room, no live metrics).

**Architecture:** A pure `room-state.ts` module owns the state language
(room state × engine → presence status / control mode), keeping the pinned
helpers (`engineStatusLabel`, `liveOwnsControls`, …) as thin wrappers so
existing unit tests keep passing. A new `panelist-presence.tsx` owns the
signature visual. `sparring-room.tsx` is restructured around three regions
(top bar / presence rail + column / control bar) without changing engine
hooks, APIs, or session shape. Auto-scroll logic moves into a testable pure
helper.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind, bun test +
`renderToStaticMarkup` (existing pattern), Playwright e2e (port 3100; the
operator's :3000 server is never touched).

## Global Constraints

- The five pinned helper exports stay exported from `sparring-room.tsx`
  (`engineStatusLabel`, `liveOwnsControls`, `recordsTurnAudio`,
  `startsRecorderOnFallback`, `liveUserInterimCaption`) — their tests are the
  behavior contract; they may delegate to `room-state.ts` but not disappear.
- E2e-visible contracts stay: `Live`/`Classic`/`Connecting` chip text +
  `data-engine`, deck strings ("Mic live", "Start speaking", "Stop speaking",
  "Click to present", "Done Presenting", "Try again", "Panel is responding"),
  interim "Speaking…" caption, "Exit session" / "End & get coached", the
  `/live-exchange` POST shape.
- Old Defense/Boardroom sessions open and debrief inside the new layout —
  presenting flow, coach-read card, boardroom banner, restore branch all keep
  working (they may restyle, never break).
- Voice engines, `use-turn-controller` / `use-live-voice` internals, session
  schema, APIs, debrief generation: unchanged.
- No live metrics anywhere in the room (quiet-room stance, approved).
- No new npm dependencies. Verify per task: `bun test`; final task adds
  `test:e2e`, `typecheck`, `lint`, `build`, `git diff --check`.
- Motion respects `prefers-reduced-motion`. New interactive elements are
  keyboard-reachable with visible focus.
- Do not commit `.superpowers/`; never print `.env` or keys; e2e rewrites
  `tsconfig.json` — revert it, never stage it.

---

### Task 1: Delete the dead weight

**Files:** `src/components/spar/sparring-room.tsx` (TelemetryBar import,
`ChevronLeft`, `EXPERIENCES` value import, `showClaimsPanel`, `SparResponse`,
`liveWords/liveHedges/liveHasEvidence` + `quickStats`), delete
`src/components/spar/telemetry-bar.tsx`, `src/components/spar/transcript.tsx`,
dead CSS (`spar-interrupt-in`, `spar-caret`) in `src/app/globals.css`.

- [ ] Step 1: Verify each target is truly unreferenced (`grep -rn` for each
  symbol across `src/`, including tests). Anything with a live reference is
  reported, not deleted.
- [ ] Step 2: Delete the code + files. `bun test` and `bun run typecheck`
  green (509 baseline minus nothing — nothing pinned these).
- [ ] Step 3: Commit `chore: clear audited dead weight from the sparring room`.

### Task 2: `room-state.ts` — the state language (pure, TDD)

**Files:** create `src/components/spar/room-state.ts` +
`src/components/spar/room-state.test.ts`; modify `sparring-room.tsx` to
delegate the five pinned helpers to it (their tests must pass unchanged).

**Interface:**

```ts
export type RoomPhase =
  | "presenting" | "coach-read" | "listening" | "gathering"
  | "speaking" | "drill-retry" | "ending";
export interface RoomStateInput {
  liveSessionActive: boolean;
  liveStatus: "off" | "connecting" | "live" | "fallback";
  isPresenting: boolean; isUserTurn: boolean; isListening: boolean;
  isProcessing: boolean; audioPlaying: boolean; analyzing: boolean;
  coachReadOpen: boolean; drillRetry: boolean; ending: boolean;
}
/** The room's single status line + presence behavior, engine-agnostic. */
export function roomState(input: RoomStateInput): {
  phase: RoomPhase; statusLine: string; presence: "listening" | "gathering" | "speaking";
};
/** Sticky-to-bottom: should auto-scroll stick given the user's scroll position? */
export function shouldStickToBottom(distanceFromBottom: number): boolean;
```

- [ ] Step 1: Failing tests: `roomState` mapping table (classic cycle:
  idle→listening, processing→gathering, audioPlaying→speaking; live active →
  listening with statusLine "Mic live — just talk"; connecting → gathering +
  "Connecting the live engine…"; drill-retry phase; coach-read phase;
  presenting phase; fallback behaves like classic), `shouldStickToBottom`
  (<80px sticks; ≥80px releases).
- [ ] Step 2: Verify red. Step 3: Implement; re-point the five pinned helpers
  in `sparring-room.tsx` to delegate; their existing tests pass UNCHANGED.
- [ ] Step 4: Green + full `bun test`. Commit
  `feat: room state language module`.

### Task 3: `panelist-presence.tsx` — the signature element

**Files:** create `src/components/spar/panelist-presence.tsx` +
`panelist-presence.test.tsx`; uses per-persona `accentHue`/`accentBorder`
from `ARCHETYPES`.

**Interface:** `<PanelistPresence persona name status variant="portrait"|"row"
interrupted />` — portrait block (large avatar, name, one-line tagline,
status line with gathering dots / speaking glow / calm ping) and compact row
variant for extra panelists; `interrupted` plays the one-beat barge-in
flicker; all motion gated on `prefers-reduced-motion`.

- [ ] Step 1: Failing tests (renderToStaticMarkup): renders name + tagline +
  each status; accent hue present as style/class; row variant omits tagline;
  no meters/badges (quiet-room pin).
- [ ] Step 2: Red. Step 3: Implement (frontend-design guidance applies:
  presence is the one bold element — portrait scale, generous negative space,
  persona accent as the only color).
- [ ] Step 4: Green + full suite. Commit `feat: panelist presence component`.

### Task 4: Room restructure — presence rail + caption column

**Files:** `src/components/spar/sparring-room.tsx` (layout regions),
`sparring-room.test.tsx` (extend, don't weaken).

- [ ] Step 1: Failing tests: presence rail renders `PanelistPresence`
  portrait for the lead + rows for others; mobile strip renders rows; the
  boardroom banner and Defense/Boardroom chips still render for those
  sessions (legacy pin); persona caption rows carry the speaker's accent
  edge class.
- [ ] Step 2: Red. Step 3: Implement — replace the `aside` card sidebar +
  mobile card strip with the presence rail/strip; wire `roomState().phase` →
  presence status; wire the agitation "about-to-interrupt" avatar pulse
  (currently unreachable); interim ghost bubble keeps the pinned "Speaking…"
  header. Desktop grid: column + 320–420px rail; mobile: strip above feed.
- [ ] Step 4: Green + full suite + `bun run typecheck`. Commit
  `feat: presence rail layout`.

### Task 5: Transcript interactions + accessibility

**Files:** `src/components/spar/sparring-room.tsx`; new
`src/components/spar/scroll-anchor.ts` if needed (or reuse
`shouldStickToBottom`).

- [ ] Step 1: Failing tests: auto-scroll effect consults
  `shouldStickToBottom` (user scrolling up releases stick; new caption while
  stuck scrolls); feed has `aria-live="polite"`; error toasts have
  `role="alert"`; deck state text visible on mobile (no `hidden sm:inline`
  on status strings).
- [ ] Step 2: Red → implement → green + full suite. Commit
  `feat: guarded transcript scroll and room accessibility`.

### Task 6: Control bar unification + live fixes + drill framing

**Files:** `sparring-room.tsx` (+ `RoomControlDeck`), `room-state.ts` if the
moment-gating logic lands there.

- [ ] Step 1: Failing tests: "I need a moment" enabled whenever a
  conversation is live (user turn OR live session active), disabled only
  while gathering/speaking/ending; drill target line visible in top bar for
  drill sessions; attempt counter renders ONLY during drill-retry phase.
- [ ] Step 2: Red → implement: one center mic control position for both
  engines (live state ↔ classic click flow, no layout jump on fallback);
  drill framing per spec. All pinned deck strings preserved.
- [ ] Step 3: Green + full suite + typecheck. Commit
  `feat: unified control bar and drill framing`.

### Task 7: Full verification + docs

- [ ] `bun test && bun run test:e2e && bun run typecheck && bun run lint &&
  bun run build && git diff --check` — all exit 0 (revert tsconfig churn
  after e2e/build; never stage it). Fix fallout honestly — e2e failures mean
  a contract broke; investigate, don't loosen.
- [ ] README room section + worklog entry (house format): what shipped, how
  to try it (dev server → practice → room), old sessions still open.
- [ ] Commit `docs: document the sparring room redesign`.

## Deferred (explicit)

- Animatedwebs-sourced motion pieces beyond the state language (entrance
  choreography, ambient room tone) — evaluate during Task 3/4 build; only if
  they serve the presence, never decorative scatter.
- Legacy Defense/Boardroom visual polish beyond "renders correctly in the
  new structure".
- Practice/home screens (Project 4), insights (Project 6).
