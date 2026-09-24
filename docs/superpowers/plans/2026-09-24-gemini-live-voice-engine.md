# Gemini Live Voice Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Gemini 3.8 Live the primary speech-to-speech voice engine for sparring rooms, with the existing Deepgram→Groq→Aura-2 cascade as automatic fallback and continuous (one-activation) microphone conversation.

**Architecture:** A new server route mints short-lived Google ephemeral tokens (durable key stays server-side). A new browser adapter speaks the Live API WebSocket protocol (setup with mode-routed model + persona voice + per-mode VAD contract; mic PCM in; 24kHz PCM out through the existing PcmPlayer; transcripts drive captions; `interrupted` drives barge-in). A mode-contracts module encodes research-grounded interaction rules per experience. Turn lifecycle, metrics, and fallback reuse the existing turn state machine, metric recorder, and cascade pipeline. Execute in an isolated worktree (superpowers:using-git-worktrees).

**Tech Stack:** Next.js 15 (App Router), TypeScript, bun test, Prisma/SQLite, existing PcmPlayer/microphone-stream/turn-state modules. No new npm dependencies (raw WebSocket; no js-genai SDK).

**Protocol reference:** `docs/research/2026-09-24-gemini-live-api-protocol.md` (wire literals, cited). Mode research: `docs/research/2026-09-24-mode-{defense,boardroom,open-spar,drill}.md`.

## Global Constraints

- Never expose the durable `GEMINI_API_KEY` to browser code, logs, metrics, or API responses; the browser receives only a short-lived ephemeral token (`token.name` from `POST /v1beta/auth_tokens`).
- Live mode connects browser-direct to `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=<token>`; the Next.js server never relays audio.
- Model routing: Defense, Drill, Open Spar → `models/gemini-3.8-live`; Boardroom → `models/gemini-3.8-live-extended-thinking`.
- Every async event in Live mode still carries a `turnId` through the existing turn state machine; stale events are ignored.
- Fallback ladder is automatic and ordered: `gemini-live` → existing cascade → browser speech; every turn records `voiceEngine` and fallback reason; never invent timing data.
- Input audio: base64 raw 16-bit PCM, 16 kHz, little-endian, mono, 20-40 ms chunks, `mimeType: "audio/pcm;rate=16000"`. Output: base64 PCM, 24 kHz (`audio/pcm;rate=24000`), played by the existing 24 kHz PcmPlayer.
- `serverContent.interrupted: true` must immediately stop playback and discard queued audio.
- When `GEMINI_API_KEY` is absent, rooms transparently use the cascade with no user-facing error.
- Do not commit `.superpowers/`; do not print `.env` or any API key.
- Tests: `bun test`; typecheck: `bun run typecheck`; lint: `bun run lint`.

---

### Task 1: Mode interaction contracts module

**Files:**
- Create: `src/lib/spar/mode-contracts.ts`
- Test: `src/lib/spar/mode-contracts.test.ts`

**Interfaces:**
- Produces: `ModeInteractionContract` type and `MODE_CONTRACTS: Record<"defense" | "boardroom" | "open_spar" | "drill", ModeInteractionContract>`; `LIVE_MODEL_BY_MODE: Record<mode, string>`; `vadConfigFor(mode): { automaticActivityDetection: { disabled: false; startOfSpeechSensitivity: string; endOfSpeechSensitivity: string; prefixPaddingMs: number; silenceDurationMs: number } }`. The exact mode key strings match the existing experience keys used by `src/lib/spar/live-turn-service.ts` (verify against that file before coding; if the app uses e.g. `openSpar`, use the app's exact keys).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { MODE_CONTRACTS, LIVE_MODEL_BY_MODE, vadConfigFor } from "./mode-contracts";

describe("mode contracts", () => {
  test("patience ladder from research: defense 3000, boardroom 1200, open spar 500, drill 500", () => {
    expect(MODE_CONTRACTS.defense.endOfSpeechPatienceMs).toBe(3000);
    expect(MODE_CONTRACTS.boardroom.endOfSpeechPatienceMs).toBe(1200);
    expect(MODE_CONTRACTS.open_spar.endOfSpeechPatienceMs).toBe(500);
    expect(MODE_CONTRACTS.drill.endOfSpeechPatienceMs).toBe(500);
  });
  test("each contract carries all six behavioral fields as non-empty strings", () => {
    for (const contract of Object.values(MODE_CONTRACTS)) {
      expect(contract.interruptionPolicy.length).toBeGreaterThan(20);
      expect(contract.responseStyleHint.length).toBeGreaterThan(20);
      expect(contract.pacingHint.length).toBeGreaterThan(20);
      expect(contract.openingBehavior.length).toBeGreaterThan(20);
      expect(contract.closingBehavior.length).toBeGreaterThan(20);
    }
  });
  test("boardroom routes to extended thinking; others to base live", () => {
    expect(LIVE_MODEL_BY_MODE.boardroom).toBe("models/gemini-3.8-live-extended-thinking");
    expect(LIVE_MODEL_BY_MODE.defense).toBe("models/gemini-3.8-live");
    expect(LIVE_MODEL_BY_MODE.drill).toBe("models/gemini-3.8-live");
    expect(LIVE_MODEL_BY_MODE.open_spar).toBe("models/gemini-3.8-live");
  });
  test("vad config maps patience to silenceDurationMs", () => {
    expect(vadConfigFor("defense").automaticActivityDetection.silenceDurationMs).toBe(3000);
    expect(vadConfigFor("drill").automaticActivityDetection.prefixPaddingMs).toBe(20);
    expect(vadConfigFor("open_spar").automaticActivityDetection.disabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/spar/mode-contracts.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the implementation**

`ModeInteractionContract` has exactly: `endOfSpeechPatienceMs: number; interruptionPolicy: string; responseStyleHint: string; pacingHint: string; openingBehavior: string; closingBehavior: string`. Copy the six field values **verbatim from the research docs** (`docs/research/2026-09-24-mode-defense.md`, `-boardroom.md`, `-open-spar.md`, `-drill.md` — each ends with the contract object). `vadConfigFor(mode)` returns `{ automaticActivityDetection: { disabled: false, startOfSpeechSensitivity: "START_SENSITIVITY_HIGH", endOfSpeechSensitivity: "END_SENSITIVITY_HIGH", prefixPaddingMs: 20, silenceDurationMs: MODE_CONTRACTS[mode].endOfSpeechPatienceMs } }`.

- [ ] **Step 4: Run test to verify it passes** — `bun test src/lib/spar/mode-contracts.test.ts`
- [ ] **Step 5: Commit** — `git add src/lib/spar/mode-contracts.ts src/lib/spar/mode-contracts.test.ts && git commit -m "feat: add mode interaction contracts"`

---

### Task 2: Gemini server env + ephemeral token route

**Files:**
- Modify: `src/lib/config/server-env.ts` (add optional `geminiApiKey`)
- Create: `src/app/api/gemini-live-token/route.ts`
- Create: `src/app/api/gemini-live-token/route.test.ts`
- Modify: `.env.example` (add `GEMINI_API_KEY=` with one-line comment)

**Interfaces:**
- Produces: `GET /api/gemini-live-token` → `200 { token: string; expiresIn: number }` (token is the minted `token.name`, format `auth_tokens/...`; `expiresIn` = seconds until `expireTime`), or `503 { error: "gemini-unconfigured" }` when `GEMINI_API_KEY` is absent. Route follows the existing pattern of `src/app/api/deepgram-token/route.ts` (same-origin check, `no-store`, zod on query if any).
- Consumes: none new.

- [ ] **Step 1: Write the failing test** — model the fetch double (inject via a module-level `fetchToken` seam mirroring how `deepgram-token` tests double the grant call). Cases: (a) 200 returns `{token, expiresIn}` from a minted `{name: "auth_tokens/abc", expireTime}` with `expiresIn` computed from `expireTime` minus now (allow 25–35 min default); (b) absent key → 503 body `{error: "gemini-unconfigured"}`; (c) upstream non-2xx → 502 `{error: "gemini-mint-failed"}`; (d) never includes the API key in any response body.

```ts
import { describe, expect, test, mock, afterEach } from "bun:test";
// Doubles the mint call; asserts route contract above. Model on
// src/app/api/deepgram-token/route.test.ts structure.
```

- [ ] **Step 2: Run test to verify it fails** — `bun test src/app/api/gemini-live-token/route.test.ts`
- [ ] **Step 3: Implement.** Mint call (server only):

```
POST https://generativelanguage.googleapis.com/v1beta/auth_tokens
headers: { "x-goog-api-key": env.geminiApiKey, "Content-Type": "application/json" }
body: { uses: 1, expireTime: <now+30min ISO>, newSessionExpireTime: <now+60s ISO> }
```

Read the credential from the response's `token.name` (per protocol ref §1.2). `server-env.ts`: `geminiApiKey` is **optional** (absent key must not break boot; contrast with required Deepgram vars). If the v1beta mint endpoint returns 404 (the documented v1beta/v1alpha ambiguity, protocol ref Open Question Q2), retry once against `https://generativelanguage.googleapis.com/v1alpha/auth_tokens`; record which version worked.

- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit** — `git commit -m "feat: mint Gemini Live ephemeral tokens"`

---

### Task 3: Live instruction builder (persona + mode prompt, spoken style)

**Files:**
- Create: `src/lib/spar/live-instruction.ts`
- Test: `src/lib/spar/live-instruction.test.ts`

**Interfaces:**
- Consumes: `ARCHETYPES`, `BEHAVIOR_STYLE_PROMPTS` from `src/lib/personas.ts`; `MODE_CONTRACTS` from Task 1.
- Produces: `buildLiveSystemInstruction(params: { archetype: ArchetypeKey; behaviorStyle: BehaviorStyle; mode: keyof typeof MODE_CONTRACTS; scenarioLabel: string; claims: Array<{ id: number; label: string; claim: string; evidence?: string }>; otherPanelists: Array<{ name: string; archetype: ArchetypeKey }> }): string` — one plain-text system instruction for the Live session.

- [ ] **Step 1: Write the failing test.** Assert: output contains the persona's lens/triggers/forbidden rules (reuse `ARCHETYPES` fields), the mode contract's `responseStyleHint`/`pacingHint`/`openingBehavior`/`closingBehavior`/`interruptionPolicy` verbatim, the claims block, other-panelists block; output does **not** contain "STRICT JSON" or `"content":` (the cascade JSON format must not leak into spoken mode); output contains an explicit brevity line `Keep spoken turns under 20 seconds unless presenting.`

- [ ] **Step 2: Verify it fails.**
- [ ] **Step 3: Implement.** Structure: persona identity from `buildPersonaStablePrefix` blocks minus `RESPONSE_FORMAT_PROMPT`/`CORE_RESPONSE_RULES`' JSON parts — write a spoken-rules block instead: one question per turn, speak naturally (no markdown, no lists), 1-3 sentences (Timekeeper-like personas shorter), never mention being an AI, never read numbers as JSON. Then the mode contract's five behavioral fields as labeled sections, then session rules (claims + other panelists) reusing `buildPersonaSessionRules`.

- [ ] **Step 4: Verify pass.**
- [ ] **Step 5: Commit** — `git commit -m "feat: build spoken persona instruction for Live sessions"`

---

### Task 4: Gemini Live browser adapter

**Files:**
- Create: `src/lib/providers/gemini-live.ts`
- Test: `src/lib/providers/gemini-live.test.ts`

**Interfaces:**
- Consumes: token from Task 2 route shape.
- Produces:

```ts
export interface GeminiLiveOptions {
  token: string; model: string; systemInstruction: string; voiceName: string;
  vad: ReturnType<typeof import("../spar/mode-contracts").vadConfigFor>["automaticActivityDetection"];
  onEvent: (event: GeminiLiveEvent) => void;   // typed union below
  dependencies?: { webSocket?: (url: string) => WebSocket; now?: () => number; backoffMs?: (attempt: number) => number };
}
export type GeminiLiveEvent =
  | { type: "ready" }
  | { type: "audio-out"; pcmBase64: string }             // decode → PcmPlayer.enqueue-compatible bytes
  | { type: "output-transcript"; text: string }
  | { type: "input-transcript"; text: string }           // finalized user speech (end-of-speech signal)
  | { type: "interim-input-transcript"; text: string }
  | { type: "turn-complete" }                            // gate: interactionStatus === "IDLE" for extended thinking
  | { type: "interrupted" }                              // discard playback NOW
  | { type: "goaway"; timeLeft: string }
  | { type: "reconnecting"; attempt: number }
  | { type: "error"; reason: "token-grant" | "socket" | "setup-rejected" | "aborted" };
export class GeminiLiveClient {
  constructor(options: GeminiLiveOptions);
  connect(): Promise<void>;           // resolves on setupComplete; rejects on token/setup failure after retries
  sendAudio(pcm16Base64: string): void;   // wraps {realtimeInput:{audio:{data, mimeType:"audio/pcm;rate=16000"}}}; no-op before ready
  close(): void;                      // idempotent; stops reconnect loop
}
```

- [ ] **Step 1: Write failing tests** with an injected WebSocket double (model on `deepgram-stt.test.ts`): (a) connects to the Constrained URL with `access_token=`; (b) sends `setup` exactly (model, `generationConfig.responseModalities:["AUDIO"]`, `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName`, `systemInstruction.parts[0].text`, `inputAudioTranscription:{}`, `outputAudioTranscription:{}`, `realtimeInputConfig.automaticActivityDetection` = the passed VAD, `sessionResumption:{handle:null}`, `contextWindowCompression:{slidingWindow:{targetTokens:8000},triggerTokens:25000}`) and nothing before `setupComplete`; (c) maps server frames: `serverContent.modelTurn.parts[0].inlineData.data` → `audio-out` with mimeType `audio/pcm;rate=24000` checked; `outputTranscription.text` → `output-transcript`; `inputTranscription.text` → `input-transcript`; `interimInputTranscription.text` → `interim-input-transcript`; `serverContent.interrupted:true` → `interrupted`; `serverContent.turnComplete:true` → `turn-complete` **only when** `serverContent.interactionStatus` is `"IDLE"` or absent (extended-thinking fires turnComplete per utterance); `goAway.timeLeft` → `goaway`; `sessionResumptionUpdate.newHandle` stored (no event, internal state); (d) reconnect: on close without `close()` having been called, emits `reconnecting`, re-sends setup with `sessionResumption.handle = <latest handle>`, backs off via injected `backoffMs`; (e) `sendAudio` before ready is a no-op; (f) `close()` prevents further reconnects.

- [ ] **Step 2: Verify fail.** — `bun test src/lib/providers/gemini-live.test.ts`
- [ ] **Step 3: Implement** per protocol ref §1–§4 (URL literal §1.1; setup §2.1; audio §3.1/§4.1; interruption §4.2: on `interrupted` the adapter only emits — playback discard is the integrator's job; resumption §4.6/§5; goAway triggers reconnect-before-close). Bound reconnect attempts at 3 before `error: "socket"`.
- [ ] **Step 4: Verify pass.**
- [ ] **Step 5: Commit** — `git commit -m "feat: add Gemini Live browser adapter"`

---

### Task 5: Prisma schema + metrics for the Live engine

**Files:**
- Modify: `prisma/schema.prisma` (TurnMetric)
- Modify: `src/app/api/turn-metrics/route.ts` + `route.test.ts`
- Modify: `src/lib/observability/turn-metrics.ts` + test

**Interfaces:**
- Produces: `TurnMetric.voiceEngine String?` (`"gemini-live" | "cascade" | "browser"`), `TurnMetric.firstLiveAudioMs Int?` (finalized-input-transcript → first audio-out, same turn), `TurnMetric.interruptions Int?`. Route zod-allowlists the new optional fields; summarizer reports p50/p95 for `firstLiveAudioMs` and total interruptions, labeled by engine; `applyMetricEvent` keeps first-writer-wins per field (existing pattern).

- [ ] **Step 1: Failing tests** — route accepts `{type:"live-engine", sessionId, turnId, voiceEngine:"gemini-live", firstLiveAudioMs: 812, interruptions:1}`; rejects unknown engine strings; summarizer percentiles include live turns only in `firstLiveAudioMs` stats; absent fields render null, never 0.
- [ ] **Step 2: Verify fail.**
- [ ] **Step 3: Implement + `bunx prisma db push` locally** (migration file via `bunx prisma migrate dev --name add_live_engine_metrics` if the dev DB is reachable; scoped DDL validation otherwise — same caveat as the previous plan's Task 2).
- [ ] **Step 4: Verify pass.**
- [ ] **Step 5: Commit** — `git commit -m "feat: record live engine turn metrics"`

---

### Task 6: Live voice session integration (mic → adapter → player → turns → fallback)

**Files:**
- Create: `src/hooks/use-live-voice.ts`
- Test: `src/hooks/use-live-voice.test.ts`
- Modify: `src/hooks/use-turn-controller.ts` (engine selection + fallback handoff)

**Interfaces:**
- Consumes: `GeminiLiveClient` (Task 4), `buildLiveSystemInstruction` (Task 3), `LIVE_MODEL_BY_MODE`/`vadConfigFor` (Task 1), existing `PcmPlayer`, `microphone-stream` capture (must emit 16 kHz PCM16 mono — verify the existing worklet sample rate; if it captures at 48 kHz, downsample by creating the capture `AudioContext` with `sampleRate: 16000`), existing turn-state machine registration, existing `queueMetric` path, existing cascade via `use-streaming-voice`.
- Produces: `useLiveVoice(options)` returning `{ status: "connecting" | "live" | "fallback"; start(): Promise<void>; stop(): void; sendNothingElse }` plus the caption/event callbacks wired in `use-turn-controller` options; a hook-level `LIVE_VOICES: Record<ArchetypeKey, string>` map — skeptic: `"Kore"` (the only Live-documented voice), nitpicker: `"Charon"`, so_what: `"Pulcherrima"`, timekeeper: `"Alnilam"`, ally: `"Achird"` (TTS prebuilt set; fall back to `"Kore"` on setup rejection — config-level constant `FALLBACK_VOICE = "Kore"`).

- [ ] **Step 1: Failing tests** (hosted-hook style, model on `use-turn-controller.test.ts`): (a) `start()` fetches `/api/gemini-live-token`, gets 503 → transitions to `fallback`, records `{type:"live-engine", voiceEngine:"cascade"}` via queueMetric, never throws to the caller; (b) token OK + `setupComplete` → `status: "live"`, mic frames flow to `sendAudio` as base64 PCM16, `audio-out` frames reach `PcmPlayer.enqueue`, first audio emits the `firstLiveAudioMs` milestone keyed to the current turnId (from finalized input-transcript timestamp); (c) `interrupted` → `player.stop()` called and active turn cancelled through the turn-state machine (idempotent); (d) AI utterance lifecycle: first `modelTurn` after idle registers a new turnId; `turn-complete` finalizes it; a stale frame for a finished turn is dropped; (e) caption events: `interim-input-transcript` → user interim caption; `output-transcript` accumulates into the active AI turn caption; (f) adapter `error: "socket"` after retries → transition to `fallback` (cascade takes over; one metric, no user-facing crash).
- [ ] **Step 2: Verify fail.**
- [ ] **Step 3: Implement.** Single Live session per room; `stop()` closes adapter + mic + player. Barge-in requires NO special user action in live mode (server VAD). Mic capture runs continuously while `status === "live"`; guard so mic frames are NOT sent while the cascade owns the room.
- [ ] **Step 4: Verify pass** (focused) then full `bun test`.
- [ ] **Step 5: Commit** — `git commit -m "feat: integrate Live voice session with fallback ladder"`

---

### Task 7: Room wiring + e2e

**Files:**
- Modify: `src/components/spar/sparring-room.tsx` (engine orchestration, one-activation mic UX in live mode, engine status chip)
- Modify: `tests/e2e/voice-loop.spec.ts` (Live-mode spec: doubles the token route + Live WebSocket; asserts one mic activation → continuous flow, `interrupted` clears playback, transcripts render as captions, no Groq/Deepgram request fires while live)
- Test: room-level unit tests co-located per existing pattern

**Interfaces:**
- Consumes: `use-turn-controller` + `use-live-voice` from Task 6.
- Produces: room behavior — on entry (mic permission granted once): live engine connects; a small quiet status label shows the active engine (`Live` / `Classic`); in live mode the per-turn Speak/Done buttons are hidden and the mic stays live; in fallback mode the existing click flow is unchanged.

- [ ] **Step 1: Failing tests** — e2e spec `voice-loop live engine` (per above) + room unit tests asserting: live mode hides per-turn controls; fallback mode renders them; status label text maps engine correctly.
- [ ] **Step 2: Verify fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify pass** — `bun test && bun run test:e2e`.
- [ ] **Step 5: Commit** — `git commit -m "feat: wire Live engine into sparring room"`

---

### Task 8: Docs, explorer, worklog, full verification

**Files:**
- Modify: `README.md` (GEMINI_API_KEY setup, engine + fallback explanation, cost note $0.005/min in + $0.018/min out)
- Modify: `.env.example` (if not already), `src/architecture/manifest.ts` + explorer voice-pipeline component (Live path as primary, cascade as fallback — same maintenance rule as before: update `data-memory.tsx` if persistence changed, update pinning tests `src/architecture/validate.test.ts` / `voice-pipeline.test.ts`)
- Modify: `worklog.md` (new Task entry: what was built, how to test a live room, env var, fallback behavior)

- [ ] **Step 1: Update docs/explorer/tests per above.**
- [ ] **Step 2: Full verification** — `bun test && bun run test:e2e && bun run typecheck && bun run lint && bun run build && git diff --check` — all exit 0.
- [ ] **Step 3: Secret scan** — `git grep -n -E "(gsk_|sk-or-|dg_[A-Za-z0-9]|AIza[A-Za-z0-9_-])" -- ':!docs/superpowers/plans/*' ':!docs/research/*'` → no textual key matches (known PNG byte-pattern false positive aside).
- [ ] **Step 4: Commit** — `git commit -m "docs: document Live voice engine"` and append the worklog entry in the same commit.

## Deferred (explicit)

- Tool calling (`mark_mood`, `challenge_claim`, `request_handoff`, `flag_interrupt`) — v2 after the engine proves itself.
- Per-persona voice swapping across multi-panelist rooms (single socket = single voice; revisit with Project 2's panelist selection).
- Real-device latency benchmark for Live mode (`firstLiveAudioMs` p50/p95) — needs a room with a real Google key and the user speaking; opt-in.
