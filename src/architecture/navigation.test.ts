import { expect, test } from "bun:test";
import {
  getKeyboardTab,
  initialExplorerState,
  reduceExplorerState,
} from "./navigation";

test("selecting a node opens its detail", () => {
  const next = reduceExplorerState(initialExplorerState, { type: "select-node", nodeId: "session-api" });
  expect(next.selectedNodeId).toBe("session-api");
});

test("changing tabs clears stale node detail", () => {
  const next = reduceExplorerState({ tab: "map", selectedNodeId: "session-api", tourIndex: 0 }, { type: "select-tab", tab: "experiences" });
  expect(next).toEqual({ tab: "experiences", selectedNodeId: null, tourIndex: 0 });
});

test("selecting a tour opens its first node", () => {
  const next = reduceExplorerState(
    { tab: "map", selectedNodeId: "session-api", tourIndex: 2 },
    { type: "select-tour", nodeIds: ["sparring-room", "session-api"] },
  );

  expect(next).toEqual({ tab: "tour", selectedNodeId: "sparring-room", tourIndex: 0 });
});

test("tour navigation advances and stays inside the supplied route", () => {
  const nodeIds = ["sparring-room", "session-api"];
  const advanced = reduceExplorerState(
    { tab: "tour", selectedNodeId: "sparring-room", tourIndex: 0 },
    { type: "next-tour-step", nodeIds },
  );
  const bounded = reduceExplorerState(advanced, { type: "next-tour-step", nodeIds });

  expect(advanced).toEqual({ tab: "tour", selectedNodeId: "session-api", tourIndex: 1 });
  expect(bounded).toEqual({ tab: "tour", selectedNodeId: "session-api", tourIndex: 1 });
});

test("tour navigation moves back and never produces a negative index", () => {
  const nodeIds = ["sparring-room", "session-api"];
  const previous = reduceExplorerState(
    { tab: "tour", selectedNodeId: "session-api", tourIndex: 1 },
    { type: "previous-tour-step", nodeIds },
  );
  const bounded = reduceExplorerState(previous, { type: "previous-tour-step", nodeIds });

  expect(previous).toEqual({ tab: "tour", selectedNodeId: "sparring-room", tourIndex: 0 });
  expect(bounded).toEqual({ tab: "tour", selectedNodeId: "sparring-room", tourIndex: 0 });
});

test("tour navigation clamps stale state to the available node range", () => {
  const nodeIds = ["sparring-room", "session-api"];

  expect(
    reduceExplorerState(
      { tab: "tour", selectedNodeId: null, tourIndex: -3 },
      { type: "next-tour-step", nodeIds },
    ),
  ).toEqual({ tab: "tour", selectedNodeId: "sparring-room", tourIndex: 0 });
  expect(
    reduceExplorerState(
      { tab: "tour", selectedNodeId: null, tourIndex: 5 },
      { type: "previous-tour-step", nodeIds },
    ),
  ).toEqual({ tab: "tour", selectedNodeId: "session-api", tourIndex: 1 });
});

test("tab keyboard navigation moves, wraps, and supports boundary keys", () => {
  expect(getKeyboardTab("map", "ArrowLeft")).toBe("latency");
  expect(getKeyboardTab("latency", "ArrowRight")).toBe("map");
  expect(getKeyboardTab("voice", "Home")).toBe("map");
  expect(getKeyboardTab("voice", "End")).toBe("latency");
  expect(getKeyboardTab("voice", "Enter")).toBe("voice");
});
