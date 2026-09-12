// Spar — Scenario definitions
// Per brief section 3.2: Thesis Defense, Investor Pitch, Board Update,
// Performance Review, Grant Defense, Client Presentation, Custom.

import type { ScenarioKey } from "./types";

export interface ScenarioDefinition {
  key: ScenarioKey;
  label: string;
  /** Short description shown in the picker */
  description: string;
  /** The "room" — who's in it, what's at stake */
  roomContext: string;
  /** Default persona configuration (2-3 archetypes that fit this scenario) */
  defaultPanel: Array<{
    archetype: import("./types").ArchetypeKey;
    behaviorStyle: import("./types").BehaviorStyle;
  }>;
  /** Suggested focus for the scenario — shown in the UI */
  focus: string;
}

export const SCENARIOS: Record<ScenarioKey, ScenarioDefinition> = {
  thesis_defense: {
    key: "thesis_defense",
    label: "Thesis Defense",
    description: "Defend your research before a committee of experts.",
    roomContext:
      "A thesis defense committee. Three faculty members probing your methodology, your contribution, and the significance of your work. Stakes: your degree.",
    defaultPanel: [
      { archetype: "skeptic", behaviorStyle: "moderate" },
      { archetype: "nitpicker", behaviorStyle: "moderate" },
      { archetype: "so_what", behaviorStyle: "gentle" },
    ],
    focus: "Defend your core contribution and methodology under direct questioning.",
  },
  investor_pitch: {
    key: "investor_pitch",
    label: "Investor Pitch",
    description: "Pitch your startup to a panel of investors.",
    roomContext:
      "A seed-stage investor pitch. Three partners probing market size, defensibility, and your numbers. Stakes: your round.",
    defaultPanel: [
      { archetype: "skeptic", behaviorStyle: "aggressive" },
      { archetype: "so_what", behaviorStyle: "moderate" },
      { archetype: "timekeeper", behaviorStyle: "moderate" },
    ],
    focus: "Justify your market, your numbers, and why now — under tight time pressure.",
  },
  board_update: {
    key: "board_update",
    label: "Board Update",
    description: "Report progress to your board of directors.",
    roomContext:
      "A quarterly board meeting. Directors probing your metrics, your strategy, and your asks. Stakes: your runway and your authority.",
    defaultPanel: [
      { archetype: "skeptic", behaviorStyle: "moderate" },
      { archetype: "so_what", behaviorStyle: "moderate" },
      { archetype: "timekeeper", behaviorStyle: "aggressive" },
    ],
    focus: "Be concise, be specific, defend your numbers and your strategy.",
  },
  performance_review: {
    key: "performance_review",
    label: "Performance Review",
    description: "Defend your work in a performance review.",
    roomContext:
      "A performance review with your manager and a skip-level. They're probing your impact, your growth, and your next role. Stakes: your trajectory.",
    defaultPanel: [
      { archetype: "so_what", behaviorStyle: "moderate" },
      { archetype: "ally", behaviorStyle: "moderate" },
      { archetype: "nitpicker", behaviorStyle: "gentle" },
    ],
    focus: "Ground your impact in evidence, own your gaps, defend your trajectory.",
  },
  grant_defense: {
    key: "grant_defense",
    label: "Grant Defense",
    description: "Defend your grant proposal before a review panel.",
    roomContext:
      "A grant review panel. Reviewers probing your methodology, your budget, and your feasibility. Stakes: your funding.",
    defaultPanel: [
      { archetype: "nitpicker", behaviorStyle: "moderate" },
      { archetype: "skeptic", behaviorStyle: "moderate" },
      { archetype: "so_what", behaviorStyle: "gentle" },
    ],
    focus: "Defend your methodology rigor, your budget realism, and your significance.",
  },
  client_presentation: {
    key: "client_presentation",
    label: "Client Presentation",
    description: "Present a proposal to a prospective client.",
    roomContext:
      "A client pitch meeting. Buyers probing your value, your differentiation, and your risk. Stakes: the deal.",
    defaultPanel: [
      { archetype: "skeptic", behaviorStyle: "moderate" },
      { archetype: "so_what", behaviorStyle: "aggressive" },
      { archetype: "ally", behaviorStyle: "moderate" },
    ],
    focus: "Justify value, differentiate, and address risk head-on.",
  },
  custom: {
    key: "custom",
    label: "Custom",
    description: "Configure the room yourself.",
    roomContext:
      "A custom sparring session. The panel will challenge you based on the personas you select.",
    defaultPanel: [
      { archetype: "skeptic", behaviorStyle: "moderate" },
      { archetype: "so_what", behaviorStyle: "moderate" },
    ],
    focus: "Practice defending your ideas under pressure.",
  },
};

export const SCENARIO_LIST = Object.values(SCENARIOS);
