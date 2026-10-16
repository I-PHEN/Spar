import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CaptionRow,
  EngineStatusChip,
  PresenceRail,
  RoomControlDeck,
  engineStatusLabel,
  liveOwnsControls,
  liveUserInterimCaption,
  recordsTurnAudio,
  startsRecorderOnFallback,
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

describe("live engine debrief recording", () => {
  test("classic activations record; live-owned activations are skipped, fallback resumes recording", () => {
    // Presenting always runs the classic recognizer — per-turn clips continue.
    expect(recordsTurnAudio(true, true, "live")).toBe(true);
    // A room without Live configuration is pure classic.
    expect(recordsTurnAudio(false, false, "fallback")).toBe(true);
    // While the live engine owns the room there is one continuous capture the
    // per-turn debrief cannot segment — the recorder must not start.
    expect(recordsTurnAudio(false, true, "connecting")).toBe(false);
    expect(recordsTurnAudio(false, true, "live")).toBe(false);
    // Once the engine ladders down, the cascade owns the room again and the
    // classic click flow records exactly as before.
    expect(recordsTurnAudio(false, true, "fallback")).toBe(true);
  });

  test("the fallback transition starts the recorder exactly once for the in-flight classic turn", () => {
    // The regression this guards: a live activation clicks while the engine
    // reads "connecting" (recordsTurnAudio false at click time), the token
    // route then answers 503 and the cascade mic starts without a click —
    // the transition itself must start the recorder or the first Q&A turn's
    // debrief clip is lost.
    expect(startsRecorderOnFallback({
      liveConfigured: true, liveSessionActive: true, status: "fallback",
      cascadeListening: true, recorderReady: true, alreadyStarted: false,
    })).toBe(true);

    // Idempotent: never twice per activation, never while already recording,
    // never before the cascade mic is actually listening.
    expect(startsRecorderOnFallback({
      liveConfigured: true, liveSessionActive: true, status: "fallback",
      cascadeListening: true, recorderReady: true, alreadyStarted: true,
    })).toBe(false);
    expect(startsRecorderOnFallback({
      liveConfigured: true, liveSessionActive: true, status: "fallback",
      cascadeListening: true, recorderReady: false, alreadyStarted: false,
    })).toBe(false);
    expect(startsRecorderOnFallback({
      liveConfigured: true, liveSessionActive: true, status: "fallback",
      cascadeListening: false, recorderReady: true, alreadyStarted: false,
    })).toBe(false);

    // Not the transition's job: classic rooms and presenting record at click
    // time, and a live-owned room (connecting/live) must stay unrecorded.
    expect(startsRecorderOnFallback({
      liveConfigured: false, liveSessionActive: false, status: "fallback",
      cascadeListening: true, recorderReady: true, alreadyStarted: false,
    })).toBe(false);
    expect(startsRecorderOnFallback({
      liveConfigured: true, liveSessionActive: true, status: "live",
      cascadeListening: true, recorderReady: true, alreadyStarted: false,
    })).toBe(false);
    expect(startsRecorderOnFallback({
      liveConfigured: true, liveSessionActive: true, status: "connecting",
      cascadeListening: true, recorderReady: true, alreadyStarted: false,
    })).toBe(false);
    // A room whose live session was never activated (or has ended) is not
    // mid-handshake — the click flow owns recording.
    expect(startsRecorderOnFallback({
      liveConfigured: true, liveSessionActive: false, status: "fallback",
      cascadeListening: true, recorderReady: true, alreadyStarted: false,
    })).toBe(false);
  });
});

describe("live interim user caption", () => {
  test("live interim speech reaches the caption UI only while the live engine owns the room", () => {
    expect(liveUserInterimCaption(true, "live", "our churn is")).toBe("our churn is");
    expect(liveUserInterimCaption(true, "connecting", "our churn is")).toBe("our churn is");
    // Fallback and never-activated rooms must not bleed live previews into
    // the classic interim-caption path.
    expect(liveUserInterimCaption(true, "fallback", "leftover preview")).toBe("");
    expect(liveUserInterimCaption(false, "live", "leftover preview")).toBe("");
    expect(liveUserInterimCaption(true, "live", "")).toBe("");
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

describe("presence rail", () => {
  const personas = [
    { id: "p2", archetype: "so_what", name: "Chiara", behaviorStyle: "moderate", seatOrder: 1 },
    { id: "p1", archetype: "skeptic", name: "Ada", behaviorStyle: "moderate", seatOrder: 0 },
  ] as const;

  test("every panelist is an equal-size circular presence with their one-liner", () => {
    const m = renderToStaticMarkup(
      <PresenceRail
        personas={[...personas]}
        states={{}}
        agitation={{}}
      />,
    );
    // Both panelists get their one-liner in the rail.
    expect(m).toContain("Questions your core assumptions");
    expect(m).toContain("Challenges your impact and relevance");
    expect(m).toContain("Ada");
    expect(m).toContain("Chiara");
    // Equal size: the avatar size class appears exactly once per panelist.
    expect(m.match(/h-24 w-24/g)?.length).toBe(2);
    // Circular avatars, not tiles.
    expect(m).toContain("rounded-full");
  });

  test("thinking maps to the gathering state language", () => {
    const m = renderToStaticMarkup(
      <PresenceRail personas={[...personas]} states={{ p1: "thinking" }} agitation={{}} />,
    );
    expect(m).toContain("Gathering…");
  });

  test("agitation at 80+ pulses that panelist (the wired interrupt tell)", () => {
    const m = renderToStaticMarkup(
      <PresenceRail personas={[...personas]} states={{}} agitation={{ p1: 85 }} />,
    );
    expect(m).toContain("spar-pulse");
  });

  test("strip layout renders rows for every panelist (mobile)", () => {
    const m = renderToStaticMarkup(
      <PresenceRail personas={[...personas]} states={{}} agitation={{}} layout="strip" />,
    );
    expect(m).toContain("Ada");
    expect(m).toContain("Chiara");
    // strip is compact: no portrait one-liners
    expect(m).not.toContain("Questions your core assumptions");
  });
});

describe("caption rows", () => {
  test("persona captions carry the speaker's accent edge", () => {
    const m = renderToStaticMarkup(
      <CaptionRow
        entry={{
          id: "c1",
          role: "persona",
          personaName: "Ada",
          archetype: "skeptic",
          content: "What evidence supports that?",
          type: "normal",
          createdAt: 0,
        }}
      />,
    );
    expect(m).toContain("spar-caption-accent");
    expect(m).toContain("oklch(0.68 0.13 250");
  });

  test("user captions stay neutral (no accent edge)", () => {
    const m = renderToStaticMarkup(
      <CaptionRow
        entry={{ id: "c2", role: "user", content: "Our market is large.", type: "normal", createdAt: 0 }}
      />,
    );
    expect(m).not.toContain("spar-caption-accent");
  });
});
