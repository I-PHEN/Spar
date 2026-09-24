# Gemini Live API Wire-Protocol Reference (BidiGenerateContent)

**Purpose:** implementation reference for a browser-direct (raw WebSocket) speech-to-speech client against the Gemini API (AI Studio / `generativelanguage.googleapis.com`) Live API.
**Compiled:** 2026-09-24. All claims cite the source page and that page's "Last updated" date at time of access (2026-09-24). Ambiguities are flagged explicitly rather than guessed.

Primary sources (short names used throughout):

- **[REF]** Live API REST/WebSocket reference — https://ai.google.dev/api/live — *last updated 2026-09-04*
- **[CAP]** Live API capabilities guide — https://ai.google.dev/gemini-api/docs/live-guide (a.k.a. `/gemini-api/docs/live-api/capabilities`) — *last updated 2026-09-18*
- **[WS]** Live API get started with raw WebSockets — https://ai.google.dev/gemini-api/docs/live-api/get-started-websocket — *last updated 2026-09-15*
- **[EPH]** Ephemeral tokens guide — https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens — *last updated 2026-09-15*
- **[SM]** Session management guide — https://ai.google.dev/gemini-api/docs/live-api/session-management — *last updated 2026-09-15*
- **[BP]** Best practices guide — https://ai.google.dev/gemini-api/docs/live-api/best-practices — *last updated 2026-09-15*
- **[THK]** Thinking in the Live API — https://ai.google.dev/gemini-api/docs/live-api/thinking — *last updated 2026-09-15*
- **[TR]** Live Transcribe guide — https://ai.google.dev/gemini-api/docs/live-api/live-transcribe — *last updated 2026-08-26*
- **[PRICE]** Pricing — https://ai.google.dev/gemini-api/docs/pricing — *last updated 2026-09-24*
- **[RL]** Rate limits — https://ai.google.dev/gemini-api/docs/rate-limits — *last updated 2026-09-02*
- **[VOICES]** Speech generation (prebuilt voices table) — https://ai.google.dev/gemini-api/docs/speech-generation — *last updated 2026-09-24*
- **[SDK]** `googleapis/js-genai` source, `main` branch (`src/live.ts`, `src/_websocket.ts`, `src/_api_client.ts`), plus class docs at googleapis.github.io/js-genai — *accessed 2026-09-24; README marked version 2.24.0 on the docs site*

---

## 1. Connection

### 1.1 Endpoint URLs (exact literals)

**API key auth** (server-side, or browser with an exposed key — not recommended):

```
wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=YOUR_API_KEY
```

Source: [WS] (2026-09-15), literal extracted from the page HTML; identical endpoint string in [REF] (2026-09-04). "Authentication is handled by including your API key as a query parameter in the WebSocket URL" — param name `key`.

**Ephemeral token auth** (browser-direct):

```
wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token={short-lived-token}
```

Source: [WS] (2026-09-15), literal from page HTML. Note the method name changes to **`BidiGenerateContentConstrained`** and the query param to **`access_token`**. [REF] (2026-09-04) confirms: ephemeral tokens (from `AuthTokenService.CreateToken`) are used with `BidiGenerateContentConstrained` "via an `access_token` query parameter or an HTTP Authorization header with `Token` prefixed" (i.e. `Authorization: Token <token>`, RFC 7235 auth-scheme). Browser `WebSocket()` cannot set headers, so the query-param form is the browser path.

**SDK cross-check** [SDK] (accessed 2026-09-24, `src/live.ts`): the SDK builds
`{wsBaseUrl}/ws/google.ai.generativelanguage.{apiVersion}.GenerativeService.{method}?{keyName}={apiKey}`, and if the API key string starts with `auth_tokens/` (the shape of a minted token's `name`), it switches `method` to `BidiGenerateContentConstrained` and `keyName` to `access_token`. The token value is therefore passed in place of the API key.

### 1.2 Auth: API key vs ephemeral token

The Live API "only provides server-to-server authentication by default"; client-to-server (browser/mobile direct) deployments are told to use ephemeral tokens [CAP] (2026-09-18), [EPH] (2026-09-15).

**Minting a token — exact REST call** [EPH] (2026-09-15):

```
curl -X POST "https://generativelanguage.googleapis.com/v1beta/auth_tokens" \
  -H "x-goog-api-key: ${GEMINI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "uses": 1,
    "expireTime": "2026-09-24T12:30:00Z",
    "newSessionExpireTime": "2026-09-24T12:01:00Z"
  }'
```

- Endpoint is `POST /v1beta/auth_tokens` (service `AuthTokenService.CreateToken` per [REF] 2026-09-04). **Note:** the docs method is `client.authTokens.create(...)` — *not* the older `tokens.create` naming; [EPH] explicitly corrects this. If you see `tokens.create` in older blog posts, that is not the current documented shape.
- Request fields [EPH] (2026-09-15), constraints from [REF] (2026-09-04):
  - `uses` — default `1`; `0` means unlimited. Session resumption/reconnection does **not** consume a use [REF].
  - `expireTime` — RFC 3339 / ISO timestamp. Default 30 minutes in the future; must be less than **20 hours** in the future [REF, 2026-09-04].
  - `newSessionExpireTime` — how long the token can still open a *new* session. Default **60 seconds** in the future ([EPH] says "1 minute"; [REF] says 60 seconds); same 20-hour cap.
  - `liveConnectConstraints` (optional) — locks the token to a model and/or setup fields, e.g. `{"model": "models/gemini-3.8-live", "sessionResumption": {}, "responseModalities": ["AUDIO"]}` [EPH].
- **Response:** the docs page documents only `token.name` — "pass the value under `token.name` back to your client" [EPH]. The token string itself (format `auth_tokens/...` per [SDK]) is what the browser puts in `access_token=`. **Ambiguity:** the response schema is not fully enumerated on [EPH]; [REF] mentions the service but the fetched reference extract did not include the full `AuthToken` response JSON. Treat `token.name` as the credential.
- SDK usage: `await client.authTokens.create({config: {...}})`; then in the client `new GoogleGenAI({apiKey: token.name})` [EPH]. The SDK currently prints a warning that ephemeral support is **v1alpha**-only (`httpOptions: {apiVersion: 'v1alpha'}`), while the docs pages show `v1beta` URLs — see Open Questions Q2.

**Do ephemeral tokens work browser-direct?** Yes — that is their documented purpose: "short-lived authentication tokens for WebSocket access... for client-to-server deployments where a browser/mobile app connects directly" [EPH] (2026-09-15). [WS] (2026-09-15) shows browser JavaScript (`new WebSocket(WS_URL)`) against the Constrained endpoint, and [TR] (2026-08-26) repeats "Ephemeral tokens recommended for client apps; REST via `POST .../v1beta/auth_tokens`".

### 1.3 Vertex vs AI Studio (one paragraph)

The docs covered here are explicitly the AI Studio / Gemini API flavor: "This content pertains to the Gemini API in AI Studio. For Vertex AI, use the Multimodal Live API on Vertex" [CAP] (2026-09-18). On Vertex the service is different: the js-genai SDK connects to `{wss base}/ws/google.cloud.aiplatform.{apiVersion}.LlmBidiService/BidiGenerateContent` with OAuth/ADC bearer headers instead of an API-key query param [SDK] (`src/live.ts`, accessed 2026-09-24); API-key query auth and ephemeral `auth_tokens` are documented only for `generativelanguage.googleapis.com`. **Caveat:** the official Vertex Multimodal Live API page (`cloud.google.com/vertex-ai/generative-ai/docs/multimodal-live`) redirected and 404'd during this research (2026-09-24), so the exact Vertex URL literal could not be verified from Google's own Vertex docs here — rely on the SDK source or the Vertex docs directly if Vertex matters to you.

---

## 2. Session setup message (`setup`)

The first client message **must** be `setup` (`BidiGenerateContentSetup`); wait for `setupComplete` before sending anything else [REF] (2026-09-04), [SDK] (`handleWebSocketMessage` remark: "the first message which is received from the server is a setupComplete message"). Config is immutable while connected; on resumption you may change parameters "except the model" [REF].

### 2.1 Complete literal example (speech-to-speech, manual values shown for VAD tuning)

```json
{
  "setup": {
    "model": "models/gemini-3.8-live",
    "generationConfig": {
      "responseModalities": ["AUDIO"],
      "speechConfig": {
        "voiceConfig": {
          "prebuiltVoiceConfig": { "voiceName": "Kore" }
        }
      },
      "temperature": 1.0
    },
    "systemInstruction": {
      "parts": [{ "text": "You are a helpful assistant." }]
    },
    "inputAudioTranscription": {},
    "outputAudioTranscription": {},
    "realtimeInputConfig": {
      "automaticActivityDetection": {
        "disabled": false,
        "startOfSpeechSensitivity": "START_SENSITIVITY_LOW",
        "endOfSpeechSensitivity": "END_SENSITIVITY_LOW",
        "prefixPaddingMs": 20,
        "silenceDurationMs": 100
      }
    },
    "sessionResumption": { "handle": null },
    "contextWindowCompression": {
      "slidingWindow": { "targetTokens": 8000 },
      "triggerTokens": 25000
    }
  }
}
```

Literal fragments verified against: setup skeleton `{\"setup\": {\"model\": \"models/gemini-3.8-live\", \"responseModalities\": [\"AUDIO\"], \"systemInstruction\": {\"parts\": [{\"text\": ...}]}}}` [WS] (2026-09-15); `generationConfig`-nested form `{"setup": {"model": ..., "generationConfig": {"responseModalities": ["TEXT"]}, "inputAudioTranscription": {"languageCodes": []}}}` [TR] (2026-08-26); `thinkingConfig` in `generationConfig` [THK] (2026-09-15); VAD example values [CAP] (2026-09-18); transcription configs [CAP]/[TR]. **Doc inconsistency:** [WS] shows `responseModalities` at the top of `setup`, while [REF]/[TR]/[THK] nest it under `generationConfig` (the reference schema has no top-level `responseModalities`). Test both; the `generationConfig` form matches the published schema (see Open Questions Q1).

### 2.2 Model IDs (exact strings)

| Model ID | Notes | Source |
|---|---|---|
| `models/gemini-3.8-live` | "Default option for most low-latency voice agent experiences." Interleaved reasoning with fixed latency profile; `thinkingLevel` **not supported** — omit `thinkingConfig`. | [CAP] 2026-09-18; [THK] 2026-09-15 |
| `models/gemini-3.8-live-extended-thinking` | Configurable background reasoning: `thinkingLevel: low | medium | high` (`minimal` **not** supported). Async (non-blocking) function calling only. | [CAP] 2026-09-18; [THK] 2026-09-15 |
| `models/gemini-3.1-flash-live-preview` | Legacy preview; `minimal`–`high` thinking, defaults `minimal`. No async function calling, no affective dialog / proactive audio. | [CAP] 2026-09-18 |
| `models/gemini-3.5-transcribe-live` | Separate transcription-only pipeline (audio in → text out, `responseModalities: ["TEXT"]`); not the conversational agent. | [TR] 2026-08-26 |

Cross-check: the pricing page groups exactly `gemini-3.8-live`, `gemini-3.8-live-extended-thinking`, `gemini-3.1-flash-live-preview` in one table [PRICE] (2026-09-24) — two independent confirmations of the 3.8 IDs. Beware: the capabilities guide's *code samples* still contain older IDs (`gemini-2.5-flash-native-audio-preview-12-2025`, `gemini-live-2.5-flash-preview`) in its lower sections — treat the comparison table and [WS]/[THK] as current.

### 2.3 Setup schema (field-by-field)

Per [REF] (2026-09-04) unless noted:

- `model` (string, required) — format `models/{model}`.
- `generationConfig` — documented subfields: `candidateCount`, `maxOutputTokens`, `temperature`, `topP`, `topK`, `presencePenalty`, `frequencyPenalty`, `responseModalities`, `speechConfig`, `mediaResolution`, `translationConfig` [REF listing, corroborated by CAP sample code]. **Unsupported subfields (documented as not supported):** `responseLogprobs`, `responseMimeType`, `logprobs`, `responseSchema`, `responseJsonSchema`, `stopSequence`, `skipResponseCache`, `routingConfig`, `audioTimestamp` [REF].
  - `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName` — string [CAP] (2026-09-18).
  - `thinkingConfig.thinkingLevel` — `"LOW" | "MEDIUM" | "HIGH"` for Extended Thinking only; omit entirely for base 3.8 [THK] (2026-09-15).
- `systemInstruction` — Content object; "only text should be used in parts" [REF]. Wire form `{"parts": [{"text": "..."}]}` [WS].
- `inputAudioTranscription`, `outputAudioTranscription` — `AudioTranscriptionConfig`; empty object `{}` enables; `languageCodes: []` = auto-detect (transcribe pipeline also allows explicit BCP-47 hints and `mode: VERBATIM|SMART`, `customVocabulary` up to 1,000 terms) [CAP] (2026-09-18), [TR] (2026-08-26).
- `realtimeInputConfig` — see below.
- `sessionResumption` — `{ handle: <string|null> }`; pass the `newHandle` from a previous `sessionResumptionUpdate`; `null` starts fresh [REF], [SM] (2026-09-15).
- `contextWindowCompression` — `triggerTokens` (default: 80% of the model context window) and/or `slidingWindow: { targetTokens }` (default `trigger_tokens/2`) [REF] (2026-09-04); SDK/doc form `contextWindowCompression: { slidingWindow: {} }` uses defaults [SM]; worked example 25,000 trigger / 8,000 target [BP] (2026-09-15). Enabling compression extends sessions "to an unlimited amount of time" [SM].
- `tools` — function declarations, `googleSearch`, code execution, URL context [REF]; for `gemini-3.8-live-extended-thinking`, tools must be async: `behavior: "NON_BLOCKING"` — synchronous blocking tools "return an error" [THK] (2026-09-15).
- Also documented on [REF]: `proactivity` (`{proactiveAudio: true}`, v1beta only) and `historyConfig`.
- Context window: 128k tokens for native-audio-output models; 32k for other Live models [CAP] (2026-09-18).

### 2.4 `realtimeInputConfig.automaticActivityDetection` — exact fields [REF] (2026-09-04), example values [CAP] (2026-09-18)

| Field | Type / values | Notes |
|---|---|---|
| `disabled` | bool | Default `false` (detection on). |
| `startOfSpeechSensitivity` | `START_SENSITIVITY_HIGH` \| `START_SENSITIVITY_LOW` | Unspecified defaults to `HIGH`. |
| `endOfSpeechSensitivity` | `END_SENSITIVITY_HIGH` \| `END_SENSITIVITY_LOW` | Unspecified defaults to `HIGH`. |
| `prefixPaddingMs` | int (ms) | Pre-speech look-back buffer; example `20`. Values near 0 can clip word onsets [CAP]. |
| `silenceDurationMs` | int (ms) | End-of-speech silence threshold. Docs example `100` (demo); recommended 500–800 ms; server default ≈ 800 ms; 100–200 ms fragments utterances; ≥2000 ms adds latency [CAP] (2026-09-18). |

Sibling fields on `realtimeInputConfig` [REF]: `activityHandling` (`START_OF_ACTIVITY_INTERRUPTS` — default, i.e. barge-in — or `NO_INTERRUPTION`) and `turnCoverage` (defaults: `TURN_INCLUDES_ONLY_ACTIVITY` for Gemini 2.5; `TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO` for Gemini 3.1+). Manual VAD = `disabled: true` + client `activityStart`/`activityEnd`; "an `audioStreamEnd` isn't sent in this configuration" and the client's own end-of-speech threshold should be at least 500 ms [CAP]. Hybrid VAD: server detects speech start, client sends `audioStreamEnd` to finalize immediately [CAP].

### 2.5 Preset voice names

The Live docs configure voices via `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName` and state that native-audio models use the Gemini TTS prebuilt voice set, but they do **not** print a Live-specific voice table (only `Kore` appears as the worked example) [CAP] (2026-09-18). The prebuilt set (30 voices, documented on the TTS page [VOICES] (2026-09-24); models listed there: Gemini 3.8 Flash TTS / Flash-Lite TTS, 3.1 Flash TTS Preview, 2.5 Pro Preview TTS):

Zephyr (Bright), Puck (Upbeat), Charon (Informative), Kore (Firm), Fenrir (Excitable), Leda (Youthful), Orus (Firm), Aoede (Breezy), Callirrhoe (Easy-going), Autonoe (Bright), Enceladus (Breathy), Iapetus (Clear), Umbriel (Easy-going), Algieba (Smooth), Despina (Smooth), Erinome (Clear), Algenib (Gravelly), Rasalgethi (Informative), Laomedeia (Upbeat), Achernar (Soft), Alnilam (Firm), Schedar (Even), Gacrux (Mature), Pulcherrima (Forward), Achird (Friendly), Zubenelgenubi (Casual), Vindemiatrix (Gentle), Sadachbia (Lively), Sadaltager (Knowledgeable), Sulafat (Warm).

**Flag:** which of these are valid for `gemini-3.8-live` specifically is not enumerated in the Live docs (see Open Questions Q3). There is also an Extended Voice Library via `GET /v1beta/voices` and voice design/replication on the TTS side [VOICES]; not documented for Live here.

---

## 3. Client → server messages

Every client JSON message contains "exactly one" of: `setup`, `clientContent`, `realtimeInput`, `toolResponse` [REF] (2026-09-04).

### 3.1 `realtimeInput` — streaming audio (inline base64 PCM16 16 kHz)

Exact wire JSON [WS] (2026-09-15):

```json
{
  "realtimeInput": {
    "audio": {
      "data": "<base64-encoded raw 16-bit PCM>",
      "mimeType": "audio/pcm;rate=16000"
    }
  }
}
```

- Format: "raw 16-bit PCM audio, 16 kHz, little-endian" (mono), base64-encoded; "The mimeType is crucial." [WS], [CAP] (2026-09-18), [TR] (2026-08-26). Any input sample rate is accepted (server resamples), but clients are told to resample (mic is often 44.1/48 kHz) down to 16 kHz themselves for latency [CAP], [BP] (2026-09-15).
- Chunking guidance: send 20–40 ms chunks when streaming; keep client buffering to 20–100 ms; do not buffer ~1 s before sending [BP] (2026-09-15). The transcription page illustrates 100 ms chunks (1,024–2,048 frames) [TR]. **No hard per-message size cap is documented anywhere** (see Open Questions Q6).
- `realtimeInput.mediaChunks[]` exists but is **deprecated** [REF] (2026-09-04).

### 3.2 `realtimeInput` — text

Exact wire JSON [WS] (2026-09-15):

```json
{ "realtimeInput": { "text": "hello" } }
```

Note: the raw-WebSocket guide sends text via `realtimeInput`, never via `clientContent` [WS].

### 3.3 `clientContent` — turn-based text/content, interrupts generation [REF] (2026-09-04)

```json
{
  "clientContent": {
    "turns": [ { "role": "user", "parts": [{ "text": "Good morning" }] } ],
    "turnComplete": true
  }
}
```

`turns[]` are `Content` objects appended to session history; `turnComplete: true` ends the turn; sending `clientContent` **unconditionally interrupts** in-flight generation (`turn_complete=true` interrupts; all three current models support `clientContent` across the session lifecycle) [REF], [CAP] (2026-09-18).

### 3.4 Manual VAD markers — `activityStart` / `activityEnd`

Sent inside `realtimeInput`, only when automatic activity detection is disabled [REF] (2026-09-04), [CAP]:

```json
{ "realtimeInput": { "activityStart": {} } }
{ "realtimeInput": { "activityEnd": {} } }
```

The docs reference the field names (`activity_start`/`activity_end` in SDK snake_case, `activityStart`/`activityEnd` on the wire) but do not print a raw literal with any payload — they are marker branches; **payload shape (empty object) is inferred from the schema, not quoted in docs** (Open Questions Q7).

### 3.5 `audioStreamEnd` (hybrid VAD)

`realtimeInput.audioStreamEnd` — "only when [automatic detection is] enabled"; sending it finalizes the turn immediately (server VAD remains the fallback) [REF] (2026-09-04), [CAP], [TR]. Same caveat: no raw literal with payload is printed in the docs.

### 3.6 `toolResponse` [WS] (2026-09-15), [REF]

```json
{
  "toolResponse": {
    "functionResponses": [
      { "name": "get_weather", "id": "<id from toolCall.functionCalls[].id>", "response": { "temperature": 20 } }
    ]
  }
}
```

Function responses are matched by `id` [REF]; the SDK requires the `id` field on Gemini AI ("FunctionResponse request must have an `id` field from the response of a ToolCall.FunctionalCalls") [SDK].

### 3.7 `sessionResumptionUpdate` (client → server): **does not exist**

The docs define `sessionResumptionUpdate` only as a **server → client** message (Section 4.6). The only documented client-side resumption input is `setup.sessionResumption.handle` [REF] (2026-09-04), [SM] (2026-09-15). If a plan assumes a client-sent resumption update, correct it.

### 3.8 `setup`

See Section 2. Must be the first message; nothing else may be sent until `setupComplete` [REF].

---

## 4. Server → client messages

All arrive as one JSON object per WebSocket text frame — `BidiGenerateContentServerMessage`, a union carrying exactly one of: `setupComplete`, `serverContent`, `toolCall`, `toolCallCancellation`, `goAway`, `sessionResumptionUpdate`, plus top-level `usageMetadata` [REF] (2026-09-04). [SDK] parses `event.data` as Blob/ArrayBuffer/string → JSON and surfaces the first `setupComplete` before resolving the session.

### 4.1 `serverContent.modelTurn` — model audio chunks

```json
{
  "serverContent": {
    "modelTurn": {
      "parts": [
        { "inlineData": { "mimeType": "audio/pcm;rate=24000", "data": "<base64 PCM>" } }
      ]
    }
  }
}
```

- Audio chunks are base64 in `parts[].inlineData.data` [WS] (2026-09-15).
- Output is always **24 kHz** sample rate [CAP] (2026-09-18); the literal output MIME `audio/pcm;rate=24000` appears in [THK] (2026-09-15) `modelTurn.parts` examples. (16-bit linear PCM implied by the `audio/pcm` family and the "raw 16-bit PCM" phrasing for input; the output bit-depth is not separately restated — see Open Questions Q8.)
- For Extended Thinking, a single server event can contain multiple content parts (e.g. filler speech then final answer spans multiple turns) [CAP].

### 4.2 Turn lifecycle: `turnComplete`, `generationComplete`, `interrupted`

All are booleans **inside `serverContent`** [REF] (2026-09-04):

- `serverContent.turnComplete: true` — the model finished the turn. Base `gemini-3.8-live`: "closes the turn and returns to idle" [THK]. **Extended Thinking:** fires **per utterance** and "does not indicate an idle session" — gate on `serverContent.interactionStatus` being `"IDLE"` instead; `IN_PROGRESS` means more is coming [CAP] (2026-09-18), [THK] (2026-09-15).
- `serverContent.generationComplete` — "the model finished generating the response" [SM] (2026-09-15), [REF]; use for UI state / next-action decisions [BP].
- `serverContent.interrupted: true` — **the barge-in / interruption event.** Exact name on the wire: `interrupted`, a boolean field of `serverContent` (SDK: `server_content.interrupted` / `serverContent.interrupted`) [REF], [CAP], [BP]. It is not a standalone message type.

**How interruption discards in-flight audio** [CAP] (2026-09-18), [BP] (2026-09-15): when VAD detects user speech during generation (`activityHandling: START_OF_ACTIVITY_INTERRUPTS`, the default [REF]), the server *cancels and discards* the ongoing generation — in-flight model audio after `interrupted` should never be played; the client must "immediately discard your client-side audio buffer" (stop playback, clear the playback queue). Only client-delivered data persists in session history; the server also cancels pending function calls and reports their IDs via `toolCallCancellation.ids` [REF], [CAP].

Other documented `serverContent` fields [REF]: `groundingMetadata`, `urlContextMetadata`, `waitingForInput`, `interactionStatus`, `speechState` (deprecated), `inputTranscription`, `interimInputTranscription`, `outputTranscription` (below).

### 4.3 Transcription events

- User speech: `serverContent.inputTranscription.text` — finalized transcript, emitted when the speaker pauses / turn completes / speech finalizes; `serverContent.interimInputTranscription.text` — "low-latency, speculative partial hypotheses updated while the speaker is actively talking" [TR] (2026-08-26), field names also in [REF] and [WS]. Requires `inputAudioTranscription` in setup.
- Model speech: `serverContent.outputTranscription.text` — arrives in incremental text chunks as the model speaks; requires `outputAudioTranscription: {}` in setup [WS] (2026-09-15), [CAP] (2026-09-18). The docs do not describe an interim variant for output — only `interimInputTranscription` exists [REF] (2026-09-04).
- `usageMetadata` (top-level) carries token counts (`totalTokenCount`, response token details) [REF], [CAP].

### 4.4 `goAway` — session-ending warning [REF] (2026-09-04), [SM]/[BP] (2026-09-15)

```json
{ "goAway": { "timeLeft": "10s" } }
```

- Exact field: `goAway.timeLeft` (a duration; the literal unit string is not shown in docs — SDK exposes `goAway.timeLeft`, Python `go_away.time_left`). It "signals that the current connection will soon be terminated"; use it to wrap up or reconnect before close [BP]. After `goAway`, the connection closes as **`ABORTED`** [SM].
- [REF]: `timeLeft` is never below a model-specific minimum — **the actual lead-time value is not published** (Open Questions Q4).

### 4.5 `toolCall` / `toolCallCancellation`

`toolCall.functionCalls[]` (each with `id`, `name`, `args`); `toolCallCancellation.ids[]` lists cancelled calls on interruption [REF] (2026-09-04), [WS].

### 4.6 `sessionResumptionUpdate` — resumption handle [REF] (2026-09-04), [SM]/[BP] (2026-09-15)

```json
{ "sessionResumptionUpdate": { "newHandle": "<opaque string>", "resumable": true } }
```

- Sent periodically by the server ("may contain a handle" — exact cadence unspecified). Store the latest `newHandle`; pass it as `setup.sessionResumption.handle` on reconnect. `resumable` indicates whether the session can currently be resumed.
- What the handle preserves is **not itemized in the docs** (see Open Questions Q5); [SM] only says resumption restores the session (vs. losing it when the connection dies), and [EPH] shows reconnection every ~10 minutes with the same token.

### 4.7 `setupComplete`

`{"setupComplete": {}}` — sent immediately after `setup` is accepted; gate all other sends on it [REF], [SDK].

---

## 5. Session limits & resumption semantics

| Limit | Value | Source (date) |
|---|---|---|
| Session duration, audio-only | **15 minutes** | [CAP] 2026-09-18; [SM] 2026-09-15; [BP] 2026-09-15 (three independent doc pages) |
| Session duration, audio+video | **2 minutes** | same three pages |
| Single connection lifetime | ~**10 minutes** ("The lifetime of a connection is limited as well, to around 10 minutes") | [SM] 2026-09-15 |
| Extending sessions | `contextWindowCompression` enables "unlimited extensions on session duration"; session-management techniques (resumption) likewise | [SM] 2026-09-15, [CAP] 2026-09-18 |
| Resumption handle validity | **2 hours** after the last session terminates ("Resumption tokens are valid for 2 hr after the last sessions termination") | [SM] 2026-09-15; corroborated [BP] 2026-09-15 ("valid for 2 hours after the last session terminates") |
| `goAway` lead time | `timeLeft` never below a model-specific minimum; numeric value not published | [REF] 2026-09-04 |
| Context window | 128k tokens (native audio output models) / 32k (other Live models); native audio accumulates ~25 tokens per second of audio | [CAP] 2026-09-18; [BP] 2026-09-15 |
| Compression defaults | `triggerTokens` = 80% of context window; `slidingWindow.targetTokens` = trigger/2 | [REF] 2026-09-04 |
| Live Transcribe pipeline (separate model) | 10-minute sessions; no word-level timestamps; no diarization | [TR] 2026-08-26 |

**Resumption semantics (what is documented):** pass `sessionResumption: {handle}` in setup on reconnect; server streams `sessionResumptionUpdate.newHandle` during the session; reconnection with the stored handle resumes the session; a resumption does not consume an ephemeral token `use`, and the same token may be reused for ~10-minute reconnects within its `expireTime` even with `uses: 1` [REF], [SM], [EPH]. **Not documented:** exactly which state survives (history? compressed context? tool call state? last model turn?) — Open Questions Q5. Community reports (discuss.ai.google.dev threads found via search, 2026-09-24) note `sessionResumptionUpdate` is not sent every turn and stale handles (~12 h) fail with "session not found"; treat as anecdotes, not spec.

**Rate limits / quotas:** the rate-limits page publishes **no per-model Live API quotas**; it says limits "depend on a variety of factors (such as your usage tier) and can be viewed in Google AI Studio", limits are per project (not per API key), and lists only rolling **spend limits** per 10 minutes: Free N/A, Tier 1 $10, Tier 2 $50, Tier 3 $200; exceeding returns `429 RESOURCE_EXHAUSTED` [RL] (2026-09-02). Live model quotas must be read from the AI Studio rate-limit dashboard.

---

## 6. Pricing snapshot [PRICE] (2026-09-24)

All three conversational Live models — `gemini-3.8-live`, `gemini-3.8-live-extended-thinking`, `gemini-3.1-flash-live-preview` — share **one** pricing table (no per-model price differences listed):

| Component | Paid tier |
|---|---|
| Audio input | **$3.00 / 1M tokens — equivalent $0.005 / minute** |
| Text input | $0.75 / 1M tokens |
| Image/video input | $1.00 / 1M tokens — equivalent $0.002 / minute |
| Text output (incl. thinking tokens) | $4.50 / 1M tokens |
| Audio output | **$12.00 / 1M tokens — equivalent $0.018 / minute** |
| Grounding w/ Google Search | 5,000 free requests/month shared across Gemini 3.x, then $14 / 1,000 |
| Free tier | Input and output "Free of charge" for these live models (data used to improve products; paid tier is not) |

The per-minute figures are Google's own equivalent rates shown alongside per-1M-token rates in the same table rows.

---

## 7. Browser constraints

- **Raw WebSocket from the browser is supported and documented.** The raw-WebSocket guide is written around browser JavaScript: `new WebSocket(WS_URL)`, `onopen` → send `setup`, `onmessage` → `JSON.parse(event.data)` and branch on `serverContent` / `toolCall`, plus `onerror`/`onclose` [WS] (2026-09-15). The API-key form (`?key=`) works from the browser but exposes the key; the docs direct client-to-server deployments to ephemeral tokens on the `BidiGenerateContentConstrained` endpoint with `access_token=` [EPH] (2026-09-15), [WS].
- The **js-genai SDK is not required** — it is a thin wrapper: `ai.live.connect(params)` builds the same URL (Section 1.1), injects the key/token as a query param, and uses an injectable `WebSocketFactory` (browser `WebSocket` works) [SDK] (`src/live.ts`, `src/_websocket.ts`, accessed 2026-09-24). One caveat: the SDK's ephemeral-token path currently warns it targets **v1alpha** while docs use **v1beta** (Open Questions Q2).
- **CORS/origin restrictions:** not documented anywhere on the pages reviewed. (WebSocket handshake origin checking is server-side and invisible to `WebSocket()` clients; Google documents no allowed-origin policy for Live.) Open Questions Q9.
- **Keepalive/ping:** no client ping/keepalive interval is documented. The docs say only "You are responsible for maintaining the WebSocket connection" [WS] (2026-09-15), and "The server may periodically reset the WebSocket connection" — handle reconnect + resumption [BP] (2026-09-15). Community reports exist of closures after ~2–3 min of inactivity without `goAway` (anecdotal, discuss.ai.google.dev, found 2026-09-24).
- **Output audio confirmed at 24 kHz linear PCM**: "Audio output always uses a sample rate of 24kHz" [CAP] (2026-09-18), delivered as base64 `inlineData` with `mimeType: "audio/pcm;rate=24000"` [THK] (2026-09-15). Input is 16 kHz/16-bit little-endian PCM (`audio/pcm;rate=16000`) [WS], [CAP], [TR].
- The browser cannot set the `Authorization: Token ...` header on `WebSocket()`, so the `access_token` query parameter is the usable browser-direct auth form [EPH] + Web platform constraint.

---

## 8. Open questions (explicit)

1. **`responseModalities` placement.** The raw-WebSocket guide's setup example puts `responseModalities` at the top level of `setup`; the API reference and the transcription/thinking pages nest it under `setup.generationConfig`, and the reference schema has no top-level copy. Docs are inconsistent; empirically test which the server accepts (likely both, but unverified).
2. **Ephemeral-token API version.** Docs pages (2026-09-15) mint and connect with **v1beta** (`POST /v1beta/auth_tokens`, v1beta Constrained endpoint). The js-genai SDK `main` source (accessed 2026-09-24) warns ephemeral support is **v1alpha only** and instructs `httpOptions: {apiVersion: 'v1alpha'}`. Both are Google sources; which version a raw browser client should use in production is ambiguous — test v1beta first (it is what the docs print) and fall back to v1alpha.
3. **Voice set for 3.8 Live.** Live docs show only `Kore` and say native-audio models use the TTS prebuilt voice set; the 30-voice table lives on the TTS page, which explicitly does not document Live compatibility. No Live-specific voice list is published.
4. **`goAway` lead time.** Documented only as "never below a model-specific minimum"; no seconds value anywhere.
5. **Resumption state preserved.** Docs never itemize what `sessionResumption.handle` restores (raw history vs. compressed context; tool-call continuity; in-flight turn). Update cadence of `sessionResumptionUpdate` is likewise unspecified ("periodically... may contain a handle").
6. **Message size / throughput caps.** No maximum WebSocket frame/message size, no minimum send rate, no documented backpressure. Only guidance values (20–40 ms streaming chunks; 20–100 ms buffering) exist.
7. **Marker-message payload literals.** `activityStart`, `activityEnd`, `audioStreamEnd` are documented as branches of `realtimeInput`, but no doc prints a full raw literal; the empty-object payloads above are schema-inferred, not quoted.
8. **Output bit depth.** Output is "24kHz" with MIME `audio/pcm;rate=24000`; 16-bit signed linear is strongly implied but not separately stated for output (input's "raw 16-bit PCM" phrasing is input-side).
9. **Origin/CORS policy.** No documented allowed-origin restrictions or requirements for browser WebSockets; unknown whether Google enforces origin checks on the Live handshake.
10. **Live rate limits.** No per-model RPM/RPD/TPM published; only spend tiers and the AI Studio dashboard.
11. **Stale doc samples.** The capabilities guide's code samples still reference `gemini-2.5-flash-native-audio-preview-12-2025` / `gemini-live-2.5-flash-preview` in later sections while its comparison table lists the 3.8 models; one fetched snapshot of the guide also differed in language count (70 vs 99) — the page appears partially updated. Trust the model-comparison table, [WS], [THK], and [PRICE] for current IDs.
12. **`BidiGenerateContentServerContent.outputTranscription` streaming granularity** (chunk cadence, whether chunks are deltas or cumulative) is not specified beyond "text".

---

## Sources (all accessed 2026-09-24)

| # | Page | URL | Page "Last updated" |
|---|---|---|---|
| [REF] | Live API reference (BidiGenerateContent) | https://ai.google.dev/api/live | 2026-09-04 |
| [CAP] | Live API capabilities guide | https://ai.google.dev/gemini-api/docs/live-guide | 2026-09-18 |
| [WS] | Get started with raw WebSockets | https://ai.google.dev/gemini-api/docs/live-api/get-started-websocket | 2026-09-15 |
| [EPH] | Ephemeral tokens | https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens | 2026-09-15 |
| [SM] | Session management | https://ai.google.dev/gemini-api/docs/live-api/session-management | 2026-09-15 |
| [BP] | Best practices | https://ai.google.dev/gemini-api/docs/live-api/best-practices | 2026-09-15 |
| [THK] | Thinking in the Live API | https://ai.google.dev/gemini-api/docs/live-api/thinking | 2026-09-15 |
| [TR] | Live Transcribe | https://ai.google.dev/gemini-api/docs/live-api/live-transcribe | 2026-08-26 |
| [PRICE] | Pricing | https://ai.google.dev/gemini-api/docs/pricing | 2026-09-24 |
| [RL] | Rate limits | https://ai.google.dev/gemini-api/docs/rate-limits | 2026-09-02 |
| [VOICES] | Speech generation (voices) | https://ai.google.dev/gemini-api/docs/speech-generation | 2026-09-24 |
| [SDK] | js-genai source & docs | https://github.com/googleapis/js-genai (`src/live.ts`, `src/_websocket.ts`, `src/_api_client.ts`); https://googleapis.github.io/js-genai/release_docs/classes/live.Live.html | accessed 2026-09-24 |
| — | Live API docs index (URL discovery) | https://ai.google.dev/gemini-api/docs/live-api | accessed 2026-09-24 |
| — | Vertex Multimodal Live docs (unreachable: 301 → 404 during research) | https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal-live | — |
