/// <reference types="bun-types" />

import { readFileSync } from "node:fs";
import { join } from "node:path";
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

  test("shows the Gemini Live session as the primary voice path, in order", () => {
    expect(
      architectureManifest.edges.filter((edge) =>
        edge.label.startsWith("primary voice path:")
      )
    ).toEqual([
      {
        from: "sparring-room",
        to: "gemini-live-voice",
        label: "primary voice path: one activation hands Q&A to the Live engine",
      },
      {
        from: "gemini-live-voice",
        to: "gemini-live-token",
        label: "primary voice path: fetches a short-lived ephemeral token",
      },
      {
        from: "gemini-live-voice",
        to: "live-turn-controller",
        label:
          "primary voice path: registers live turns, transcripts, and captions",
      },
      {
        from: "gemini-live-voice",
        to: "sparring-room",
        label: "primary voice path: engine status and speech-to-speech playback",
      },
    ]);
  });

  test("keeps the streaming cascade as the fallback voice path, in order", () => {
    expect(
      architectureManifest.edges.filter((edge) =>
        edge.label.startsWith("cascade voice path:")
      )
    ).toEqual([
      {
        from: "sparring-room",
        to: "flux-stt",
        label: "cascade voice path: streams microphone PCM",
      },
      {
        from: "flux-stt",
        to: "live-turn-controller",
        label: "cascade voice path: interim and finalized transcripts",
      },
      {
        from: "live-turn-controller",
        to: "session-api",
        label: "cascade voice path: POST /spar-stream with a turn id",
      },
      {
        from: "session-api",
        to: "groq-live-generation",
        label: "cascade voice path: Groq streams the response",
      },
      {
        from: "session-api",
        to: "live-turn-controller",
        label: "cascade voice path: turn-tagged SSE events",
      },
      {
        from: "live-turn-controller",
        to: "aura-2-tts",
        label: "cascade voice path: speaks each finalized phrase",
      },
      {
        from: "aura-2-tts",
        to: "sparring-room",
        label: "cascade voice path: ordered PCM playback",
      },
    ]);
  });

  test("documents the Gemini Live engine and its token route", () => {
    const nodeById = Object.fromEntries(
      architectureManifest.nodes.map((node) => [node.id, node]),
    );

    expect(nodeById["gemini-live-voice"]).toMatchObject({
      label: "Gemini Live voice engine",
      layer: "browser",
    });
    expect(nodeById["gemini-live-voice"]?.files).toContain(
      "src/hooks/use-live-voice.ts",
    );
    expect(nodeById["gemini-live-token"]).toMatchObject({
      label: "Gemini Live token route",
      layer: "api",
    });
    expect(nodeById["gemini-live-token"]?.files).toContain(
      "src/app/api/gemini-live-token/route.ts",
    );
  });

  test("keeps live generation behind the server API with its durable keys and fallback edges", () => {
    const nodeById = Object.fromEntries(
      architectureManifest.nodes.map((node) => [node.id, node]),
    );

    expect(nodeById["groq-live-generation"]).toMatchObject({
      label: "Groq live generation",
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
      architectureManifest.edges.filter((edge) => edge.label.startsWith("fallback:")),
    ).toEqual([
      {
        from: "gemini-live-voice",
        to: "flux-stt",
        label: "fallback: Live failure hands the room to the cascade",
      },
      {
        from: "flux-stt",
        to: "web-speech-recognition",
        label: "fallback: browser recognition while streaming STT reconnects",
      },
      {
        from: "session-api",
        to: "openrouter-live-generation",
        label: "fallback: OpenRouter only before speech starts",
      },
    ]);
  });

  test("preserves the pre-streaming REST path only as the legacy fallback", () => {
    expect(
      architectureManifest.edges.filter((edge) =>
        edge.label.startsWith("legacy buffered path:")
      )
    ).toEqual([
      {
        from: "session-api",
        to: "deepgram-tts",
        label: "legacy buffered path: REST synthesis for non-live clients",
      },
      {
        from: "deepgram-tts",
        to: "sparring-room",
        label: "legacy buffered path: returns base64 audio",
      },
    ]);

    const nodeById = Object.fromEntries(
      architectureManifest.nodes.map((node) => [node.id, node]),
    );
    expect(nodeById["deepgram-tts"]?.label).toBe("Legacy Deepgram REST TTS");
    expect(nodeById["aura-2-tts"]?.label).toBe("Deepgram Aura-2 streaming TTS");
  });

  test("wires turn metrics into the latency lab", () => {
    const nodeById = Object.fromEntries(
      architectureManifest.nodes.map((node) => [node.id, node]),
    );

    expect(nodeById["turn-metrics"]?.files).toContain(
      "src/components/architecture/latency-lab.tsx",
    );
    expect(
      architectureManifest.edges.filter((edge) => edge.to === "turn-metrics"),
    ).toEqual([
      {
        from: "live-turn-controller",
        to: "turn-metrics",
        label: "records browser turn metrics",
      },
      {
        from: "session-api",
        to: "turn-metrics",
        label: "records server turn metrics",
      },
    ]);
    expect(architectureManifest.edges).toContainEqual({
      from: "turn-metrics",
      to: "prisma-sqlite",
      label: "persists per-turn metric records",
    });
  });

  test("describes unsupported Web Speech as blocking room entry", () => {
    const webSpeech = architectureManifest.nodes.find(
      (node) => node.id === "web-speech-recognition",
    );

    expect(webSpeech?.failure).toBe(
      "Unsupported browsers are blocked from entering the Sparring Room and directed to switch to Chrome or Edge or return home.",
    );
  });

  test("documents the TurnMetric persistence entity in the data-memory model", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/architecture/data-memory.tsx"),
      "utf8",
    );

    // The persistence model must keep the live pipeline's telemetry entity
    // alongside the other Prisma models, with its session cardinality and
    // the Live engine's attribution fields.
    expect(source).toContain('<EntityCard name="TurnMetric"');
    expect(source).toContain('["Session", "1 → many", "TurnMetric"');
    expect(source).toContain("turnId is unique");
    expect(source).toContain("voiceEngine");
    expect(source).toContain("firstLiveAudioMs");
    expect(source).toContain("interruption count");
  });
});
