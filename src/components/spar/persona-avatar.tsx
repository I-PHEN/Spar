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
 * Persona avatar — clean initials with muted accent hue.
 * NO cartoon/anime avatars (per the brief's "Not Toyish" rules).
 * The avatar's border treatment reflects the persona's current state.
 */
export function PersonaAvatar({
  archetype,
  size = "md",
  initials,
  state = "idle",
}: PersonaAvatarProps) {
  const def = ARCHETYPES[archetype];
  const hue = def.accentHue;
  const label = (initials || def.initials).slice(0, 2).toUpperCase();

  // Border / glow treatment by state.
  const borderClass =
    state === "speaking"
      ? "ring-2 ring-offset-2 ring-offset-background"
      : state === "about-to-interrupt"
      ? "spar-pulse"
      : state === "thinking"
      ? "ring-1 ring-border"
      : "ring-1 ring-border/50";

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full font-semibold tracking-wide ${SIZE_CLASSES[size]} ${borderClass}`}
      style={{
        background: `linear-gradient(135deg, ${hue} 0%, ${hue.replace(/oklch\(([^)]+)\)/, (m, p) => {
          // Darken the hue for the gradient end
          const parts = p.split(" ").map((x: string) => parseFloat(x));
          return `oklch(${Math.max(0.25, parts[0] - 0.18)} ${parts[1]} ${parts[2]})`;
        })} 100%)`,
        color: "oklch(0.16 0.008 250)",
        // Override the ring color via inline style to match the hue.
        ...(state === "speaking" ? { ["--tw-ring-color" as string]: hue } : {}),
      }}
      aria-hidden
    >
      {label}
    </div>
  );
}
