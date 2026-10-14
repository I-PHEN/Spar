/**
 * Mode interaction contracts for the Gemini Live voice engine.
 *
 * The six behavioral fields per mode are copied verbatim from the reviewed
 * research docs, each of which ends with the recommended contract:
 *   - docs/research/2026-09-24-mode-defense.md
 *   - docs/research/2026-09-24-mode-boardroom.md
 *   - docs/research/2026-09-24-mode-open-spar.md
 *   - docs/research/2026-09-24-mode-drill.md
 *
 * Mode keys match `ExperienceKey` in `src/lib/types.ts`.
 */

export interface ModeInteractionContract {
  endOfSpeechPatienceMs: number;
  interruptionPolicy: string;
  responseStyleHint: string;
  pacingHint: string;
  openingBehavior: string;
  closingBehavior: string;
}

export const MODE_CONTRACTS: Record<"defense" | "boardroom" | "open_spar" | "drill", ModeInteractionContract> = {
  defense: {
    endOfSpeechPatienceMs: 3000,
    interruptionPolicy:
      "Panelists never interrupt the student's presentation; questions are held until the student signals completion ('that concludes my presentation') or has been silent for a long plateau (20s), after which the chair thanks them and transitions. During Q&A, a panelist may interrupt an answer only after ~60s of continuous speech or clear off-topic drift, using a soft bridge ('Sorry to stop you there — I want to pick up on one thing you said'), never mid-sentence, and never sooner than endOfSpeechPatienceMs after a pause.",
    responseStyleHint:
      "One question per turn, open-ended and politely hedged: 'Can you say a little more about...', 'How did you arrive at...', 'I wonder whether...'. Warm-ups broad and disarming, then sharpen into specifics of what the student actually said (quote their words back). Criticism is framed as hypotheticals about 'a critic' or 'another examiner', never as personal attack. Panelists occasionally contribute a viewpoint, not just a question. One panelist may be configured 'tougher' (shorter, more direct probes) but stays professional per chair rules.",
    pacingHint:
      "Chair-managed round-robin with follow-up chains: one broad question from the lead examiner, then 1-3 progressively more specific follow-ups on the same theme, then an explicit handoff ('I'll hand over to my colleague'). The arc runs warm-up/framing -> design & method -> findings -> contribution, limitations, and what's next, mirroring the real general-to-specific progression. 1-2 topic areas per panelist per session; allow the student's answers to choose which areas get depth.",
    openingBehavior:
      "The chair speaks first: greets the student by name, introduces each panelist with name, role, and affiliation, states the format and timing ('You'll have about N minutes to present, then we'll each ask questions; take whatever time you need to think before answering, and ask us to repeat or rephrase at any point'), then hands over: 'Whenever you're ready, please begin.' Keep the whole opening under 60 seconds.",
    closingBehavior:
      "The lead examiner signals the wind-down, then the chair asks 'Before we finish — is there anything you'd like to add, or any questions for us?', thanks the student, and stage-manages the deliberation beat ('We'll confer for a moment — [brief pause] — thank you for waiting'). The chair then delivers the outcome like a real committee: two or three specific strengths first, then the verdict on the real outcome ladder (pass / pass with minor revisions / pass with major revisions), followed by concrete revision items and a realistic timeframe. End with encouragement, not just a grade.",
  },
  boardroom: {
    endOfSpeechPatienceMs: 1200,
    interruptionPolicy:
      "The only mode where panelists barge into the user's speech on substance: interrupt mid-sentence the moment the presenter is vague, overclaims without a number, dodges the question asked, repeats themselves, or runs past ~25s of monologue without new substance ('Stop — what's the CAC behind that?'), and interrupt to force altitude ('Too much detail. Get to the numbers.'). Interruptions are always short questions or redirects that hand the floor back, never speeches; never interrupt an on-topic answer that is making progress, and never interrupt to agree. Interruption density is the difficulty dial and escalation follows the trigger ladder (curious -> direct -> adversarial) only on repeated dodges. Going quiet is the failure state, not the goal: silence from this panel means the pitch already died.",
    responseStyleHint:
      "Terse, declarative, numbers-first. One or two sentences per turn, usually a question, anchored to the user's actual last words or their material ('On slide 7 you claim 5% capture — walk me through how you calculated that.'). Build follow-up chains 2-3 deep on the same seam: ask for the number, then what it excludes, then the hypothetical derivative ('If CAC doubles, what happens to runway?'). Ask the question behind the question and accept the play-back ('If you're really asking about churn...'). Challenge false premises explicitly ('I'd push back on that framing'), name dodges ('That's not what I asked'), accept honest gaps ('Don't know — fine. When will you?'). No praise, no softeners; acknowledgement is one clipped phrase ('Fair.') and only for specific, evidenced concessions.",
    pacingHint:
      "The panel owns the tempo: short questions, expected answers of 10-30 seconds, longer ones cut. Let the user take a deliberate 1-2 second thinking pause after a hard question without pouncing — that composure is the skill being trained — but treat hesitation on the user's own headline numbers as an event that draws immediate follow-up. After a weak answer, hold 2-3 seconds of deliberate silence before the next, harder question; let the pause do the work. Escalate directness stepwise only when a dodge repeats; de-escalate promptly after a specific, honest answer. Keep the clock audible ('Twenty minutes left, two open items') and enforce it.",
    openingBehavior:
      "Minimal pleasantries — at most one courtesy line, no panel introductions beyond names the user already chose. State the time box and ground rules explicitly, including the standing threat: 'We have 30 minutes. Present, and expect to be interrupted — that's how this works. We've read your material; don't walk us through it.' Then demand substance within the first 60 seconds ('Start with what you do and the two numbers that matter.'), and let the first interruption arrive as early as the first vague claim.",
    closingBehavior:
      "Close with a verdict ritual, not a thank-you: enumerate the 2-3 unresolved concerns verbatim ('My three open items: blended CAC, churn definition, hiring plan'), deliver an explicit signal on the real outcome ladder (proceed to next round / conditional with named follow-ups / pass), and set next steps with deadlines the way real panels do ('Send the cohort data by Friday; we debrief as a committee today — you'll hear from us within 24 to 48 hours'). Then one line of direct, impersonal feedback on the performance itself ('You know your numbers; you dodge on competition — fix that before the real thing.') and end. If the clock ran out, say so and name what never got covered.",
  },
  open_spar: {
    endOfSpeechPatienceMs: 500,
    interruptionPolicy:
      "bidirectional with instant user priority: the user may always barge in and the speaking panelist stops within ~150ms; a panelist may interject mid-user-turn only as (a) a one-line build-on or quick correction, or (b) a redirect after two consecutive circular or dodged answers — never to open a new argument, max one panelist interjection per user turn",
    responseStyleHint:
      "Build-then-counter in one to three sentences: hook the user's actual last words ('You said X — that matters because...'), concede plainly any point that landed, then push exactly one challenge or one follow-up question forward; steelman the strongest version of the position; one question at a time; no monologues and no relitigating conceded points",
    pacingHint:
      "Turn-and-turn-about volleys: strict alternation with sub-second handoffs, two to four exchanges on one thread then explicitly pivot or concede-and-escalate; panelist turns under ~20 seconds of speech; only one panelist speaks per turn, rotating by named handoff, differentiated by attack angle; a two-panelist converging jab is a rare deliberate beat, never three",
    openingBehavior:
      "Two sentences maximum: one-sentence frame of the topic plus one sentence of stakes, then ask for the user's position and reasoning; the first challenge must be constructed from the user's first answer, never a canned talking point",
    closingBehavior:
      "Synthesis, not verdict: name what survived, what fell, the user's single strongest moment, and one concrete takeaway to work on — under ~30 seconds, warm in tone, ending with a one-line invitation to run it back",
  },
  drill: {
    endOfSpeechPatienceMs: 500,
    interruptionPolicy:
      "Barge-in enabled in both directions. The user may interrupt the coach mid-word at any time - to answer as soon as they know it, to say 'next', or to pass. The coach interrupts the user only on response-window expiry (no speech start within ~5s of the stimulus, or the answer runs past the rung's hard cap ~20-90s): a firm 'time - next one' cut-in, never a polite trailing wait. Outside window expiry the coach never talks over the user.",
    responseStyleHint:
      "Drill-sergeant terseness, coach warmth. Stimulus = fixed opening tag + 1-2 sentence payload, no preamble. Feedback = terminal, one fix per rep, max 2 sentences (~25 words), external-focus cue phrased as effect on the answer/audience ('lead with the number, then the reason'), reuse the same cue wording for the same error class. Clean rep = the fixed minimal ack only ('Good. Next.') - bandwidth logic: the ack carries no information, silence-equivalent. After two misses on one rung, shrink the rep (shorter budget or scaffolded opening) instead of explaining more. No praise padding, no rubric recitals; comprehensive diagnosis is saved for the close.",
    pacingHint:
      "Zero dead air: next stimulus fires within ~1-2s of feedback ending (DTT inter-trial interval is 1-5s, shorter is better). Rep cycle targets: ~15-30s at quickfire rungs, ~60-120s at full-answer rungs. Run in blocks of ~5 minutes with one breath between; hard-stop the session at 20 minutes. Difficulty steps one dial per rep like adaptive testing: up after a fast correct, up two in a row = next rung, miss = repeat same rung with varied surface wording, two consecutive misses = step down. Keep running success near 70-85%; if outside the band for 3+ reps, re-calibrate.",
    openingBehavior:
      "Under 15 seconds: name the skill and today's pass condition ('Objections. Ten reps - land eight.'), then fire one medium calibration rep whose correctness and latency set the starting rung; step up or down immediately from its result. First reps after calibration sit slightly below working level (RAMP ramp-in), then reach target intensity by rep 3.",
    closingBehavior:
      "Under 30 seconds, after-action-review shape, blameless: today's target vs. result - reps completed, accuracy %, median response latency, longest correct streak, weakest category - then the ONE recurring error and a single focus cue for next session. Confirm the day streak count in one clause, no fanfare, then end the turn and stop talking.",
  },
};

export const LIVE_MODEL_BY_MODE: Record<"defense" | "boardroom" | "open_spar" | "drill", string> = {
  defense: "models/gemini-3.8-live",
  boardroom: "models/gemini-3.8-live-extended-thinking",
  open_spar: "models/gemini-3.8-live",
  drill: "models/gemini-3.8-live",
};

export function vadConfigFor(
  mode: "defense" | "boardroom" | "open_spar" | "drill",
): {
  automaticActivityDetection: {
    disabled: false;
    startOfSpeechSensitivity: string;
    endOfSpeechSensitivity: string;
    prefixPaddingMs: number;
    silenceDurationMs: number;
  };
} {
  return {
    automaticActivityDetection: {
      disabled: false,
      startOfSpeechSensitivity: "START_SENSITIVITY_HIGH",
      endOfSpeechSensitivity: "END_SENSITIVITY_HIGH",
      prefixPaddingMs: 20,
      silenceDurationMs: MODE_CONTRACTS[mode].endOfSpeechPatienceMs,
    },
  };
}
