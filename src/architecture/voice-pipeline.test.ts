import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

test("routes the post-presentation first question through the live turn controller", () => {
  const source = readFileSync(join(process.cwd(), "src/components/spar/sparring-room.tsx"), "utf8");
  expect(source).toContain("turnController.submitPresentationTurn(transcript, true)");
  expect(source).not.toContain("const qaReader");
  expect(source).not.toContain("qaDecoder");
});
