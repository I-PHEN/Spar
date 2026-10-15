import { ARCHETYPES } from "@/lib/personas";
import { EXPERIENCES, type ExperienceKey } from "@/lib/experiences";
import type { ArchetypeKey } from "@/lib/types";

export interface PanelSeat {
  archetype: ArchetypeKey;
  name: string;
  intensity: 1 | 2 | 3;
  filled: boolean;
}

export const MAX_SEATS = 3;

/** One filled seat: the experience's lead panelist (Q&A and Drill both lead with skeptic). */
export function defaultSeatsFor(experience: ExperienceKey): PanelSeat[] {
  const lead = EXPERIENCES[experience].defaultPanel[0];
  return [
    {
      archetype: lead.archetype,
      name: ARCHETYPES[lead.archetype].defaultName,
      intensity:
        lead.behaviorStyle === "gentle"
          ? 1
          : lead.behaviorStyle === "moderate"
          ? 2
          : 3,
      filled: true,
    },
  ];
}

/** Append an unfilled seat if under MAX_SEATS; otherwise return seats unchanged. */
export function addSeat(seats: PanelSeat[]): PanelSeat[] {
  if (seats.length >= MAX_SEATS) return seats;
  return [
    ...seats,
    { archetype: "skeptic", name: "", intensity: 2, filled: false },
  ];
}
