# Spar Low-Latency Voice Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a secure, interruption-aware voice loop whose measured end-of-turn-to-first-playback latency is p50 <= 1.0 second and p95 <= 1.5 seconds while keeping every normal turn below 2,000 input tokens and 80 output tokens.

**Architecture:** The browser holds persistent Deepgram Flux STT and Aura-2 TTS WebSockets authenticated with short-lived server-minted tokens. A server route streams a Groq response as the primary generator and falls back to OpenRouter only before speech begins. Pure turn-state, context-budget, phrase-chunking, and telemetry modules make ordering, cancellation, cost, and latency testable without microphones or provider calls.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Bun test runner, Groq OpenAI-compatible chat completions, OpenRouter fallback, Deepgram Flux STT, Deepgram Aura-2 streaming TTS, Web Audio API, Prisma/SQLite.

## Global Constraints

- Never expose durable Groq, OpenRouter, or Deepgram API keys to browser code, logs, metrics, or API responses.
- A browser receives only a short-lived Deepgram JWT and connects directly to Deepgram; no Next.js route pretends to be a durable WebSocket relay.
- Use Flux `EndOfTurn` as the only first-release generation trigger and `StartOfTurn` as the barge-in trigger. Do not generate on `EagerEndOfTurn` yet.
- Identify every async event with `turnId`; stale text, audio, metrics, and provider errors must be ignored.
- Keep one persistent STT connection per active room and one persistent TTS connection per active persona voice.
- Stream exact generated text to TTS through a phrase chunker. Do not rewrite or summarize spoken output after generation.
- Keep the stable instruction prefix byte-identical across turns so Groq prompt caching can apply.
- Preserve all four approved experience state machines and the existing deterministic Drill correction path.
- Record p50/p95 latency, tokens, cached tokens, estimated cost, fallbacks, cancellation, and ordering failures. Never invent missing timing data.

---

## Planned File Structure

- `src/lib/config/server-env.ts` - validated server-only provider configuration.
- `src/lib/providers/deepgram-auth.ts` - temporary-token grant client.
- `src/app/api/deepgram-token/route.ts` - development prototype token endpoint.
- `src/lib/observability/turn-metrics.ts` - turn trace contracts and aggregation.
- `src/app/api/turn-metrics/route.ts` - local metric writes from browser-owned stages.
- `src/lib/persona/context-builder.ts` - stable prompt prefix and bounded dynamic context.
- `src/lib/providers/groq.ts` - primary streaming generator.
- `src/lib/providers/openrouter.ts` - typed fallback adapter around the existing client.
- `src/lib/providers/persona-generator.ts` - provider orchestration and fallback boundary.
- `src/lib/voice/phrase-chunker.ts` - low-latency, text-preserving chunk emission.
- `src/lib/voice/turn-state.ts` - pure turn lifecycle and stale-event rejection.
- `src/lib/providers/deepgram-stt.ts` - Flux WebSocket protocol adapter.
- `src/lib/providers/deepgram-tts.ts` - Aura-2 WebSocket protocol adapter.
- `src/lib/voice/pcm-player.ts` - queued incremental PCM playback and cancellation.
- `src/hooks/use-streaming-voice.ts` - microphone, STT, TTS, and playback lifecycle.
- `src/hooks/use-turn-controller.ts` - UI-facing turn orchestration.
- `src/lib/spar/live-turn-service.ts` - server-side context, generation, and metric creation.
- `playwright.config.ts` - local Chromium end-to-end configuration.
- `tests/e2e/architecture.spec.ts` - explorer navigation and no-provider-request coverage.
- `tests/e2e/voice-loop.spec.ts` - deterministic streaming playback and barge-in coverage.
- `scripts/stress-live-turns.ts` - deterministic 100-turn ordering and cancellation stress run.

### Task 1: Validate Provider Configuration and Mint Temporary Deepgram Tokens

**Files:**
- Modify: `.gitignore`
- Create: `.env.example`
- Create: `src/lib/config/server-env.ts`
- Test: `src/lib/config/server-env.test.ts`
- Create: `src/lib/providers/deepgram-auth.ts`
- Test: `src/lib/providers/deepgram-auth.test.ts`
- Create: `src/app/api/deepgram-token/route.ts`

**Interfaces:**
- Produces: `getServerProviderConfig(env): ServerProviderConfig` with redacted validation errors.
- Produces: `grantDeepgramToken(fetcher, apiKey, ttlSeconds): Promise<DeepgramGrant>`.
- Produces: `POST /api/deepgram-token` returning `{ accessToken, expiresIn }` only in development.

- [ ] **Step 1: Make a safe environment template trackable**

Keep `.env*` ignored, then add `!.env.example`. Create `.env.example` with names and comments only:

```dotenv
DATABASE_URL="file:./dev.db"
GROQ_API_KEY=""
OPENROUTER_API_KEY=""
DEEPGRAM_API_KEY=""
DEEPGRAM_REGION="us"
```

- [ ] **Step 2: Write failing configuration tests**

Test that all three provider keys are required, `DEEPGRAM_REGION` accepts `us` or `eu`, thrown messages contain missing variable names, and thrown messages never contain any supplied secret value.

- [ ] **Step 3: Run the test and confirm failure**

Run: `bun test src/lib/config/server-env.test.ts`

Expected: FAIL because `server-env.ts` does not exist.

- [ ] **Step 4: Implement server-only configuration validation**

Add `import "server-only"`. Accept an injected `Record<string, string | undefined>` for tests; call it with `process.env` only at route boundaries. Return `{ groqApiKey, openRouterApiKey, deepgramApiKey, deepgramRegion }` and never stringify the environment.

- [ ] **Step 5: Write failing Deepgram grant tests**

Mock `fetch` and assert the adapter:

```ts
await grantDeepgramToken(fetcher, "dg-secret", 60);
expect(fetcher).toHaveBeenCalledWith(
  "https://api.deepgram.com/v1/auth/grant",
  expect.objectContaining({ method: "POST" }),
);
```

Also assert `Authorization: Token dg-secret`, JSON `{ ttl_seconds: 60 }`, normalized `{ accessToken, expiresIn }`, and a redacted error on non-2xx responses.

- [ ] **Step 6: Implement the grant adapter and route**

Use a 60-second grant. Reject non-development requests with 404. Reject cross-origin requests when an `Origin` header does not match the request URL origin. Return `Cache-Control: no-store`. A 401/403 from Deepgram must become a clear server error explaining that the configured Deepgram key needs permission to grant temporary tokens, without returning the key or upstream body.

- [ ] **Step 7: Verify**

Run: `bun test src/lib/config/server-env.test.ts src/lib/providers/deepgram-auth.test.ts && bun run typecheck`

Expected: all tests pass and TypeScript exits 0.

- [ ] **Step 8: Commit**

```bash
git add .gitignore .env.example src/lib/config src/lib/providers/deepgram-auth.ts src/lib/providers/deepgram-auth.test.ts src/app/api/deepgram-token
git commit -m "feat: secure voice provider configuration"
```

### Task 2: Persist Turn-Level Latency, Token, and Fallback Metrics

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/*_add_turn_metrics/migration.sql`
- Create: `src/lib/observability/turn-metrics.ts`
- Test: `src/lib/observability/turn-metrics.test.ts`
- Create: `src/app/api/turn-metrics/route.ts`
- Modify: `src/app/api/dev/metrics/route.ts`

**Interfaces:**
- Produces: `TurnMetricEvent`, `TurnMetricRecord`, `applyMetricEvent(record, event)`, and `summarizeTurnMetrics(records)`.
- Produces: `POST /api/turn-metrics` for browser-owned timestamps and `GET /api/dev/metrics` for the explorer.

- [ ] **Step 1: Write failing metric reducer tests**

Cover trace ID, experience, persona, transcript confidence, selected region, server generation start, first token, first phrase, first TTS byte, first playback, cancellation, fallback, input/output/cached token counts, estimated cost, duplicate events, and stale `turnId`. Assert durations are calculated only when both endpoints exist.

- [ ] **Step 2: Run and confirm failure**

Run: `bun test src/lib/observability/turn-metrics.test.ts`

Expected: FAIL because the metrics module does not exist.

- [ ] **Step 3: Implement the pure metric contracts**

Use monotonic millisecond offsets within a turn for latency calculations and an ISO timestamp only for persistence. Derive:

```ts
interface TurnMetricSummary {
  p50PlaybackMs: number | null;
  p95PlaybackMs: number | null;
  maxInputTokens: number;
  maxOutputTokens: number;
  cacheRatio: number | null;
  totalCostUsd: number;
  fallbackCount: number;
  cancelledCount: number;
  orderingFailureCount: number;
}
```

- [ ] **Step 4: Add the Prisma model and migration**

Add a `TurnMetric` related to `Session` with unique `turnId`, trace ID, experience, persona, transcript confidence, selected region, optional milestone offsets, provider/model names, token fields, estimated cost, fallback reason, cancelled flag, and ordering failure count. Generate and apply the migration:

Run: `bunx prisma migrate dev --name add_turn_metrics`

Expected: Prisma creates the migration and updates the local SQLite database.

- [ ] **Step 5: Add metric write/read routes**

`POST /api/turn-metrics` validates a fixed event union, upserts by `turnId`, and ignores an event whose `sessionId` does not match the existing turn. `/api/dev/metrics` reads recent persisted turns and uses the shared aggregator. Both development routes must return `Cache-Control: no-store` and no environment data.

- [ ] **Step 6: Verify and commit**

Run: `bun test src/lib/observability/turn-metrics.test.ts && bunx prisma validate && bun run typecheck`

```bash
git add prisma src/lib/observability src/app/api/turn-metrics src/app/api/dev/metrics
git commit -m "feat: record live turn performance"
```

### Task 3: Build a Stable, Token-Bounded Persona Context

**Files:**
- Create: `src/lib/persona/context-builder.ts`
- Test: `src/lib/persona/context-builder.test.ts`
- Modify: `src/lib/personas.ts`
- Modify: `src/app/api/sessions/[id]/spar-stream/route.ts`

**Interfaces:**
- Produces: `buildPersonaContext(input): PersonaContext`.
- Produces: `estimateInputTokens(messages): number` and explicit `ContextBudgetError`.

- [ ] **Step 1: Write failing context-budget tests**

Assert that the builder:

- emits a stable prefix whose bytes do not change when only conversation history changes;
- keeps a rolling summary at or below 250 estimated tokens;
- retains at most the newest six messages;
- includes the newest user utterance exactly once;
- trims oldest dynamic context before crossing an 1,800 estimated-token safety limit;
- separates deterministic Drill/agitation state from conversational prose;
- returns a cacheable-prefix token estimate and total estimate.

- [ ] **Step 2: Run and confirm failure**

Run: `bun test src/lib/persona/context-builder.test.ts`

Expected: FAIL because the context builder does not exist.

- [ ] **Step 3: Implement the builder**

Use a conservative deterministic estimator of `Math.ceil(characterCount / 3.5)`. Construct messages in this order: stable persona/system prefix, compact session rules, rolling summary, latest four-to-six messages, newest utterance if it is not already the final history item. Remove oldest history pairs first, then truncate summary, and throw if immutable instructions alone exceed the safety limit.

- [ ] **Step 4: Compact the stable prompt source**

Refactor repeated wording in `src/lib/personas.ts` into reusable fixed blocks without changing mode behavior. Keep volatile timestamps, scores, and conversation text out of the stable prefix.

- [ ] **Step 5: Replace full-transcript prompt construction**

Update the stream route to use `buildPersonaContext`. Remove the existing duplicated-newest-message path. Preserve the current route response contract until Task 9 changes it deliberately.

- [ ] **Step 6: Verify and commit**

Run: `bun test src/lib/persona/context-builder.test.ts && bun run typecheck && bun run lint`

```bash
git add src/lib/persona src/lib/personas.ts src/app/api/sessions/[id]/spar-stream/route.ts
git commit -m "perf: bound persona context tokens"
```

### Task 4: Add Groq Primary Generation with a Safe OpenRouter Fallback

**Files:**
- Create: `src/lib/providers/types.ts`
- Create: `src/lib/providers/groq.ts`
- Test: `src/lib/providers/groq.test.ts`
- Modify: `src/lib/openrouter.ts`
- Create: `src/lib/providers/openrouter.ts`
- Create: `src/lib/providers/persona-generator.ts`
- Test: `src/lib/providers/persona-generator.test.ts`

**Interfaces:**
- Produces: `PersonaGenerator` with `stream(request, signal): AsyncIterable<GenerationEvent>`.
- Produces events: `text-delta`, `usage`, `provider-selected`, `fallback`, and `complete`.

- [ ] **Step 1: Write failing Groq SSE parser tests**

Feed fragmented `data:` lines, multiple events in one network chunk, `[DONE]`, usage metadata, malformed JSON, abort, and a non-2xx response. Assert ordered text deltas and redacted errors.

- [ ] **Step 2: Implement the Groq adapter**

POST to Groq's OpenAI-compatible chat completions endpoint with model `openai/gpt-oss-20b`, `stream: true`, `stream_options: { include_usage: true }`, `max_completion_tokens: 80`, low reasoning effort, and the caller's `AbortSignal`. Do not buffer the complete response.

- [ ] **Step 3: Type the OpenRouter fallback**

Move provider-independent SSE parsing into a shared helper if both adapters need it. Keep OpenRouter on `openai/gpt-oss-20b`, emit the same event contract, and preserve the existing app attribution headers.

- [ ] **Step 4: Write failing fallback-boundary tests**

Assert Groq is primary; OpenRouter is used only when Groq fails before the orchestrator marks `speechStarted`; provider failure after `speechStarted` ends the turn cleanly without speaking a second, conflicting answer; abort never triggers fallback.

- [ ] **Step 5: Implement provider orchestration**

Expose the selected provider/model and normalized usage. Estimate cost from a versioned price table only when provider usage exists; store `null` when pricing is unknown instead of guessing.

- [ ] **Step 6: Verify and commit**

Run: `bun test src/lib/providers/groq.test.ts src/lib/providers/persona-generator.test.ts && bun run typecheck`

```bash
git add src/lib/providers src/lib/openrouter.ts
git commit -m "feat: stream Groq with OpenRouter fallback"
```

### Task 5: Emit Speakable Phrases Without Waiting for Full Sentences

**Files:**
- Create: `src/lib/voice/phrase-chunker.ts`
- Test: `src/lib/voice/phrase-chunker.test.ts`

**Interfaces:**
- Produces: `createPhraseChunker(options)` with `push(delta)`, `flush()`, and `cancel()`.

- [ ] **Step 1: Write failing phrase-boundary tests**

Cover fragmented words, punctuation, commas, semicolons, quotes, abbreviations such as `e.g.`, decimal numbers, URLs, long punctuation-free output, final flush, and cancellation. Assert concatenated emitted text equals concatenated input exactly.

- [ ] **Step 2: Add latency-specific cases**

Assert the first phrase prefers 4-10 words and later phrases 8-16 words, but punctuation may close a phrase earlier. A long stream must emit before the final period. Whitespace must be preserved or normalized only at a documented single boundary.

- [ ] **Step 3: Implement the stateful chunker**

Buffer incomplete tokens, prefer natural punctuation boundaries, and use a hard word-count ceiling to prevent silence. Return phrase objects containing `text`, `sequence`, and `isFinal`; never modify wording.

- [ ] **Step 4: Verify and commit**

Run: `bun test src/lib/voice/phrase-chunker.test.ts && bun run typecheck`

```bash
git add src/lib/voice/phrase-chunker.ts src/lib/voice/phrase-chunker.test.ts
git commit -m "feat: stream low-latency speech phrases"
```

### Task 6: Define the Turn State Machine, Ordering, and Barge-In Rules

**Files:**
- Create: `src/lib/voice/turn-state.ts`
- Test: `src/lib/voice/turn-state.test.ts`

**Interfaces:**
- Produces: `TurnState`, `TurnEvent`, `TurnEffect`, `initialTurnState`, and `reduceTurn(state, event)`.

- [ ] **Step 1: Write failing lifecycle tests**

Use explicit states: `idle`, `listening`, `finalizing`, `generating`, `speaking`, `cancelled`, and `failed`. Test the normal path and every invalid transition. `EndOfTurn` enters `finalizing`; a successfully frozen transcript then enters `generating`.

- [ ] **Step 2: Write interruption and stale-event tests**

When Flux emits `StartOfTurn` during `generating` or `speaking`, assert effects abort generation, clear queued text, stop playback, reset the TTS connection, and begin a new `turnId`. Assert late provider deltas, audio frames, completions, and metric events for the old turn have no effect.

- [ ] **Step 3: Write ordering tests**

Phrase and audio sequence numbers must be strictly increasing. Duplicate events are idempotent; gaps or backwards events increment an ordering failure and fail the affected turn rather than playing scrambled audio.

- [ ] **Step 4: Implement the pure reducer**

Keep all browser APIs and fetches outside the reducer. Return declarative effects so the controller can execute and test them independently.

- [ ] **Step 5: Verify and commit**

Run: `bun test src/lib/voice/turn-state.test.ts && bun run typecheck`

```bash
git add src/lib/voice/turn-state.ts src/lib/voice/turn-state.test.ts
git commit -m "feat: define interruptible voice turns"
```

### Task 7: Stream Microphone Audio Through Deepgram Flux

**Files:**
- Create: `src/lib/providers/deepgram-stt.ts`
- Test: `src/lib/providers/deepgram-stt.test.ts`
- Create: `src/lib/voice/microphone-stream.ts`
- Test: `src/lib/voice/microphone-stream.test.ts`
- Create: `src/hooks/use-streaming-voice.ts`

**Interfaces:**
- Produces: `DeepgramSttClient` emitting `StartOfTurn`, interim transcript, `EndOfTurn`, error, and close events.
- Produces: microphone chunks as mono 16 kHz linear PCM with monotonic sequence numbers.

- [ ] **Step 1: Write failing protocol tests**

Mock WebSocket construction and assert the URL uses `/v2/listen`, `model=flux-general-en`, `encoding=linear16`, and `sample_rate=16000`; authentication uses the short-lived JWT, never the durable key. Parse fragmented mock messages into the normalized event union and reject events after close.

- [ ] **Step 2: Write failing microphone conversion tests**

Test Float32-to-Int16 clamping, mono downsampling, ordered 80 ms chunks, permission rejection, and stop cleanup. Pure conversion functions must not require a browser.

- [ ] **Step 3: Implement the Flux client**

Fetch `/api/deepgram-token`, then open the configured global or EU Deepgram WebSocket with `new WebSocket(url, ["bearer", accessToken])`, Deepgram's browser-compatible `Sec-WebSocket-Protocol` form for a temporary JWT. Send binary audio in order. Treat `EndOfTurn` as the sole submit event and `StartOfTurn` as interruption. Keep interim text display-only and record confidence with the finalized transcript.

- [ ] **Step 4: Implement microphone lifecycle and fallback**

Use an `AudioWorklet` when supported and a contained legacy audio-node fallback otherwise. If temporary-token grant, WebSocket startup, or microphone streaming fails, activate the existing browser Web Speech recognition path and record a fallback metric.

- [ ] **Step 5: Add hook lifecycle coverage**

Extract injectable constructors for fetch, WebSocket, media devices, and clock. Test one STT connection per mounted room, reconnection with capped jitter, cleanup on unmount, and no reconnect after explicit stop.

- [ ] **Step 6: Verify and commit**

Run: `bun test src/lib/providers/deepgram-stt.test.ts src/lib/voice/microphone-stream.test.ts && bun run typecheck && bun run lint`

```bash
git add src/lib/providers/deepgram-stt.ts src/lib/providers/deepgram-stt.test.ts src/lib/voice/microphone-stream.ts src/lib/voice/microphone-stream.test.ts src/hooks/use-streaming-voice.ts
git commit -m "feat: add Flux streaming transcription"
```

### Task 8: Stream Aura-2 Audio into Incremental Browser Playback

**Files:**
- Create: `src/lib/providers/deepgram-tts.ts`
- Test: `src/lib/providers/deepgram-tts.test.ts`
- Create: `src/lib/voice/pcm-player.ts`
- Test: `src/lib/voice/pcm-player.test.ts`
- Modify: `src/hooks/use-streaming-voice.ts`
- Modify: `src/lib/voice.ts`

**Interfaces:**
- Produces: `DeepgramTtsClient` with `speak(phrase, sequence)`, `flush()`, `clear()`, and `close()`.
- Produces: `PcmPlayer` with `enqueue(frame)`, `start()`, `stop()`, and `reset()`.

- [ ] **Step 1: Write failing TTS protocol tests**

Assert a persistent regional `/v1/speak` WebSocket uses the selected Aura-2 model, `encoding=linear16`, and `sample_rate=24000`; sends phrase text in sequence; sends `Flush` at the final phrase; handles binary frames and control messages separately; and drops frames after `clear` or close.

- [ ] **Step 2: Write failing incremental-player tests**

Using an injected fake audio clock, assert playback begins once the first decodable frame arrives, frames schedule without overlap or gaps beyond a small tolerance, underruns are counted, and `stop()` immediately invalidates queued frames from the old `turnId`.

- [ ] **Step 3: Implement the TTS client**

Reuse a short-lived Deepgram JWT to open one connection per active persona voice. Send exact phrase-chunker output as soon as emitted. Reconnect only before a turn begins; do not replay a partially spoken answer on a replacement connection.

- [ ] **Step 4: Implement Web Audio playback**

Convert little-endian PCM16 frames to normalized Float32 samples, queue them on an `AudioContext`, capture first-playback timing at the actual scheduled start, and use a generation counter to make cancellation synchronous from the controller's perspective.

- [ ] **Step 5: Keep a browser fallback**

If streaming TTS is unavailable before speech begins, use browser speech synthesis and captions, record the fallback, and preserve cancellation. Stop using the existing REST/base64 path in the live loop; retain only any non-live call sites that still require it.

- [ ] **Step 6: Verify and commit**

Run: `bun test src/lib/providers/deepgram-tts.test.ts src/lib/voice/pcm-player.test.ts && bun run typecheck && bun run lint`

```bash
git add src/lib/providers/deepgram-tts.ts src/lib/providers/deepgram-tts.test.ts src/lib/voice/pcm-player.ts src/lib/voice/pcm-player.test.ts src/hooks/use-streaming-voice.ts src/lib/voice.ts
git commit -m "feat: stream Aura speech to playback"
```

### Task 9: Integrate the End-to-End Live Turn Controller

**Files:**
- Create: `src/lib/spar/live-turn-service.ts`
- Test: `src/lib/spar/live-turn-service.test.ts`
- Create: `src/hooks/use-turn-controller.ts`
- Test: `src/hooks/use-turn-controller.test.ts`
- Modify: `src/app/api/sessions/[id]/spar-stream/route.ts`
- Modify: `src/components/spar/sparring-room.tsx`
- Modify: `src/lib/session-cache.ts`

**Interfaces:**
- Produces: server SSE events `turn-start`, `text-delta`, `phrase`, `usage`, `metric`, `fallback`, `complete`, and `error`, all carrying `turnId`.
- Produces: `useTurnController` as the only owner of live generation, speech, cancellation, and UI turn state.

- [ ] **Step 1: Write failing service tests**

Mock session loading, context building, providers, clock, and metric writes. Assert Flux `EndOfTurn` text is persisted once, the stable bounded context reaches Groq, deltas pass through the chunker, phrase events arrive before completion, usage is persisted, and the response never exceeds the 80-token setting.

- [ ] **Step 2: Write failing controller tests**

Simulate normal conversation, Groq-before-speech fallback, STT fallback, TTS fallback, barge-in during generation, barge-in during playback, repeated StartOfTurn, unmount, network loss, and a late old-turn completion. Assert one visible assistant message and one audible answer per completed turn.

- [ ] **Step 3: Implement the thin stream route**

Parse and validate the request, create a `turnId`, call `liveTurnService`, and serialize its events immediately as SSE. Pass `request.signal` through every provider and persistence boundary. Add `Cache-Control: no-cache, no-transform` and disable response buffering where supported.

- [ ] **Step 4: Implement the controller hook**

Connect normalized STT events to the turn reducer; submit only on `EndOfTurn`; stream phrases to the browser-owned TTS connection; update captions from exact deltas; post browser timing milestones; and execute reducer cancellation effects in a fixed order: abort generation, invalidate phrase queue, stop audio, clear TTS, then accept the new turn.

- [ ] **Step 5: Refactor SparringRoom incrementally**

Replace its independent recognition, fetch, full-response TTS, and interruption state with `useTurnController`. Keep layout and non-voice controls unchanged. Route current status text, transcript preview, assistant captions, and microphone controls through the hook.

- [ ] **Step 6: Preserve cache and persistence behavior**

Write each finalized user message and exact assistant response once. Do not cache partial assistant text as a completed message. Clear abandoned turn buffers on cancellation while retaining the metric record.

- [ ] **Step 7: Verify and commit**

Run: `bun test src/lib/spar/live-turn-service.test.ts src/hooks/use-turn-controller.test.ts && bun run typecheck && bun run lint && bun run build`

```bash
git add src/lib/spar src/hooks/use-turn-controller.ts src/hooks/use-turn-controller.test.ts src/app/api/sessions/[id]/spar-stream/route.ts src/components/spar/sparring-room.tsx src/lib/session-cache.ts
git commit -m "feat: integrate low-latency live turns"
```

### Task 10: Protect Experience Behavior and Prove the Performance Budget

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/architecture.spec.ts`
- Create: `tests/e2e/voice-loop.spec.ts`
- Create: `src/lib/spar/experience-contracts.test.ts`
- Create: `scripts/stress-live-turns.ts`
- Create: `scripts/benchmark-voice.ts`
- Modify: `package.json`
- Modify: `src/architecture/manifest.ts`
- Modify: `README.md`

**Interfaces:**
- Produces scripts `test:stress-turns` and `benchmark:voice`.
- Updates the architecture explorer from planned target to measured implementation.

- [ ] **Step 1: Add the Chromium test harness**

Run: `bun add --dev @playwright/test && bunx playwright install chromium`

Add `test:e2e: "playwright test"` to `package.json`. Configure Playwright to start `bunx next dev -p 3100`, reuse no existing server in CI, retain traces only on failure, and use Chromium with microphone permission for `http://localhost:3100`.

- [ ] **Step 2: Add deterministic browser tests**

In `architecture.spec.ts`, open `/architecture`, traverse all six tabs, select one system node and every experience, and fail if a request targets Groq, OpenRouter, or Deepgram.

In `voice-loop.spec.ts`, install deterministic `MediaDevices`, WebSocket, AudioContext, and SSE/fetch doubles before application code loads. Assert captions update from interim STT, generation begins only after `EndOfTurn`, playback begins before the mocked generation completes, `StartOfTurn` stops audio within the injected 200 ms clock budget, and a late old-turn audio frame is discarded.

- [ ] **Step 3: Run the browser tests**

Run: `bun run test:e2e`

Expected: both Chromium specs pass; the explorer makes zero provider requests; the voice test proves first playback precedes response completion and stale audio is silent.

- [ ] **Step 4: Add experience regression tests**

Assert the approved behavior remains:

- Defense: configure -> uninterrupted presentation -> analysis -> Q&A -> end -> debrief.
- Boardroom: configure -> presentation with interrupt/recover loop -> Q&A -> end -> debrief.
- Open Spar: panel opens -> answer/challenge loop -> end -> debrief.
- Drill: deterministic target selection, detection, correction/retry-or-advance, statistics, and debrief.

Mock the generator where AI is expected; assert Drill correctness and progression do not depend on model output.

- [ ] **Step 5: Add a deterministic 100-turn stress script**

Drive the pure controller with seeded provider/audio delays, a mix of normal turns, fallbacks, and barge-ins. Exit nonzero for duplicate completion, stale output accepted, out-of-order playback, leaked active turn, more than 2,000 estimated input tokens, or more than 80 configured output tokens.

- [ ] **Step 6: Add a local provider benchmark**

`benchmark:voice` performs an explicit opt-in check of configured services, supports `--region=us|eu`, prompts the operator to speak 20 representative turns across the four experiences, and reports end-of-turn-to-first-token, first-phrase, first-TTS-byte, and first-playback p50/p95. It must redact keys, avoid storing raw audio, and label browser/provider fallbacks.

- [ ] **Step 7: Gate against the approved budgets**

First run a five-turn opt-in regional probe with the same short prompts against `us` and `eu`, then set `DEEPGRAM_REGION` to the lower measured end-to-end result. The final benchmark exits nonzero when a 20-turn valid sample on the selected region misses p50 <= 1,000 ms, p95 <= 1,500 ms, or barge-in <= 200 ms. It prints environment and sample-size caveats so a local result is not presented as a universal production guarantee.

- [ ] **Step 8: Update scripts, docs, and explorer truthfully**

Add package scripts, provider-key setup, Deepgram token permission troubleshooting, latency definitions, fallback policy, and benchmark commands. Update `src/architecture/manifest.ts` so the implemented streaming path is Current; preserve the old path only as fallback/history and wire live metrics into the Latency lab.

- [ ] **Step 9: Run complete automated verification**

Run: `bun test && bun run test:e2e && bun run test:stress-turns && bun run typecheck && bun run lint && bun run build && git diff --check`

Expected: all commands exit 0; stress output reports 100 completed/cancelled turns with zero duplicate, stale, or out-of-order acceptance.

- [ ] **Step 10: Run the real local benchmark**

Run the regional probes: `bun run benchmark:voice --region=us --turns=5` and `bun run benchmark:voice --region=eu --turns=5`.

Run the acceptance sample after selecting the faster measured region: `bun run benchmark:voice --turns=20`.

Expected: 20 valid samples spanning all four experiences, p50/p95 and barge-in results printed, keys redacted, raw audio absent. If the target is missed, keep the measured numbers visible in the Latency lab and do not claim the latency goal is complete.

- [ ] **Step 11: Inspect secrets and repository state**

Run: `git status --short && git grep -n -E "(gsk_|sk-or-|dg_[A-Za-z0-9])" -- ':!docs/superpowers/plans/*'`

Expected: `.env`, generated database files, and provider secrets do not appear; the grep returns no matches.

- [ ] **Step 12: Commit**

```bash
git add package.json bun.lock playwright.config.ts tests/e2e README.md scripts src/architecture/manifest.ts src/lib/spar/experience-contracts.test.ts
git commit -m "test: verify voice latency and mode behavior"
```

## Completion Evidence

- All automated tests, typecheck, lint, and production build pass.
- The 100-turn seeded stress run reports zero stale, duplicate, and out-of-order acceptance.
- A 20-turn local benchmark reports actual p50/p95 playback and barge-in timings; the target is claimed only if those measurements pass.
- Normal sampled turns remain within 2,000 input tokens and the generator is configured for at most 80 output tokens.
- Groq usage shows the primary path, OpenRouter appears only as an allowed pre-speech fallback, and Deepgram uses short-lived browser credentials.
- `/architecture` accurately reflects implemented providers, state machines, storage, metrics, and fallback paths without making a runtime model call.
