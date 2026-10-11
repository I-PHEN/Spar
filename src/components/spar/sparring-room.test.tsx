import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EngineStatusChip,
  RoomControlDeck,
  engineStatusLabel,
  liveOwnsControls,
  type RoomControlDeckProps,
} from "./sparring-room";

/** The classic click-flow deck: every per-turn control path reachable. */
const classicDeck: RoomControlDeckProps = {
  isSupported: true,
  connectionError: false,
  coachAnalysisOpen: false,
  analyzingPresentation: false,
  isPresenting: false,
  drillRetry: false,
  drillAttempts: 0,
  isUserTurn: true,
  isProcessing: false,
  isListening: false,
  audioPlaying: false,
  liveStatus: "off",
  waveformAmplitude: 0,
  onStartSpeaking: () => {},
  onStopSpeaking: () => {},
  onDonePresenting: () => {},
  onRetry: () => {},
};

describe("engine status label", () => {
  test("maps the live session states onto Live / Connecting / Classic", () => {
    expect(engineStatusLabel(true, "live")).toBe("Live");
    expect(engineStatusLabel(true, "connecting")).toBe("Connecting");
    // The cascade owns the room once the live engine ladders down.
    expect(engineStatusLabel(true, "fallback")).toBe("Classic");
  });

  test("never reports Live unless the room's live session is actually active", () => {
    // Pre-activation the hook already reads "connecting", but nothing is running.
    expect(engineStatusLabel(false, "connecting")).toBe("Classic");
    // After stop() the hook status can still read "live" — the room must not.
    expect(engineStatusLabel(false, "live")).toBe("Classic");
    expect(engineStatusLabel(false, "fallback")).toBe("Classic");
  });
});

describe("live engine control gating", () => {
  test("live owns the controls only while the live session runs and has not fallen back", () => {
    expect(liveOwnsControls(true, "live")).toBe(true);
    // One activation: the connecting window already hides the click flow.
    expect(liveOwnsControls(true, "connecting")).toBe(true);
    expect(liveOwnsControls(true, "fallback")).toBe(false);
    expect(liveOwnsControls(false, "live")).toBe(false);
    expect(liveOwnsControls(false, "fallback")).toBe(false);
  });
});

describe("room control deck", () => {
  test("live mode hides the per-turn Speak/Done controls for a quiet mic-live deck", () => {
    const markup = renderToStaticMarkup(<RoomControlDeck {...classicDeck} liveStatus="live" />);
    expect(markup).not.toContain("Start speaking");
    expect(markup).not.toContain("Stop speaking");
    expect(markup).not.toContain("Done Presenting");
    expect(markup).not.toContain("Click to speak");
    // The one-activation promise: the mic stays live without a button.
    expect(markup).toContain("Mic live");
  });

  test("the connecting window stays live-owned: transient indicator, no click flow", () => {
    const markup = renderToStaticMarkup(<RoomControlDeck {...classicDeck} liveStatus="connecting" />);
    expect(markup).not.toContain("Start speaking");
    expect(markup).not.toContain("Stop speaking");
    expect(markup).toContain("Connecting");
  });

  test("fallback mode renders the unchanged click flow", () => {
    const idle = renderToStaticMarkup(<RoomControlDeck {...classicDeck} />);
    expect(idle).toContain("Start speaking");
    const listening = renderToStaticMarkup(
      <RoomControlDeck {...classicDeck} isListening />,
    );
    expect(listening).toContain("Stop speaking");
    // Processing and panel-speaking states keep their existing hints.
    const processing = renderToStaticMarkup(
      <RoomControlDeck {...classicDeck} isUserTurn={false} isProcessing />,
    );
    expect(processing).toContain("Panel is responding");
  });

  test("presenting keeps the Done Presenting flow inside the classic deck", () => {
    const presenting = renderToStaticMarkup(
      <RoomControlDeck {...classicDeck} isPresenting />,
    );
    expect(presenting).toContain("Click to present");
    const presentingLive = renderToStaticMarkup(
      <RoomControlDeck {...classicDeck} isPresenting isListening />,
    );
    expect(presentingLive).toContain("Done Presenting");
  });
});

describe("engine status chip", () => {
  test("renders each engine label quietly", () => {
    expect(renderToStaticMarkup(<EngineStatusChip label="Live" />)).toContain(">Live<");
    expect(renderToStaticMarkup(<EngineStatusChip label="Classic" />)).toContain(">Classic<");
    expect(renderToStaticMarkup(<EngineStatusChip label="Connecting" />)).toContain(">Connecting<");
  });

  test("carries a stable engine attribute for UI tests", () => {
    expect(renderToStaticMarkup(<EngineStatusChip label="Live" />)).toContain('data-engine="live"');
    expect(renderToStaticMarkup(<EngineStatusChip label="Classic" />)).toContain('data-engine="classic"');
  });
});
