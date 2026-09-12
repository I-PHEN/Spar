"use client";

import { ARCHETYPES } from "@/lib/personas";
import type { ArchetypeKey } from "@/lib/types";

interface PersonaAvatarProps {
  archetype: ArchetypeKey;
  size?: "sm" | "md" | "lg";
  /** Override the initials (defaults to archetype initials) */
  initials?: string;
  /** State of the avatar — controls the border treatment */
  state?: "idle" | "listening" | "thinking" | "speaking" | "about-to-interrupt";
}

const SIZE_CLASSES: Record<NonNullable<PersonaAvatarProps["size"]>, string> = {
  sm: "h-9 w-9 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-base",
};

/**
 * Persona avatar — clean initials, monochrome. No colored hues.
 * The avatar's border treatment reflects the persona's current state.
 * White ring = speaking; pulse = about to interrupt; subtle ring = idle.
 */
export function PersonaAvatar({
  archetype,
  size = "md",
  initials,
  state = "idle",
}: PersonaAvatarProps) {
  const def = ARCHETYPES[archetype];
  const label = (initials || def.initials).slice(0, 2).toUpperCase();

  // Border / glow treatment by state — all monochrome.
  const borderClass =
    state === "speaking"
      ? "ring-2 ring-white ring-offset-2 ring-offset-background"
      : state === "about-to-interrupt"
      ? "spar-pulse"
      : state === "thinking"
      ? "ring-1 ring-white/30"
      : "ring-1 ring-white/10";

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full font-semibold tracking-wide ${SIZE_CLASSES[size]} ${borderClass}`}
      style={{
        background: "oklch(0.23 0 0)",       /* dark slate */
        color: "oklch(0.90 0 0)",             /* near-white initials */
      }}
      aria-hidden
    >
      {label}
    </div>
  );
}
