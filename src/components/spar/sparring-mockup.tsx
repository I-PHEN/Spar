"use client";

import { useEffect, useState } from "react";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Animated Sparring Room Mockup — the TRUTH mockup.
 *
 * A self-contained auto-playing loop that mirrors the real room as it
 * exists today (Project 3): one panelist by default (Ada), an equal
 * circular presence tinted with her accent, the room's state language
 * (listening → gathering → speaking), an accent-edged caption, a ghost
 * user bubble, and the classic mic ("Start speaking"). No hidden modes,
 * no invented panel of three.
 *
 * Decorative: the whole thing is aria-hidden, and the loop freezes on a
 * calm still frame under prefers-reduced-motion.
 */

const ADA_ACCENT = "oklch(0.68 0.13 250)";

const CHALLENGE = "Hold on. Drop the qualifier. Say it directly.";

const USER_LINE = "I think maybe our market is roughly 50 billion...";

const PHASES = {
  PRESENCE_LANDS: 0,
  GATHERING: 1100,
  SPEAKING: 1900,
  TYPING_CAPTION: 2400,
  USER_SPEAKS: 4400,
  RESET: 6600,
} as const;

export function SparringMockup() {
  const [phase, setPhase] = useState<number>(PHASES.PRESENCE_LANDS);
  const [typedText, setTypedText] = useState("");

  // Master loop. Under prefers-reduced-motion the mock rests on the
  // speaking still frame — calm, no rAF churn.
  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const frame = requestAnimationFrame(() => {
        setPhase(PHASES.SPEAKING);
        setTypedText(CHALLENGE);
      });
      return () => cancelAnimationFrame(frame);
    }

    const startTime = Date.now();
    let animationFrame: number;
    const update = () => {
      const cycleTime = (Date.now() - startTime) % PHASES.RESET;
      if (cycleTime < PHASES.GATHERING) {
        setPhase(PHASES.PRESENCE_LANDS);
        setTypedText("");
      } else if (cycleTime < PHASES.SPEAKING) {
        setPhase(PHASES.GATHERING);
        setTypedText("");
      } else if (cycleTime < PHASES.TYPING_CAPTION) {
        setPhase(PHASES.SPEAKING);
        setTypedText("");
      } else if (cycleTime < PHASES.USER_SPEAKS) {
        setPhase(PHASES.TYPING_CAPTION);
        setTypedText(CHALLENGE.slice(0, Math.floor((cycleTime - PHASES.TYPING_CAPTION) / 28)));
      } else {
        setPhase(PHASES.USER_SPEAKS);
        setTypedText(CHALLENGE);
      }
      animationFrame = requestAnimationFrame(update);
    };
    animationFrame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  const gathering = phase >= PHASES.GATHERING && phase < PHASES.SPEAKING;
  const speaking = phase >= PHASES.SPEAKING;
  const userSpeaking = phase >= PHASES.USER_SPEAKS;

  const statusWord = userSpeaking
    ? "Listening"
    : speaking
    ? "Speaking"
    : gathering
    ? "Gathering…"
    : "Listening";

  return (
    <div
      aria-hidden
      className="relative w-full overflow-hidden rounded-lg border border-[#1a1a1a] bg-[#080808]"
    >
      {/* Ambient glow inside the mockup */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 h-32 w-64 -translate-x-1/2 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.06) 0%, transparent 70%)",
        }}
      />

      {/* Top bar — the real mode chip + engine chip, like the room */}
      <div className="flex items-center justify-between border-b border-[#141414] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="h-2.5 w-2.5 rounded-full bg-[#2a2a2a]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#2a2a2a]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#2a2a2a]" />
          </div>
          <span className="ml-2 text-[11px] text-neutral-500">Sparring Room</span>
          <span className="rounded border border-[#2a2a2a] bg-[#171717] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-neutral-200">
            Q&A
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            data-engine="classic"
            className="rounded border border-[#2a2a2a] bg-[#171717] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-neutral-400"
          >
            Classic
          </span>
          <span className="font-mono text-[11px] text-neutral-500">02:14</span>
        </div>
      </div>

      {/* Body — conversation column + presence rail, like the room */}
      <div className="flex h-[280px] sm:h-[320px]">
        {/* Conversation */}
        <div className="flex flex-1 flex-col justify-end gap-3 px-4 py-4 sm:px-5">
          {/* Ada's challenge — accent-edged, typed live */}
          {(speaking || typedText) && (
            <div className="spar-fade-up max-w-[85%]">
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                Ada
              </div>
              <div
                className="rounded-md rounded-bl-sm border border-[#1a1a1a] bg-[#0f0f0f] px-3.5 py-2.5 text-xs leading-relaxed text-neutral-200"
                style={{
                  borderLeft: `2px solid color-mix(in oklab, ${ADA_ACCENT} 45%, transparent)`,
                }}
              >
                {typedText}
                {speaking && !typedText && (
                  <span className="text-neutral-600">…</span>
                )}
              </div>
            </div>
          )}

          {/* The user answers — ghost interim bubble */}
          {userSpeaking && (
            <div className="spar-fade-up flex justify-end">
              <div className="max-w-[85%] text-right">
                <div className="mb-1 text-[10px] uppercase tracking-wider text-neutral-500">
                  Speaking...
                </div>
                <div className="rounded-md rounded-br-sm border border-[#1a1a1a] bg-[#0a0a0a] px-3.5 py-2.5 text-xs text-neutral-300 italic">
                  {USER_LINE}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Presence rail — one equal circular presence: the true default */}
        <div className="hidden w-[130px] flex-col items-center justify-center gap-3 border-l border-[#141414] bg-[#0a0a0a] px-3 py-4 sm:flex sm:w-[150px]">
          <div
            className={cn(
              "flex h-20 w-20 select-none items-center justify-center rounded-full text-lg font-semibold tracking-wide",
              speaking && "spar-presence-speaking"
            )}
            style={{
              background: `color-mix(in oklab, ${ADA_ACCENT} 14%, oklch(0.16 0 0))`,
              color: `color-mix(in oklab, ${ADA_ACCENT} 55%, oklch(0.92 0 0))`,
              boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${ADA_ACCENT} 22%, transparent)`,
            }}
          >
            A
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white">Ada</p>
            <div className="mt-1.5 flex items-center justify-center gap-1.5">
              {gathering ? (
                <span className="flex gap-0.5">
                  <span className="spar-thinking-dot inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <span className="spar-thinking-dot inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <span className="spar-thinking-dot inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                </span>
              ) : (
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: speaking ? ADA_ACCENT : "#525252" }}
                />
              )}
              <span className="text-[9px] uppercase tracking-wider text-neutral-500">
                {statusWord}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar — the classic mic, in the room's words */}
      <div className="flex items-center justify-between border-t border-[#141414] px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-colors",
              speaking ? "animate-pulse bg-white" : "bg-[#2a2a2a]"
            )}
          />
          <span className="text-[9px] uppercase tracking-wider text-neutral-500">
            {userSpeaking ? "Listening to you" : statusWord === "Speaking" ? "Ada is speaking" : "Panel is ready"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Mic className="h-3 w-3 text-neutral-400" />
          <span className="text-[9px] uppercase tracking-wider text-neutral-500">
            Start speaking
          </span>
        </div>
      </div>
    </div>
  );
}
