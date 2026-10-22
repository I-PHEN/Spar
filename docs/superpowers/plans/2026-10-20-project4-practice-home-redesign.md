# Project 4 — Practice Screen + Home Redesign Implementation Plan

**Goal:** Truth-first surfaces: single-screen practice (user-locked layout),
home with real session history + full stats + honest CTA, hero whose animated
mockup mirrors the actual Project 3 room, 2-step onboarding that creates the
real upcoming moment, debrief label bug fixed, audited dead weight cleared.

**Spec:** `docs/superpowers/specs/2026-10-20-project4-practice-home-redesign-design.md` (approved).

**Architecture:** Practice collapses to one page (state stays, stepper
dies). Home consumes the existing `GET /api/sessions` (shapes unchanged).
The hero mockup is rebuilt against real components' visual language (static
markup, same loop cadence). Onboarding posts the real upcoming-moment
endpoint. One shared helper derives debrief/session labels from
`EXPERIENCES` with legacy `SCENARIOS` fallback.

**Tech Stack:** Next.js 15, TypeScript, Tailwind, bun test +
`renderToStaticMarkup`, Playwright e2e (port 3100; dev app on 3001).

## Global Constraints

- Session POST body, all API shapes, the room, the debrief content,
  engine behavior: unchanged. The view machine's structure unchanged.
- E2e funnel renegotiated deliberately: same click-path (hero CTA → auth →
  home CTA → topic → mode → Start Sparring) with updated selectors; the
  `/api/user` non-"Founder" → skip-onboarding rule is pinned behavior.
- Unit pins kept: experiences / personas / panel-seats suites; practice-view
  source pins updated to the single-screen wiring.
- No new npm dependencies. Per task: `bun test`; final task adds e2e,
  typecheck, lint, build, `git diff --check`.
- Do not commit `.superpowers/`; never print `.env`; e2e rewrites
  `tsconfig.json` — revert, never stage.

---

### Task 1: Label fix + dead weight

**Files:** `src/lib/session-label.ts` (+ test), `src/app/page.tsx`
(debrief label), `src/lib/scenarios.ts` (drop `SCENARIO_LIST`), delete
`src/components/spar/persona-avatar.tsx`, mockup `tick` state, home's
unused `/api/stats` shape gaps.

- [x] Failing test: `sessionLabel("open_spar")` → "Q&A", `("drill")` →
  "Drill", legacy `("investor_pitch")` → SCENARIOS label, unknown → the
  raw key. Wire `handleSessionEnded` to it.
- [x] Delete dead code; full suite + typecheck green.
- [x] Commit `fix: experience-true session labels + surface dead weight cleared`.

### Task 2: Practice — single screen

**Files:** `src/components/spar/practice-view.tsx`, `practice-view.test.tsx`.

- [x] Failing tests (source + render): no stepper markup; "Defend" /
  "Mode" / "Panel" section order; mode cards side-by-side container;
  drill chips render only when Drill selected; "Customize the room"
  disclosure hides room description; sticky Start bar present; seat
  summary line renders ("Ada" + intensity word); softer short-material
  state string; "YOU" block present; no duplicated defaultName.
- [x] Implement the user-locked layout (spec §1). Same validation, same
  POST. Seat editor dialog unchanged. e2e selectors updated in Task 6.
- [x] Green + typecheck. Commit `feat: single-screen practice flow`.

### Task 3: Home — history + density

**Files:** `src/components/spar/home-view.tsx` (+ test), page.tsx passes
`onOpenDebrief`.

- [x] Failing tests: history section renders sessions (mode chip, date,
  takeaway, "Read debrief"); empty state with invitation; stats row
  includes total sessions; CTA reads "New session".
- [x] Implement: fetch `/api/sessions` alongside stats/moment; "Read
  debrief" opens the debrief view for that session id (page.tsx gains the
  handler); honest empty states (no bare zeros).
- [x] Green + typecheck. Commit `feat: home session history and density`.

### Task 4: Hero — truth mockup + honest copy

**Files:** `src/components/spar/sparring-mockup.tsx`, `hero-view.tsx`
(+ mockup test if pinning).

- [x] Failing tests (mockup render): equal circular presence(s) with Ada;
  accent-edged caption; header "Q&A"; mic "Start speaking"; no
  "Thesis Defense" / "Click to speak" strings; reduced-motion attr/class
  handling present.
- [x] Rebuild the mock loop against the real room's visual language; fix
  hero copy (1-3 panelists, default Ada opens; kill filler microcopy and
  Terms/Privacy lie; real scenario chips); animations `aria-hidden` +
  `prefers-reduced-motion`.
- [x] Green + typecheck. Commit `feat: hero tells the truth`.

### Task 5: Onboarding + auth honesty

**Files:** `src/components/spar/onboarding-view.tsx`, `auth-view.tsx`,
`src/app/page.tsx`.

- [x] Failing tests: onboarding has exactly 2 steps (moment title+date →
  real POST; name → `/api/user`); no focus-area step; auth is name-only
  with associated labels, no Terms line.
- [x] Implement; the moment POST reuses the existing endpoint; skip
  allowed on step 1.
- [x] Green + typecheck. Commit `feat: two-step onboarding with real moment`.

### Task 6: E2e funnel + full verification + docs

**Files:** `tests/e2e/voice-loop.spec.ts` (selectors for the single-screen
practice: no "Next" clicks; mode card + Start), README, worklog.

- [x] Update e2e to the new funnel; `bun run test:e2e` green (revert
  tsconfig churn; never stage).
- [x] `bun test && bun run typecheck && bun run lint && bun run build &&
  git diff --check` — all 0.
- [x] README (home/practice/hero descriptions) + worklog entry (house
  format). Commit `docs: document practice and home redesign`.

## Deferred (explicit)

- Real authentication / multi-user. Coach + Progress views (Projects 5-6).
- Any insights beyond the existing stats endpoint (Project 6).
- PersonaAvatar deletion happens in Task 1 only if nothing re-imports it.
