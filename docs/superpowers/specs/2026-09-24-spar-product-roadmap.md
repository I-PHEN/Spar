# Spar Product Roadmap

Date: 2026-09-24
Status: Order approved by user

## How we work (process contract)

One project at a time. Each project: **research → user reviews spec → plan →
build → user checks it meets requirements → next project.** Nothing is built
all at once; no surface-level work — every part gets its research phase.
After every completed project or goal, `worklog.md` (repo root) gets a new
entry summarizing what was built and what changed — it is the user's living
map of the app.

## Projects, in order

### 1. Gemini Live voice engine
Spec: `2026-09-24-gemini-live-voice-engine-design.md` (approved).
Speech-to-speech voice via Gemini 3.8 Live (base for Defense/Drill/Open Spar,
Extended Thinking for Boardroom), current Deepgram+Groq+Aura-2 pipeline as
automatic fallback, continuous mic after one room-entry activation, distinct
fixed voice per persona, per-mode interaction contracts from real-life
research (defense committees, boardrooms, sparring partners, coaching reps).
**Check gate:** user tests a room — voice quality, immediacy, interruption.

### 2. Persona simplification + panel count
Spec: `2026-09-24-persona-simplification-design.md` (approved; amended with
panelist selection). First names only (Ada, Victor, Chiara, Marcus, Priya),
meter bars deleted, cards = name + one line, user selects 1–3 panelists.
**Check gate:** user reviews configure + room screens.

### 3. Sparring room + practice screen redesign
Room rebuilt around continuous conversation (no per-turn clicking); practice/
configure flow redesigned properly. Depends on 1 and 2 landing first so it is
designed once, not twice.

### 4. Material uploads — slides/PDF + resume
Students upload slides/PDF and present them; upload a resume and get
interviewed on it. Research phase: how real defenses and interviews use
material — parsing, presentation flow, question grounding.

### 5. Coach courses (partner-authored)
Short, practical courses structured like Duolingo/Brilliant; partner authors
them; each practical lesson launches a linked sparring-room session to
practice live with the AI. Research: course structure, lesson→room linking
contract, authoring flow.

### 6. Insights
Debrief/analytics done properly: progress over time, weakness patterns,
course progress. Built after courses and uploads exist so insights cover the
whole picture.

### 7. Home + hero redesign
Dense, real hero that sells what exists (live voice, courses, uploads) —
deliberately last so the front door sells the actual product.

## Explicitly deferred decisions

- Tool calling in Live mode (`mark_mood`, `challenge_claim`,
  `request_handoff`, `flag_interrupt`) — v2, after the engine proves itself.
- Real 20-turn latency benchmark on the cascade — awaits explicit user opt-in.
- Persona final names — user confirms at spec review.
