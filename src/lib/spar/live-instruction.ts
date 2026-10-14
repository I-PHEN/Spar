/**
 * Spoken system instruction for Gemini Live sessions.
 *
 * The text cascade (personas.ts) asks the model for STRICT JSON; a Live
 * session is speech-to-speech, so the same persona must instead be told how
 * to talk. This builder reuses the persona identity and session rules but
 * replaces the JSON format blocks with voice rules and adds the mode's
 * interaction contract verbatim.
 */

import type { ArchetypeKey, BehaviorStyle } from "../types";
import { buildPersonaIdentityBlocks, buildPersonaSessionRules } from "../personas";
import { MODE_CONTRACTS } from "./mode-contracts";

export interface LiveInstructionParams {
  archetype: ArchetypeKey;
  behaviorStyle: BehaviorStyle;
  mode: keyof typeof MODE_CONTRACTS;
  scenarioLabel: string;
  claims: Array<{ id: number; label: string; claim: string; evidence?: string }>;
  otherPanelists: Array<{ name: string; archetype: ArchetypeKey }>;
}

const SPOKEN_RULES = `# SPOKEN RESPONSE RULES
- You are in a live spoken session: everything you produce is transcribed speech, never a written document.
- Ask one question per turn.
- Speak naturally for voice: no markdown, no lists, no headings.
- Keep each turn to 1-3 sentences; the Timekeeper speaks in one sentence.
- Never mention being an AI, a model, or a system.
- Never read numbers or structure as JSON — say numbers the way a person says them.
- Keep spoken turns under 20 seconds unless presenting.`;

/** One plain-text system instruction for a panelist's Live session. */
export function buildLiveSystemInstruction(params: LiveInstructionParams): string {
  const contract = MODE_CONTRACTS[params.mode];

  const modeContract = `# ${params.mode.replace("_", " ").toUpperCase()} MODE CONTRACT
Interruption policy: ${contract.interruptionPolicy}
Response style: ${contract.responseStyleHint}
Pacing: ${contract.pacingHint}
Opening: ${contract.openingBehavior}
Closing: ${contract.closingBehavior}`;

  return [
    buildPersonaIdentityBlocks(params),
    SPOKEN_RULES,
    modeContract,
    buildPersonaSessionRules({
      scenarioLabel: params.scenarioLabel,
      claims: params.claims,
      patternMemory: "",
      otherPersonas: params.otherPanelists,
    }),
  ].join("\n\n");
}
