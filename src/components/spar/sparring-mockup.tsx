"use client";

import { useEffect, useState, useRef } from "react";
import { Search, Microscope, Target, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Animated Sparring Room Mockup
 *
 * A self-contained, auto-playing loop that simulates a sparring session.
 * No video file — this is a React animation that cycles:
 *
 *   1. Panel appears (3 persona cards, all "Listening")
 *   2. Skeptic activates ("Thinking" → "Speaking")
 *   3. Caption types out: "Hold on. Drop the qualifier. Say it directly."
 *   4. Waveform pulses
 *   5. Reset → repeat
 *
 * This is the hero centerpiece — it shows the user what the product
 * actually looks like and feels like.
 */

const SCRIPT = [
  { text: "Hold on. Drop the qualifier.", delay: 40 },
  { text: "Say it directly.", delay: 40 },
];

const PHASES = {
  PANEL_APPEARS: 0,
  SKEPTIC_THINKING: 1200,
  SKEPTIC_SPEAKING: 2000,
  TYPING_CAPTION: 2600,
  WAVEFORM_ACTIVE: 4200,
  RESET: 6500,
} as const;

export function SparringMockup() {
  const [phase, setPhase] = useState<number>(PHASES.PANEL_APPEARS);
  const [typedText, setTypedText] = useState("");
  const [waveformBars, setWaveformBars] = useState<number[]>(Array(14).fill(3));

  // Master loop — resets every ~6.5s
  useEffect(() => {
    const startTime = Date.now();
    let animationFrame: number;

    function update() {
      const elapsed = Date.now() - startTime;
      const cycleTime = elapsed % PHASES.RESET;

      // Determine phase
      if (cycleTime < PHASES.SKEPTIC_THINKING) {
        setPhase(PHASES.PANEL_APPEARS);
        setTypedText("");
      } else if (cycleTime < PHASES.SKEPTIC_SPEAKING) {
        setPhase(PHASES.SKEPTIC_THINKING);
        setTypedText("");
      } else if (cycleTime < PHASES.TYPING_CAPTION) {
        setPhase(PHASES.SKEPTIC_SPEAKING);
        setTypedText("");
      } else if (cycleTime < PHASES.WAVEFORM_ACTIVE) {
        setPhase(PHASES.SKEPTIC_SPEAKING);
        // Type out the caption
        const typingElapsed = cycleTime - PHASES.TYPING_CAPTION;
        const fullText = SCRIPT.map((s) => s.text).join(" ");
        const charCount = Math.floor(typingElapsed / 35);
        setTypedText(fullText.slice(0, charCount));
      } else if (cycleTime < PHASES.RESET) {
        setPhase(PHASES.WAVEFORM_ACTIVE);
        const fullText = SCRIPT.map((s) => s.text).join(" ");
        setTypedText(fullText);
      } else {
        setPhase(PHASES.PANEL_APPEARS);
        setTypedText("");
      }

      // Update waveform during speaking phase
      if (cycleTime >= PHASES.SKEPTIC_SPEAKING && cycleTime < PHASES.RESET) {
        setWaveformBars(
          Array.from({ length: 14 }, (_, i) => {
            const baseHeight = 3;
            const amplitude =
              cycleTime >= PHASES.WAVEFORM_ACTIVE ? 12 : 6;
            const frequency = 0.08;
            const phaseOffset = i * 0.4;
            return Math.round(
              baseHeight +
                Math.abs(
                  Math.sin(elapsed * frequency + phaseOffset)
                ) *
                  amplitude
            );
          })
        );
      } else {
        setWaveformBars(Array(14).fill(3));
      }

      animationFrame = requestAnimationFrame(update);
    }

    animationFrame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  const skepticState =
    phase >= PHASES.SKEPTIC_SPEAKING
      ? "speaking"
      : phase >= PHASES.SKEPTIC_THINKING
      ? "thinking"
      : "listening";

  const nitpickerState = "listening";
  const sowhatState = "listening";

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-[#1a1a1a] bg-[#080808]">
      {/* Ambient glow inside the mockup */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 h-32 w-64 -translate-x-1/2 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.06) 0%, transparent 70%)",
        }}
      />

      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-[#141414] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="h-2 w-2 rounded-full bg-[#2a2a2a]" />
            <div className="h-2 w-2 rounded-full bg-[#2a2a2a]" />
            <div className="h-2 w-2 rounded-full bg-[#2a2a2a]" />
          </div>
          <span className="ml-2 text-[10px] uppercase tracking-wider text-neutral-600">
            Sparring Room — Thesis Defense
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-neutral-600">
          02:14
        </div>
      </div>

      {/* Main content area */}
      <div className="flex h-[280px] sm:h-[320px]">
        {/* Left: transcript */}
        <div className="flex-1 overflow-hidden border-r border-[#141414] p-4">
          {/* User message */}
          <div className="flex justify-end mb-3">
            <div className="max-w-[80%]">
              <p className="mb-1 text-right text-[9px] uppercase tracking-wider text-neutral-600">
                You
              </p>
              <div className="rounded-md rounded-br-sm border border-[#2a2a2a] bg-[#171717] px-3 py-2 text-xs text-neutral-200">
                I think maybe our market is roughly 50 billion...
              </div>
            </div>
          </div>

          {/* Persona message */}
          <div className="flex gap-2.5">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-[#1a1a1a] ring-1 ring-[#2a2a2a]">
              <Search className="h-3.5 w-3.5 text-neutral-400" />
            </div>
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-1.5">
                <span className="text-[10px] font-medium text-neutral-300">
                  Ada
                </span>
                {phase >= PHASES.SKEPTIC_SPEAKING && (
                  <span className="flex items-center gap-0.5 text-[8px] uppercase tracking-wider text-neutral-400">
                    <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-white" />
                    Speaking
                  </span>
                )}
                {phase >= PHASES.SKEPTIC_THINKING &&
                  phase < PHASES.SKEPTIC_SPEAKING && (
                    <span className="flex items-center gap-0.5 text-[8px] uppercase tracking-wider text-neutral-500">
                      <span className="flex gap-0.5">
                        <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-neutral-500" style={{ animationDelay: "0ms" }} />
                        <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-neutral-500" style={{ animationDelay: "150ms" }} />
                        <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-neutral-500" style={{ animationDelay: "300ms" }} />
                      </span>
                      Thinking
                    </span>
                  )}
              </div>
              {/* Caption bubble */}
              <div
                className={cn(
                  "rounded-md rounded-bl-sm border px-3 py-2 text-xs text-neutral-200 transition-all",
                  phase >= PHASES.SKEPTIC_SPEAKING
                    ? "border-[#2a2a2a] bg-[#0f0f0f] opacity-100"
                    : "border-[#141414] bg-[#0a0a0a] opacity-0"
                )}
                style={{ minHeight: "36px" }}
              >
                {typedText}
                {phase >= PHASES.TYPING_CAPTION &&
                  phase < PHASES.WAVEFORM_ACTIVE && (
                    <span className="ml-0.5 inline-block w-[2px] h-3 bg-white align-middle animate-pulse" />
                  )}
              </div>
            </div>
          </div>

          {/* Waveform (shows when speaking) */}
          {phase >= PHASES.SKEPTIC_SPEAKING && (
            <div className="mt-3 flex items-center gap-[1.5px] h-4">
              {waveformBars.map((h, i) => (
                <div
                  key={i}
                  className="w-[2px] rounded-full bg-neutral-400 transition-all duration-75"
                  style={{
                    height: `${h}px`,
                    opacity: 0.3 + (h / 15) * 0.5,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: panel */}
        <div className="w-[140px] sm:w-[160px] border-l border-[#141414] bg-[#0a0a0a] p-2.5">
          <p className="mb-2 text-[8px] uppercase tracking-[0.15em] text-neutral-600">
            The Panel
          </p>
          <div className="space-y-2">
            <MockupPersonaCard
              icon={<Search className="h-3 w-3" />}
              name="Ada"
              state={skepticState}
            />
            <MockupPersonaCard
              icon={<Microscope className="h-3 w-3" />}
              name="Victor"
              state={nitpickerState}
            />
            <MockupPersonaCard
              icon={<Target className="h-3 w-3" />}
              name="Chiara"
              state={sowhatState}
            />
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between border-t border-[#141414] px-4 py-2">
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-colors",
              phase >= PHASES.SKEPTIC_SPEAKING
                ? "bg-white animate-pulse"
                : "bg-[#2a2a2a]"
            )}
          />
          <span className="text-[9px] uppercase tracking-wider text-neutral-600">
            {phase >= PHASES.SKEPTIC_SPEAKING
              ? "Panel speaking"
              : phase >= PHASES.SKEPTIC_THINKING
              ? "Panel thinking"
              : "Listening"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Mic className="h-3 w-3 text-neutral-600" />
          <span className="text-[9px] uppercase tracking-wider text-neutral-600">
            Click to speak
          </span>
        </div>
      </div>
    </div>
  );
}

function MockupPersonaCard({
  icon,
  name,
  state,
}: {
  icon: React.ReactNode;
  name: string;
  state: "listening" | "thinking" | "speaking";
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-2 transition-all duration-300",
        state === "speaking"
          ? "border-[#2a2a2a] bg-[#141414]"
          : state === "thinking"
          ? "border-[#1e1e1e] bg-[#0f0f0f]"
          : "border-[#141414] bg-[#080808]"
      )}
    >
      <div className="flex items-center gap-1.5">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-[#1a1a1a] ring-1 ring-[#222]">
          {icon}
        </div>
        <span className="text-[9px] font-medium text-neutral-300">{name}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-1">
        {state === "speaking" ? (
          <>
            <span className="h-1 w-1 animate-pulse rounded-full bg-white" />
            <span className="text-[7px] uppercase tracking-wider text-neutral-300">
              Speaking
            </span>
          </>
        ) : state === "thinking" ? (
          <>
            <span className="h-1 w-1 rounded-full bg-neutral-500" />
            <span className="text-[7px] uppercase tracking-wider text-neutral-500">
              Thinking
            </span>
          </>
        ) : (
          <>
            <span className="h-1 w-1 rounded-full bg-neutral-600" />
            <span className="text-[7px] uppercase tracking-wider text-neutral-600">
              Listening
            </span>
          </>
        )}
      </div>
    </div>
  );
}
