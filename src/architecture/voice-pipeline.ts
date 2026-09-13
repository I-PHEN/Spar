export interface CurrentVoiceFallback {
  mode: "current";
  trigger: "stt-unavailable" | "primary-tts-failed" | "voice-fallback-failed";
  outcome: "blocks-room-entry" | "uses-legacy-tts" | "continues-text-only";
  guidance?: "switch-to-chrome-or-edge";
  nextAction?: "back-to-home";
  label: string;
  detail: string;
}

export const CURRENT_VOICE_FALLBACKS: readonly CurrentVoiceFallback[] = [
  {
    mode: "current",
    trigger: "stt-unavailable",
    outcome: "blocks-room-entry",
    guidance: "switch-to-chrome-or-edge",
    nextAction: "back-to-home",
    label: "STT unavailable",
    detail:
      "The unsupported-browser overlay blocks entry to the Sparring Room, asks the user to switch to Chrome or Edge, and offers Back to Home.",
  },
  {
    mode: "current",
    trigger: "primary-tts-failed",
    outcome: "uses-legacy-tts",
    label: "Deepgram fails",
    detail: "The server tries the legacy z-ai voice path.",
  },
  {
    mode: "current",
    trigger: "voice-fallback-failed",
    outcome: "continues-text-only",
    label: "Voice fallback fails",
    detail: "The text response remains the durable output.",
  },
];
