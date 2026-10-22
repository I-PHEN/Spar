// Spar — Session labels
//
// Sessions store their experience key ("open_spar", "drill", …) in the
// legacy `scenario` column; pre-Project-2 sessions store true scenario keys
// ("investor_pitch", …). This resolves either to the human label the UI
// shows (the debrief header), falling back to the raw key.

import { EXPERIENCES, type ExperienceKey } from "./experiences";
import { SCENARIOS } from "./scenarios";

export function sessionLabel(key: string): string {
  if (key in EXPERIENCES) return EXPERIENCES[key as ExperienceKey].label;
  if (key in SCENARIOS) return SCENARIOS[key as keyof typeof SCENARIOS].label;
  return key;
}
