import { expect, test } from "bun:test";
import { CURRENT_VOICE_FALLBACKS } from "./voice-pipeline";

test("models unsupported browsers as blocking current-room guidance", () => {
  const sttFallback = CURRENT_VOICE_FALLBACKS.find(
    (fallback) => fallback.trigger === "stt-unavailable",
  );

  expect(sttFallback).toMatchObject({
    mode: "current",
    trigger: "stt-unavailable",
    outcome: "blocks-room-entry",
    guidance: "switch-to-chrome-or-edge",
    nextAction: "back-to-home",
  });
});
