# Mode Focus Refinement — Design

Date: 2026-10-07
Status: Approved direction (user) — user-experiment focus

## Goal

Sharpen the app to **two visible modes — Q&A and Drill** — for experimenting
with real users. Everything else in the interface gets out of the way. No
code is deleted; hidden modes remain in the codebase.

## Decisions (locked with user)

1. **Two modes in the interface: Q&A and Drill.**
   - **Q&A** is today's `open_spar` mode (answer/challenge loop, no
     presenting) with a new display name and copy. The code key
     `open_spar`, its contracts, session data, and API surface are
     unchanged — this is a UI naming/positioning change only.
   - **Drill** stays Drill.
   - **Defense and Boardroom are hidden from the interface** (mode picker,
     home, routing guards). Their code, prompts, contracts, and tests stay
     in the codebase untouched for later re-introduction.
2. **Q&A is the primary mode** — it gets the heaviest focus and polish in
   the room redesign; Drill is second.
3. **Panelists: default one, selectable up to three** on the practice
   screen (extends the approved persona-simplification spec, which already
   defines 1-3 selection; this fixes the default to 1).
4. **Persona presentation stays per the simplification spec** — first
   names only (Ada, Victor, Chiara, Marcus, Priya), meter bars deleted,
   cards = name + one line.

## Scope sketch (implementation planned separately)

- Mode picker / practice screen: Q&A (default) + Drill only; Defense and
  Boardroom unreachable via UI navigation (direct URLs for retired modes
  redirect to the picker).
- Display copy: "Q&A" naming and one-line description ("They ask. You
  answer. They push back." — final copy at implementation).
- Panelist selector: default 1, max 3.
- No changes to mode keys, contracts module, prompts, session schema, or
  metrics for hidden modes.
