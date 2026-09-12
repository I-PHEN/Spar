# Spar Low-Latency Voice and Architecture Explorer Design

**Status:** Approved design, pending written-spec review

**Date:** 2026-09-12

**Scope:** Single-user local prototype, with clean boundaries for later multi-user deployment

## 1. Summary

Spar will be optimized around one product promise: after a user finishes speaking, a useful, high-quality panel response should begin playing as quickly and consistently as possible.

The implementation will replace the current batch-like voice path with a streaming relay:

```text
Microphone
  -> Deepgram Flux streaming STT
  -> turn controller
  -> direct Groq GPT-OSS 20B stream
  -> phrase chunker
  -> persistent Deepgram TTS stream
  -> incremental browser audio queue
```

The work also adds a developer-only architecture explorer at `/architecture`. It will explain the important product systems, experience modes, voice path, persistence, debrief generation, latency, and token usage. It will make no AI calls at runtime.

## 2. Goals

### 2.1 User-experience goals

- Begin audible playback within 1.0 second at the median and 1.5 seconds at the 95th percentile after a confirmed end of turn on a stable connection.
- Let the user interrupt the panel naturally. New speech must stop current playback within 200 ms and cancel stale downstream work.
- Preserve coherent, persona-specific, grounded responses while beginning playback from the first safe phrase.
- Keep captions usable when speech generation is unavailable.
- Never play duplicated, stale, or out-of-order audio.

### 2.2 Efficiency goals

- Keep live turns at or below 2,000 input tokens and 80 output tokens under ordinary operation.
- Use application logic for deterministic decisions and fixed language.
- Keep Groq prompt prefixes stable to benefit from automatic prompt caching.
- Measure prompt, cached, reasoning, and completion tokens for every live LLM call.
- Keep the architecture explorer free of runtime model calls.

### 2.3 Learning goals

- Make the important architecture understandable without requiring the user to read the repository first.
- Prioritize experience modes, session state, the voice path, personas, data/memory, debriefs, failure behavior, token usage, and latency.
- Use at most one short analogy per subsystem and keep technical details collapsible.
- Show which source files own each important behavior.

## 3. Non-goals

- Multi-user scaling, distributed connection state, and production autoscaling are not part of this iteration.
- Visual implementation details such as light/dark mode, Tailwind utilities, and individual shadcn components are excluded from the primary learning paths.
- Speculative response generation before a confirmed end of turn is deferred. It can waste tokens and speak an incorrect interpretation.
- Replacing the existing debrief product or redesigning the main Spar interface is out of scope.
- Perfectly zero latency is not possible. The design optimizes measured perceived latency.

## 4. Current-state findings

The current implementation already streams LLM tokens and sends completed sentences through server-sent events, but several boundaries add avoidable delay and cost:

- `src/lib/openrouter.ts` calls OpenRouter rather than Groq directly.
- `src/app/api/sessions/[id]/spar-stream/route.ts` waits for sentence punctuation, or a long comma-delimited clause, before starting TTS.
- `src/lib/voice.ts` uses Deepgram REST, waits for the complete audio response, converts it to base64, and sends the complete payload to the browser.
- The browser cannot play audio until the complete encoded payload arrives.
- The full transcript is resent on every turn.
- The newest user message appears in the transcript and is repeated in the “what the user just said” block.
- Local prompt caching reduces database and prompt-construction work but does not reduce the prompt tokens sent to a provider.
- Drill corrections are already deterministic and avoid an LLM call. This pattern should be extended to other predictable decisions.
- Browser Web Speech recognition is inexpensive but gives limited control over end-of-turn timing and varies across browsers.

## 5. Architectural decisions

### 5.1 Provider choices

- **Live LLM:** direct Groq Chat Completions using `openai/gpt-oss-20b`, streaming enabled and reasoning effort kept low for short persona responses.
- **LLM fallback:** the existing OpenRouter path, using the same response contract.
- **Primary STT:** Deepgram Flux `flux-general-en` over `/v2/listen`.
- **STT behavior:** start with confirmed `EndOfTurn` events. Use `StartOfTurn` to interrupt agent playback. Do not enable `EagerEndOfTurn` in the first release.
- **STT fallback:** the existing browser Web Speech implementation.
- **Primary TTS:** Deepgram Aura-2 over one persistent WebSocket per conversation, preserving the existing persona voice mapping.
- **TTS experiment:** benchmark Deepgram Flux TTS behind the same adapter after the streaming Aura-2 baseline is stable. Adoption requires a measurable latency or quality improvement worth its higher character price.
- **TTS fallback:** browser speech synthesis when available; captions-only otherwise.

Deepgram's current documentation recommends Flux STT for conversational agents because it combines recognition with model-native start/end-of-turn events. Groq supports automatic prefix caching for GPT-OSS 20B.

References:

- [Deepgram Flux overview](https://developers.deepgram.com/docs/flux/quickstart)
- [Deepgram Flux versus Nova-3](https://developers.deepgram.com/docs/flux/flux-nova-3-comparison)
- [Deepgram streaming TTS](https://developers.deepgram.com/docs/tts-websocket)
- [Deepgram token-based authentication](https://developers.deepgram.com/guides/fundamentals/token-based-authentication)
- [Deepgram browser WebSocket authentication](https://developers.deepgram.com/docs/using-the-sec-websocket-protocol)
- [Groq prompt caching](https://console.groq.com/docs/prompt-caching)

### 5.2 Provider adapters

Provider-specific behavior will sit behind focused interfaces:

```ts
interface SpeechRecognizer {
  connect(sessionId: string): Promise<void>;
  sendAudio(chunk: ArrayBuffer): void;
  events(): AsyncIterable<SpeechEvent>;
  close(): Promise<void>;
}

interface PersonaGenerator {
  stream(request: PersonaRequest, signal: AbortSignal): AsyncIterable<TextDelta>;
}

interface SpeechSynthesizer {
  connect(voice: string): Promise<void>;
  sendText(text: string, turnId: string): Promise<void>;
  audio(turnId: string): AsyncIterable<AudioChunk>;
  cancel(turnId: string): Promise<void>;
  close(): Promise<void>;
}
```

The application will depend on these interfaces rather than Groq or Deepgram response shapes. Fallbacks and benchmarks can therefore change providers without changing experience-mode logic.

## 6. Realtime turn architecture

### 6.1 Turn controller

A single turn controller owns the lifecycle of each spoken exchange. Every turn receives a monotonically increasing `turnId` and a trace ID.

States:

```text
idle -> listening -> finalizing -> thinking -> speaking -> idle
                  \-> cancelled
                  \-> failed
```

The controller owns:

- STT events and the final transcript.
- The LLM abort controller.
- Phrase-chunker state.
- TTS input and audio streams.
- Browser playback queue state.
- Stage timestamps and token usage.

All downstream events carry the same `turnId`. The client discards any event that does not match the active turn. A new `StartOfTurn` event cancels model generation, TTS work, queued audio, and active playback for the previous turn.

### 6.2 Speech recognition

The browser captures mono audio in small chunks and sends it directly to Deepgram over a Flux WebSocket. Before connecting, it requests a short-lived JWT from a same-origin server route backed by Deepgram's `/v1/auth/grant` endpoint. The durable Deepgram key remains on the server, while the temporary browser credential expires quickly and the established WebSocket may outlive that credential.

Initial Flux behavior:

- `StartOfTurn`: stop panel playback and cancel stale work.
- `Update`: update live captions only.
- `TurnResumed`: retain listening state; no LLM work exists yet in the initial design.
- `EndOfTurn`: freeze the transcript and start the Groq request.
- `ForceEndTurn`: available for explicit push-to-talk completion.

Region selection will be configurable. From Reykjavik, the EU endpoint will be benchmarked against the global endpoint and selected by measured end-to-end latency rather than assumption.

### 6.3 Persona generation

The live model receives a compact request and streams the spoken content immediately. The response contract will avoid metadata that application code already knows:

- `type` is determined by whether the request is an interruption.
- `mood` defaults from persona and turn state.
- `claimRef` is selected by the context builder when a specific claim is targeted.
- The model generates only the spoken challenge text.

This removes strict-JSON fragility and reduces tokens before the first speakable text. If implementation evidence shows that model-selected metadata materially improves coaching, metadata may be emitted after the spoken content or generated outside the latency-critical path.

### 6.4 Phrase chunking

The phrase chunker turns token deltas into safe speakable units. It must not split inside numbers, abbreviations, quoted phrases, or incomplete markup.

Boundary priority:

1. Sentence-ending punctuation.
2. Semicolon, colon, em dash, or comma after a useful clause.
3. A whitespace boundary after a configurable maximum word count.

Initial tuning range:

- First phrase: approximately 4-10 words.
- Later phrases: approximately 8-16 words.
- Output ceiling: 1-2 sentences and 80 tokens.

The exact thresholds will be chosen using measured time-to-first-audio and listening quality. The chunker must never rewrite model text.

### 6.5 Streaming speech synthesis and playback

One Deepgram TTS WebSocket stays open for each persona voice used in the conversation. If connection limits or provider behavior make multiple sockets inefficient, the implementation may keep only the active voice warm and reconnect on persona changes; this choice must be benchmarked.

Audio will remain binary. It will not be converted to base64 or relayed through a Next.js request. The browser receives binary chunks directly from the authenticated Deepgram TTS WebSocket and feeds them into a small Web Audio playback buffer. The queue:

- Preserves chunk order.
- Begins playback as soon as the minimum safe buffer is available.
- Applies backpressure when playback falls behind.
- Drops all queued chunks when the active turn is cancelled.
- Emits playback-start and playback-stop timestamps.

## 7. Token and cost design

### 7.1 Prompt layout

Each live prompt is assembled in this order:

1. Stable base persona instructions and response rules.
2. Stable experience-mode instructions.
3. Compact session facts: relevant claims and current mode state.
4. Rolling summary of older conversation context, capped at 250 tokens.
5. The latest 4-6 messages.
6. The newest user utterance exactly once.

Stable content must remain byte-for-byte identical and precede dynamic content to maximize Groq prefix-cache eligibility.

### 7.2 Context trimming priority

If the estimated input exceeds 2,000 tokens, trim in this order:

1. Old recent messages already represented by the rolling summary.
2. Low-relevance pattern memories.
3. Low-relevance claims not involved in the current exchange.
4. Compress the rolling summary to a smaller fixed budget.

Never trim the current utterance, active mode rules, the targeted claim, or safety/response constraints.

### 7.3 Avoided calls

- Drill corrections and acknowledgements remain deterministic.
- Agitation scoring and trigger detection remain local.
- Persona order and interruption type remain local.
- A rolling summary is refreshed only after a threshold is crossed, not on every turn.
- The stronger coaching/debrief call runs once after the session, outside the live path.

### 7.4 Usage tracking

Every LLM response records:

- Prompt tokens.
- Cached prompt tokens.
- Reasoning tokens when reported.
- Completion tokens.
- Estimated provider cost.
- Cache-hit ratio.
- Model and fallback provider.

The latency lab displays per-turn values and p50/p95 aggregates. The UI warns when a live turn exceeds its token budget.

## 8. Experience-mode architecture

All four experiences share session persistence, personas, voice transport, turn control, telemetry, and debrief generation. Their differences are expressed as explicit state transitions and policies.

### 8.1 Defense

```text
configure -> present uninterrupted -> analyze presentation -> Q&A loop -> end -> debrief
```

- The user presents first.
- Agitation may be observed for coaching but cannot trigger an interruption during the presentation.
- The first question must reference the presentation or an extracted claim.

### 8.2 Boardroom

```text
configure -> present <-> interrupt/answer/resume -> finish presentation -> Q&A loop -> end -> debrief
```

- The user presents first.
- Agitation runs during presentation.
- A triggered persona may interrupt.
- After the user answers, the presentation resumes until explicitly completed.

### 8.3 Open Spar

```text
configure -> panel opens -> user answer <-> panel challenge -> end -> debrief
```

- There is no presentation phase.
- The panel speaks first.
- The mode moves directly through conversational challenge turns.

### 8.4 Drill

```text
choose target -> question -> answer -> detect
  -> weakness found -> deterministic correction -> retry same challenge
  -> clean answer -> deterministic acknowledgement -> generate next question
  -> end -> stats and debrief
```

- Detection, corrections, acknowledgements, retry state, and scoring remain deterministic.
- The LLM generates fresh questions only.
- A repeated attempt does not resend irrelevant conversation history.

## 9. Architecture explorer

### 9.1 Route and access

- Route: `/architecture`.
- Available only when `NODE_ENV === "development"`; production requests return `notFound()`.
- No API keys, provider SDKs, or external model calls are used by the explorer.

### 9.2 Navigation

The explorer has six primary views:

1. **System map:** clickable browser, API, domain, provider, storage, and debrief nodes.
2. **Guided tour:** short next/back walkthroughs for starting a session, completing a turn, interrupting, ending, and generating a debrief.
3. **Experiences:** the four explicit mode state machines, shared machinery, and differences.
4. **Voice pipeline:** STT, turn detection, LLM stream, phrase chunking, TTS, playback, cancellation, and fallback paths.
5. **Data and memory:** Prisma entities, pattern memory, summaries, skill snapshots, and browser IndexedDB audio.
6. **Latency lab:** real local stage timing, token usage, cache hits, estimated cost, fallbacks, and percentile summaries.

### 9.3 Component explanations

Selecting a component answers five questions:

1. What does it do?
2. What enters it?
3. What leaves it?
4. Which important files implement it?
5. What happens when it fails?

Details may include one concise analogy, but analogies must not replace the technical explanation.

### 9.4 Manifest and freshness

A typed architecture manifest is the single content source for nodes, edges, mode flows, tours, file references, and analogies. The explorer renders this data directly.

Automated validation will verify that:

- Every `ExperienceKey` is represented.
- Every critical session API route is represented.
- Referenced files exist.
- Node and edge identifiers resolve.
- Guided-tour steps reference valid nodes.
- The explorer imports no provider client and performs no runtime model request.

Repository guidance will require architecture-changing work to update the manifest. The validation detects structural omissions; human or coding-agent review remains responsible for semantic accuracy.

## 10. Telemetry and latency lab

Each turn produces a local trace containing:

- `turnId` and trace ID.
- Experience and persona.
- STT start, end-of-turn, and transcript confidence.
- LLM request start and first-token time.
- First safe phrase time.
- TTS send and first-audio-byte time.
- Browser first-playback time.
- Cancellation and fallback events.
- Token usage, cache-hit ratio, and estimated cost.

Server durations and browser durations will be recorded independently to avoid comparing unsynchronized clocks. The browser owns the authoritative end-of-turn-to-playback measurement. Server events report relative durations for provider stages.

Prototype metrics may be stored in SQLite in a dedicated turn-metric model. A development-only metrics endpoint supplies the latency lab. Raw API keys and full audio are never recorded.

## 11. Failure handling

| Failure | Behavior |
|---|---|
| Flux connection fails before a turn | Fall back to browser speech recognition and show a non-blocking status |
| Flux disconnects mid-turn | Attempt one bounded reconnect; preserve captions; require explicit retry if the transcript is incomplete |
| Groq times out before first token | Retry once when safe, then use OpenRouter |
| Groq fails after speech has begun | Finish already queued safe audio, stop cleanly, and show a retry action |
| TTS connection fails | Use browser speech synthesis when available; otherwise deliver captions |
| Audio arrives for a stale turn | Discard it by `turnId` |
| User begins speaking during playback | Stop playback, clear the queue, and cancel model/TTS work |
| Token budget would be exceeded | Apply deterministic trimming; reject the call only if required context still cannot fit |

Retries use bounded exponential backoff with jitter and never continue indefinitely. A live turn may perform at most one provider retry before falling back or surfacing an actionable error.

## 12. Security

- `GROQ_API_KEY`, `OPENROUTER_API_KEY`, and the durable `DEEPGRAM_API_KEY` remain server-side.
- The browser receives only a short-lived Deepgram JWT from a same-origin route; it never receives a durable provider key.
- Browser WebSockets authenticate with Deepgram's documented `Sec-WebSocket-Protocol` mechanism and TLS.
- Logs report only whether a key is configured, never its value.
- Provider error bodies are sanitized before being returned to the browser.
- `.env` remains ignored by Git.
- The development metrics endpoint and architecture explorer are unavailable in production.

## 13. Testing strategy

### 13.1 Unit tests

- Turn-state transitions and illegal-transition rejection.
- Cancellation propagation by `turnId`.
- Phrase boundaries, abbreviations, numbers, quotes, and incomplete punctuation.
- Context priority and the 2,000-token guardrail.
- No duplicated newest user utterance.
- Experience-mode state machines.
- Drill deterministic paths.
- Architecture-manifest integrity.

### 13.2 Integration tests

- Mocked STT start/update/resume/end events.
- Slow, malformed, disconnected, and retried LLM streams.
- Partial and disconnected TTS streams.
- Audio ordering and backpressure.
- Barge-in cancellation across all stages.
- Provider fallback selection.
- Usage and timing telemetry.

### 13.3 Browser tests

- Chromium microphone flow using deterministic audio fixtures.
- Captions update while listening.
- First audio plays before the full response completes.
- New speech stops active playback.
- No stale audio after navigation or session end.
- Explorer navigation and development-only access.

### 13.4 Manual benchmark

Run at least 20 representative turns across the four experiences on a stable connection. Record p50 and p95 end-of-turn-to-playback, failure count, cache-hit ratio, tokens per turn, and fallback use. Retain baseline and optimized runs in the latency lab for comparison.

## 14. Rollout plan

1. **Baseline and credentials:** validate key presence without displaying values; instrument the existing path and capture a repeatable baseline.
2. **Architecture explorer foundation:** implement the manifest, system map, guided tour, experience flows, and current-state latency view.
3. **Direct Groq and bounded context:** add the Groq adapter, compact prompt builder, token accounting, prompt-cache-friendly ordering, and OpenRouter fallback.
4. **Turn controller and Flux STT:** add temporary-token issuance, direct browser Flux streaming, `EndOfTurn`-driven generation, `StartOfTurn` barge-in, and browser-recognition fallback.
5. **Streaming TTS and playback:** replace complete base64 MP3 responses with persistent TTS connections, binary audio chunks, and incremental Web Audio playback.
6. **Hardening and tuning:** add disconnect tests, stress tests, provider fallbacks, regional benchmarks, phrase-threshold tuning, and acceptance runs.

Each stage must preserve a runnable application and update the architecture manifest before moving to the next stage.

## 15. Acceptance criteria

- The app passes its complete automated verification suite.
- On a stable connection over at least 20 representative real turns, median end-of-turn-to-first-playback is at most 1.0 second and p95 is at most 1.5 seconds.
- Barge-in stops active playback within 200 ms.
- A 100-turn scripted stress run produces no duplicated, stale, or out-of-order speech.
- Ordinary live turns stay within 2,000 input and 80 output tokens.
- Token usage, cache hits, provider choice, fallback use, and stage latency are visible in the local latency lab.
- Groq, OpenRouter, and Deepgram failures each produce a bounded fallback or an actionable non-blocking error.
- No provider key appears in client bundles, browser responses, application logs, or committed files.
- `/architecture` explains all four experiences, the realtime voice path, persistence, debriefs, failures, tokens, and latency.
- `/architecture` makes no runtime model calls and is inaccessible in production.
- The Git worktree contains no generated database, environment file, runtime logs, or brainstorming-session artifacts.
