export interface CurrentVoiceFallback {
  mode: "current";
  trigger:
    | "voice-unsupported"
    | "live-engine-unavailable"
    | "stt-unavailable"
    | "primary-generation-failed"
    | "generation-failed-after-speech"
    | "primary-tts-failed"
    | "tts-failed-after-playback";
  outcome:
    | "blocks-room-entry"
    | "falls-back-to-cascade"
    | "falls-back-to-web-speech"
    | "restarts-on-openrouter"
    | "ends-turn-without-a-second-answer"
    | "falls-back-to-browser-speech"
    | "ends-turn-text-remains";
  guidance?: "switch-to-chrome-or-edge";
  nextAction?: "back-to-home";
  label: string;
  detail: string;
}

export const CURRENT_VOICE_FALLBACKS: readonly CurrentVoiceFallback[] = [
  {
    mode: "current",
    trigger: "live-engine-unavailable",
    outcome: "falls-back-to-cascade",
    label: "Gemini Live unavailable",
    detail:
      "Without GEMINI_API_KEY, or after a setup rejection (one retry on the Kore voice), socket exhaustion, or a microphone failure, the room hands itself to the Deepgram → Groq → Aura-2 cascade; the engine chip reads Classic and the per-turn click flow returns.",
  },
  {
    mode: "current",
    trigger: "voice-unsupported",
    outcome: "blocks-room-entry",
    guidance: "switch-to-chrome-or-edge",
    nextAction: "back-to-home",
    label: "No voice input available",
    detail:
      "Browsers with neither WebSocket microphone streaming nor Web Speech recognition are blocked from entering the Sparring Room, asked to switch to Chrome or Edge, and offered Back to Home.",
  },
  {
    mode: "current",
    trigger: "stt-unavailable",
    outcome: "falls-back-to-web-speech",
    label: "Flux STT unavailable",
    detail:
      "The room switches to browser speech recognition, keeps accepting turns through the fallback transcript, and reconnects to streaming STT with backoff.",
  },
  {
    mode: "current",
    trigger: "primary-generation-failed",
    outcome: "restarts-on-openrouter",
    label: "Groq fails before speech",
    detail:
      "The server restarts the same turn on OpenRouter and resets the phrase stream from sequence zero, so no half-spoken answer is mixed.",
  },
  {
    mode: "current",
    trigger: "generation-failed-after-speech",
    outcome: "ends-turn-without-a-second-answer",
    label: "Generation fails after speech starts",
    detail:
      "Once a phrase is audible, the turn stops with an error instead of switching providers mid-answer.",
  },
  {
    mode: "current",
    trigger: "primary-tts-failed",
    outcome: "falls-back-to-browser-speech",
    label: "Aura-2 unavailable before audio",
    detail:
      "Before the first audio frame plays, speech falls back to the browser's speech synthesis for the queued phrases.",
  },
  {
    mode: "current",
    trigger: "tts-failed-after-playback",
    outcome: "ends-turn-text-remains",
    label: "Speech fails during playback",
    detail:
      "After playback has started, a speech failure ends the turn; the durable text answer remains in the transcript.",
  },
];
