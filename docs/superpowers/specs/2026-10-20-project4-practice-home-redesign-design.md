# Project 4 — Practice Screen + Home Redesign — Design

Date: 2026-10-20
Status: Approved (user, 2026-10-20) — single-screen practice (user layout,
below), 2-step onboarding with real upcoming-moment, home history, truth
mockup. Roadmap process: research → user reviews spec ✓ → plan → build.

## Goal

Redesign the practice/configure flow and the home + hero surfaces for what
Spar actually is now: two modes, a one-panelist default, first-name personas,
the Project 3 room. **Dense and real — sells what exists.** Every screen
tells the truth; nothing collects what it doesn't use; the home shows the
user's real history.

## Design concept — "the truth, densely"

- The hero shows the real room (the Project 3 room, animated), the real
  defaults, the real copy. No filler microcopy, no links to nothing.
- The home is a working dashboard: your moment, your history, your stats,
  one honest start button. Empty states are invitations, not zeros.
- The practice screen is ONE screen: with two modes and a one-panelist
  default, a three-step wizard is ceremony. Configure and start, top to
  bottom.
- Onboarding collects only what it keeps — and feeds what's real (your
  "preparing for" answer becomes your upcoming moment).

## 1. Practice screen — one screen, no stepper (user-locked layout)

Single page, top to bottom — the default path is **paste your material and
click Start**; everything else is available but optional:

1. **Defend** (the main focus, top): Bring material / Topic only toggle,
   title, and the material box.
2. **Mode**: Q&A and Drill as two cards **side by side**, Q&A preselected.
   When Drill is selected, the weakness field (drill-target chips) expands
   **under the cards**.
3. **Panel**: the seat view, compact — Ada prefilled, "Add panelist"
   visible, clicking a seat edits it (dialog unchanged). If space is tight,
   collapse to a one-line summary ("Ada · moderate") with an Edit link.
   The "YOU, presenting here" visual **stays** (user-locked: it has
   personality and explains what's about to happen).
4. **Room description (optional)**: behind a "Customize the room"
   disclosure — an advanced field that shouldn't take space for everyone.
5. **Start Sparring**: visible at the bottom, **sticky if the page
   scrolls**, with the same disabled-reason line.

Smaller fixes (user-locked):
- The "Ready" helper fires too eagerly (22 chars) while telling users to
  paste more — add a softer middle state for very short input ("Short, so
  the panel will have less to challenge") before the green light.
- SeatCard no longer shows "Ada" twice (drop the defaultName subtitle);
  the stepper is removed (with it the mobile-unlabeled stepper buttons).
- Session POST body unchanged.

## 2. Home — a working dashboard

- Header: greeting + name; upcoming moment line (or the set-one invitation).
- **Session history** (the density win): recent sessions from the existing
  `GET /api/sessions` — mode chip, date, persona names, one-line debrief
  takeaway (`oneThingToPractice`), "Read debrief" (if summary exists — the
  debrief view loads by session id). Empty state for new users: "No sessions
  yet — the room takes about 5 minutes" + start button.
- Stats row: sessions this week, streak, top skill, **total sessions**
  (finally rendered). Today's Focus card stays.
- Primary CTA stays top-right of the header area but reads truthfully:
  **"New session"** → practice.
- Upcoming-moment dialog unchanged.

## 3. Hero — the real room in the frame

- **The mockup is rebuilt to mirror the actual Project 3 room:** equal
  circular presences (Ada speaking, breathing), accent-edged captions, the
  real state language, "Sparring Room — Q&A" header, one mic activation
  ("Start speaking"). Same self-playing loop; reduced-motion respected;
  decorative visuals `aria-hidden`.
- Copy fixes: "1-3 panelists — Ada opens" (real default); proof points keep
  only what's true (pattern memory, Drill, real interruption) with honest
  wording; kill "Free to start. No credit card required." and the
  Terms/Privacy footer lie; scenario chips → the real two modes' use cases.
- "Watch demo" stays (scrolls to the mockup); CTAs unchanged otherwise.

## 4. Onboarding + auth — collect only what you keep

- **Onboarding becomes two steps:** (1) "What are you preparing for?" —
  free-text title + optional date → **creates the real upcoming moment**
  (same POST), skip allowed; (2) name. The focus-area step is deleted (its
  promise died with the coaching-focus removal).
- Auth stays fake-but-honest: one "Continue" + name (email dropped from the
  UI), no Terms/Privacy line, labels properly associated.

## 5. Real bug fixed along the way

Debrief header shows raw `open_spar`/`drill` (SCENARIOS lookup misses for
experience-keyed sessions) — the debrief label now derives from
`EXPERIENCES[session.experience].label`, falling back to legacy scenario
labels for old sessions.

## Dead weight deleted

`PersonaAvatar` (orphaned by Project 3), `SCENARIO_LIST`, mockup `tick`
state, `stats.totalSessions` becomes rendered (was dead), `all` field from
upcoming-moment GET stays (harmless) or drops, unused e2e double shapes
updated to real ones.

## What doesn't change

The view machine's structure (hero → auth → onboarding → home → practice →
sparring → debrief), all APIs' shapes (only the home starts CONSUMING
sessions history), the room, the debrief content, nav placeholders
(Coach/Progress = Projects 5-6), engine behavior.

## Contracts

- E2e funnel renegotiated deliberately: the same click-path must exist
  (hero CTA → auth → home CTA → topic input → mode → Start Sparring), with
  updated selectors where copy changed (single-screen practice removes the
  two "Next" clicks). The `/api/user` non-"Founder" → skip-onboarding rule
  is pinned behavior.
- Unit pins kept: experiences/personas/panel-seats suites; practice-view
  source pins updated to the new single-screen wiring.

## Accessibility (fixing audited gaps)

Auth/onboarding inputs properly labeled; no unlabeled stepper (removed);
hero/mockup animations respect `prefers-reduced-motion` and are
`aria-hidden`; history cards are real links/buttons with accessible names.

## Non-goals

Real authentication, multi-user, Coach/Progress views (Projects 5-6),
insights/analytics beyond the existing stats endpoint, any room changes,
billing.
