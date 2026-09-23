/// <reference types="bun-types" />

/**
 * Opt-in local voice benchmark (real provider usage — never run in CI).
 *
 * `benchmark:voice` measures the live voice pipeline against the operator's
 * own configured services. It makes REAL Groq / OpenRouter / Deepgram
 * requests and therefore refuses to start without explicit confirmation.
 *
 *   Regional probe (same five short prompts per region, server-visible):
 *     DEEPGRAM_REGION=us bun run benchmark:voice --region=us --turns=5
 *     DEEPGRAM_REGION=eu bun run benchmark:voice --region=eu --turns=5
 *     -> set DEEPGRAM_REGION to the region with the lower end-to-end result.
 *
 *   Acceptance sample (20 spoken turns, all four experiences, browser):
 *     bun run benchmark:voice --turns=20
 *
 * Budget gates on the acceptance sample: playback p50 <= 1,000 ms,
 * p95 <= 1,500 ms, and the deterministic 200 ms barge-in teardown budget
 * (verified by the Chromium harness, which measures it without providers).
 *
 * Truthfulness: results are single-machine, single-browser, small-sample
 * local measurements, not a production guarantee.
 *
 * Secrets are never printed and no raw audio is stored; only turn metric
 * offsets and counts are read.
 */

import { spawn } from "node:child_process";
import process from "node:process";
import * as readline from "node:readline";
import { summarizeTurnMetrics, type TurnMetricRecord } from "../src/lib/observability/turn-metrics";

const PLAYBACK_P50_BUDGET_MS = 1_000;
const PLAYBACK_P95_BUDGET_MS = 1_500;
const EXPERIENCES = ["defense", "boardroom", "open_spar", "drill"] as const;
type Experience = (typeof EXPERIENCES)[number];

interface Arguments {
  region: "us" | "eu";
  turns: number;
  baseUrl: string;
  confirmed: boolean;
  help: boolean;
}

function usage(): string {
  return [
    "Usage: bun run benchmark:voice [--region=us|eu] [--turns=N] [--base-url=URL] [--yes]",
    "",
    "  --region      Labels the probe and prints the DEEPGRAM_REGION guidance. Default: us.",
    "  --turns       Sample size. 1-5 runs the server-visible regional probe; the",
    "                acceptance sample is 20 spoken turns across all four experiences.",
    "  --base-url    Local app origin. Default: http://localhost:3000.",
    "  --yes         Explicit opt-in. Without it the script asks interactively.",
    "",
    "This script performs real, credit-consuming provider requests. It reads only",
    "turn metric offsets; it never prints secret values and never stores raw audio.",
  ].join("\n");
}

function parseArguments(argv: string[]): Arguments {
  const parsed: Arguments = { region: "us", turns: 20, baseUrl: "http://localhost:3000", confirmed: false, help: false };
  for (const argument of argv) {
    if (argument === "--help" || argument === "-h") parsed.help = true;
    else if (argument === "--yes") parsed.confirmed = true;
    else if (argument.startsWith("--region=")) {
      const value = argument.slice(9);
      if (value !== "us" && value !== "eu") throw new Error(`--region must be us or eu, got "${value}".`);
      parsed.region = value;
    } else if (argument.startsWith("--turns=")) {
      const value = Number(argument.slice(8));
      if (!Number.isInteger(value) || value < 1 || value > 100) throw new Error(`--turns must be an integer between 1 and 100.`);
      parsed.turns = value;
    } else if (argument.startsWith("--base-url=")) {
      parsed.baseUrl = argument.slice(11).replace(/\/$/, "");
    } else {
      throw new Error(`Unknown argument "${argument}".\n\n${usage()}`);
    }
  }
  return parsed;
}

function checkConfiguredServices(): boolean {
  const keys = ["GROQ_API_KEY", "OPENROUTER_API_KEY", "DEEPGRAM_API_KEY"];
  const missing = keys.filter(key => !process.env[key] || !process.env[key]!.trim());
  for (const key of keys) {
    console.log(`  ${key.padEnd(20)} ${missing.includes(key) ? "MISSING" : "present"}`);
  }
  console.log(`  ${"DEEPGRAM_REGION".padEnd(20)} ${process.env.DEEPGRAM_REGION === "eu" ? "eu" : "us (default)"}`);
  if (missing.length > 0) {
    console.error(`\nConfigure ${missing.join(", ")} in .env first. Values are never printed.`);
    return false;
  }
  return true;
}

async function confirmInteractive(): Promise<boolean> {
  if (!process.stdin.isTTY) {
    console.error("\nRefusing to run: benchmark:voice consumes real provider credits.");
    console.error("Re-run with --yes (or an interactive terminal) once you accept that.");
    return false;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>(resolve => {
    rl.question("\nType 'yes' to make real Groq / OpenRouter / Deepgram requests now: ", resolve);
  });
  rl.close();
  return answer.trim().toLowerCase() === "yes";
}

function percentile(values: number[], position: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * position;
  const lower = sorted[Math.floor(index)];
  const upper = sorted[Math.ceil(index)];
  return Math.round(lower + (upper - lower) * (index - Math.floor(index)));
}

interface LiveTurnMilestones {
  firstTokenMs: number | null;
  firstPhraseMs: number | null;
  completeMs: number | null;
  provider: string | null;
  fallback: boolean;
}

/** Posts one live turn and reads its SSE stream until completion. */
async function postLiveTurn(baseUrl: string, sessionId: string, transcript: string, turnId: string): Promise<LiveTurnMilestones> {
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/spar-stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ turnId, transcript, confidence: 0.95 }),
  });
  if (!response.ok || !response.body) throw new Error(`spar-stream responded ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const milestones: LiveTurnMilestones = { firstTokenMs: null, firstPhraseMs: null, completeMs: null, provider: null, fallback: false };
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const data = frame
          .split(/\r?\n/)
          .filter(line => line.startsWith("data:"))
          .map(line => line.slice(5).trim())
          .join("");
        if (!data) continue;
        let event: Record<string, unknown>;
        try {
          event = JSON.parse(data) as Record<string, unknown>;
        } catch {
          continue;
        }
        if (event.type === "metric" && event.metric && typeof event.metric === "object") {
          const metric = event.metric as { type?: string; offsetMs?: number; provider?: string };
          if (metric.type === "first-token" && typeof metric.offsetMs === "number") milestones.firstTokenMs = metric.offsetMs;
          if (metric.type === "first-phrase" && typeof metric.offsetMs === "number") milestones.firstPhraseMs = metric.offsetMs;
          if (metric.type === "generation-started" && typeof metric.provider === "string") milestones.provider = metric.provider;
        }
        if (event.type === "fallback") milestones.fallback = true;
        if (event.type === "complete") milestones.completeMs = Date.now() - startedAt;
      }
      if (done) return milestones;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

async function createSession(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      experience: "open_spar",
      drillTarget: null,
      coachingEnabled: false,
      mode: "without_material",
      rawMaterial: "Benchmark probe: state one claim and defend it.",
      personas: [
        { archetype: "skeptic", name: "The Skeptic", behaviorStyle: "moderate", seatOrder: 0 },
      ],
    }),
  });
  if (!response.ok) throw new Error(`session creation responded ${response.status}`);
  const body = (await response.json()) as { session?: { id?: string } };
  if (!body.session?.id) throw new Error("session creation returned no session id");
  return body.session.id;
}

/** Regional probe: identical short prompts, server-visible milestones only. */
async function runProbe(arguments_: Arguments): Promise<number> {
  const prompts = [
    "State your central claim in one sentence.",
    "Name the number that matters most.",
    "What is the biggest risk?",
    "Why now?",
    "What would you cut first?",
  ].slice(0, arguments_.turns);

  console.log(`\nRegional probe (${arguments_.region}): ${prompts.length} identical short prompts per region.`);
  console.log("This measures server-visible generation milestones (end-of-turn to first token/phrase).");
  console.log("Run it once per DEEPGRAM_REGION, then keep the region with the lower end-to-end median.\n");

  const sessionId = await createSession(arguments_.baseUrl);
  const milestones: LiveTurnMilestones[] = [];
  for (let index = 0; index < prompts.length; index += 1) {
    process.stdout.write(`  probe turn ${index + 1}/${prompts.length}... `);
    const result = await postLiveTurn(arguments_.baseUrl, sessionId, prompts[index], `probe-${arguments_.region}-${index}`);
    milestones.push(result);
    console.log(`complete in ${result.completeMs ?? "?"} ms (first token ${result.firstTokenMs ?? "?"} ms, first phrase ${result.firstPhraseMs ?? "?"} ms${result.fallback ? ", fell back to OpenRouter" : ""})`);
  }

  const endToEnd = milestones.map(item => item.completeMs).filter((value): value is number => value !== null);
  const median = percentile(endToEnd, 0.5);
  console.log(`\nProbe summary for ${arguments_.region}: end-to-end median ${median ?? "n/a"} ms across ${endToEnd.length} turns.`);
  console.log(`Next: set DEEPGRAM_REGION=${arguments_.region === "us" ? "eu" : "us"} and re-run the same probe, then keep the faster region.`);
  return median ?? Number.POSITIVE_INFINITY;
}

interface MetricsResponse {
  turns?: TurnMetricRecord[];
}

async function fetchMetrics(baseUrl: string): Promise<TurnMetricRecord[]> {
  const response = await fetch(`${baseUrl}/api/dev/metrics`, { headers: { "Cache-Control": "no-store" } });
  if (!response.ok) throw new Error(`/api/dev/metrics responded ${response.status}`);
  const body = (await response.json()) as MetricsResponse;
  return Array.isArray(body.turns) ? body.turns : [];
}

function validSample(record: TurnMetricRecord): boolean {
  return record.transcriptFinalizedOffsetMs !== null && record.firstPlaybackOffsetMs !== null;
}

/** Acceptance sample: the operator speaks, the script reads measured turns. */
async function runAcceptanceSample(arguments_: Arguments): Promise<number> {
  const perExperience = Math.ceil(arguments_.turns / EXPERIENCES.length);
  const baseline = await fetchMetrics(arguments_.baseUrl);
  const known = new Set(baseline.map(record => record.turnId));

  console.log("\nAcceptance sample — speak in the browser, the script collects measured turns.");
  console.log(`Open ${arguments_.baseUrl} and complete ${perExperience} spoken turns in EACH experience:`);
  for (const experience of EXPERIENCES) console.log(`  - ${experience}`);
  console.log("\nA valid sample turn has a finalized transcript and a first-playback measurement.");
  console.log("Interrupt the panel mid-answer at least once per experience where it is reachable.");
  console.log("Collecting (Ctrl+C stops early)...\n");

  const deadline = Date.now() + 45 * 60_000;
  let sample: TurnMetricRecord[] = [];
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 5_000));
    const turns = await fetchMetrics(arguments_.baseUrl);
    sample = turns.filter(record => !known.has(record.turnId) && validSample(record));
    const coverage = EXPERIENCES.map(experience => sample.filter(record => record.experience === experience).length);
    process.stdout.write(`\r  collected ${sample.length}/${arguments_.turns} valid turns (${EXPERIENCES.map((experience, index) => `${experience}:${coverage[index]}`).join(" ")})   `);
    if (sample.length >= arguments_.turns && coverage.every(count => count > 0)) break;
  }
  console.log("");

  if (sample.length < arguments_.turns) {
    console.error(`\nOnly ${sample.length} of ${arguments_.turns} valid sample turns were measured; the budget gate cannot pass on an incomplete sample.`);
    return 1;
  }

  const summary = summarizeTurnMetrics(sample);
  const playback = sample.map(record => (record.firstPlaybackOffsetMs ?? 0) - (record.transcriptFinalizedOffsetMs ?? 0));
  const milestones = {
    "first token": sample.map(record => record.firstTokenOffsetMs ?? 0),
    "first phrase": sample.map(record => record.firstPhraseOffsetMs ?? 0),
    "first TTS byte": sample.map(record => record.firstTtsByteOffsetMs ?? 0),
    "first playback": playback,
  };

  console.log("\nMeasured end-of-turn to milestone (ms), n=" + sample.length + ":");
  for (const [label, values] of Object.entries(milestones)) {
    const positive = values.filter(value => value > 0);
    console.log(`  ${label.padEnd(15)} p50 ${String(percentile(positive, 0.5) ?? "n/a").padStart(6)}  p95 ${String(percentile(positive, 0.95) ?? "n/a").padStart(6)}`);
  }

  const groq = sample.filter(record => record.generationProvider === "groq").length;
  const openRouter = sample.filter(record => record.generationProvider === "openrouter").length;
  const browserFallback = sample.filter(record => record.ttsProvider !== "deepgram").length;
  console.log(`\n  generation: ${groq} Groq, ${openRouter} OpenRouter (pre-speech fallback allowed only before speech starts)`);
  console.log(`  speech: ${sample.length - browserFallback} Deepgram streaming, ${browserFallback} browser fallback`);
  console.log(`  measured cost: $${summary.totalCostUsd.toFixed(6)}  fallback turns: ${summary.fallbackCount}  cancelled: ${summary.cancelledCount}`);

  const exitCode = await verifyBargeInBudget();
  const p50 = summary.p50PlaybackMs;
  const p95 = summary.p95PlaybackMs;
  const budgetLines = [
    `  playback p50 ${Math.round(p50 ?? Number.POSITIVE_INFINITY)} ms <= ${PLAYBACK_P50_BUDGET_MS} ms  ${p50 !== null && p50 <= PLAYBACK_P50_BUDGET_MS ? "PASS" : "MISS"}`,
    `  playback p95 ${Math.round(p95 ?? Number.POSITIVE_INFINITY)} ms <= ${PLAYBACK_P95_BUDGET_MS} ms  ${p95 !== null && p95 <= PLAYBACK_P95_BUDGET_MS ? "PASS" : "MISS"}`,
  ];
  console.log("\nBudget gates:");
  for (const line of budgetLines) console.log(line);

  if (p50 === null || p50 > PLAYBACK_P50_BUDGET_MS || p95 === null || p95 > PLAYBACK_P95_BUDGET_MS || exitCode !== 0) {
    console.error("\nThe measured local sample does not meet the latency budget; do not claim the latency goal is complete.");
    console.error("Keep the measured numbers above visible in the /architecture Latency lab.");
    return 1;
  }
  console.log("\nThe measured local sample meets the playback budget. Treat it as a local measurement, not a production guarantee.");
  return 0;
}

/**
 * The barge-in teardown budget is a deterministic property of the turn
 * pipeline, so it is verified by the Chromium harness (which measures the
 * 200 ms teardown without any provider call) instead of re-measured here.
 */
async function verifyBargeInBudget(): Promise<number> {
  console.log("\nBarge-in teardown budget: running the deterministic Chromium harness (no providers)...");
  return new Promise<number>(resolve => {
    const child = spawn("bunx", ["playwright", "test", "tests/e2e/voice-loop.spec.ts"], {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", error => {
      console.error(`  could not start the Chromium harness: ${error.message}`);
      resolve(1);
    });
    child.on("close", code => {
      const exit = code ?? 1;
      console.log(`  Chromium harness exit code ${exit} (200 ms teardown budget).`);
      resolve(exit === 0 ? 0 : 1);
    });
  });
}

function printCaveats(arguments_: Arguments): void {
  console.log("\nCaveats:");
  console.log(`  - Single local machine (${process.platform}), one browser, n=${arguments_.turns} turns.`);
  console.log(`  - Local network to Groq / OpenRouter / Deepgram (${arguments_.region} Deepgram region).`);
  console.log("  - Small sample; p95 from 20 turns is a rough tail estimate, not a production guarantee.");
  console.log("  - Playback latency depends on local audio output and this machine's load.");
}

async function main(): Promise<number> {
  const arguments_ = parseArguments(process.argv.slice(2));
  if (arguments_.help) {
    console.log(usage());
    return 0;
  }

  console.log("Spar voice benchmark — explicit opt-in check");
  console.log(`  app origin          ${arguments_.baseUrl}`);
  console.log(`  requested turns     ${arguments_.turns}`);
  console.log(`  labeled region      ${arguments_.region}`);
  if (!checkConfiguredServices()) return 2;

  if (!arguments_.confirmed && !(await confirmInteractive())) {
    console.error("Not confirmed; nothing was sent to any provider.");
    return 2;
  }

  if (arguments_.turns <= 5) {
    await runProbe(arguments_);
    printCaveats(arguments_);
    return 0;
  }
  const exitCode = await runAcceptanceSample(arguments_);
  printCaveats(arguments_);
  return exitCode;
}

if (import.meta.main) {
  try {
    process.exit(await main());
  } catch (error) {
    console.error(`\nbenchmark:voice failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
