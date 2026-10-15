"use client";

import { ARCHETYPES } from "@/lib/personas";
import type { ArchetypeKey, PersonaMood } from "@/lib/types";
import { PersonaAvatar } from "./persona-avatar";
import { cn } from "@/lib/utils";

interface PersonaCardProps {
  archetype: ArchetypeKey;
  name: string;
  state: "idle" | "listening" | "thinking" | "speaking" | "about-to-interrupt";
  mood: PersonaMood;
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

/**
 * Persona card — redesigned for the sidebar layout.
 *
 * Key changes from the old card:
 *   - Full names (no truncation — allow wrap)
 *   - Accent left border when speaking (per archetype: blue/amber/red/emerald/violet)
 *   - Card scales up slightly when active
 *   - Status dot: listening=gray, thinking=amber+pulse, speaking=white+glow
 */
export function PersonaCard({
  archetype,
  name,
  state,
  mood,
  variant = "sidebar",
}: PersonaCardProps) {
  const def = ARCHETYPES[archetype];
  const moodInfo = MOOD_LABELS[mood] || MOOD_LABELS.neutral;

  const speaking = state === "speaking";
  const aboutToInterrupt = state === "about-to-interrupt";
  const thinking = state === "thinking";
  const isActive = speaking || aboutToInterrupt;

  const isCompact = variant === "compact";

  return (
    <div
      className={cn(
        "relative rounded-md border bg-[#101010] transition-all duration-200",
        isCompact ? "p-2.5 min-w-[160px]" : "p-4 mb-3",
        isActive
          ? "border-[#343434] bg-[#171717]"
          : thinking
          ? "border-[#252525]"
          : "border-[#202020]"
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
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neutral-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-neutral-500" />
            </span>
            <span className="uppercase tracking-wider">{moodInfo.label}</span>
          </span>
        )}
      </div>

    </div>
  );
}
