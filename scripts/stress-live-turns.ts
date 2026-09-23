/// <reference types="bun-types" />

/**
 * Deterministic 100-turn stress run for the live turn controller.
 *
 * The real LiveTurnController (with its pure reducer) is driven by simulated
 * providers on a virtual clock: seeded generation, TTS, and playback delays,
 * a seeded mix of normal turns, pre-speech Groq->OpenRouter fallbacks, and
 * barge-ins, plus deliberate fault injection (duplicate completion events,
 * exact audio-frame replays, and stale old-turn output after a barge-in).
 *
 * The run exits nonzero when any protective contract is broken:
 *   - a duplicate completion is accepted,
 *   - stale old-turn output is accepted,
 *   - audio plays out of order (or any ordering failure is recorded),
 *   - a turn is still active when the run settles (leak),
 *   - an estimated prompt exceeds 2,000 input tokens,
 *   - the configured generation cap exceeds 80 output tokens,
 *   - a barge-in teardown of audio exceeds 200 ms of virtual time.
 *
 * No provider, network, or database is touched.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LiveTurnController } from "../src/hooks/use-turn-controller";
import type { LivePersona, LiveTurnEvent, LiveTurnRequest } from "../src/lib/spar/live-turn-service";
import { buildPersonaContext, estimateInputTokens, MAX_CONTEXT_TOKENS } from "../src/lib/persona/context-builder";
import { createPhraseChunker, type PhraseChunk } from "../src/lib/voice/phrase-chunker";

const DEFAULT_SEED = 20260912;
const DEFAULT_TURNS = 100;
const INPUT_TOKEN_BUDGET = 2_000;
const OUTPUT_TOKEN_BUDGET = 80;
const BARGE_IN_STOP_BUDGET_MS = 200;
const MAX_VIRTUAL_MS = 10 * 60_000;
const AUDIO_FRAME_BYTES = 4_800; // 100 ms of 24 kHz 16-bit mono PCM.

/** Deterministic PRNG so every run with the same seed replays identically. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Scheduled {
  at: number;
  order: number;
  run: () => void;
}

/** Virtual clock: sleeps resolve when the clock reaches their deadline. */
class VirtualClock {
  private queue: Scheduled[] = [];
  private order = 0;
  now = 0;

  sleep(ms: number): Promise<void> {
    return new Promise(resolve => this.schedule(ms, resolve));
  }

  schedule(ms: number, run: () => void): void {
    this.queue.push({ at: this.now + Math.max(0, ms), order: this.order++, run });
    this.queue.sort((left, right) => left.at - right.at || left.order - right.order);
  }

  async drain(): Promise<void> {
    while (this.queue.length > 0) {
      if (this.now > MAX_VIRTUAL_MS) {
        throw new Error("Virtual clock exceeded its horizon; a scheduled turn never settled.");
      }
      const next = this.queue.shift()!;
      this.now = next.at;
      await next.run();
    }
  }

  get pending(): number {
    return this.queue.length;
  }
}

/**
 * Advances virtual time until the controller and its simulated providers are
 * fully idle: one macrotask boundary lets pending promise chains park on the
 * clock, then the clock drains everything they scheduled.
 */
async function quiesce(clock: VirtualClock): Promise<void> {
  for (let round = 0; round < 1_000; round += 1) {
    await new Promise(resolve => setTimeout(resolve, 0));
    if (clock.pending === 0) return;
    await clock.drain();
  }
  throw new Error("The simulation never quiesced; a turn kept scheduling work.");
}

type TurnKind = "normal" | "fallback" | "barge-in";

interface TurnRecord {
  turnId: string;
  kind: TurnKind;
  completionsYielded: number;
  completionsAccepted: number;
  playedSequences: number[];
  interrupted: boolean;
  bargeInStopLatencyMs: number | null;
  inputTokens: number;
}

const PERSONAS: LivePersona[] = [
  { id: "persona-1", name: "The Skeptic", archetype: "skeptic", behaviorStyle: "moderate", seatOrder: 0 },
  { id: "persona-2", name: "The Timekeeper", archetype: "timekeeper", behaviorStyle: "aggressive", seatOrder: 1 },
];

/** The output cap the server actually configures for every provider request. */
function configuredOutputTokenCap(): number {
  const source = readFileSync(join(process.cwd(), "src/lib/providers/chat-stream.ts"), "utf8");
  const match = source.match(/max_completion_tokens:\s*(\d+)/);
  if (!match) throw new Error("Could not read max_completion_tokens from src/lib/providers/chat-stream.ts");
  return Number(match[1]);
}

function buildAnswer(index: number, random: () => number): string {
  const words = [
    "Ship", "the", "number", "now.", "Churn", "stays", "flat.", "Name", "the", "metric.",
    "Hold", "the", "line.", "Show", "the", "evidence.", "Cut", "the", "setup.", "Decide.",
  ];
  const target = 14 + Math.floor(random() * 12);
  const tokens: string[] = [];
  while (tokens.length < target) tokens.push(words[(index + tokens.length + Math.floor(random() * words.length)) % words.length]);
  return tokens.join(" ");
}

function percentile(values: number[], position: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * position;
  const lower = sorted[Math.floor(index)];
  const upper = sorted[Math.ceil(index)];
  return lower + (upper - lower) * (index - Math.floor(index));
}

export interface StressOptions {
  seed?: number;
  turns?: number;
}

export interface StressResult {
  turnCount: number;
  completed: number;
  interrupted: number;
  fallbackTurns: number;
  bargeInTurns: number;
  duplicateCompletions: number;
  staleAcceptances: number;
  outOfOrderPlayback: number;
  orderingFailures: number;
  leakedTurns: number;
  maxInputTokens: number;
  p50InputTokens: number;
  p95InputTokens: number;
  configuredOutputTokens: number;
  maxBargeInStopMs: number;
  violations: string[];
}

/** Runs the deterministic stress scenario and reports every measurement. */
export async function runStressTurns(options: StressOptions = {}): Promise<StressResult> {
  const seed = options.seed ?? DEFAULT_SEED;
  const turns = options.turns ?? DEFAULT_TURNS;
  const random = mulberry32(seed);
  const clock = new VirtualClock();
  const violations: string[] = [];
  const records: TurnRecord[] = [];
  const metricTypes: string[] = [];
  const history: Array<{ role: "user" | "assistant"; content: string }> = [];

  const aborts = new Map<string, AbortController>();
  const liveSpeechTurns = new Set<string>();
  const audioSequence = new Map<string, number>();
  const bargeInAt = new Map<string, number>();
  let nextKind: TurnKind = "normal";

  const controller = new LiveTurnController(`stress-${seed}`, "aura-2-zeus-en", {
    now: () => clock.now,
    createLifecycleId: () => `lifecycle-${seed}`,

    async *streamTurn(request: LiveTurnRequest, signal: AbortSignal): AsyncIterable<LiveTurnEvent> {
      const abort = new AbortController();
      aborts.set(request.turnId, abort);
      const dead = () => signal.aborted || abort.signal.aborted;
      const startedAt = clock.now;
      const record: TurnRecord = {
        turnId: request.turnId,
        kind: nextKind,
        completionsYielded: 0,
        completionsAccepted: 0,
        playedSequences: [],
        interrupted: false,
        bargeInStopLatencyMs: null,
        inputTokens: 0,
      };
      records.push(record);
      const kind = nextKind;

      const persona = PERSONAS[records.length % PERSONAS.length];
      await clock.sleep(4 + random() * 10);
      if (dead()) return;
      yield {
        type: "turn-start", turnId: request.turnId, persona,
        model: "openai/gpt-oss-20b", maxOutputTokens: OUTPUT_TOKEN_BUDGET,
      };

      let chunker = createPhraseChunker();
      let answer = "";
      const accept = async function* (delta: string): AsyncGenerator<LiveTurnEvent> {
        answer += delta;
        yield { type: "text-delta", turnId: request.turnId, text: delta };
        for (const phrase of chunker.push(delta)) {
          yield { type: "phrase", turnId: request.turnId, phrase };
        }
      };

      if (kind === "fallback") {
        // The primary provider dies before any speakable phrase exists, so
        // the restart at phrase sequence zero stays inside the contract.
        await clock.sleep(20 + random() * 40);
        if (dead()) return;
        yield* accept(`{"content":"Drop`);
        yield { type: "fallback", turnId: request.turnId, from: "groq", to: "openrouter", reason: "http-error", resetText: true };
        chunker.cancel();
        chunker = createPhraseChunker();
        answer = "";
      }

      const full = `{"content":"${buildAnswer(records.length, random)}","type":"normal","claimRef":null,"mood":"neutral"}`;
      for (let index = 0; index < full.length; index += 9) {
        await clock.sleep(8 + random() * 18);
        if (dead()) return;
        yield* accept(full.slice(index, index + 9));
      }
      await clock.sleep(6 + random() * 12);
      if (dead()) return;
      for (const phrase of chunker.flush().chunks) {
        yield { type: "phrase", turnId: request.turnId, phrase };
      }
      yield {
        type: "usage", turnId: request.turnId,
        usage: {
          inputTokens: 120 + Math.floor(random() * 400),
          outputTokens: 18 + Math.floor(random() * 30),
          cachedTokens: 60, estimatedCostUsd: 0.00004, priceVersion: "test",
        },
      };

      record.completionsYielded += 1;
      yield {
        type: "complete", turnId: request.turnId, messageId: `message-${request.turnId}`,
        text: answer, metadata: { type: "normal", claimRef: null, mood: "neutral" },
      };
      // Fault injection: a duplicated completion must never be accepted twice.
      if (random() < 0.25) {
        record.completionsYielded += 1;
        yield {
          type: "complete", turnId: request.turnId, messageId: `message-${request.turnId}`,
          text: answer, metadata: { type: "normal", claimRef: null, mood: "neutral" },
        };
      }
    },

    async beginSpeech(turnId: string): Promise<void> {
      liveSpeechTurns.add(turnId);
    },

    speakPhrase(turnId: string, phrase: PhraseChunk): void {
      if (!liveSpeechTurns.has(turnId)) {
        violations.push(`stale output accepted: phrase synthesis for retired turn ${turnId}`);
        return;
      }
      void phrase;
      // Seeded TTS: one first-byte delay, then audio frames with spacing.
      clock.schedule(40 + random() * 120, () => {
        if (!liveSpeechTurns.has(turnId)) return;
        controller.acceptSpeechEvent({ type: "first-tts-byte", turnId, timestampMs: clock.now });
        const frames = 1 + Math.floor(random() * 2);
        for (let frame = 0; frame < frames; frame += 1) {
          clock.schedule(frame * 30, () => deliverAudio(turnId));
        }
      });
    },

    finishSpeech(turnId: string): void {
      clock.schedule(20 + random() * 40, () => {
        if (!liveSpeechTurns.has(turnId)) return;
        controller.acceptSpeechEvent({ type: "complete", turnId });
      });
    },

    cancelGeneration(turnId: string): void {
      aborts.get(turnId)?.abort();
      aborts.delete(turnId);
    },

    invalidatePhraseQueue(turnId: string): void {
      liveSpeechTurns.delete(turnId);
    },

    resetPhraseQueue(turnId: string): void {
      // A pre-speech generation fallback restarts the phrase stream within
      // the same turn; the queue resets but the speech turn survives.
      void turnId;
    },

    stopAudio(turnId: string): void {
      const record = records.find(entry => entry.turnId === turnId);
      if (record && record.bargeInStopLatencyMs === null) {
        record.bargeInStopLatencyMs = Math.max(0, clock.now - (bargeInAt.get(turnId) ?? clock.now));
        if (record.bargeInStopLatencyMs > BARGE_IN_STOP_BUDGET_MS) {
          violations.push(`barge-in teardown took ${record.bargeInStopLatencyMs} ms on ${turnId} (budget ${BARGE_IN_STOP_BUDGET_MS} ms)`);
        }
      }
      liveSpeechTurns.delete(turnId);
    },

    clearTts(turnId: string): void {
      liveSpeechTurns.delete(turnId);
    },

    beginListening(turnId: string): void {
      void turnId;
    },

    async recordMetric(metric): Promise<void> {
      metricTypes.push(metric.type);
    },
  });

  function deliverAudio(turnId: string): void {
    if (!liveSpeechTurns.has(turnId)) return;
    const sequence = audioSequence.get(turnId) ?? 0;
    audioSequence.set(turnId, sequence + 1);
    // Byte content derives from the sequence so exact replays match.
    const audio = new Uint8Array(AUDIO_FRAME_BYTES).fill(Math.min(255, sequence));
    controller.acceptSpeechEvent({ type: "audio", turnId, sequence, audio });

    const record = records.find(entry => entry.turnId === turnId);
    const played = record?.playedSequences ?? [];
    const isFirstFrame = played.length === 0;
    if (played.length > 0 && sequence !== played[played.length - 1] + 1) {
      violations.push(`out-of-order playback on ${turnId}: frame ${sequence} after ${played[played.length - 1]}`);
    }
    if (record) record.playedSequences.push(sequence);
    if (isFirstFrame) {
      controller.acceptSpeechEvent({ type: "playback-start", turnId, timestampMs: clock.now, audioTime: 0 });
    }
    clock.schedule((AUDIO_FRAME_BYTES / 48_000) * 1_000, () => {
      if (!liveSpeechTurns.has(turnId)) return;
      controller.acceptSpeechEvent({ type: "drained", turnId, sequence });
    });

    // Fault injection: an exact replay of this frame must stay idempotent.
    if (random() < 0.15) {
      clock.schedule(2, () => {
        if (!liveSpeechTurns.has(turnId)) return;
        controller.acceptSpeechEvent({ type: "audio", turnId, sequence, audio });
      });
    }
  }

  let turnIndex = 0;
  let fallbackTurns = 0;
  let bargeInTurns = 0;
  let staleAcceptances = 0;

  if (process.env.STRESS_DEBUG) {
    controller.subscribe(snapshot => {
      console.error(
        `[t=${Math.round(clock.now)}] ${snapshot.turn.turnId} -> ${snapshot.turn.status}` +
          ` gen=${snapshot.turn.generationComplete} phrases=${snapshot.turn.phrasesFinalized}` +
          ` audio=${snapshot.turn.audioComplete} lastAudio=${snapshot.turn.lastAudioSequence}` +
          ` played=${snapshot.turn.lastPlayedAudioSequence} caption="${snapshot.assistantCaption.slice(0, 24)}"`,
      );
    });
  }

  for (let index = 0; index < turns; index += 1) {
    const kind: TurnKind = random() < 0.15 ? "fallback" : random() < 0.3 ? "barge-in" : "normal";
    const transcript = `Stress answer ${index} with concrete evidence attached.`;
    history.push({ role: "user", content: transcript });

    const context = buildPersonaContext({
      stablePrefix: "STABLE PREFIX",
      sessionRules: "One focused challenge.",
      rollingSummary: history
        .slice(0, Math.max(0, history.length - 6))
        .map(message => `${message.role === "user" ? "User" : "Panelist"}: ${message.content}`)
        .join("\n")
        .slice(-875),
      deterministicState: { experience: "open_spar" },
      history,
      newestUtterance: transcript,
    });
    const inputTokens = estimateInputTokens(context.messages);
    if (inputTokens > INPUT_TOKEN_BUDGET) {
      violations.push(`estimated input tokens ${inputTokens} exceed the ${INPUT_TOKEN_BUDGET} budget on turn ${index}`);
    }
    if (context.totalEstimatedTokens > MAX_CONTEXT_TOKENS) {
      violations.push(`persona context ${context.totalEstimatedTokens} exceeds its ${MAX_CONTEXT_TOKENS} safety limit on turn ${index}`);
    }

    nextKind = kind;
    if (kind === "fallback") fallbackTurns += 1;
    await controller.acceptStt({ type: "StartOfTurn", turnIndex: turnIndex++, transcript: "" });
    await controller.acceptStt({ type: "interim", turnIndex, transcript });
    const submittedTurnId = controller.getSnapshot().turn.turnId;
    const submittedRecord = () => records.find(entry => entry.turnId === submittedTurnId);

    if (kind === "barge-in") {
      bargeInTurns += 1;
      // The user cuts in mid-answer at a seeded virtual offset.
      clock.schedule(80 + random() * 400, async () => {
        const activeTurnId = controller.getSnapshot().turn.turnId;
        bargeInAt.set(activeTurnId, clock.now);
        await controller.acceptStt({ type: "StartOfTurn", turnIndex: turnIndex++, transcript: "" });
        // Fault injection: stale old-turn output must be discarded whole.
        controller.acceptServerEvent({ type: "text-delta", turnId: activeTurnId, text: " STALE OUTPUT" });
        controller.acceptSpeechEvent({
          type: "audio", turnId: activeTurnId, sequence: 4096,
          audio: new Uint8Array(AUDIO_FRAME_BYTES).fill(255),
        });
        const snapshot = controller.getSnapshot();
        if (snapshot.assistantCaption.includes("STALE OUTPUT") || snapshot.turn.orderingFailureCount > 0) {
          staleAcceptances += 1;
          violations.push(`stale output accepted after barge-in on ${activeTurnId}`);
        }
        const retired = records.find(entry => entry.turnId === activeTurnId);
        if (retired) retired.interrupted = true;
      });
    }

    // Submission runs on the virtual clock; the stream only progresses as
    // the clock drains, so barge-ins can land mid-answer.
    void controller.acceptStt({ type: "EndOfTurn", turnIndex, transcript, confidence: 0.9 });
    await quiesce(clock);
    const submitted = submittedRecord();
    if (submitted) submitted.inputTokens = inputTokens;
    history.push({ role: "assistant", content: buildAnswer(index, random) });

    if (kind === "barge-in") {
      // The barge-in turn is listening; complete it as a normal turn.
      nextKind = "normal";
      const followUp = `Recovery answer ${index} states the number directly.`;
      history.push({ role: "user", content: followUp });
      await controller.acceptStt({ type: "interim", turnIndex, transcript: followUp });
      void controller.acceptStt({ type: "EndOfTurn", turnIndex, transcript: followUp, confidence: 0.9 });
      await quiesce(clock);
    }
  }

  const finalSnapshot = controller.getSnapshot();
  const leaked = ["listening", "finalizing", "generating", "speaking"].includes(finalSnapshot.turn.status) ? 1 : 0;
  if (leaked) violations.push(`leaked active turn: status ${finalSnapshot.turn.status} after the run settled`);

  for (const record of records) {
    const messages = finalSnapshot.messages.filter(message => message.turnId === record.turnId && message.role === "assistant");
    record.completionsAccepted = messages.length;
    if (messages.length > 1) {
      violations.push(`duplicate completion accepted on ${record.turnId}: ${messages.length} assistant messages`);
    }
    if (record.completionsAccepted === 0 && !record.interrupted) {
      violations.push(`turn ${record.turnId} (${record.kind}) never completed and was not interrupted`);
    }
    for (let position = 1; position < record.playedSequences.length; position += 1) {
      if (record.playedSequences[position] !== record.playedSequences[position - 1] + 1) {
        violations.push(`out-of-order playback on ${record.turnId}: ${record.playedSequences.join(",")}`);
        break;
      }
    }
  }

  const orderingFailures = metricTypes.filter(type => type === "ordering-failure").length;
  if (orderingFailures > 0) violations.push(`${orderingFailures} ordering failures were recorded`);

  const configuredOutputTokens = configuredOutputTokenCap();
  if (configuredOutputTokens > OUTPUT_TOKEN_BUDGET) {
    violations.push(`configured output tokens ${configuredOutputTokens} exceed the ${OUTPUT_TOKEN_BUDGET} budget`);
  }

  const stopLatencies = records
    .map(record => record.bargeInStopLatencyMs)
    .filter((value): value is number => value !== null);
  const inputSamples = records.map(record => record.inputTokens);

  controller.dispose();

  return {
    turnCount: records.length,
    completed: records.filter(record => record.completionsAccepted === 1).length,
    interrupted: records.filter(record => record.interrupted).length,
    fallbackTurns,
    bargeInTurns,
    duplicateCompletions: records.filter(record => record.completionsAccepted > 1).length,
    staleAcceptances,
    outOfOrderPlayback: records.filter(record => {
      const played = record.playedSequences;
      return played.some((sequence, position) => position > 0 && sequence !== played[position - 1] + 1);
    }).length,
    orderingFailures,
    leakedTurns: leaked,
    maxInputTokens: inputSamples.reduce((max, value) => Math.max(max, value), 0),
    p50InputTokens: Math.round(percentile(inputSamples, 0.5)),
    p95InputTokens: Math.round(percentile(inputSamples, 0.95)),
    configuredOutputTokens,
    maxBargeInStopMs: stopLatencies.length ? Math.max(...stopLatencies) : 0,
    violations,
  };
}

if (import.meta.main) {
  const seedArgument = process.argv.find(argument => argument.startsWith("--seed="));
  const turnsArgument = process.argv.find(argument => argument.startsWith("--turns="));
  const result = await runStressTurns({
    seed: seedArgument ? Number(seedArgument.slice(7)) : undefined,
    turns: turnsArgument ? Number(turnsArgument.slice(8)) : undefined,
  });

  console.log(
    [
      `turns: ${result.turnCount} (${result.completed} completed, ${result.interrupted} interrupted, ${result.fallbackTurns} fallback, ${result.bargeInTurns} barge-in)`,
      `duplicate completions: ${result.duplicateCompletions}`,
      `stale acceptances: ${result.staleAcceptances}`,
      `out-of-order playback: ${result.outOfOrderPlayback} (ordering failures: ${result.orderingFailures})`,
      `leaked active turns: ${result.leakedTurns}`,
      `estimated input tokens: p50 ${result.p50InputTokens}, p95 ${result.p95InputTokens}, max ${result.maxInputTokens} (budget ${INPUT_TOKEN_BUDGET})`,
      `configured output tokens: ${result.configuredOutputTokens} (budget ${OUTPUT_TOKEN_BUDGET})`,
      `max barge-in teardown: ${result.maxBargeInStopMs} ms (budget ${BARGE_IN_STOP_BUDGET_MS} ms)`,
    ].join("\n"),
  );

  if (result.violations.length > 0) {
    console.error(`\nstress violations (${result.violations.length}):`);
    for (const violation of result.violations) console.error(`  - ${violation}`);
    process.exit(1);
  }
  process.exit(0);
}
