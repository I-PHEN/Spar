import { ARCHETYPES } from "@/lib/personas";
import { EXPERIENCES, type ExperienceKey } from "@/lib/experiences";
import {
  intensityNumberFromBehavior,
  type PanelIntensityKey,
} from "@/lib/user-preferences";
import { isAccentKey, type AccentKey } from "@/lib/voice-accents";
import type { ArchetypeKey } from "@/lib/types";

export interface PanelSeat {
  archetype: ArchetypeKey;
  name: string;
  intensity: 1 | 2 | 3;
  filled: boolean;
  accent?: AccentKey;
}

export const MAX_SEATS = 3;

/** One filled seat: the experience's lead panelist (Q&A and Drill both lead with skeptic). */
export function defaultSeatsFor(
  experience: ExperienceKey,
  panelIntensity?: PanelIntensityKey,
): PanelSeat[] {
  const lead = EXPERIENCES[experience].defaultPanel[0];
  const resolvedStyle = panelIntensity ?? lead.behaviorStyle;
  return [
    {
      archetype: lead.archetype,
      name: ARCHETYPES[lead.archetype].defaultName,
      intensity: intensityNumberFromBehavior(resolvedStyle),
      filled: true,
    },
  ];
}

export function normalizePanelSeat(raw: unknown): PanelSeat | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const rawArchetype = record.archetype;
  const archetype: ArchetypeKey =
    typeof rawArchetype === "string" && rawArchetype in ARCHETYPES
      ? (rawArchetype as ArchetypeKey)
      : "skeptic";
  const intensity: 1 | 2 | 3 =
    record.intensity === 1 || record.intensity === 2 || record.intensity === 3
      ? record.intensity
      : intensityNumberFromBehavior(
          typeof record.behaviorStyle === "string" ? record.behaviorStyle : null,
        );
  const name =
    typeof record.name === "string" && record.name.trim().length > 0
      ? record.name
      : ARCHETYPES[archetype].defaultName;
  const filled = record.filled === false ? false : true;
  const accent =
    isAccentKey(record.accent) && record.accent !== "mixed"
      ? record.accent
      : undefined;

  return {
    archetype,
    name,
    intensity,
    filled,
    ...(accent ? { accent } : {}),
  };
}

/** Append an unfilled seat if under MAX_SEATS; otherwise return seats unchanged. */
export function addSeat(seats: PanelSeat[]): PanelSeat[] {
  if (seats.length >= MAX_SEATS) return seats;
  return [
    ...seats,
    { archetype: "skeptic", name: "", intensity: 2, filled: false },
  ];
}
