"use client";

import { useEffect, useRef, useState } from "react";
import { detectTriggers, getThreshold } from "@/lib/triggers";
import type { ArchetypeKey } from "@/lib/types";

export type CoachingMode = "pure-spar" | "coach" | "drill";
export type DrillTarget = "hedging" | "over-explaining" | "recovery-speed" | "evidence-gaps";

export interface AgitationPersona {
  id: string;
  archetype: ArchetypeKey;
}

export interface UseAgitationEngineParams {
  /** The personas in the session */
  personas: AgitationPersona[];
  /** The live interim transcript (from Web Speech API) */
  interimTranscript: string;
  /** The accumulated final transcript (from Web Speech API) */
  finalTranscript: string;
  /** Whether the user is currently speaking */
  isListening: boolean;
  /** The coaching mode (affects thresholds in Drill Mode) */
  coachingMode: CoachingMode;
  /** The drill target (only used when coachingMode === "drill") */
  drillTarget?: DrillTarget;
  /** Called when a persona's agitation hits the threshold */
  onInterrupt: (personaId: string, reason: string) => void;
}

/**
 * The Agitation Engine — the backbone of the Sparring Room.
 *
 * Watches the live transcript for heuristic triggers (hedges, long answers,
 * vague quantifiers) and builds each persona's agitation score in real-time.
 * When a persona's agitation hits their threshold, fires onInterrupt.
 *
 * Key design decisions:
 *   - Triggers are detected on the FULL text (final + interim) each tick.
 *     The score is computed from scratch (idempotent) — no accumulation
 *     errors from double-counting volatile interim text.
 *   - After an interrupt, a "baseline" is saved so the interrupting persona
 *     starts fresh. Other personas keep their agitation (primed to pile on).
 *   - Decay: agitation slowly decreases if no new triggers fire, so a single
 *     hedge doesn't permanently keep the Skeptic at 30.
 *
 * IMPORTANT: This is heuristic-only. No LLM calls. Semantic analysis (claim
 * quality, evidence gaps, contradictions) happens post-turn in the debrief.
 */
export function useAgitationEngine({
  personas,
  interimTranscript,
  finalTranscript,
  isListening,
  coachingMode,
  drillTarget,
  onInterrupt,
}: UseAgitationEngineParams) {
  // Agitation per persona (0-100)
  const [agitation, setAgitation] = useState<Record<string, number>>({});

  // Baseline trigger counts per archetype. After an interrupt, we save the
  // current count so the persona starts fresh. This prevents re-counting
  // triggers from text that was already there when the interrupt fired.
  const baselineRef = useRef<Record<string, number>>({});

  // The onInterrupt callback might change between renders. Use a ref so the
  // interval doesn't restart every time.
  const onInterruptRef = useRef(onInterrupt);
  useEffect(() => {
    onInterruptRef.current = onInterrupt;
  }, [onInterrupt]);

  // Track whether an interrupt has already fired for this speaking turn
  // (prevents multiple interrupts in the same turn).
  const interruptFiredRef = useRef(false);

  // Reset when listening starts — deferred to the next tick to avoid
  // setState-in-effect cascading render warnings.
  const prevListeningRef = useRef(false);
  useEffect(() => {
    if (isListening && !prevListeningRef.current) {
      // Use a microtask to defer the state update out of the effect body
      queueMicrotask(() => {
        setAgitation({});
        baselineRef.current = {};
        interruptFiredRef.current = false;
      });
    }
    prevListeningRef.current = isListening;
  }, [isListening]);

  // Main detection loop — runs every 500ms while listening
  useEffect(() => {
    if (!isListening) return;

    const interval = setInterval(() => {
      const fullText = (finalTranscript + " " + interimTranscript).trim();
      const wordCount = fullText ? fullText.split(/\s+/).length : 0;

      const triggers = detectTriggers(fullText, wordCount);

      setAgitation((prev) => {
        const next: Record<string, number> = {};

        for (const persona of personas) {
          // The trigger score for this persona's archetype
          const rawScore = triggers.agitation[persona.archetype] || 0;
          // Subtract the baseline (triggers that were already counted before
          // the last interrupt)
          const baseline = baselineRef.current[persona.archetype] || 0;
          const score = Math.max(0, rawScore - baseline);

          next[persona.id] = score;

          // Check if this persona should interrupt
          const threshold = getThreshold(
            persona.archetype,
            coachingMode,
            drillTarget
          );

          if (
            score >= threshold &&
            !interruptFiredRef.current &&
            wordCount > 5 // Don't interrupt on tiny utterances
          ) {
            // Fire the interrupt
            interruptFiredRef.current = true;
            onInterruptRef.current(persona.id, triggers.reason);

            // Save baseline so this persona starts fresh after the interrupt
            baselineRef.current[persona.archetype] = rawScore;

            // Reset all agitation (the interrupt changes the conversation)
            for (const p of personas) {
              next[p.id] = 0;
            }
            break;
          }
        }

        return next;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [
    isListening,
    interimTranscript,
    finalTranscript,
    personas,
    coachingMode,
    drillTarget,
  ]);

  // Reset interrupt flag when listening stops (turn ends normally)
  useEffect(() => {
    if (!isListening) {
      interruptFiredRef.current = false;
    }
  }, [isListening]);

  return agitation;
}
