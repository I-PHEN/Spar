// Spar — Experience definitions
//
// An "experience" bundles: the flow (how the session progresses) + the room
// context (what the personas know about the situation) + the default panel.
//
// This replaces the old "scenario" + "mode" two-step. One choice, one flow.
//
// 4 experiences:
//   defense    — Present uninterrupted, then Q&A (thesis, investor pitch, board)
//   boardroom  — Present with mid-speech interruption (hostile rooms)
//   open_spar  — Instant back-and-forth, no presentation (interviews, topic exploration)
//   drill      — Targeted weakness, immediate interrupts (breaking a habit)
//
// Defense and Boardroom are hidden from the product UI (see VISIBLE_EXPERIENCES)
// but retained in code: existing sessions in those modes still open.

import type { ArchetypeKey, BehaviorStyle } from "./types";

export type ExperienceKey = "defense" | "boardroom" | "open_spar" | "drill";
export type DrillTarget =
  | "hedging"
  | "over-explaining"
  | "recovery-speed"
  | "evidence-gaps";

export interface ExperienceDefinition {
  key: ExperienceKey;
  label: string;
  tagline: string;
  description: string;
  /** What the user sees when the room opens */
  openingPrompt: string;
  /** Default room context string (personas see this) */
  roomContext: string;
  /** Default panel configuration */
  defaultPanel: Array<{
    archetype: ArchetypeKey;
    behaviorStyle: BehaviorStyle;
  }>;
  /** Whether the user presents first (true) or the panel speaks first (false) */
  userPresentsFirst: boolean;
}

export const EXPERIENCES: Record<ExperienceKey, ExperienceDefinition> = {
  defense: {
    key: "defense",
    label: "Defense",
    tagline: "Present your material, then face the Q&A",
    description:
      "You present uninterrupted. When you're done, the panel reviews and questions you. For thesis defenses, investor pitches, board presentations, conference talks.",
    openingPrompt: "The floor is yours. Present your material.",
    roomContext:
      "A formal presentation followed by Q&A. The user will present their material uninterrupted, then the panel will question them on what they presented.",
    defaultPanel: [
      { archetype: "skeptic", behaviorStyle: "moderate" },
      { archetype: "nitpicker", behaviorStyle: "moderate" },
      { archetype: "so_what", behaviorStyle: "moderate" },
    ],
    userPresentsFirst: true,
  },
  boardroom: {
    key: "boardroom",
    label: "Boardroom",
    tagline: "Present while they interrupt you",
    description:
      "You present, but the panel interrupts mid-speech when they detect weakness. You must recover and continue. For board updates, hostile investor meetings, consulting readouts.",
    openingPrompt: "Present. They will interrupt you.",
    roomContext:
      "A high-pressure presentation where the panel interrupts mid-speech. The user presents but will be cut off when they make weak claims, hedge, or ramble.",
    defaultPanel: [
      { archetype: "skeptic", behaviorStyle: "moderate" },
      { archetype: "timekeeper", behaviorStyle: "aggressive" },
      { archetype: "so_what", behaviorStyle: "moderate" },
    ],
    userPresentsFirst: true,
  },
  open_spar: {
    key: "open_spar",
    label: "Q&A",
    tagline: "They ask. You answer. They push back.",
    description: "They ask. You answer. They push back.",
    openingPrompt: "The panel is ready. They'll open.",
    roomContext:
      "An open sparring session. The panel asks questions and the user answers. No presentation phase — direct back-and-forth.",
    defaultPanel: [
      { archetype: "skeptic", behaviorStyle: "moderate" },
      { archetype: "so_what", behaviorStyle: "moderate" },
    ],
    userPresentsFirst: false,
  },
  drill: {
    key: "drill",
    label: "Drill",
    tagline: "Hammer one weakness until it's fixed",
    description:
      "The panel focuses on your chosen weakness. Every instance gets interrupted immediately. Repetitive, targeted pressure. For breaking a specific bad habit.",
    openingPrompt: "DRILL mode. Every instance of your weakness gets interrupted.",
    roomContext:
      "A targeted drill session. The panel's sole purpose is to force the user to stop a specific bad habit. Relentless, repetitive pressure.",
    defaultPanel: [
      { archetype: "skeptic", behaviorStyle: "aggressive" },
      { archetype: "timekeeper", behaviorStyle: "aggressive" },
    ],
    userPresentsFirst: false,
  },
};

export const EXPERIENCE_LIST = Object.values(EXPERIENCES);

/** Modes reachable in the product UI, in display order (Q&A is primary). */
export const VISIBLE_EXPERIENCES: readonly ExperienceKey[] = [
  "open_spar",
  "drill",
];

export const VISIBLE_EXPERIENCE_LIST = VISIBLE_EXPERIENCES.map(
  (key) => EXPERIENCES[key],
);

export const DRILL_TARGETS: Array<{
  id: DrillTarget;
  label: string;
  description: string;
  /** The archetype that leads the drill for this target */
  leadArchetype: ArchetypeKey;
  /** The detection regex pattern (used by the agitation engine) */
  detectionHint: string;
}> = [
  {
    id: "hedging",
    label: "Hedging",
    description: "Stop using 'I think', 'maybe', 'sort of'",
    leadArchetype: "skeptic",
    detectionHint: "hedge words",
  },
  {
    id: "over-explaining",
    label: "Over-explaining",
    description: "Answer in 15 words or less",
    leadArchetype: "timekeeper",
    detectionHint: "long answers",
  },
  {
    id: "recovery-speed",
    label: "Recovery speed",
    description: "Respond within 2 seconds of being asked",
    leadArchetype: "skeptic",
    detectionHint: "long pauses",
  },
  {
    id: "evidence-gaps",
    label: "Evidence gaps",
    description: "Back every claim with data",
    leadArchetype: "nitpicker",
    detectionHint: "claims without evidence",
  },
];
