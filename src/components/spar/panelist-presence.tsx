"use client";

import { ARCHETYPES } from "@/lib/personas";
import type { ArchetypeKey } from "@/lib/types";
import type { PresenceState } from "./room-state";
import { cn } from "@/lib/utils";

interface PanelistPresenceProps {
  archetype: ArchetypeKey;
  name: string;
  /** The room's state language — listening / gathering / speaking. */
  status: PresenceState;
  /** portrait = the lead panelist's focal block; row = compact extra panelist. */
  variant?: "portrait" | "row";
  /** One-beat barge-in acknowledgment (live mode's "you cut in" tell). */
  interrupted?: boolean;
  /** Agitation tell — the avatar pulses just before an interruption. */
  aboutToInterrupt?: boolean;
}

const STATUS_WORD: Record<PresenceState, string> = {
  listening: "Listening",
  gathering: "Gathering…",
  speaking: "Speaking",
};

/**
 * Panelist presence — the room's signature element.
 *
 * The active panelist is the room's focal visual: a portrait-scale block
 * whose accent is the persona's own muted hue (the room's only color), with
 * one quiet status line underneath. No meters, no badges — the presence
 * breathes while listening, gathers while thinking, and glows in its accent
 * while speaking. Motion is one orchestrated state language, disabled under
 * prefers-reduced-motion.
 */
export function PanelistPresence({
  archetype,
  name,
  status,
  variant = "portrait",
  interrupted = false,
  aboutToInterrupt = false,
}: PanelistPresenceProps) {
  const def = ARCHETYPES[archetype];
  const accent = def.accentHue;
  const word = STATUS_WORD[status];
  const isPortrait = variant === "portrait";

  // Avatar block: dark slate tinted with the persona's accent. The accent is
  // the only color in the room — everything else stays neutral.
  const avatarStyle = {
    background: `color-mix(in oklab, ${accent} 14%, oklch(0.16 0 0))`,
    color: `color-mix(in oklab, ${accent} 55%, oklch(0.92 0 0))`,
    boxShadow:
      status === "speaking"
        ? `0 0 48px -12px ${accent}`
        : `inset 0 0 0 1px color-mix(in oklab, ${accent} 22%, transparent)`,
  };

  const avatarClass = cn(
    "spar-presence-avatar relative inline-flex select-none items-center justify-center rounded-2xl font-semibold tracking-wide",
    isPortrait ? "h-36 w-36 text-2xl sm:h-44 sm:w-44 sm:text-3xl" : "h-9 w-9 rounded-lg text-xs",
    status === "listening" && "spar-presence-breathe",
    status === "speaking" && "spar-presence-speaking",
    aboutToInterrupt && "spar-pulse",
    interrupted && "spar-presence-flicker",
  );

  return (
    <div
      className={cn(
        "flex flex-col",
        isPortrait ? "items-center text-center" : "items-center gap-2.5 sm:flex-row sm:text-left",
      )}
    >
      <div className={avatarClass} style={avatarStyle} aria-hidden>
        {def.initials}
      </div>

      <div className={cn(isPortrait ? "mt-4" : "min-w-0 flex-1")}>
        <p
          className={cn(
            "font-medium leading-tight text-white",
            isPortrait ? "text-base" : "truncate text-sm",
          )}
        >
          {name}
        </p>
        {isPortrait && (
          <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">{def.tagline}</p>
        )}

        {/* One quiet status line — the room's whole state language. */}
        <div
          className={cn(
            "flex items-center gap-1.5 text-neutral-500",
            isPortrait ? "mt-3 justify-center" : "mt-0.5",
          )}
        >
          {status === "gathering" ? (
            <span className="flex gap-0.5">
              <span className="spar-thinking-dot inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span className="spar-thinking-dot inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span className="spar-thinking-dot inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
            </span>
          ) : status === "speaking" ? (
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: accent }}
            />
          ) : (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neutral-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-neutral-500" />
            </span>
          )}
          <span
            className={cn(
              "uppercase tracking-wider",
              isPortrait ? "text-[10px]" : "text-[9px]",
              status === "speaking" && "text-neutral-300",
            )}
          >
            {word}
          </span>
        </div>
      </div>
    </div>
  );
}
