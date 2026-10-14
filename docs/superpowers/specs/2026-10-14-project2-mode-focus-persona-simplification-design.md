# Project 2 — Mode Focus + Persona Simplification + Panelist Default — Design

Date: 2026-10-14
Status: Approved direction (user) — consolidates and finalizes
`2026-10-07-mode-focus-refinement-design.md` + `2026-09-24-persona-simplification-design.md`
Supersedes the open items in both ("final names at spec review", "final copy at
implementation" — both locked below).

## Goal

Sharpen the app to two visible modes — **Q&A (primary) and Drill** — with calm,
simple persona cards and a panelist default of one, so real-user experiments
run on a focused surface. No code is deleted; hidden modes remain in the
codebase untouched.

## Locked decisions (user-confirmed 2026-10-14)

1. **First names locked:** skeptic → **Ada**, nitpicker → **Victor**,
   so_what → **Chiara**, timekeeper → **Marcus**, ally → **Priya**.
   Archetype keys unchanged; existing session data stays valid.
2. **Card one-liners locked (drafts kept):**
   Ada — Questions your core assumptions · Victor — Digs into your methods and
   details · Chiara — Challenges your impact and relevance · Marcus — Pushes
   you to be concise · Priya — Supports, then finds the weak spot.
3. **Q&A copy locked:** mode name **"Q&A"**, description
   **"They ask. You answer. They push back."** (`open_spar` key unchanged.)
4. **Hidden modes:** Defense and Boardroom are removed from the mode picker
   only. Existing sessions saved with those modes still open and debrief
   normally. Nothing is blocked, nothing is deleted.

## Design

### 1. Mode visibility

- A single exported allowlist — `VISIBLE_MODES = ["open_spar", "drill"]` — is
  the one source of truth. The mode picker and every UI surface that lists
  modes filters through it; no scattered conditionals.
- Display names: `open_spar` → **"Q&A"** with the locked description; Drill
  unchanged. Q&A is the default selection on the practice screen.
- Defense/Boardroom: unreachable via the picker; contracts, prompts, tests,
  and old sessions keep working (code retained for later re-introduction).

### 2. Persona presentation

- `src/lib/personas.ts`: `defaultName` → first names; initials update to
  match (A/V/C/M/P). Prompt-side character stays — system prompts say
  "You are Ada, a Spar panelist" with the same behavioral blocks; only
  presentation names change.
- Persona cards render **name + one line**. Meter bars are deleted everywhere
  they appear (`persona-card`, sparring room, any carousel). Where a live
  status is genuinely needed, it is a small quiet text label — the room
  already carries its quiet `Live`/`Classic` engine chip from Project 1, so
  no new status UI is required.
- No credentials, no dossier screens, no extra fields. The configure screen
  keeps its behavior-style control as a plain setting.

### 3. Panelist selection

- Configure screen: pick **1–3 panelists** from the five, any mix;
  **default 1 (Ada)**.
- Selection is stored with the session (verify the existing field at plan
  time; extend only if missing).
- Multi-panelist rooms keep the existing "other panelists" prompt block and
  handoff behavior; single-panelist rooms omit it (already conditional).

### 4. Surfaces touched

SPA views under `src/components/spar/` (driven from `src/app/page.tsx`):
`practice-view` (configure + mode picker + panelist selector), `home-view`,
`persona-card`, `sparring-room` headers/labels, plus display strings in
`src/lib/personas.ts`. No new routes, no schema change (unless the selection
field is missing), no API change, no mode-key change.

## What doesn't change

Mode keys, the mode-contracts module (Defense/Boardroom contracts stay),
session schema (except a possible selection field), metrics, the Live voice
engine and its fallback ladder, the API surface, and tests for hidden modes.

## Testing

- Unit tests referencing old names, meters, or picker contents are updated.
- New tests pin: allowlist filtering (Defense/Boardroom absent from picker),
  picker default = Q&A, panelist bounds (1–3, default 1, Ada), card renders
  name + one line with no meters, and old-mode sessions still open.
- E2e specs (`voice-loop`) updated if they reference "Open Spar" labels.

## Non-goals

No room redesign (Project 3), no practice/home redesign (Project 4), no new
profile screens, no per-persona stats, no voice preview UI, no new data model
beyond display strings, no re-introduction of Defense/Boardroom.
