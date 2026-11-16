import { describe, expect, test } from "bun:test";
import { roomState, shouldStickToBottom, type RoomStateInput } from "./room-state";

/** A classic Q&A room, user's turn, nothing happening. */
function base(overrides: Partial<RoomStateInput> = {}): RoomStateInput {
  return {
    liveSessionActive: false,
    liveStatus: "off",
    isPresenting: false,
    isUserTurn: true,
    isListening: false,
    isProcessing: false,
    audioPlaying: false,
    analyzing: false,
    coachReadOpen: false,
    drillRetry: false,
    ending: false,
    ...overrides,
  };
}

describe("roomState", () => {
  test("classic idle: user's turn, ready to speak", () => {
    const s = roomState(base());
    expect(s.phase).toBe("listening");
    expect(s.presence).toBe("listening");
    expect(s.statusLine).toBe("Click to speak");
  });

  test("classic mid-speech: recognizer listening", () => {
    const s = roomState(base({ isListening: true }));
    expect(s.phase).toBe("listening");
    expect(s.presence).toBe("listening");
    expect(s.statusLine).toBe("Listening…");
  });

  test("classic processing: panel is gathering the response", () => {
    const s = roomState(base({ isUserTurn: false, isProcessing: true }));
    expect(s.phase).toBe("gathering");
    expect(s.presence).toBe("gathering");
    expect(s.statusLine).toBe("Panel is responding");
  });

  test("classic playback: panel is speaking", () => {
    const s = roomState(base({ isUserTurn: false, audioPlaying: true }));
    expect(s.phase).toBe("speaking");
    expect(s.presence).toBe("speaking");
    expect(s.statusLine).toBe("Panel is speaking");
  });

  test("live active: continuous conversation, no click flow", () => {
    const s = roomState(base({ liveSessionActive: true, liveStatus: "live" }));
    expect(s.phase).toBe("listening");
    expect(s.statusLine).toBe("Mic live — just talk");
    // Live playback still reads as speaking.
    const speaking = roomState(
      base({ liveSessionActive: true, liveStatus: "live", isUserTurn: false, audioPlaying: true }),
    );
    expect(speaking.phase).toBe("speaking");
  });

  test("live connecting: the handshake reads as gathering", () => {
    const s = roomState(base({ liveSessionActive: true, liveStatus: "connecting" }));
    expect(s.phase).toBe("gathering");
    expect(s.presence).toBe("gathering");
    expect(s.statusLine).toBe("Connecting the live engine…");
  });

  test("live fallback behaves like classic", () => {
    const s = roomState(base({ liveSessionActive: true, liveStatus: "fallback" }));
    expect(s.phase).toBe("listening");
    expect(s.statusLine).toBe("Click to speak");
  });

  test("drill retry surfaces as its own phase", () => {
    const s = roomState(base({ drillRetry: true }));
    expect(s.phase).toBe("drill-retry");
    expect(s.presence).toBe("listening");
    expect(s.statusLine).toBe("Try again — answer without the weakness");
  });

  test("presenting phase: the user holds the floor", () => {
    const s = roomState(base({ isPresenting: true, isUserTurn: true }));
    expect(s.phase).toBe("presenting");
    expect(s.presence).toBe("listening");
  });

  test("coach-read phase: analyzing and the open card are one window", () => {
    expect(roomState(base({ analyzing: true })).phase).toBe("coach-read");
    expect(roomState(base({ coachReadOpen: true })).phase).toBe("coach-read");
    expect(roomState(base({ coachReadOpen: true })).presence).toBe("gathering");
  });

  test("ending wins over everything", () => {
    const s = roomState(base({ ending: true, audioPlaying: true, drillRetry: true }));
    expect(s.phase).toBe("ending");
  });
});

describe("shouldStickToBottom", () => {
  test("sticks when the user is at (or near) the bottom", () => {
    expect(shouldStickToBottom(0)).toBe(true);
    expect(shouldStickToBottom(79)).toBe(true);
  });

  test("releases when the user has scrolled up to read", () => {
    expect(shouldStickToBottom(80)).toBe(false);
    expect(shouldStickToBottom(600)).toBe(false);
  });
});

describe("distanceFromBottom", () => {
  test("measures how far the user has scrolled up", async () => {
    const { distanceFromBottom } = await import("./room-state");
    const el = { scrollHeight: 1000, scrollTop: 200, clientHeight: 600 } as HTMLElement;
    expect(distanceFromBottom(el)).toBe(200);
  });

  test("zero when pinned to the bottom", async () => {
    const { distanceFromBottom } = await import("./room-state");
    const el = { scrollHeight: 1000, scrollTop: 400, clientHeight: 600 } as HTMLElement;
    expect(distanceFromBottom(el)).toBe(0);
  });
});
