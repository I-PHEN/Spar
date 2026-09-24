# Persona Simplification — Design

Date: 2026-09-24
Status: Approved direction (user) — pending spec review

## Goal

The persona cards become simple and calm: a name, one line saying what the
panelist does, nothing else. The segmented meter bars under the cards are
removed. The archetype names ("The Nitpicker", "The Ally") are replaced with
first names only.

## Decisions (locked with user)

1. **First names only** for the five panelists. Proposed mapping (archetype
   keys are unchanged; only display names change, so existing session data
   stays valid):

   | Archetype key | Old name | New name | One-liner (draft) |
   |---|---|---|---|
   | `skeptic` | The Skeptic | **Ada** | Questions your core assumptions |
   | `nitpicker` | The Nitpicker | **Victor** | Digs into your methods and details |
   | `so_what` | The So-What | **Chiara** | Challenges your impact and relevance |
   | `timekeeper` | The Timekeeper | **Marcus** | Pushes you to be concise |
   | `ally` | The Ally | **Priya** | Supports, then finds the weak spot |

   Final name choices are the user's call at spec review.

2. **Meter bars are deleted** everywhere they appear under persona cards.
   Where a live status is genuinely needed during a session (e.g. who is
   listening), it is a small quiet text label — no segmented meters, no
   badge clutter on the cards.

3. **Cards show name + one line.** No credentials, no "philosophy", no
   dossier screens, no additional fields. The configure screen keeps its
   behavior-style control as a plain setting.

4. **Prompt-side character stays.** The internal persona data that shapes
   model behavior (lens, triggers, question templates, forbidden rules)
   remains; system prompts say "You are Ada, a Spar panelist" with the same
   behavioral blocks. Only presentation and names change.

## Scope

- `src/lib/personas.ts`: `defaultName` → first names; prompt builder uses
  them; initials update to match.
- Persona card component(s): remove meters/badges, simplify to name + line.
- Any component rendering the segmented status meters: remove or reduce to
  quiet text where a live indicator is required.
- Tests referencing old names updated.

## Panelist selection (added 2026-09-24)

The user picks **1–3 panelists** (maximum three) from the five personas on
the configure screen; any mix is allowed. The room and prompts reflect the
selection: multi-panelist rooms keep the existing "other panelists" prompt
block and handoff behavior; single-panelist rooms omit it. Selection is
stored with the session.

## Non-goals

- No new profile screens, no per-persona stats, no voice preview UI, no new
  data model beyond display strings.
