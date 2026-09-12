import type { ExperienceFlow } from "./types";

export interface ExperienceDetail {
  flow: ExperienceFlow;
  whoSpeaksFirst: string;
  presentationRule: string;
  interruptionPolicy: string;
  aiStepIds: string[];
  deterministicStepIds: string[];
  storedResults: string;
  failureBehavior: string;
}

type ExperienceNarrative = Omit<
  ExperienceDetail,
  "flow" | "aiStepIds" | "deterministicStepIds"
>;

const EXPERIENCE_NARRATIVES: Record<ExperienceFlow["id"], ExperienceNarrative> = {
  defense: {
    whoSpeaksFirst: "The user presents first.",
    presentationRule: "The user presents uninterrupted, then the panel moves into analysis and Q&A.",
    interruptionPolicy: "No interruption is permitted while the presentation is in progress.",
    storedResults: "Session transcript, telemetry, and audio clips are stored. The debrief and pattern memory are stored when debrief generation succeeds; presentation analysis is stored only when coaching is enabled and the analysis succeeds.",
    failureBehavior: "If presentation analysis fails, Q&A continues without the coach read. If debrief generation fails, ending is retried before final coaching results are available.",
  },
  boardroom: {
    whoSpeaksFirst: "The user presents first.",
    presentationRule: "The user presents under pressure and resumes the presentation after an interruption.",
    interruptionPolicy: "Live transcript heuristics can trigger a panel interruption for a weak claim, hedge, or ramble.",
    storedResults: "The presentation analysis, interruptions, transcript, telemetry, audio clips, debrief, and pattern memory are stored.",
    failureBehavior: "If live interruption signaling fails, the presentation continues without that interruption; if debrief generation fails, ending is retried before results are available.",
  },
  open_spar: {
    whoSpeaksFirst: "The panel opens the exchange.",
    presentationRule: "No presentation phase; the conversation alternates between panel challenges and user answers.",
    interruptionPolicy: "There is no presentation phase; the panel opens the exchange and live-answer interruptions can still occur.",
    storedResults: "The transcript, telemetry, audio clips, debrief, and pattern memory are stored.",
    failureBehavior: "If a live panel response fails, the current turn cannot advance; if debrief generation fails, ending is retried before results are available.",
  },
  drill: {
    whoSpeaksFirst: "The panel asks the first focused question.",
    presentationRule: "No presentation phase; the user answers one focused question at a time.",
    interruptionPolicy: "A detected target behavior immediately produces a correction and requires a retry.",
    storedResults: "The selected target, attempts, corrections, transcript, telemetry, audio clips, debrief, and pattern memory are stored.",
    failureBehavior: "If deterministic correction handling fails, the session emits an error and cannot continue that correction. Only a missing stored target falls back to the hard-coded hedging target; if debrief generation fails, ending is retried before results are available.",
  },
};

export function selectExperienceDetail(
  flows: ExperienceFlow[],
  experienceId: ExperienceFlow["id"],
): ExperienceDetail | null {
  const flow = flows.find((candidate) => candidate.id === experienceId);
  if (!flow) return null;

  return {
    flow,
    ...EXPERIENCE_NARRATIVES[flow.id],
    aiStepIds: flow.steps
      .filter((step) => step.kind === "ai")
      .map((step) => step.id),
    deterministicStepIds: flow.steps
      .filter((step) => step.kind === "code")
      .map((step) => step.id),
  };
}
