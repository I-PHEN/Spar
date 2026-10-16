# Project 3 — Sparring Room Redesign — Design

Date: 2026-10-16
Status: Approved (user, 2026-10-16) — bold presence rail, quiet room (no live
metrics), proceeding to plan. Roadmap process: research → user reviews spec ✓
→ plan → build.
Inputs: room audit (all states/controls/dead weight, 2026-10-15), external
voice-UI research (Lazarev VUI guide; Yoodli positioning; ElevenLabs
conversation-container pattern), frontend-design direction guidance.

## Goal

Rebuild the sparring room around what it now actually is: a **continuous,
voice-first conversation with one to three named panelists**, Live-engine
first, Q&A primary. The room should feel like a stage you share with a person
— not a dashboard you operate. Today's room is still architected as a
click-per-turn chat with Live bolted on; the redesign inverts that.

## Design concept — "the room is a stage, not a dashboard"

- The conversation is the hero. Everything else is quiet chrome.
- One signature element: **the panelist presence**. The active panelist is the
  room's focal visual — a portrait-scale avatar block that carries state
  (listening = calm, thinking = gathering, speaking = alive in their accent,
  interrupted = a flicker). No meters, no graphs, no telemetry in the room.
- Color stays the existing dark neutral foundation; the per-persona muted
  oklch accents are the room's only color system (active speaker's accent
  tints their caption edge and presence ring). No new accent, no acid-green
  template look.
- Motion: one orchestrated state language on the presence + captions; respect
  `prefers-reduced-motion`. No scattered decorative animation.

## Layout

```
┌──────────────────────────────────────────────────────────┐
│ ✕   Q&A · {scenario}                    [engine]   ⏱ End │  top bar (quiet)
├──────────────────────────────────────────────┬───────────┤
│                                              │  PRESENCE │
│              conversation column             │  ┌─────┐  │
│   (captions: interim ghost → final rows,     │  │ Ada │  │
│    persona-accent edges, fade-up on land,    │  └─────┘  │
│    auto-scroll + sticky-to-bottom guard)     │  name     │
│                                              │  one line │
│                                              │  status   │
│                                              │  (2nd/3rd │
│                                              │  smaller) │
├──────────────────────────────────────────────┴───────────┤
│            [ mic / state ]        "I need a moment"  End │  control bar
└──────────────────────────────────────────────────────────┘
```

- **Single conversation column** (keep ~max-w-2xl center) — transcript reads
  as captions, not a log: interim user speech is a ghost bubble that resolves
  into the final row; persona rows carry a subtle accent edge.
- **Presence rail** replaces the card sidebar: the active/lead panelist gets a
  portrait block; additional panelists render as compact stacked entries
  beneath. Mobile: the rail collapses to a horizontal strip above the feed
  (presence-first, not cards-first).
- **Control bar** is engine-agnostic: one center mic control. Live-active →
  mic becomes a small persistent state ("live — just talk"); classic → the
  mic circle click flow, visually identical position. No per-turn clutter.
- **Drill framing**: the drill target stays visible as a quiet persistent line
  in the top bar ("Drill · Hedging"); the attempt counter surfaces only
  during a retry. Nothing else changes structurally between Q&A and Drill.

## State language (voice has no spinner)

Every moment shows one of three room states, carried by the presence + a
single status line: **listening / gathering / speaking**. Transitions are the
animation budget. Silence never reads as dead: while the panel "gathers,"
the presence shows the gathering state (existing thinking dots language,
moved onto the presence).

- **Barge-in**: classic keeps the rumble cue + "Interrupting" row label; live
  adds a one-beat "you cut in" flicker on the presence (today live barge-in
  has zero visual acknowledgment — the caption just vanishes).
- **Fallback (live → classic mid-room)**: the engine chip flips as today; the
  control bar morphs from "just talk" state to the mic circle with no layout
  jump.
- **"I need a moment"**: stays; fixed to work in live mode (gating currently
  depends on classic per-turn flags that live never drives).

## What gets deleted (audited dead weight)

`TelemetryBar` + its import, the orphaned `Transcript` component file +
`spar-interrupt-in`/`spar-caret` CSS, `showClaimsPanel` state,
`liveWords/liveHedges/liveHasEvidence` computation, dead imports
(`ChevronLeft`, value `EXPERIENCES`), the `SparResponse` interface. The
unreachable `about-to-interrupt` persona state gets **wired** (avatar pulse
before a classic agitation interrupt) rather than deleted.

## Legacy sessions (Defense/Boardroom) + old contract pins

- Old sessions must keep opening and debriefing: the presenting flow, coach
  read card, boardroom banner, and restore branch render **within the new
  layout structure** (they are caption types + deck states, not a second
  design). No separate legacy skin.
- Behavior pins preserved: engine chip trio (`Live`/`Classic`/`Connecting` +
  `data-engine`), deck strings ("Mic live", "Start/Stop speaking",
  "Click to present", "Done Presenting", "Try again", "Panel is
  responding"), interim "Speaking…" caption, "Exit session" /
  "End & get coached" pair, `/live-exchange` POST shape. Component-level
  unit tests move with the refactor; e2e contracts stay.

## Accessibility (fixing audited gaps)

`aria-live="polite"` on the caption feed, `role="alert"` on error toasts,
state text visible on mobile (not `hidden sm:inline`), auto-scroll guarded by
user-scroll detection (sticky-to-bottom), keyboard focus visible throughout.

## What doesn't change

The voice engines and their contracts (Gemini Live + cascade ladder,
`use-turn-controller` / `use-live-voice` behavior), session schema and APIs,
the debrief (hero artifact, unchanged), persona identities (Project 2),
practice/home screens (Project 4), mode keys, old-session behavior.

## Testing

- Existing room unit tests + e2e specs are the behavior contract; they keep
  passing (moved/extended, not deleted).
- New unit pins: state-language mapping (room state × engine → presence
  status), sticky-to-bottom guard logic, live "I need a moment" gating,
  drill attempt counter visibility.
- E2e: existing voice-loop suite + one new assertion path for the presence
  state language (classic flow is already covered).

## Non-goals

No Yoodli-style live metrics overlay (filler-word counters, pacing graphs in
room — rejected deliberately; pressure realism + debrief-after is the
product's stance). No practice/home redesign (Project 4). No new routes, no
schema change, no engine work, no Defense/Boardroom re-introduction.
