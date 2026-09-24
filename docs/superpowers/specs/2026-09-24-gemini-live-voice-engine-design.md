# Gemini 3.8 Live Voice Engine — Design

Date: 2026-09-24
Status: Approved direction (user) — pending spec review

## Goal

Room voice becomes speech-to-speech: the user talks naturally, a panelist answers
with sub-second feel, and the user can interrupt by voice at any time. The
existing Deepgram Flux → Groq → Aura-2 pipeline remains as the automatic
fallback. Mic interaction becomes one activation on room entry, then a
continuous conversation — no per-turn clicking.

## Decisions (locked with user)

1. **Gemini 3.8 Live is the primary voice engine** for all four experiences;
   the current cascade (Deepgram STT + Groq + Aura-2) is the automatic
   fallback when the Live socket fails or `GEMINI_API_KEY` is absent;
   browser web speech stays the last resort.
2. **Model routing per experience:**
   - Defense, Drill, Open Spar → `gemini-3.8-live` (base; snappy).
   - Boardroom → `gemini-3.8-live-extended-thinking` (tracks and challenges
     the substance of what is being presented).
   - Same WebSocket endpoint and price table; routing is a setup-time model id.
3. **Continuous mic**: activate once at room entry; the Live API's server-side
   VAD owns turn detection and barge-in from there.
4. **Distinct, consistent voices**: each persona maps to a fixed Gemini preset
   voice in the session config (replaces the Aura-2 voice map in Live mode).
5. **Tool calling is v2, not v1.** Candidate tools when we get there:
   `mark_mood`, `challenge_claim(claimId)`, `request_handoff(persona)`,
   `flag_interrupt`. Each adds latency; only worth it if the UI needs the
   signals back.

## Phase 0 — Mode research (required before implementation)

Model each experience on how it occurs in real life; each mode gets a **mode
interaction contract** that the Live config, persona prompt style, and UI
cadence all implement:

| Mode | Real-life model | Contract drives |
|---|---|---|
| Defense | Oral defense committees: chair mediation, question cadence, when examiners hold vs interrupt | turn-taking, interruption policy, pacing |
| Boardroom | Board/investor dynamics: follow-up chains, pressure escalation, tolerance for thinking pauses | longer end-of-speech patience; interruption budget |
| Open Spar | Sparring partner / adversarial collaborator: alternating rhythm, building on the last answer | continuous-flow turn logic |
| Drill | Coaching reps: stimulus → response → correction, progression difficulty | most aggressive response-time target, cadence |

Each contract is a small data object: `{ endOfSpeechPatienceMs,
interruptionPolicy, responseStyleHint, pacingHint }`. Research findings are
written into `docs/` before engine work begins; the contracts are the
reviewable artifact.

## Architecture

- **`/api/gemini-live-token`** (new server route): mints a short-lived
  ephemeral token from server-side `GEMINI_API_KEY`; returns `{ token,
  expiresIn }`. The mode→model mapping lives in shared config used by the
  browser when it builds the setup message. The durable key never reaches
  the browser, logs, or metrics — same rule as the Deepgram key today.
- **`src/lib/providers/gemini-live.ts`** (new browser adapter): WebSocket to
  the Live API `BidiGenerateContent` endpoint using the ephemeral token.
  Sends mic PCM; receives 24kHz linear16 PCM (the existing `PcmPlayer`
  plays it unchanged) plus output transcripts.
- **Session setup**: system instruction assembled from the persona blocks in
  `src/lib/personas.ts` (natural spoken style — the strict JSON response
  format does not apply in Live mode), selected Gemini voice, mode-routed
  model id, and the mode interaction contract.
- **Turn lifecycle**: each AI utterance is registered as a turn with a
  `turnId` through the existing turn state machine; server VAD events map to
  start/barge-in so ordering, captions, and metrics keep working. The user's
  transcript streams to the existing interim-caption path; the model's
  output transcript becomes the caption text for its turn.
- **Reconnect**: on the 15-minute session cap or socket drop, reconnect and
  re-seed context (persona prefix + claims + rolling summary from the
  existing context builder). Falls back down the ladder on repeated failure.
- **Fallback ladder**: `gemini-live` → existing cascade → browser speech.
  Every turn records `voiceEngine` and fallback reason.

## Trade-offs (accepted)

- Captions in Live mode come from the model's own transcript, not
  byte-exact pre-generated text; response length is governed by persona
  style instructions instead of the 80-token cap.
- Structured extras (mood / claimRef / interruption flags) are dropped in
  v1 Live mode; room UI uses neutral presentation.
- No Groq prompt caching in Live mode; cost is per audio minute
  (~$0.005/min in + ~$0.018/min out, comparable to the current split stack).
- Google becomes the primary dependency, mitigated by the fallback ladder.

## Metrics

- New headline milestone: **user end-of-speech → first audio byte**
  (the "immediately" number), plus interruption count and per-turn
  `voiceEngine`. Posted to `/api/turn-metrics`; schema additions ship as a
  Prisma migration. Existing milestones unchanged for cascade turns.

## Testing

- Adapter protocol unit tests with WebSocket doubles (setup, audio in/out,
  VAD events, reconnect, error surfaces).
- Turn-mapping tests through the existing state machine (barge-in cancels,
  stale events ignored, one active turn).
- Fallback-ladder tests (Live failure mid-room lands on cascade cleanly).
- E2E voice-loop extended with Live doubles; explorer request-block asserts
  no provider call leaks.
- Contract test: durable `GEMINI_API_KEY` never appears in any client bundle,
  route response, log line, or metric.

## Environment

- `GEMINI_API_KEY` (user will create at aistudio.google.com). `.env.example`
  and README updated; when absent, rooms transparently use the cascade.
