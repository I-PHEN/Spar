# Spar

**The sparring room for your next big moment.**

Spar is a voice-first practice environment where you defend ideas under live AI pressure. An AI panel of personas challenges, interrupts, and coaches you in real time. After every session, you get a coaching debrief — not scores, but development.

## What it does

- **4 sparring experiences:**
  - **Defense** — Present your material uninterrupted, then face Q&A
  - **Boardroom** — Present while the panel interrupts you mid-speech
  - **Open Spar** — Instant back-and-forth, no presentation phase
  - **Drill** — Targeted weakness training with immediate corrections

- **Live AI panel** — 2-3 personas (Skeptic, Nitpicker, So-What, Timekeeper, Ally) with distinct lenses. They build agitation in real-time and interrupt when you show weakness.

- **Voice-first** — Speak naturally. Live transcription via Web Speech API. Persona responses via streaming LLM + TTS with sentence-level pipelining for low latency.

- **Coaching debrief** — After each session: The Moment, What You Did Well, The Pattern, One Thing to Practice, Telemetry insights. No scores — just development.

- **Voice recording playback** — Listen back to your own answers in the debrief. Per-message clips stored client-side in IndexedDB.

- **Cross-session pattern memory** — The panel remembers your patterns across sessions and adapts its behavior.

- **Drill stats** — For drill sessions: challenge count, attempt breakdown (1st try clean / 2nd / 3+), recovery time, score.

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **Database:** Prisma ORM (SQLite)
- **LLM:** OpenRouter (gpt-oss-20b) for persona responses + z-ai SDK for debriefs
- **TTS:** Deepgram (aura-2 voices)
- **Voice:** Web Speech API (transcription) + MediaRecorder (audio capture)
- **Storage:** IndexedDB (audio clips), Prisma/SQLite (sessions, messages, patterns)

## Getting Started

### Prerequisites

- Node.js 18+
- Bun (package manager)
- An OpenRouter API key
- A Deepgram API key

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
OPENROUTER_API_KEY="your-openrouter-key"
DEEPGRAM_API_KEY="your-deepgram-key"
```

### Database Setup

```bash
bun run db:push
```

### Run the Dev Server

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in Chrome or Edge (Web Speech API requires Chromium-based browsers).

## How It Works

### The Agitation Engine

Each persona has heuristic triggers (hedge words, vague quantifiers, over-explaining). As you speak, their agitation score builds in real-time. When it hits the threshold, they interrupt. You can see the agitation building on the persona cards before they cut in.

### Deterministic Corrections (Drill Mode)

In Drill mode, correction phrases are fixed — no LLM call needed. This makes corrections instant (~1.7s TTS-only) and never paraphrased. The LLM only generates questions, never corrections.

### Sentence-Level TTS Pipelining

Persona responses stream from the LLM token-by-token. As each sentence completes, it's sent to Deepgram for TTS immediately — so you hear the first sentence while the rest is still generating. Target perceived latency: 2-3s from "stop speaking" to "first audio."

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
│   ├── use-voice.ts          # Web Speech API wrapper
│   ├── use-audio-recorder.ts # MediaRecorder for debrief playback
│   ├── use-agitation.ts      # Agitation engine hook
│   └── use-sound.ts         # Activation click + waveform
├── lib/
│   ├── drills.ts            # Drill definitions + deterministic corrections
│   ├── coach.ts             # Pre-Q&A presentation analysis
│   ├── llm.ts               # Debrief generation + pattern memory
│   ├── openrouter.ts        # Streaming LLM wrapper
│   ├── voice.ts             # Deepgram TTS
│   ├── triggers.ts          # Heuristic agitation triggers
│   ├── audio-db.ts          # IndexedDB audio clip storage
│   └── ...
└── prisma/
    └── schema.prisma         # User, Session, SessionMessage, PatternMemory, SkillSnapshot
```

## Browser Support

- **Chrome / Edge** — Full support (Web Speech API + MediaRecorder)
- **Safari 14.1+** — Partial (MediaRecorder works, Web Speech API may not)
- **Firefox** — Not supported (no Web Speech API)

## License

MIT
