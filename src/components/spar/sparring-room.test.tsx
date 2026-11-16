import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AiStageCaption,
  CaptionRow,
  DrillHudStrip,
  EngineStatusChip,
  PresenceRail,
  RoomControlDeck,
  RoomToast,
  engineStatusLabel,
  liveOwnsControls,
  liveUserInterimCaption,
  recordsTurnAudio,
  shouldAutoStartMic,
  autoSendSilenceMs,
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
    expect(startsRecorderOnFallback({
      liveConfigured: true, liveSessionActive: true, status: "fallback",
      cascadeListening: true, recorderReady: true, alreadyStarted: false,
    })).toBe(true);

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

  test("every panelist is an equal-size circular presence, no taglines", () => {
    const m = renderToStaticMarkup(
      <PresenceRail
        personas={[...personas]}
        states={{}}
        agitation={{}}
      />,
    );
    expect(m).toContain("Ada");
    expect(m).toContain("Chiara");
    expect(m).not.toContain("Questions your core assumptions");
    expect(m).not.toContain("Challenges your impact and relevance");
    expect(m.match(/h-20 w-20/g)?.length).toBe(2);
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

describe("room accessibility", () => {
  test("error toasts announce themselves at the top without overlapping bottom stage captions", () => {
    const m = renderToStaticMarkup(<RoomToast>Microphone access denied.</RoomToast>);
    expect(m).toContain('role="alert"');
    expect(m).toContain("Microphone access denied.");
    expect(m).toContain("top-16");
    expect(m).not.toContain("bottom-20");
  });

  test("deck state text is visible on mobile (no hidden sm:inline)", () => {
    const m = renderToStaticMarkup(<RoomControlDeck {...classicDeck} />);
    expect(m).toContain("Start speaking");
    expect(m).not.toContain("hidden sm:inline");
  });
});

describe("drill framing and barge-in", () => {
  test("attempt counter appears only during a drill retry", () => {
    const idle = renderToStaticMarkup(<RoomControlDeck {...classicDeck} drillRetry={false} drillAttempts={2} />);
    expect(idle).not.toContain("Attempt");

    const retry = renderToStaticMarkup(<RoomControlDeck {...classicDeck} drillRetry drillAttempts={2} />);
    expect(retry).toContain("Attempt 3");
    expect(retry).toContain("Try again");
  });

  test("a barge-in flickers only the interrupted panelist's presence", () => {
    const personas = [
      { id: "p1", archetype: "skeptic", name: "Ada", behaviorStyle: "moderate", seatOrder: 0 },
      { id: "p2", archetype: "so_what", name: "Chiara", behaviorStyle: "moderate", seatOrder: 1 },
    ] as const;
    const m = renderToStaticMarkup(
      <PresenceRail personas={[...personas]} states={{}} agitation={{}} interruptedPersonaId="p1" />,
    );
    expect(m).toContain("spar-presence-flicker");
  });

  test("DrillHudStrip renders live clean rep count and active retry reason", () => {
    const hud = renderToStaticMarkup(
      <DrillHudStrip
        drillTarget="hedging"
        outcomes={["clean-1", "clean-2"]}
        drillRetry={true}
        drillAttempts={1}
        lastReason='Used qualifier "I think"'
      />
    );
    expect(hud).toContain("Drill · Hedging");
    expect(hud).toContain("2 clean");
    expect(hud).toContain("Attempt #2");
    expect(hud).toContain("Used qualifier &quot;I think&quot;");
  });

  test("DrillHudStrip renders live word ceiling counter and consecutive clean streak", () => {
    const hud = renderToStaticMarkup(
      <DrillHudStrip
        drillTarget="over-explaining"
        outcomes={["clean-1", "clean-1"]}
        drillRetry={false}
        drillAttempts={0}
        lastReason={null}
        liveTranscript="We invert the Hessian matrix in quadratic time"
      />
    );
    expect(hud).toContain("8/15 words");
    expect(hud).toContain("2 streak");
  });

  test("hands-free auto-mic helper arms only on clean user turn in classic mode", () => {
    const base = {
      handsFree: true,
      isSupported: true,
      isPresenting: false,
      isUserTurn: true,
      isProcessing: false,
      audioPlaying: false,
      isListening: false,
      opening: false,
      loading: false,
      showEndDialog: false,
      connectionError: false,
      coachAnalysisOpen: false,
      liveStatus: "off" as const,
    };
    expect(shouldAutoStartMic(base)).toBe(true);
    expect(shouldAutoStartMic({ ...base, handsFree: false })).toBe(false);
    expect(shouldAutoStartMic({ ...base, audioPlaying: true })).toBe(false);
    expect(shouldAutoStartMic({ ...base, isListening: true })).toBe(false);
    expect(shouldAutoStartMic({ ...base, liveStatus: "live" })).toBe(false);

    expect(autoSendSilenceMs("drill")).toBe(1600);
    expect(autoSendSilenceMs("open_spar")).toBe(2100);
  });

  test("RoomControlDeck shows hands-free auto-mic toggle pill when wired", () => {
    const markup = renderToStaticMarkup(
      <RoomControlDeck
        {...classicDeck}
        handsFree={true}
        onToggleHandsFree={() => {}}
      />
    );
    expect(markup).toContain("Auto-Mic On · Space to send");
  });

  test("face-to-face stage: PresenceRail supports centered stage layout and AiStageCaption renders bottom AI caption without chat chrome", () => {
    const stageMarkup = renderToStaticMarkup(
      <PresenceRail
        personas={[
          { id: "p1", archetype: "skeptic", name: "Victor", behaviorStyle: "moderate", seatOrder: 0 },
        ]}
        states={{ p1: "speaking" }}
        agitation={{}}
        layout="stage"
      />,
    );
    expect(stageMarkup).toContain("Victor");
    expect(stageMarkup).toContain("h-28 w-28");

    const captionMarkup = renderToStaticMarkup(
      <AiStageCaption
        entry={{
          id: "p1-cap",
          role: "persona",
          personaName: "Victor",
          archetype: "skeptic",
          content: "What is the LTV to CAC ratio?",
          type: "opening",
          createdAt: 0,
        }}
      />,
    );
    expect(captionMarkup).toContain("Victor");
    expect(captionMarkup).toContain("What is the LTV to CAC ratio?");
    expect(captionMarkup).not.toContain("Opening");
    expect(captionMarkup).not.toContain("border-[#232327]");
    expect(captionMarkup).not.toContain("border-left");

    const source = readFileSync(
      new URL("./sparring-room.tsx", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain("I need a moment");
    expect(source).not.toContain("handleNeedMoment");
    expect(source).toContain("formatRoomDisplaySubtitle");
    expect(source).toContain('layout="stage"');
    expect(source).toContain("<AiStageCaption");
  });
});
