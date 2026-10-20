# Spar

**The sparring room for your next big moment.**

Spar is a voice-first practice environment where you defend ideas under live AI pressure. An AI panel of personas challenges, interrupts, and coaches you in real time. After every session, you get a coaching debrief — not scores, but development.

## What it does

- **2 visible sparring experiences:**
  - **Q&A** — They ask. You answer. They push back.
  - **Drill** — Hammer one weakness until it's fixed

Defense and Boardroom are currently hidden from the UI (code retained for later re-introduction).

- **Live AI panel** — 1-3 panelists (Ada, Victor, Chiara, Marcus, Priya) with distinct lenses. They build agitation in real-time and interrupt when you show weakness.
- **The room** — a voice-first stage, not a dashboard: equal circular presences (one per panelist, tinted with their accent) carry the whole state language (breathing = listening, dots = gathering, expand/contract pulse = speaking, flicker = you barged in); captions carry each speaker's accent edge; scrolling up to read pauses auto-scroll; the room paints the moment the session loads. No meters, no live stats — feedback lands in the debrief.

- **Voice-first** — Speak naturally. With a Gemini API key configured, Q&A runs on the Gemini Live speech-to-speech engine: one mic activation, continuous listening, and instant interruption in both directions. Without it (and whenever Live cannot connect), the Deepgram → Groq → Aura-2 cascade serves the room: Flux streaming STT transcription, Groq persona responses spoken through Aura-2 streaming TTS as phrases complete.

- **Coaching debrief** — After each session: The Moment, What You Did Well, The Pattern, One Thing to Practice, Telemetry insights. No scores — just development.

- **Voice recording playback** — Listen back to your own answers in the debrief. Per-message clips stored client-side in IndexedDB.

- **Cross-session pattern memory** — The panel remembers your patterns across sessions and adapts its behavior.

- **Drill stats** — For drill sessions: challenge count, attempt breakdown (1st try clean / 2nd / 3+), recovery time, score.

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **Database:** Prisma ORM (SQLite)
- **Live engine:** Gemini 3.8 Live speech-to-speech (browser WebSocket to Google, short-lived ephemeral tokens) — primary for Q&A when `GEMINI_API_KEY` is set
- **LLM:** Groq (gpt-oss-20b, primary) + OpenRouter (pre-speech fallback) for persona responses; z-ai SDK for debriefs
- **STT:** Deepgram Flux streaming (browser WebSocket, short-lived tokens); Web Speech for presentations and fallback
- **TTS:** Deepgram Aura-2 streaming (browser WebSocket); browser speech synthesis as fallback
- **Voice:** MediaRecorder + AudioWorklet (audio capture)
- **Storage:** IndexedDB (audio clips), Prisma/SQLite (sessions, messages, patterns, turn metrics)

## Getting Started

### Prerequisites

- Node.js 18+
- Bun (package manager)
- A Groq API key
- An OpenRouter API key
- A Deepgram API key
- A Google Gemini API key (optional — without it, rooms run on the fallback cascade)

### Installation

```bash
git clone https://github.com/I-PHEN/Spar.git
cd Spar
bun install
```

### Environment Setup

Create a `.env` file in the root:

```env
DATABASE_URL="file:./dev.db"
GROQ_API_KEY="your-groq-key"
OPENROUTER_API_KEY="your-openrouter-key"
DEEPGRAM_API_KEY="your-deepgram-key"
# Optional: Deepgram region for STT/TTS sockets. Default is us.
DEEPGRAM_REGION="us"
# Optional: Gemini Live voice engine. Absent means rooms use the fallback cascade.
GEMINI_API_KEY="your-gemini-key"
```

All provider keys stay server-side. The browser only ever receives short-lived provider tokens — Deepgram tokens minted by `POST /api/deepgram-token` and a Gemini ephemeral token minted by `GET /api/gemini-live-token`; no durable key reaches client code, logs, or metrics. `DEEPGRAM_REGION` is the single region control: the token route returns it alongside each grant, so the browser's Flux STT and Aura-2 TTS sockets always connect to the same region the server uses and records in its turn metrics (there is no `NEXT_PUBLIC_` region override).

**Deepgram token troubleshooting.** If the console shows `Configured Deepgram API key needs permission to grant temporary tokens`, your key's scopes do not allow minting temporary tokens. In the Deepgram console, edit the API key and enable the permission to grant short-lived credentials, then reload the room.

**Gemini Live voice engine.** `GEMINI_API_KEY` is optional. With it set, sparring-room Q&A runs on the Gemini 3.8 Live speech-to-speech engine; without it, rooms transparently use the Deepgram → Groq → Aura-2 cascade — there is no user-facing error either way. The key stays server-side: `GET /api/gemini-live-token` mints a short-lived ephemeral token (Google AI Studio keys work; create one at [aistudio.google.com](https://aistudio.google.com)) and the browser opens its Live WebSocket directly to Google with it. Live audio is billed by Google at **$0.005/min audio input + $0.018/min audio output**.

## Fallback Policy

The voice pipeline degrades in bounded, labeled steps; a failure never produces a second spoken answer for one turn:

- **Voice engine** — Gemini Live is primary when `GEMINI_API_KEY` is set. If the token route answers 503 (no key), the session setup is rejected (after one retry on the Kore voice), the socket dies after its reconnect budget, or the microphone fails, the room hands itself to the Deepgram → Groq → Aura-2 cascade mid-session. The engine chip in the room's top bar reads `Live` or `Classic`, so you always know which engine is speaking.

- **STT** — Flux streaming STT is primary. On failure the room switches to Web Speech recognition, keeps accepting turns, and reconnects to Flux with backoff. A browser with neither path is blocked from entering the room.
- **Generation** — Groq is primary. If Groq fails **before** a phrase has been spoken, the same turn restarts on OpenRouter and the phrase stream resets. After speech has started, the turn ends with an error instead of switching providers mid-answer.
- **Speech** — Aura-2 streaming TTS is primary. If it fails **before** the first audio frame, the queued phrases are spoken with the browser's speech synthesis. After playback has started, a failure ends the turn and the durable text answer remains.
- **Legacy buffered path** — The pre-streaming route (full reply, REST TTS, base64 audio) remains only for requests that carry none of the live turn protocol's fields (for example, the opening line). A body carrying any live-protocol field (`turnId`, `isInterrupt`, drill flags, ...) must be a complete live turn request or it is rejected with 400.

### Database Setup

```bash
bun run db:push
```

### Run the Dev Server

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in Chrome or Edge (Web Speech API requires Chromium-based browsers).

## Development

The Architecture Explorer is available during development at [http://localhost:3000/architecture](http://localhost:3000/architecture). It is the maintained map of Spar's implementation and its session flows.

Changes to `ExperienceKey`, session routes, voice providers, persistence models, turn state, or debrief flow must update `src/architecture/manifest.ts`. See [`docs/architecture-maintenance.md`](docs/architecture-maintenance.md) for the content rules.

## How It Works

### The Agitation Engine

Each persona has heuristic triggers (hedge words, vague quantifiers, over-explaining). As you speak, their agitation score builds in real-time. When it hits the threshold, they interrupt. You can see the agitation building on the persona cards before they cut in.

### Deterministic Corrections (Drill Mode)

In Drill mode, correction phrases are fixed — no LLM call needed. This makes corrections instant (~1.7s TTS-only) and never paraphrased. The LLM only generates questions, never corrections.

### The Live Voice Engine

When `GEMINI_API_KEY` is configured, sparring-room Q&A runs on Gemini 3.8 Live — one speech-to-speech session voiced by the panel's lead panelist. A single click on the mic starts the session; from then on the mic stays live and the model owns turn-taking. It listens continuously (16 kHz PCM), applies a per-mode voice-activity contract (Boardroom's 1.2 s end-of-speech patience lets it cut in fast; Defense's 3 s holds questions; Open Spar and Drill run at 500 ms), and answers as streamed 24 kHz PCM audio. Interruption is native and instant in both directions: you can barge in mid-word, and the panelist can cut you off. Boardroom rooms use the extended-thinking Live model; the other experiences use the standard one.

The persona's identity, spoken-response rules, and the mode's interaction contract are compiled into a single spoken system instruction — no JSON. Captions still stream while you speak and while the panelist answers, and each turn is attributed to the room's turn machine and measured (`firstLiveAudioMs`, interruption counts) alongside the cascade metrics. Each finalized exchange is persisted to the session transcript fire-and-forget (`POST /api/sessions/[id]/live-exchange`), so the end-of-session debrief, drill stats, and pattern memory see live Q&A the same way they see cascade Q&A; an interrupted (barge-in) answer is dropped and its user utterance rides the next completed exchange's post. The presentation phase (Defense and Boardroom) still uses the classic recognizer; Live owns Q&A.

### Streaming Phrase Pipelining

Persona responses stream from Groq token-by-token. The server slices the stream into speakable phrases and emits each one to the browser as an SSE `phrase` event; the browser speaks each phrase through Aura-2 immediately, so first playback happens while generation is still running. The pre-streaming behavior (full reply, then sentence-level REST TTS) remains only as the legacy fallback path.

### Latency Definitions and Budget

Turn latency is measured from **end of user speech** (the STT `EndOfTurn`) to four milestones: **first token** (first generation text), **first phrase** (first speakable phrase), **first TTS byte** (first audio frame from Aura-2), and **first playback** (first frame actually played). **Barge-in teardown** is the time from a new `StartOfTurn` (or session end) to fully stopped audio; its budget is 200 ms and it is verified deterministically by the Chromium harness and the seeded stress run.

The latency budget for the local acceptance sample is **playback p50 <= 1,000 ms and p95 <= 1,500 ms** end-of-turn to first playback. Status: the streaming path is implemented and its budgets are enforced by automated tests, but the measured p50/p95 numbers have **not yet been collected** — run `benchmark:voice` below before claiming the budget is met. Local measurements are single-machine, small-sample observations, not production guarantees.

## Verification

```bash
bun test                # unit and contract tests (deterministic doubles; no provider calls)
bun run test:e2e        # Chromium suite; starts its own dev server on port 3100
bun run test:stress-turns   # seeded 100-turn controller stress on a virtual clock
bun run typecheck && bun run lint && bun run build
```

The browser suite double-replaces MediaDevices, WebSocket, AudioContext, and same-origin fetch, so no test touches Groq, OpenRouter, or Deepgram.

### Local provider benchmark (opt-in, uses real credits)

`benchmark:voice` measures the real pipeline against your configured services. It refuses to start without an explicit confirmation, never prints key values, and stores no raw audio — only turn metric offsets and counts.

```bash
# 1. Regional probe: the same five short prompts per Deepgram region (server-visible milestones)
DEEPGRAM_REGION=us bun run benchmark:voice --region=us --turns=5
DEEPGRAM_REGION=eu bun run benchmark:voice --region=eu --turns=5
#    -> keep the region with the lower end-to-end median in DEEPGRAM_REGION
#
# DEEPGRAM_REGION is server-side and is served to the browser with every
# short-lived token, so setting it alone moves the browser's STT/TTS sockets
# too — the measured region and the metric labels cannot diverge.

# 2. Acceptance sample: speak 20 turns across all four experiences in the browser
bun run benchmark:voice --turns=20
```

The acceptance sample gates on the playback budget above plus the deterministic 200 ms barge-in teardown, prints p50/p95 for every milestone, labels generation and speech fallbacks, and exits nonzero if the budget is missed. Treat results as local, single-browser measurements: environment and sample-size caveats are printed with every report.

### The Coaching Debrief

After each session, the coaching engine generates a 6-7 section narrative debrief grounded in telemetry (word count, hedge count, response latency, evidence citations). For Defense/Boardroom, it also evaluates your presentation delivery. If the LLM fails, a heuristic fallback builds a specific debrief from the telemetry signals.

## Project Structure

```
src/
├── app/
│   ├── api/sessions/        # Session, spar-stream, debrief, present, end routes
│   ├── page.tsx             # Main app (hero → auth → onboarding → home → practice → sparring → debrief)
│   └── layout.tsx
├── components/spar/
│   ├── sparring-room.tsx    # The voice room (mic, captions, panel, agitation)
│   ├── debrief-view.tsx     # Post-session coaching debrief + audio playback
│   ├── practice-view.tsx    # 3-step session config
│   ├── hero-view.tsx        # Landing page
│   ├── persona-card.tsx     # Panel member card with agitation meter
│   └── ...
├── hooks/
│   ├── use-turn-controller.ts   # Live turn lifecycle owner (reducer-driven)
│   ├── use-live-voice.ts        # Gemini Live speech-to-speech session
│   ├── use-streaming-voice.ts   # Flux STT + Aura-2 speech sessions
│   ├── use-voice.ts             # Web Speech API wrapper (presentations, fallback)
│   ├── use-audio-recorder.ts    # MediaRecorder for debrief playback
│   ├── use-agitation.ts         # Agitation engine hook
│   └── use-sound.ts             # Activation click + waveform
├── lib/
│   ├── drills.ts            # Drill definitions + deterministic corrections
│   ├── coach.ts             # Pre-Q&A presentation analysis
│   ├── llm.ts               # Debrief generation + pattern memory
│   ├── openrouter.ts        # Streaming LLM wrapper (fallback)
│   ├── voice.ts             # Legacy Deepgram REST TTS
│   ├── triggers.ts          # Heuristic agitation triggers
│   ├── audio-db.ts          # IndexedDB audio clip storage
│   ├── spar/                # Live turn service (server SSE), mode contracts, spoken Live instruction
│   ├── providers/           # Groq, OpenRouter, Deepgram STT/TTS, Gemini Live clients
│   ├── voice/               # Turn state, phrase chunker, PCM player, mic stream
│   └── observability/       # Turn metrics (p50/p95, tokens, cost, fallbacks, voice engines)
└── prisma/
    └── schema.prisma         # User, Session, SessionMessage, PatternMemory, SkillSnapshot
```

## Browser Support

- **Chrome / Edge** — Full support (WebSocket microphone streaming + AudioWorklet + Web Speech fallback)
- **Safari 14.1+** — Partial (MediaRecorder works; streaming STT needs WebSocket + getUserMedia + AudioContext, otherwise the Web Speech fallback is required)
- **Firefox** — Depends on Web Speech availability for the fallback path; browsers with neither are blocked from the Sparring Room

## License

MIT
