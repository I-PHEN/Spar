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
  /** Compact mode for smaller screens */
  compact?: boolean;
}

const MOOD_LABELS: Record<PersonaMood, { label: string; tone: string }> = {
  neutral: { label: "Listening", tone: "text-muted-foreground" },
  listening: { label: "Listening", tone: "text-muted-foreground" },
  thinking: { label: "Thinking", tone: "text-muted-foreground" },
  speaking: { label: "Speaking", tone: "text-foreground" },
  pressing: { label: "Pressing", tone: "text-foreground/80" },
  skeptical: { label: "Skeptical", tone: "text-foreground/80" },
  curious: { label: "Curious", tone: "text-foreground/80" },
  satisfied: { label: "Acknowledged", tone: "text-foreground/80" },
  frustrated: { label: "Pressing harder", tone: "text-foreground/80" },
};

const BEHAVIOR_LABELS: Record<BehaviorStyle, string> = {
  gentle: "Gentle",
  moderate: "Moderate",
  aggressive: "Aggressive",
};

// Monochrome behavior badges — no color, just border weight.
const BEHAVIOR_TONES: Record<BehaviorStyle, string> = {
  gentle: "border-white/20 text-muted-foreground",
  moderate: "border-white/15 text-muted-foreground",
  aggressive: "border-white/30 text-foreground/80",
};

/**
 * A single persona in the panel. Per brief section 3.3:
 * "Each shows: Listening | Speaking | Thinking. Live mood indicator.
 *  Who's about to interrupt — subtle pulse animation."
 *
 * Monochrome — no colored accents. State is conveyed via ring + text weight.
 */
export function PersonaCard({
  archetype,
  name,
  behaviorStyle,
  state,
  mood,
  compact = false,
}: PersonaCardProps) {
  const def = ARCHETYPES[archetype];
  const moodInfo = MOOD_LABELS[mood] || MOOD_LABELS.neutral;

  const speaking = state === "speaking";
  const aboutToInterrupt = state === "about-to-interrupt";
  const thinking = state === "thinking";

  return (
    <div
      className={cn(
        "relative rounded-lg border bg-card/60 transition-all duration-300",
        compact ? "p-2.5" : "p-3.5",
        speaking
          ? "border-white/40 bg-card"
          : aboutToInterrupt
          ? "border-white/30"
          : thinking
          ? "border-white/15"
          : "border-border/60"
      )}
    >
      <div className="flex items-start gap-3">
        <PersonaAvatar
          archetype={archetype}
          size={compact ? "sm" : "md"}
          state={state}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-foreground text-sm">
              {name}
            </span>
            <span
              className={cn(
                "rounded border px-1 py-px text-[9px] uppercase tracking-wider",
                BEHAVIOR_TONES[behaviorStyle]
              )}
            >
              {BEHAVIOR_LABELS[behaviorStyle]}
            </span>
          </div>
          {!compact && (
            <p className="mt-0.5 text-[11px] text-muted-foreground/70 line-clamp-1">
              {def.tagline}
            </p>
          )}
        </div>
      </div>

      {/* State indicator */}
      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {thinking ? (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="flex gap-0.5">
                <span className="spar-thinking-dot inline-block h-1 w-1 rounded-full bg-muted-foreground/80" />
                <span className="spar-thinking-dot inline-block h-1 w-1 rounded-full bg-muted-foreground/80" />
                <span className="spar-thinking-dot inline-block h-1 w-1 rounded-full bg-muted-foreground/80" />
              </span>
              <span className="uppercase tracking-wider">Thinking</span>
            </span>
          ) : speaking ? (
            <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-foreground">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-foreground" />
              {moodInfo.label}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground/60">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
              {moodInfo.label}
            </span>
          )}
        </div>
        {/* Mood dot — monochrome */}
        <span
          className={cn("inline-block h-1.5 w-1.5 rounded-full", moodInfo.tone)}
          style={{
            backgroundColor: aboutToInterrupt ? "oklch(0.96 0 0)" : undefined,
          }}
        />
      </div>
    </div>
  );
}
