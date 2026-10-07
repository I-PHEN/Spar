# Spar Product Roadmap (v2 — refined 2026-10-07)

Date: 2026-09-24, refined 2026-10-07
Status: Order approved by user (v2 reflects the user-experiment focus)

## How we work (process contract)

One project at a time. Each project: **research → user reviews spec → plan →
build → user checks it meets requirements → next project.** Nothing is built
all at once; no surface-level work — every part gets its research phase.
After every completed project or goal, `worklog.md` (repo root) gets a new
entry summarizing what was built and what changed — it is the user's living
map of the app.

## Standing decisions (v2)

- **Voice engine: Gemini 3.8 Live speech-to-speech** — one socket, mic in →
  voice out, current Deepgram+Groq+Aura-2 pipeline as automatic fallback.
  Unchanged from the approved spec; implementation in flight.
- **Two visible modes only: Q&A and Drill.** Q&A = today's `open_spar`
  (renamed in UI only); Defense and Boardroom hidden from the interface,
  code retained. Q&A is the primary focus. See
  `2026-10-07-mode-focus-refinement-design.md`.
- **Panelists: default 1, selectable up to 3.**
- **Persona presentation:** first names only, no meter bars, simple cards
  (`2026-09-24-persona-simplification-design.md`).

## Projects, in order

### 1. Gemini Live voice engine (IN FLIGHT — 2 of 8 tasks done)
Spec: `2026-09-24-gemini-live-voice-engine-design.md` (approved).
Plan: `docs/superpowers/plans/2026-09-24-gemini-live-voice-engine.md`.
Tasks 1 (mode contracts) and 2 (ephemeral token route) complete and
review-clean; resume at Task 3 (spoken instruction builder). Note: with only
Q&A + Drill visible, the Live session uses the `open_spar` and `drill`
contracts; Defense/Boardroom contracts stay in the module for later.
**Check gate:** user tests a live room — voice quality, immediacy, interruption.

### 2. Mode focus + persona simplification + panelist default
Specs: `2026-10-07-mode-focus-refinement-design.md` +
`2026-09-24-persona-simplification-design.md` (both approved).
Q&A + Drill visible; Defense/Boardroom hidden (UI only); first names; meter
bars deleted; cards = name + one line; panelist default 1, max 3.
**Check gate:** user reviews configure + picker + room screens.

### 3. Sparring room redesign
Room rebuilt around the two-mode, Live-engine, one-panelist-default
experience: continuous conversation, clean persona cards, Q&A-first.
Depends on 1 and 2 landing so it is designed once.

### 4. Practice screen + Home redesign
Practice/configure flow redesigned for two modes + panelist default; home
screen (including hero) redesigned to be dense and real — sells what exists.

### 5. Coach courses (partner-authored) with room linking
Short practical courses (Duolingo/Brilliant-style structure); partner
authors them; each practical lesson launches a linked sparring-room session
in the right mode with the right focus — the linking is the core of this
project. Research: course structure, lesson→room linking contract, authoring
flow.

### 6. Insights
Debrief/analytics done properly: progress over time, weakness patterns,
course progress. After courses exist so insights cover the whole picture.

## Explicitly deferred decisions

- Tool calling in Live mode (`mark_mood`, `challenge_claim`,
  `request_handoff`, `flag_interrupt`) — v2, after the engine proves itself.
- Real 20-turn latency benchmark — awaits explicit user opt-in.
- Persona final names — user confirms at implementation review.
- Per-persona voice swapping in multi-panelist rooms (single Live socket =
  single voice; single-panelist default reduces the surface of this).
- Re-introduction of Defense and Boardroom modes to the UI.
