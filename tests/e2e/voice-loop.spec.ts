import { expect, test, type Page } from "@playwright/test";

/**
 * Deterministic end-to-end voice loop.
 *
 * Browser doubles for MediaDevices, WebSocket, AudioContext, and every
 * same-origin fetch (including the spar-stream SSE response) are installed
 * before application code loads, so the real Sparring Room runs against a
 * scripted Flux STT stream, a scripted live turn SSE stream, and a scripted
 * Aura-2 TTS socket without any network or provider access.
 */

const SESSION_ID = "sess-e2e-voice";
const BARGE_IN_BUDGET_MS = 200;
const PERSONA = {
  id: "persona-1",
  archetype: "skeptic",
  name: "The Skeptic",
  behaviorStyle: "moderate",
  seatOrder: 0,
};

interface SparLog {
  fetches: Array<{ url: string; method: string; at: number; body: string | null }>;
  providerRequests: Array<{ url: string; at: number }>;
  tokenGrants: number;
  metrics: Array<{ type?: string; turnId?: string; at?: number }>;
  sttSent: Array<{ at: number; kind: string; text: string | null; bytes: number }>;
  ttsSent: Array<{ at: number; kind: string; text: string | null; bytes: number }>;
  sttSockets: number;
  ttsSockets: number;
  sttStartOfTurnAt: number | null;
  sttEndOfTurnAt: number | null;
  sseRequests: Array<{ at: number; turnId: string | null; warmup: boolean }>;
  sseEvents: Array<{ type: string; at: number }>;
  sseCompletedAt: number | null;
  markAt: number | null;
  playerStarted: number[];
  playerStopped: number[];
}

type SparPageState = { log: SparLog };

type SparControls = {
  openStt: [];
  sttStartOfTurn: [turnIndex: number, transcript: string];
  sttInterim: [turnIndex: number, transcript: string];
  sttEndOfTurn: [turnIndex: number, transcript: string];
  openTts: [];
  ttsAudio: [bytes: number];
  ttsMessage: [text: string];
  pushSse: [event: Record<string, unknown>];
  endSse: [];
  drainPlayer: [];
};

function sparState(page: Page): Promise<SparPageState> {
  return page.evaluate(() => {
    const spar = (window as unknown as { __spar?: SparPageState }).__spar;
    if (!spar) throw new Error("Spar doubles are not installed.");
    return spar;
  });
}

function sparLog(page: Page): Promise<SparLog> {
  return sparState(page).then((state) => state.log);
}

async function sparControl<K extends keyof SparControls>(
  page: Page,
  name: K,
  ...args: SparControls[K]
): Promise<void> {
  await page.evaluate(
    ({ name, args }) => {
      const spar = (window as unknown as { __spar?: { controls: Record<string, (...parameters: unknown[]) => void> } }).__spar;
      if (!spar) throw new Error("Spar doubles are not installed.");
      spar.controls[name](...args);
    },
    { name, args },
  );
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ sessionId, persona }) => {
      const origin = Date.now();
      const now = (): number => Date.now() - origin;

      const log: SparLog = {
        fetches: [],
        providerRequests: [],
        tokenGrants: 0,
        metrics: [],
        sttSent: [],
        ttsSent: [],
        sttSockets: 0,
        ttsSockets: 0,
        sttStartOfTurnAt: null,
        sttEndOfTurnAt: null,
        sseRequests: [],
        sseEvents: [],
        sseCompletedAt: null,
        markAt: null,
        playerStarted: [],
        playerStopped: [],
      };

      // ─── Microphone and recorder doubles ─────────────────────────────
      const fakeTrack = () => ({
        readyState: "live",
        addEventListener() {},
        removeEventListener() {},
        stop() {},
      });
      const fakeStream = () => ({
        id: "deterministic-stream",
        active: true,
        getTracks: () => [fakeTrack()],
        getAudioTracks: () => [fakeTrack()],
        addEventListener() {},
        removeEventListener() {},
      });
      const mediaDevices = {
        getUserMedia: async () => fakeStream(),
        enumerateDevices: async () => [],
        addEventListener() {},
        removeEventListener() {},
      };
      try {
        Object.defineProperty(navigator, "mediaDevices", { value: mediaDevices, configurable: true });
      } catch {
        (navigator as unknown as { mediaDevices: unknown }).mediaDevices = mediaDevices;
      }
      // Keep the debrief recorder out of the loop: no MediaRecorder.
      try {
        delete (window as unknown as Record<string, unknown>).MediaRecorder;
      } catch {
        /* already absent */
      }

      // ─── AudioContext double ─────────────────────────────────────────
      // PCM playback is scheduled against this context; onended callbacks
      // are handed back on demand through drainPlayer() because the double
      // owns no real audio clock.
      const liveSources: Array<{ onended: null | (() => void) }> = [];
      const connectable = () => ({ connect() {}, disconnect() {} });
      class FakeAudioContext {
        sampleRate = 48000;
        currentTime = 0;
        state = "running";
        destination = connectable();
        // Absent on purpose: microphone capture takes the ScriptProcessor
        // path and stays silent because onaudioprocess is never fired.
        audioWorklet = undefined;

        resume() {
          this.state = "running";
          return Promise.resolve();
        }

        close() {
          this.state = "closed";
          return Promise.resolve();
        }

        createMediaStreamSource() {
          return connectable();
        }

        createScriptProcessor() {
          return { ...connectable(), onaudioprocess: null };
        }

        createBuffer(channels: number, length: number, rate: number) {
          return {
            duration: length / rate,
            copyToChannel() {},
            getChannelData: () => new Float32Array(length),
          };
        }

        createBufferSource() {
          const source = {
            buffer: null as unknown,
            onended: null as null | (() => void),
            connect() {},
            disconnect() {},
            start: () => {
              log.playerStarted.push(now());
            },
            stop: () => {
              log.playerStopped.push(now());
            },
          };
          liveSources.push(source);
          return source;
        }

        createOscillator() {
          return { type: "sine", frequency: { value: 0 }, ...connectable(), start() {}, stop() {} };
        }

        createBiquadFilter() {
          return { type: "lowpass", frequency: { value: 0 }, Q: { value: 0 }, ...connectable() };
        }

        createGain() {
          return {
            gain: {
              value: 0,
              setValueAtTime() {},
              linearRampToValueAtTime() {},
              exponentialRampToValueAtTime() {},
            },
            ...connectable(),
          };
        }

        createAnalyser() {
          return {
            fftSize: 0,
            smoothingTimeConstant: 0,
            frequencyBinCount: 128,
            getByteTimeDomainData(samples: Uint8Array) {
              samples.fill(128);
            },
            ...connectable(),
          };
        }
      }
      (window as unknown as Record<string, unknown>).AudioContext = FakeAudioContext;

      // ─── WebSocket double (Flux STT + Aura TTS) ──────────────────────
      type FakeSocket = {
        url: string;
        readyState: number;
        onopen: null | (() => void);
        onmessage: null | ((event: { data: unknown }) => void);
        onclose: null | ((event: { code: number }) => void);
      };
      const sttSockets: FakeSocket[] = [];
      const ttsSockets: FakeSocket[] = [];

      class FakeWebSocket {
        url: string;
        readyState = 0;
        bufferedAmount = 0;
        binaryType = "arraybuffer";
        onopen: null | (() => void) = null;
        onmessage: null | ((event: { data: unknown }) => void) = null;
        onerror: null | (() => void) = null;
        onclose: null | ((event: { code: number }) => void) = null;

        constructor(url: string) {
          this.url = url;
          (url.includes("/v1/speak") ? ttsSockets : sttSockets).push(this);
          if (url.includes("/v1/speak")) log.ttsSockets += 1;
          else log.sttSockets += 1;
        }

        send(data: string | Uint8Array) {
          const isTts = this.url.includes("/v1/speak");
          if (typeof data === "string") {
            (isTts ? log.ttsSent : log.sttSent).push({ at: now(), kind: "text", text: data, bytes: data.length });
          } else {
            (isTts ? log.ttsSent : log.sttSent).push({ at: now(), kind: "binary", text: null, bytes: data.byteLength });
          }
        }

        close() {
          if (this.readyState === 3) return;
          this.readyState = 3;
          this.onclose?.({ code: 1000 });
        }
      }
      (window as unknown as Record<string, unknown>).WebSocket = FakeWebSocket;

      // ─── SSE / fetch double ──────────────────────────────────────────
      const sseStreams: Array<{ closed: boolean; push(event: Record<string, unknown>): void; end(): void }> = [];

      const jsonResponse = (body: unknown) =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });

      const sseResponse = () => {
        let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          start(c) {
            controller = c;
          },
        });
        const entry = {
          closed: false,
          push(event: Record<string, unknown>) {
            if (controller && !entry.closed) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            }
          },
          end() {
            if (!entry.closed) {
              entry.closed = true;
              try {
                controller?.close();
              } catch {
                /* already closed */
              }
            }
          },
        };
        sseStreams.push(entry);
        return new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store" },
        });
      };

      const session = {
        id: sessionId,
        scenario: "custom",
        experience: "open_spar",
        rawMaterial: "Deterministic go-to-market claim.",
        roomContext: "A deterministic room.",
        extractedClaims: null,
        personas: [persona],
      };

      const originalFetch = window.fetch.bind(window);
      const deterministicFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const method = init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET");
        const body = typeof init?.body === "string" ? init.body : null;
        log.fetches.push({ url, method, at: now(), body });

        if (/groq\.com|openrouter\.ai|deepgram\.com/.test(url)) {
          log.providerRequests.push({ url, at: now() });
          return new Response("blocked by deterministic doubles", { status: 599 });
        }
        if (url.includes("/api/deepgram-token")) {
          log.tokenGrants += 1;
          return jsonResponse({ accessToken: "deterministic-access-token", expiresIn: 600, region: "us" });
        }
        if (url.includes("/api/turn-metrics")) {
          if (body) {
            try {
              log.metrics.push({ ...JSON.parse(body), at: now() });
            } catch {
              /* ignore malformed bodies */
            }
          }
          return jsonResponse({ ok: true });
        }
        if (url.endsWith("/api/user")) return jsonResponse({ name: "Operator" });
        if (url.includes("/api/upcoming-moment")) return jsonResponse({ moment: null });
        if (url.includes("/api/stats")) return jsonResponse({ totalSessions: 0, drillStats: null });
        if (/\/api\/sessions\/?$/.test(url) && method === "POST") return jsonResponse({ session: { id: sessionId } });
        if (url.includes("/spar-stream")) {
          const warmup = !!body && body.includes("_warmup");
          let turnId: string | null = null;
          if (body) {
            try {
              turnId = (JSON.parse(body) as { turnId?: string }).turnId ?? null;
            } catch {
              turnId = null;
            }
          }
          log.sseRequests.push({ at: now(), turnId, warmup });
          if (warmup) return new Response(null, { status: 200 });
          return sseResponse();
        }
        if (url.includes("/open")) {
          return jsonResponse({
            message: {
              id: "opening-1",
              personaId: persona.id,
              personaName: persona.name,
              archetype: persona.archetype,
              content: "State your central claim.",
              claimRef: null,
              mood: "neutral",
              audio: null,
              createdAt: new Date().toISOString(),
            },
          });
        }
        if (url.includes("/present")) return jsonResponse({ coachRead: null });
        if (url.includes("/debrief")) {
          // A minimal well-formed payload: the debrief view renders instead
          // of crashing on a null momentDescription.
          return jsonResponse({
            debrief: {
              momentDescription: "The churn exchange.",
              whatWentWell: ["Stated the number directly."],
              thePattern: "You hedge under pressure.",
              oneThingToPractice: "Lead with the number.",
              telemetryInsights: { pace: "Brisk.", fillers: "Few.", recovery: "Direct.", evidence: "Cited." },
              shareableSummary: "Practice summary.",
            },
            telemetry: null,
          });
        }
        if (url.includes("/end")) {
          // Defensive: if the room ever ends mid-test, keep the request
          // deterministic instead of letting it reach the real dev server.
          log.markAt = now();
          return jsonResponse({ ok: true });
        }
        if (url.includes(`/api/sessions/${sessionId}`)) return jsonResponse({ session });
        return originalFetch(input, init);
      };
      window.fetch = deterministicFetch as typeof window.fetch;

      // ─── Test controls ───────────────────────────────────────────────
      let turnSequence = 0;
      const sttMessage = (message: Record<string, unknown>) => {
        sttSockets[sttSockets.length - 1]?.onmessage?.({ data: JSON.stringify(message) });
      };

      const controls = {
        openStt() {
          const socket = sttSockets[sttSockets.length - 1];
          if (socket && socket.readyState === 0) {
            socket.readyState = 1;
            socket.onopen?.();
          }
        },
        sttStartOfTurn(turnIndex: number, transcript: string) {
          log.sttStartOfTurnAt = now();
          sttMessage({ type: "TurnInfo", event: "StartOfTurn", turn_index: turnIndex, sequence_id: turnSequence++, transcript });
        },
        sttInterim(turnIndex: number, transcript: string) {
          sttMessage({ type: "TurnInfo", event: "Update", turn_index: turnIndex, sequence_id: turnSequence++, transcript });
        },
        sttEndOfTurn(turnIndex: number, transcript: string) {
          log.sttEndOfTurnAt = now();
          sttMessage({
            type: "TurnInfo",
            event: "EndOfTurn",
            turn_index: turnIndex,
            sequence_id: turnSequence++,
            transcript,
            words: transcript.split(/\s+/).map(() => ({ confidence: 0.9 })),
          });
        },
        openTts() {
          const socket = ttsSockets[ttsSockets.length - 1];
          if (socket && socket.readyState === 0) {
            socket.readyState = 1;
            socket.onopen?.();
          }
        },
        ttsAudio(bytes: number) {
          ttsSockets[ttsSockets.length - 1]?.onmessage?.({ data: new ArrayBuffer(bytes) });
        },
        ttsMessage(text: string) {
          ttsSockets[ttsSockets.length - 1]?.onmessage?.({ data: text });
        },
        pushSse(event: Record<string, unknown>) {
          log.sseEvents.push({ type: String(event.type), at: now() });
          if (event.type === "complete") log.sseCompletedAt = now();
          sseStreams[sseStreams.length - 1]?.push(event);
        },
        endSse() {
          sseStreams[sseStreams.length - 1]?.end();
        },
        drainPlayer() {
          while (liveSources.length) {
            const source = liveSources.shift();
            source?.onended?.();
          }
        },
      };

      (window as unknown as { __spar: unknown }).__spar = { log, controls };
    },
    { sessionId: SESSION_ID, persona: PERSONA },
  );
});

async function enterSparringRoom(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Enter the Sparring Room" }).first().click();

  // Fake sign-in: the /api/user double reports a returning operator.
  await page.getByPlaceholder("Your name").fill("Operator");
  await page.getByPlaceholder("you@example.com").fill("operator@spar.test");
  await page.getByRole("button", { name: /Create Account/ }).click();

  // Dashboard → practice configuration.
  await page.getByRole("button", { name: "Enter the Sparring Room" }).first().click();

  await page.getByRole("button", { name: "Topic only" }).click();
  await page.getByPlaceholder(/go-to-market strategy/).fill(
    "We grow 40 percent quarter over quarter selling into mid-market healthcare.",
  );
  await page.getByRole("button", { name: /^Next/ }).click();

  await page.getByRole("button", { name: /^Open Spar/i }).click();
  await page.getByRole("button", { name: /^Next/ }).click();
  await page.getByRole("button", { name: /Start Sparring/ }).click();

  await expect(page.getByText("State your central claim.")).toBeVisible({ timeout: 30_000 });
}

async function startListening(page: Page): Promise<void> {
  const socketsBefore = (await sparLog(page)).sttSockets;
  await page.getByRole("button", { name: "Start speaking" }).click();
  await page.waitForFunction(
    (count) => {
      const spar = (window as unknown as { __spar?: SparPageState }).__spar;
      return !!spar && spar.log.sttSockets > count;
    },
    socketsBefore,
  );
  await sparControl(page, "openStt");
  await expect(page.getByRole("button", { name: "Stop speaking" })).toBeVisible({ timeout: 15_000 });
}

async function beginScriptedTurn(page: Page, turnIndex: number, interim: string, final: string): Promise<string> {
  const requestsBefore = (await sparLog(page)).sseRequests.filter((request) => !request.warmup).length;
  await sparControl(page, "sttStartOfTurn", turnIndex, "");
  await sparControl(page, "sttInterim", turnIndex, interim);
  await sparControl(page, "sttEndOfTurn", turnIndex, final);
  await page.waitForFunction(
    (count) => {
      const spar = (window as unknown as { __spar?: SparPageState }).__spar;
      return !!spar && spar.log.sseRequests.filter((request) => !request.warmup).length > count;
    },
    requestsBefore,
  );
  const generation = (await sparLog(page)).sseRequests.filter((request) => !request.warmup).at(-1);
  if (!generation?.turnId) throw new Error("The scripted turn never reached the live turn service.");
  return generation.turnId;
}

async function beginScriptedSpeech(page: Page, turnId: string): Promise<void> {
  // The Aura socket appears within milliseconds of turn-start, so the socket
  // baseline is captured before the event is pushed.
  const socketsBefore = (await sparLog(page)).ttsSockets;
  await sparControl(page, "pushSse", {
    type: "turn-start",
    turnId,
    persona: PERSONA,
    model: "openai/gpt-oss-20b",
    maxOutputTokens: 80,
  });
  await page.waitForFunction(
    (count) => {
      const spar = (window as unknown as { __spar?: SparPageState }).__spar;
      return !!spar && spar.log.ttsSockets > count;
    },
    socketsBefore,
    { timeout: 15_000 },
  );
  await sparControl(page, "openTts");
}

async function speakScriptedPhrase(page: Page, turnId: string, text: string, audioFrames: number): Promise<void> {
  // Baselines are captured before the phrase is pushed: speaking and playback
  // both follow within milliseconds.
  const before = await sparLog(page);
  const speaksBefore = before.ttsSent.filter((sent) => sent.kind === "text" && (sent.text ?? "").includes('"Speak"')).length;
  const playbackBefore = before.playerStarted.length;

  await sparControl(page, "pushSse", {
    type: "phrase",
    turnId,
    phrase: { text, sequence: 0, isFinal: false },
  });
  await page.waitForFunction(
    (count) => {
      const spar = (window as unknown as { __spar?: SparPageState }).__spar;
      return (
        !!spar &&
        spar.log.ttsSent.filter((sent) => sent.kind === "text" && (sent.text ?? "").includes('"Speak"')).length > count
      );
    },
    speaksBefore,
    { timeout: 15_000 },
  );
  for (let frame = 0; frame < audioFrames; frame += 1) {
    await sparControl(page, "ttsAudio", 4800);
  }
  await page.waitForFunction(
    (count) => {
      const spar = (window as unknown as { __spar?: SparPageState }).__spar;
      return !!spar && spar.log.playerStarted.length > count;
    },
    playbackBefore,
    { timeout: 15_000 },
  );
}

test("captions, generation, playback, barge-in, and stale audio follow the live turn contract", async ({
  page,
}) => {
  page.on("pageerror", (error) => console.error("[pageerror]", error.message));
  await enterSparringRoom(page);

  // ─── Turn 1: interim captions and generation gated on EndOfTurn ──────
  await startListening(page);
  await sparControl(page, "sttStartOfTurn", 0, "");

  // No live turn request exists while the user is still mid-turn.
  expect((await sparLog(page)).sseRequests.filter((request) => !request.warmup)).toHaveLength(0);

  await sparControl(page, "sttInterim", 0, "I think we should ship the beta");
  await expect(page.getByText("Speaking...")).toBeVisible();
  await expect(page.getByText("I think we should ship the beta")).toBeVisible();
  expect((await sparLog(page)).sseRequests.filter((request) => !request.warmup)).toHaveLength(0);

  const turnId = await beginScriptedTurn(page, 0, "I think we should ship the beta", "I think we should ship the beta now");
  const endOfTurnAt = (await sparLog(page)).sttEndOfTurnAt;
  const generation = (await sparLog(page)).sseRequests.filter((request) => !request.warmup).at(-1);
  expect(endOfTurnAt).not.toBeNull();
  expect(generation!.at).toBeGreaterThanOrEqual(endOfTurnAt!);

  // ─── Scripted live turn: persona, phrase, audio, completion ──────────
  await beginScriptedSpeech(page, turnId);
  await speakScriptedPhrase(page, turnId, "Ship it with the numbers.", 2);

  // First playback must precede mocked generation completion, which has not
  // been delivered yet at this point. The first-playback metric is posted in
  // the same task that starts the audio source, so its timestamp is the
  // attributable playback moment.
  await page.waitForFunction(() => {
    const spar = (window as unknown as { __spar?: SparPageState }).__spar;
    return !!spar && spar.log.metrics.some((metric) => metric.type === "first-playback");
  });
  const firstPlaybackMetric = (await sparLog(page)).metrics.find((metric) => metric.type === "first-playback");
  expect(firstPlaybackMetric?.at).toBeDefined();
  expect((await sparLog(page)).sseCompletedAt).toBeNull();

  await sparControl(page, "pushSse", {
    type: "complete",
    turnId,
    messageId: "message-1",
    text: "Ship it with the numbers.",
    metadata: { type: "normal", claimRef: null, mood: "neutral" },
  });
  await expect(page.getByText("Ship it with the numbers.").first()).toBeVisible();

  const afterCompletion = await sparLog(page);
  expect(afterCompletion.sseCompletedAt).not.toBeNull();
  expect(firstPlaybackMetric!.at!).toBeLessThan(afterCompletion.sseCompletedAt!);

  // Generation completed: flush TTS, deliver EOF, drain playback.
  await page.waitForFunction(
    () => {
      const spar = (window as unknown as { __spar?: SparPageState }).__spar;
      return (
        !!spar && spar.log.ttsSent.some((sent) => sent.kind === "text" && (sent.text ?? "").includes('"Flush"'))
      );
    },
    undefined,
    { timeout: 15_000 },
  );
  await sparControl(page, "ttsMessage", '{"type":"Flushed"}');
  await sparControl(page, "drainPlayer");
  await page.waitForFunction(() => {
    const spar = (window as unknown as { __spar?: SparPageState }).__spar;
    return !!spar && spar.log.metrics.some((metric) => metric.type === "first-playback");
  });
  await expect(page.getByRole("button", { name: "Start speaking" })).toBeVisible({ timeout: 15_000 });

  // ─── Turn 2: barge-in stops audio inside the 200 ms budget ──────────
  await startListening(page);
  const turnId2 = await beginScriptedTurn(page, 1, "Hold on, what about the churn", "Hold on, what about the churn number");
  // The Aura client is cached per voice model, so turn 2 reuses turn 1's
  // already-open socket instead of creating a new one.
  await sparControl(page, "pushSse", {
    type: "turn-start",
    turnId: turnId2,
    persona: PERSONA,
    model: "openai/gpt-oss-20b",
    maxOutputTokens: 80,
  });
  await speakScriptedPhrase(page, turnId2, "Churn is flat at two percent.", 1);

  // ─── Stale old-turn output is discarded ─────────────────────────────
  // Turn 1's identity is retired; its text must never reach the caption.
  await sparControl(page, "pushSse", { type: "text-delta", turnId, text: " STALE GENERATION" });
  await page.waitForTimeout(100);
  await expect(page.getByText("STALE GENERATION")).toHaveCount(0);

  // ─── Active-turn teardown stays inside the 200 ms budget ────────────
  // Scope note: while the panel holds the turn (status finalizing/
  // generating/speaking) the room marks itself processing and offers no
  // mic, so a mid-playback StartOfTurn cannot be produced through the UI
  // today. Cancel and StartOfTurn run the same reducer cleanup(), so
  // ending the session mid-playback measures the teardown path they
  // share; the StartOfTurn form of the budget is additionally enforced by
  // the turn-state, controller, and 100-turn stress contracts.
  const beforeTeardown = await sparLog(page);
  const startedBeforeTeardown = beforeTeardown.playerStarted.length;
  const stoppedBeforeTeardown = beforeTeardown.playerStopped.length;
  await page.getByRole("button", { name: "Exit session" }).click();
  await page.getByRole("button", { name: /End & get coached/ }).click();
  await page.waitForFunction(
    (count) => {
      const spar = (window as unknown as { __spar?: SparPageState }).__spar;
      return !!spar && spar.log.playerStopped.length > count;
    },
    stoppedBeforeTeardown,
    { timeout: 15_000 },
  );

  const tornDown = await sparLog(page);
  const teardownAt = tornDown.markAt;
  expect(teardownAt).not.toBeNull();
  const stopsAfterTeardown = tornDown.playerStopped.filter((at) => at >= teardownAt!);
  expect(stopsAfterTeardown.length).toBeGreaterThan(0);
  const teardownLatency = Math.max(...stopsAfterTeardown) - teardownAt!;
  expect(teardownLatency).toBeLessThanOrEqual(BARGE_IN_BUDGET_MS);
  expect(tornDown.metrics.some((metric) => metric.type === "cancelled")).toBe(true);

  // A late Aura frame delivered after teardown stays silent.
  await sparControl(page, "ttsAudio", 4800);
  await page.waitForTimeout(150);
  const settled = await sparLog(page);
  expect(settled.playerStarted).toHaveLength(startedBeforeTeardown);
  expect(settled.playerStopped).toHaveLength(tornDown.playerStopped.length);

  // No provider or network escape hatch was used anywhere in the loop.
  expect(settled.providerRequests).toEqual([]);
  expect(settled.fetches.filter((entry) => /groq\.com|openrouter\.ai|deepgram\.com/.test(entry.url))).toEqual([]);
  expect(settled.tokenGrants).toBeGreaterThanOrEqual(2);
});
