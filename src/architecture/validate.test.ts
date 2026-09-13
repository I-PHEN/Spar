/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test";
import { architectureManifest } from "./manifest";
import { validateManifest } from "./validate";

describe("architecture manifest", () => {
  test("matches the repository", () => {
    expect(validateManifest(architectureManifest, process.cwd())).toEqual([]);
  });

  test("rejects duplicate node IDs", () => {
    const broken = {
      ...architectureManifest,
      nodes: [
        ...architectureManifest.nodes,
        { ...architectureManifest.nodes[0], id: "page-navigation" },
      ],
    };

    expect(validateManifest(broken, process.cwd())).toContain(
      "Duplicate node ID: page-navigation"
    );
  });

  test("rejects dangling edges", () => {
    const broken = {
      ...architectureManifest,
      edges: [{ from: "missing", to: "page-navigation", label: "bad" }],
    };

    expect(validateManifest(broken, process.cwd())).toContain(
      "Unknown edge source: missing"
    );
  });

  test("rejects guided tours that reference an unknown node", () => {
    const broken = {
      ...architectureManifest,
      tours: [
        {
          ...architectureManifest.tours[0],
          nodeIds: ["missing"],
        },
      ],
    };

    expect(validateManifest(broken, process.cwd())).toContain(
      "Unknown tour node: missing"
    );
  });

  test("rejects a missing experience key", () => {
    const broken = {
      ...architectureManifest,
      experiences: architectureManifest.experiences.filter(
        (experience) => experience.id !== "drill"
      ),
    };

    expect(validateManifest(broken, process.cwd())).toContain(
      "Missing experience: drill"
    );
  });

  test("rejects node files that do not exist", () => {
    const broken = {
      ...architectureManifest,
      nodes: architectureManifest.nodes.map((node) =>
        node.id === "page-navigation"
          ? { ...node, files: ["src/not-a-real-file.ts"] }
          : node
      ),
    };

    expect(validateManifest(broken, process.cwd())).toContain(
      "Missing file: src/not-a-real-file.ts"
    );
  });

  test("rejects a missing critical session route", () => {
    const broken = {
      ...architectureManifest,
      criticalRoutes: architectureManifest.criticalRoutes.filter(
        (route) => route !== "src/app/api/sessions/[id]/end/route.ts"
      ),
    };

    expect(validateManifest(broken, process.cwd())).toContain(
      "Missing critical route: src/app/api/sessions/[id]/end/route.ts"
    );
  });

  test("defines the approved experience state machines", () => {
    const stepsByExperience = Object.fromEntries(
      architectureManifest.experiences.map((experience) => [
        experience.id,
        experience.steps.map((step) => step.id),
      ])
    );

    expect(stepsByExperience).toEqual({
      defense: ["configure", "present", "analyze", "qa", "end", "debrief"],
      boardroom: [
        "configure",
        "present",
        "interrupt",
        "recover",
        "qa",
        "end",
        "debrief",
      ],
      open_spar: ["configure", "panel-opens", "answer", "challenge", "end", "debrief"],
      drill: [
        "choose-target",
        "question",
        "answer",
        "detect",
        "correct-or-advance",
        "end",
        "debrief",
      ],
    });
  });

  test("shows the current voice path through the session API in order", () => {
    expect(
      architectureManifest.edges.filter((edge) =>
        edge.label.startsWith("current voice path:")
      )
    ).toEqual([
      {
        from: "sparring-room",
        to: "session-api",
        label: "current voice path: sends turn to /spar-stream",
      },
      {
        from: "session-api",
        to: "openrouter-live-generation",
        label: "current voice path: streams persona response",
      },
      {
        from: "openrouter-live-generation",
        to: "deepgram-tts",
        label: "current voice path: synthesizes persona audio",
      },
      {
        from: "deepgram-tts",
        to: "sparring-room",
        label: "current voice path: returns audio to browser",
      },
    ]);
  });

  test("keeps target generation behind the server API and its durable keys", () => {
    const nodeById = Object.fromEntries(
      architectureManifest.nodes.map((node) => [node.id, node]),
    );

    expect(nodeById["groq-target-generation"]).toMatchObject({
      label: "Groq target generation",
      layer: "provider",
      inputs: [
        "Persona prompt",
        "Conversation messages",
        "Server-side Groq API key",
      ],
    });
    expect(nodeById["openrouter-live-generation"]).toMatchObject({
      inputs: [
        "Persona prompt",
        "Conversation messages",
        "Server-side OpenRouter API key",
      ],
    });
    expect(
      architectureManifest.edges.filter((edge) =>
        edge.label.startsWith("target voice"),
      ),
    ).toEqual([
      {
        from: "sparring-room",
        to: "session-api",
        label: "target voice path: sends turn through server API",
      },
      {
        from: "session-api",
        to: "groq-target-generation",
        label: "target voice path: uses server-side Groq primary",
      },
      {
        from: "session-api",
        to: "openrouter-live-generation",
        label: "target voice fallback: uses OpenRouter before speech starts",
      },
    ]);
  });

  test("describes unsupported Web Speech as blocking room entry", () => {
    const webSpeech = architectureManifest.nodes.find(
      (node) => node.id === "web-speech-recognition",
    );

    expect(webSpeech?.failure).toBe(
      "Unsupported browsers are blocked from entering the Sparring Room and directed to switch to Chrome or Edge or return home.",
    );
  });
});
