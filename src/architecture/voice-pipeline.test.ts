import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CURRENT_VOICE_FALLBACKS } from "./voice-pipeline";

test("models unsupported browsers as blocking current-room guidance", () => {
  const unsupported = CURRENT_VOICE_FALLBACKS.find(
    (fallback) => fallback.trigger === "voice-unsupported",
  );

  expect(unsupported).toMatchObject({
    mode: "current",
    trigger: "voice-unsupported",
    outcome: "blocks-room-entry",
    guidance: "switch-to-chrome-or-edge",
    nextAction: "back-to-home",
  });
});

test("streams fall back to Web Speech recognition while Flux reconnects", () => {
  const sttFallback = CURRENT_VOICE_FALLBACKS.find(
    (fallback) => fallback.trigger === "stt-unavailable",
  );

  expect(sttFallback).toMatchObject({
    mode: "current",
    trigger: "stt-unavailable",
    outcome: "falls-back-to-web-speech",
  });
});

test("generation fallbacks are split at the speech boundary", () => {
  const beforeSpeech = CURRENT_VOICE_FALLBACKS.find(
    (fallback) => fallback.trigger === "primary-generation-failed",
  );
  const afterSpeech = CURRENT_VOICE_FALLBACKS.find(
    (fallback) => fallback.trigger === "generation-failed-after-speech",
  );

  expect(beforeSpeech).toMatchObject({
    trigger: "primary-generation-failed",
    outcome: "restarts-on-openrouter",
  });
  expect(afterSpeech).toMatchObject({
    trigger: "generation-failed-after-speech",
    outcome: "ends-turn-without-a-second-answer",
  });
});

test("speech fallbacks are split at the first played audio frame", () => {
  const beforeAudio = CURRENT_VOICE_FALLBACKS.find(
    (fallback) => fallback.trigger === "primary-tts-failed",
  );
  const afterAudio = CURRENT_VOICE_FALLBACKS.find(
    (fallback) => fallback.trigger === "tts-failed-after-playback",
  );

  expect(beforeAudio).toMatchObject({
    trigger: "primary-tts-failed",
    outcome: "falls-back-to-browser-speech",
  });
  expect(afterAudio).toMatchObject({
    trigger: "tts-failed-after-playback",
    outcome: "ends-turn-text-remains",
  });
});

test("routes the post-presentation first question through the live turn controller", () => {
  const source = readFileSync(join(process.cwd(), "src/components/spar/sparring-room.tsx"), "utf8");
  expect(source).toContain("turnController.submitPresentationTurn(transcript, true)");
  expect(source).not.toContain("const qaReader");
  expect(source).not.toContain("qaDecoder");
});
