"use client";

import { ARCHETYPES } from "@/lib/personas";
import type { ArchetypeKey, BehaviorStyle, PersonaMood } from "@/lib/types";
import { PersonaAvatar } from "./persona-avatar";
import { cn } from "@/lib/utils";

interface PersonaCardProps {
  archetype: ArchetypeKey;
  name: string;
  behaviorStyle: BehaviorStyle;
  state: "idle" | "listening" | "thinking" | "speaking" | "about-to-interrupt";
  mood: PersonaMood;
  /** Interrupt meter fill level (0-5) */
  interruptLevel?: number;
  /** Sidebar mode (vertical, full) vs compact (mobile horizontal) */
  variant?: "sidebar" | "compact";
}

const MOOD_LABELS: Record<PersonaMood, { label: string }> = {
  neutral: { label: "Listening" },
  listening: { label: "Listening" },
  thinking: { label: "Thinking" },
  speaking: { label: "Speaking" },
  pressing: { label: "Pressing" },
  skeptical: { label: "Skeptical" },
  curious: { label: "Curious" },
  satisfied: { label: "Acknowledged" },
  frustrated: { label: "Pressing harder" },
};

const BEHAVIOR_LABELS: Record<BehaviorStyle, string> = {
  gentle: "Gentle",
  moderate: "Moderate",
  aggressive: "Aggressive",
};

/**
 * Persona card — redesigned for the sidebar layout.
 *
 * Key changes from the old card:
 *   - Full names (no truncation — allow wrap)
 *   - Accent left border when speaking (per archetype: blue/amber/red/emerald/violet)
 *   - Card scales up slightly when active
 *   - Interrupt meter (5 dots that fill as the user speaks)
 *   - Status dot: listening=gray, thinking=amber+pulse, speaking=white+glow
 */
export function PersonaCard({
  archetype,
  name,
  behaviorStyle,
  state,
  mood,
  interruptLevel = 0,
  variant = "sidebar",
}: PersonaCardProps) {
  const def = ARCHETYPES[archetype];
  const moodInfo = MOOD_LABELS[mood] || MOOD_LABELS.neutral;

  const speaking = state === "speaking";
  const aboutToInterrupt = state === "about-to-interrupt";
  const thinking = state === "thinking";
  const isActive = speaking || aboutToInterrupt;

  const isCompact = variant === "compact";

  // Accent border class (only when active)
  const accentBorder = isActive ? def.accentBorder : "";

  return (
    <div
      className={cn(
        "relative rounded-xl border bg-[#111]/80 transition-all duration-300",
        isCompact ? "p-2.5 min-w-[160px]" : "p-4 mb-3",
        isActive
          ? cn(
              "border-white/20 bg-[#1a1a1a] scale-[1.02] shadow-[0_0_30px_rgba(255,255,255,0.03)]",
              accentBorder,
              "border-l-2"
            )
          : thinking
          ? "border-white/15"
          : "border-white/[0.06]"
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <PersonaAvatar
            archetype={archetype}
            size={isCompact ? "sm" : "sm"}
            state={state}
          />
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-semibold leading-tight whitespace-normal break-words">
              {name}
            </p>
            {!isCompact && (
              <p className="text-[10px] text-neutral-500 mt-0.5 truncate">
                {def.tagline}
              </p>
            )}
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/10 text-neutral-400 flex-shrink-0">
          {BEHAVIOR_LABELS[behaviorStyle]}
        </span>
      </div>

      {/* Status line */}
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        {thinking ? (
          <span className="flex items-center gap-1.5">
            <span className="flex gap-0.5">
              <span className="spar-thinking-dot inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span className="spar-thinking-dot inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span className="spar-thinking-dot inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
            </span>
            <span className="uppercase tracking-wider">Thinking</span>
          </span>
        ) : speaking ? (
          <span className="flex items-center gap-1.5 text-white">
            <span className="inline-block h-2 w-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)] animate-pulse" />
            <span className="uppercase tracking-wider font-medium">{moodInfo.label}</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-neutral-600" />
            <span className="uppercase tracking-wider">{moodInfo.label}</span>
          </span>
        )}
      </div>

      {/* Interrupt meter — 5 dots */}
      {!isCompact && (
        <div className="flex gap-1 mt-3">
          {[0, 1, 2, 3, 4].map((i) => {
            const filled = i < interruptLevel;
            const warning = filled && interruptLevel >= 4;
            return (
              <div
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors duration-500",
                  filled
                    ? warning
                      ? "bg-amber-400"
                      : "bg-white"
                    : "bg-neutral-800"
                )}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
