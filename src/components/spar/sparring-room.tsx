"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Mic,
  Square,
  Loader2,
  Clock,
  AlertCircle,
  Hand,
  FileText,
  Pause,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PanelistPresence } from "./panelist-presence";
import { WaveformBar } from "./waveform-bar";
import {
  engineStatusLabel,
  liveOwnsControls,
  recordsTurnAudio,
  startsRecorderOnFallback,
  liveUserInterimCaption,
  type EngineStatusLabel,
  type PresenceState,
} from "./room-state";
import { ARCHETYPES } from "@/lib/personas";
import { useVoiceRecognition, playBase64Audio } from "@/hooks/use-voice";
import { useTurnController, type UseTurnControllerResult } from "@/hooks/use-turn-controller";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { useAgitationEngine, type CoachingMode, type DrillTarget } from "@/hooks/use-agitation";
import { playActivationClick, useWaveformAmplitude } from "@/hooks/use-sound";
import { SCENARIOS } from "@/lib/scenarios";
import type { ExperienceKey } from "@/lib/experiences";
import type {
  ArchetypeKey,
  BehaviorStyle,
  ExtractedClaim,
  MessageType,
  PersonaMood,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Play a subtle audio cue when a persona interrupts.
 * Uses the Web Audio API to generate a short low rumble — no audio file needed.
 */
function playInterruptCue() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 90;
    osc.type = "sine";
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // AudioContext not available — silent fallback
  }
}

interface SparringRoomProps {
  sessionId: string;
  onSessionEnded: () => void;
  onExit: () => void;
  experience?: ExperienceKey;
  drillTarget?: DrillTarget | null;
}

interface SessionPersona {
  id: string;
  archetype: ArchetypeKey;
  name: string;
  behaviorStyle: BehaviorStyle;
  seatOrder: number;
}

type PersonaState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "about-to-interrupt";

interface CaptionEntry {
  id: string;
  role: "user" | "persona";
  personaId?: string;
  personaName?: string;
  archetype?: ArchetypeKey;
  content: string;
  type: MessageType;
  claimRef?: number | null;
  mood?: PersonaMood;
  isLive?: boolean; // user's live interim transcript
  createdAt: number;
}

export function SparringRoom({
  sessionId,
  onSessionEnded,
  onExit,
  experience = "open_spar",
  drillTarget = null,
}: SparringRoomProps) {
  const [personas, setPersonas] = useState<SessionPersona[]>([]);
  const [claims, setClaims] = useState<ExtractedClaim[]>([]);
  const [rawMaterial, setRawMaterial] = useState<string>("");
  const [scenarioLabel, setScenarioLabel] = useState<string>("");
  const [roomContext, setRoomContext] = useState<string>("");
  const [captions, setCaptions] = useState<CaptionEntry[]>([]);
  // Defense flow state
  const [isPresenting, setIsPresenting] = useState(false);
  const [settling, setSettling] = useState(false);
  // Full coach analysis (strengths, weakness, anticipatedAttack, coachRead) —
  // shown in an expanded card with a "Begin Q&A" button. Replaces the old
  // 6s auto-dismiss timer — the user controls when Q&A begins.
  const [coachAnalysis, setCoachAnalysis] = useState<{
    strengths: string[];
    weakness: string;
    anticipatedAttack: string;
    coachRead: string;
  } | null>(null);
  const [analyzingPresentation, setAnalyzingPresentation] = useState(false);
  // Drill re-attempt state: when a drill interrupt fires, the user sees
  // "Try again" instead of a normal mic button. The system sends the
  // same question context (not advance to a new question).
  //
  // drillRetry (state) drives the UI render. drillRetryRef (ref) is always
  // current and is read inside submitTurn/handleStopSpeaking callbacks to
  // avoid stale-closure bugs (the callbacks don't list drillRetry in deps).
  const [drillRetry, setDrillRetry] = useState(false);
  const drillRetryRef = useRef(false);
  const setDrillRetryBoth = useCallback((v: boolean) => {
    drillRetryRef.current = v;
    setDrillRetry(v);
  }, []);
  // How many corrections have fired for the current question (0 = first try).
  // Shown in the UI as "Attempt N" so the user knows how many times they've
  // been corrected. Reset to 0 when they answer cleanly.
  const [drillAttempts, setDrillAttempts] = useState(0);
  const [connectionError, setConnectionError] = useState(false);
  const [personaStates, setPersonaStates] = useState<Record<string, PersonaState>>({});
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [sessionStart] = useState(Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);

  // Voice state
  // Presentation capture retains the long-form recognizer. Every live Q&A
  // turn is owned by the low-latency controller (Flux -> generator -> Aura).
  const presentationVoice = useVoiceRecognition();

  // Gemini Live configuration: built once the panel has loaded. The lead
  // panelist (lowest seat) voices the Live session — one socket, one voice.
  // While undefined (panel still loading) the engine ladder rests on the
  // existing cascade; a 503 from the token route ladders down the same way.
  const liveConfig = useMemo(() => {
    if (personas.length === 0) return undefined;
    const [lead, ...rest] = [...personas].sort((a, b) => a.seatOrder - b.seatOrder);
    return {
      mode: experience,
      persona: { archetype: lead.archetype, behaviorStyle: lead.behaviorStyle },
      scenarioLabel,
      claims: claims.map((claim) => ({
        id: claim.id,
        label: claim.label,
        claim: claim.claim,
        ...(claim.evidence ? { evidence: claim.evidence } : {}),
      })),
      otherPanelists: rest.map((p) => ({ name: p.name, archetype: p.archetype })),
    };
  }, [personas, experience, scenarioLabel, claims]);

  const turnController = useTurnController({
    sessionId,
    voiceModel: "aura-2-zeus-en",
    live: liveConfig,
  });
  const voice = isPresenting ? presentationVoice : turnController;
  const recorder = useAudioRecorder();
  // Counter for user messages — used to key audio clips in IndexedDB.
  // Each user turn (presentation + each Q&A answer) gets a unique index.
  const messageIndexRef = useRef(0);
  const [isUserTurn, setIsUserTurn] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);

  // Live engine (Gemini Live): the room tracks whether its one-activation mic
  // session is running. The hook-level status can still read "live" after a
  // stop() (it only transitions on the next session), so the room derives its
  // engine UI from this flag AND the status — never the status alone.
  const [liveSessionActive, setLiveSessionActive] = useState(false);

  const sparInFlight = useRef(false);
  // Latch: the fallback transition starts the recorder at most once per
  // live activation (see the effect below). Reset when a fresh live
  // activation begins.
  const fallbackRecorderStartedRef = useRef(false);
  // Stores the presentation transcript when handleDonePresenting runs, so
  // that if the present endpoint or spar-stream fails, the user can retry
  // without having to re-present from scratch.
  const pendingPresentation = useRef<string | null>(null);
  // Set to true when beginQA fails — so the retry button knows to retry
  // beginQA (not submitPresentation). Cleared on successful retry.
  const qaFailedRef = useRef(false);
  const captionsEndRef = useRef<HTMLDivElement>(null);

  // Timer
  useEffect(() => {
    const t = setInterval(() => setElapsedSec(Math.floor((Date.now() - sessionStart) / 1000)), 1000);
    return () => clearInterval(t);
  }, [sessionStart]);

  // Auto-scroll captions
  useEffect(() => {
    captionsEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [captions]);

  // Show live interim transcript as a caption. Whichever engine owns the
  // room drives it: the classic recognizer's interim transcript while it
  // listens, or the live engine's transcript preview (interim-input-
  // transcript) while the Gemini Live session owns the room. The finalized
  // transcript retires the caption — the caption mirror below rebuilds
  // without `isLive` entries whenever the messages change.
  const liveInterim = liveUserInterimCaption(
    liveSessionActive,
    turnController.liveEngineStatus,
    turnController.transcriptPreview,
  );
  useEffect(() => {
    const interim = voice.isListening ? voice.interimTranscript : liveInterim;
    if (interim) {
      setCaptions((prev) => {
        const existing = prev.find((c) => c.isLive);
        if (existing) {
          return prev.map((c) =>
            c.id === existing.id ? { ...c, content: interim } : c
          );
        }
        return [
          ...prev,
          {
            id: "live-user",
            role: "user" as const,
            content: interim,
            type: "normal" as MessageType,
            isLive: true,
            createdAt: Date.now(),
          },
        ];
      });
    } else if (!voice.isListening) {
      // Remove the live caption when not listening
      setCaptions((prev) => prev.filter((c) => !c.isLive));
    }
  }, [voice.interimTranscript, voice.isListening, liveInterim]);

  // Live→cascade fallback mid-handshake: the click path skipped the recorder
  // (recordsTurnAudio read "connecting" at click time), so the transition
  // starts it for the in-flight classic turn — without this, every session on
  // a no-key deployment loses the first Q&A turn's debrief clip. The latch
  // keeps it idempotent; classic paths are unchanged.
  useEffect(() => {
    if (
      !startsRecorderOnFallback({
        liveConfigured: !!liveConfig,
        liveSessionActive,
        status: turnController.liveEngineStatus,
        cascadeListening: turnController.isListening,
        recorderReady: recorder.isSupported && !recorder.isRecording,
        alreadyStarted: fallbackRecorderStartedRef.current,
      })
    ) {
      return;
    }
    fallbackRecorderStartedRef.current = true;
    recorder.start(sessionId, messageIndexRef.current);
  }, [
    liveConfig,
    liveSessionActive,
    turnController.liveEngineStatus,
    turnController.isListening,
    recorder,
    sessionId,
  ]);

  // Mirror controller-owned exact captions into the room without creating a
  // second generation, speech, or interruption state machine.
  useEffect(() => {
    setCaptions((previous) => {
      let next = previous.filter((caption) =>
        !caption.isLive && !caption.id.startsWith("user:") && !caption.id.startsWith("assistant:"),
      );
      for (const message of turnController.messages) {
        const persona = message.persona;
        const entry: CaptionEntry = {
          id: message.id,
          role: message.role === "assistant" ? "persona" : "user",
          personaId: message.role === "assistant" ? persona?.id : undefined,
          personaName: message.role === "assistant" ? persona?.name : undefined,
          archetype: message.role === "assistant" ? persona?.archetype as ArchetypeKey | undefined : undefined,
          content: message.content,
          type: message.metadata?.type ?? "normal",
          claimRef: message.metadata?.claimRef,
          mood: message.metadata?.mood as PersonaMood | undefined,
          createdAt: Date.now(),
        };
        const index = next.findIndex((caption) => caption.id === message.id);
        next = index < 0 ? [...next, entry] : next.map((caption, current) => current === index ? { ...caption, ...entry } : caption);
      }
      if (turnController.assistantCaption) {
        const id = `assistant:${turnController.turn.turnId}`;
        const persona = turnController.activePersona;
        const liveAssistant: CaptionEntry = {
          id, role: "persona", personaId: persona?.id, personaName: persona?.name,
          archetype: persona?.archetype as ArchetypeKey | undefined,
          content: turnController.assistantCaption,
          type: turnController.assistantMetadata?.type ?? "normal",
          claimRef: turnController.assistantMetadata?.claimRef,
          mood: turnController.assistantMetadata?.mood as PersonaMood | undefined,
          createdAt: Date.now(),
        };
        const index = next.findIndex((caption) => caption.id === id);
        next = index < 0 ? [...next, liveAssistant] : next.map((caption, current) => current === index ? { ...caption, ...liveAssistant } : caption);
      }
      return next;
    });
  }, [turnController.messages, turnController.assistantCaption, turnController.assistantMetadata, turnController.turn.turnId, turnController.activePersona]);

  useEffect(() => {
    if (isPresenting) return;
    const busy = turnController.turn.status === "finalizing" || turnController.turn.status === "generating" || turnController.turn.status === "speaking";
    setIsProcessing(busy);
    setAudioPlaying(turnController.turn.status === "speaking");
    if (turnController.error) {
      setError(turnController.error);
      setConnectionError(true);
    }
    const personaId = turnController.activePersona?.id;
    if (personaId) setPersonaStates((previous) => ({ ...previous, [personaId]: turnController.turn.status === "speaking" ? "speaking" : busy ? "thinking" : "listening" }));
  }, [isPresenting, turnController.turn.status, turnController.error, turnController.activePersona, turnController.assistantMetadata]);

  // Initial load: fetch session + open
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const sRes = await fetch(`/api/sessions/${sessionId}`);
        if (!sRes.ok) throw new Error("Session not found");
        const sData = await sRes.json();
        if (!mounted) return;

        const session = sData.session;
        const parsedClaims: ExtractedClaim[] = session.extractedClaims
          ? safeParseArray(session.extractedClaims)
          : [];
        const scenario = SCENARIOS[session.scenario as keyof typeof SCENARIOS];
        const scenarioLabel = scenario?.label || "Custom Session";
        const roomContext =
          session.scenario === "custom" && session.roomContext
            ? session.roomContext
            : scenario?.roomContext || "";

        setPersonas(session.personas);
        setClaims(parsedClaims);
        setRawMaterial(session.rawMaterial || "");
        setScenarioLabel(scenarioLabel);
        setRoomContext(roomContext);

        const states: Record<string, PersonaState> = {};
        for (const p of session.personas) {
          states[p.id] = "listening";
        }
        setPersonaStates(states);

        // Open the session — panel speaks first
        const oRes = await fetch(`/api/sessions/${sessionId}/open`, {
          method: "POST",
        });
        if (!oRes.ok) throw new Error("Failed to open session");
        const oData = await oRes.json();
        if (!mounted) return;

        if (oData.alreadyStarted && Array.isArray(oData.messages)) {
          // Restoring — map stored messages to captions
          setCaptions(
            oData.messages.map((m: any) => ({
              id: m.id,
              role: m.role,
              personaId: m.personaId,
              personaName: session.personas.find((p: SessionPersona) => p.id === m.personaId)?.name,
              archetype: session.personas.find((p: SessionPersona) => p.id === m.personaId)?.archetype,
              content: m.content,
              type: m.type,
              claimRef: m.claimRef,
              createdAt: new Date(m.createdAt).getTime(),
            }))
          );
          setIsUserTurn(true);
        } else if (oData.defenseMode) {
          // ─── Defense/Boardroom flow: user presents first ────────────────
          // Show the room with all personas in "listening" state.
          // After a 2-second settle beat, show "The floor is yours."
          // This gives the user a moment to see the room before being asked to speak.
          setIsPresenting(true);
          setIsUserTurn(false); // not the user's turn yet — settling
          setSettling(true);

          // Settle beat: 2 seconds of the room being visible before the prompt appears
          setTimeout(() => {
            if (mounted) {
              setSettling(false);
              setIsUserTurn(true); // now it's the user's turn to present
            }
          }, 2000);
        } else if (oData.message) {
          const m = oData.message;
          // Mark the speaking persona
          setPersonaStates((prev) => ({ ...prev, [m.personaId]: "speaking" }));

          setCaptions([
            {
              id: m.id,
              role: "persona",
              personaId: m.personaId,
              personaName: m.personaName,
              archetype: m.archetype,
              content: m.content,
              type: "opening",
              claimRef: m.claimRef,
              mood: m.mood,
              createdAt: new Date(m.createdAt).getTime(),
            },
          ]);

          // Show the room immediately — before the audio plays.
          // The persona is already in "speaking" state with the caption visible,
          // so the user sees the room materialize as the voice begins.
          if (mounted) setLoading(false);

          // Play the opening audio (the room is already visible)
          if (m.audio) {
            setAudioPlaying(true);
            try {
              await playBase64Audio(m.audio);
            } catch (e) {
              console.error("Audio playback failed:", e);
            }
            setAudioPlaying(false);
          }

          // Persona done — back to listening
          setPersonaStates((prev) => ({ ...prev, [m.personaId]: "listening" }));
          setIsUserTurn(true);
        }
      } catch (e) {
        if (mounted) setError(String(e));
      } finally {
        // Safety: ensure loading is false even if the audio path failed
        if (mounted) setLoading(false);

        // Pre-warm: fire a lightweight request to compile the spar-stream route
        // so the first real spar call doesn't pay the Turbopack compilation cost (~0.8s)
        if (mounted) {
          fetch(`/api/sessions/${sessionId}/spar-stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ _warmup: true }),
          }).catch(() => {}).then(() => {});
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [sessionId]);

  // Handle user pressing "Speak" (or "Start presenting")
  const handleStartSpeaking = useCallback(() => {
    if (!voice.isSupported) return;
    // One activation: in Q&A (not presenting) with Live configured, this
    // click hands the room to the Live engine and the mic stays live.
    if (!isPresenting && liveConfig) {
      setLiveSessionActive(true);
      // A fresh live activation gets a fresh fallback-recorder latch.
      fallbackRecorderStartedRef.current = false;
    }
    voice.reset();
    voice.start();
    // Start audio recording alongside voice recognition — classic turns only.
    // Both access the mic simultaneously — recording is for debrief playback.
    // Keyed by sessionId + messageIndex so the debrief can fetch clips per
    // turn. Live-engine activations are skipped: the debrief cannot segment
    // one continuous session capture (fallback re-activations record again).
    if (
      recorder.isSupported &&
      recordsTurnAudio(isPresenting, !!liveConfig, turnController.liveEngineStatus)
    ) {
      recorder.start(sessionId, messageIndexRef.current);
    }
    // Play the activation click — feels like a mic turning on
    playActivationClick();
  }, [voice, recorder, sessionId, isPresenting, liveConfig, turnController.liveEngineStatus]);

  // Submit the user's turn to the panel. Used by both "Done" (normal stop)
  // and the agitation engine (interrupt). When isInterrupt=true, the persona
  // response is framed as a mid-speech interruption.
  //
  // For Boardroom: when an interrupt fires during presenting, after the persona
  // responds, the user should be able to RESUME presenting (not just answer).
  // The `resumePresenting` flag controls this.
  const submitTurn = useCallback(
    async (
      isInterrupt: boolean,
      interruptingPersonaId?: string,
      resumePresenting: boolean = false,
      drillFlags?: { drillInterrupt?: boolean; drillClean?: boolean }
    ) => {
      // Stop the audio recorder and save the clip to IndexedDB.
      // Non-blocking — the clip saves async, doesn't delay the turn.
      if (recorder.isRecording) {
        recorder.stop().catch(() => {});
      }
      // Increment the message index for the next user turn
      messageIndexRef.current += 1;

      if (sparInFlight.current) return;
      sparInFlight.current = true;
      setIsUserTurn(false);
      setIsProcessing(true);

      if (isInterrupt) {
        playInterruptCue();
      }

      // Mark all personas as listening
      setPersonaStates((prev) => {
        const next: Record<string, PersonaState> = {};
        for (const k of Object.keys(prev)) next[k] = "listening";
        return { ...prev, ...next };
      });

      try {
        const requestOptions = {
          isInterrupt,
          forcedPersonaId: interruptingPersonaId,
          drillInterrupt: drillFlags?.drillInterrupt ?? false,
          drillClean: drillFlags?.drillClean ?? false,
        };
        if (isPresenting) {
          presentationVoice.stop();
          await new Promise((r) => setTimeout(r, 300));
          const transcript = `${presentationVoice.finalTranscript} ${presentationVoice.interimTranscript}`.trim();
          if (transcript.length < 3) return;
          await turnController.submitPresentationTurn(transcript, false, requestOptions);
        } else {
          await turnController.finishInput(requestOptions);
        }
        if (resumePresenting) setIsPresenting(true);
        if (drillFlags?.drillClean) {
          setDrillRetryBoth(false);
          setDrillAttempts(0);
        }
        setIsUserTurn(true);
        setIsProcessing(false);
      } catch (e) {
        setError(String(e));
        setConnectionError(true);
        setIsUserTurn(true);
        setIsProcessing(false);
      } finally {
        sparInFlight.current = false;
      }
      return;
    },
    [isPresenting, presentationVoice, recorder, turnController, setDrillRetryBoth]
  );

  // Handle user pressing "Done" (stop speaking)
  const handleStopSpeaking = useCallback(() => {
    // In Drill Mode: if the user is answering after a correction (drillRetry
    // is true) and clicks Done without triggering another agitation interrupt,
    // that means their answer was clean. Send drillClean so the backend
    // generates the NEXT question with a deterministic acknowledgment.
    const isDrillClean = experience === "drill" && drillRetryRef.current;
    submitTurn(false, undefined, false, isDrillClean ? { drillClean: true } : undefined);
  }, [submitTurn, experience]);

  // ─── Defense flow: Done Presenting ────────────────────────────────────
  // Called when the user clicks "Done Presenting" in a Defense session.
  // Saves the presentation, analyzes it, shows the coach read, then Q&A begins.
  // If the present endpoint fails, the transcript is saved in pendingPresentation
  // so the user can retry without re-presenting.
  async function handleDonePresenting() {
    voice.stop();
    // Stop the recorder — the presentation clip is message index 0
    if (recorder.isRecording) {
      recorder.stop().catch(() => {});
    }
    messageIndexRef.current += 1;

    // Wait for final transcript to settle
    await new Promise((r) => setTimeout(r, 300));

    const transcript = (
      voice.finalTranscript +
      " " +
      voice.interimTranscript
    ).trim();
    if (!transcript || transcript.length < 5) {
      setError("Your presentation was too short. Try again.");
      return;
    }

    pendingPresentation.current = transcript;
    await submitPresentation(transcript);
  }

  // Submit the presentation transcript to the present endpoint and begin Q&A.
  // Separated from handleDonePresenting so it can be retried on failure.
  async function submitPresentation(transcript: string) {
    setIsPresenting(false);
    setAnalyzingPresentation(true);
    setConnectionError(false);
    setError(null);
    setIsUserTurn(false);

    // Add the presentation as a caption (if not already added)
    const presentationId = `presentation-${Date.now()}`;
    setCaptions((prev) => [
      ...prev.filter((c) => !c.isLive && !c.id.startsWith("presentation-")),
      {
        id: presentationId,
        role: "user",
        content: transcript,
        type: "normal",
        createdAt: Date.now(),
      },
    ]);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/present`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      if (!res.ok) throw new Error("Failed to process presentation");
      const data = await res.json();

      // Show the coach analysis card (if coaching is enabled and analysis exists).
      // The user reads it, then clicks "Begin Q&A" to start the questioning.
      // This replaces the old 6-second auto-dismiss timer — the user controls
      // when Q&A begins, giving them time to absorb the coach's read.
      if (data.coachRead) {
        setCoachAnalysis(data.coachRead);
      } else {
        // No coach analysis — go straight to Q&A
        await beginQA();
        return;
      }
    } catch (e) {
      console.error("[present] Failed to process presentation:", e);
      setError(
        "Couldn't process your presentation. The panel didn't respond — try again."
      );
      setAnalyzingPresentation(false);
      setConnectionError(true);
      // Don't set isUserTurn — we want the retry button to handle the next action
    }
  }

  // Retry the presentation submission after a failure. Uses the saved
  // transcript from pendingPresentation so the user doesn't have to
  // re-present from scratch.
  async function retryPresentation() {
    if (!pendingPresentation.current) return;
    await submitPresentation(pendingPresentation.current);
  }

  // Begin the Q&A phase — called when the user clicks "Begin Q&A" on the
  // coach card, or immediately if no coach analysis was produced.
  // Pulled out as its own function so the user controls the timing.
  async function beginQA() {
    setAnalyzingPresentation(false);
    setCoachAnalysis(null);
    setIsUserTurn(false);

    try {
      const transcript = pendingPresentation.current?.trim();
      if (!transcript) throw new Error("No presentation transcript available");
      await turnController.submitPresentationTurn(transcript, true);

      qaFailedRef.current = false;
      setIsUserTurn(true);
    } catch (e) {
      console.error("[beginQA] Failed to start Q&A:", e);
      setError("The panel didn't respond. Try again.");
      setAnalyzingPresentation(false);
      setConnectionError(true);
      // Mark that Q&A failed (not presentation) so the retry button retries
      // beginQA instead of submitPresentation.
      qaFailedRef.current = true;
    }
  }

  // Error recovery: smart retry.
  // - If pendingPresentation exists AND coachAnalysis is null →
  //   the present endpoint failed → retry submitPresentation.
  // - If coachAnalysis was set (then cleared by beginQA) but
  //   beginQA failed → retry beginQA. We detect this with a ref.
  // - Otherwise → restart the mic.
  const handleConnectionRetry = useCallback(() => {
    setConnectionError(false);
    setError(null);
    if (qaFailedRef.current) {
      qaFailedRef.current = false;
      beginQA();
    } else if (pendingPresentation.current) {
      retryPresentation();
    } else {
      handleStartSpeaking();
    }
  }, [handleStartSpeaking]);

  // ─── The Agitation Engine ────────────────────────────────────────────
  // Watches the live transcript for heuristic triggers (hedges, long answers,
  // vague quantifiers). When a persona's agitation hits 100, fires an interrupt.
  const handleInterrupt = useCallback(
    (personaId: string, reason: string) => {
      console.log(`[agitation] Interrupt fired: ${personaId} (${reason})`);
      // For Boardroom: interrupt during presenting → resume presenting after
      const shouldResume = experience === "boardroom" && isPresenting;
      // For Drill: enter retry state (show "Try again") and send the
      // deterministic drillInterrupt flag so the backend returns the fixed
      // correction phrase WITHOUT calling the LLM. Increment the attempt
      // counter so the UI shows "Attempt 2", "Attempt 3", etc.
      if (experience === "drill") {
        setDrillRetryBoth(true);
        setDrillAttempts((n) => n + 1);
      }
      const drillFlags =
        experience === "drill" ? { drillInterrupt: true } : undefined;
      submitTurn(true, personaId, shouldResume, drillFlags);
    },
    [submitTurn, experience, isPresenting]
  );

  // ─── Waveform + activation sound ──────────────────────────────────────
  // Track amplitude while listening (for the subtle waveform bar)
  const waveformAmplitude = useWaveformAmplitude(voice.isListening);

  // ─── Engine status (Gemini Live vs classic cascade) ───────────────────
  // Quiet chip label + control ownership. In live mode the per-turn click
  // flow is hidden (one activation; server VAD owns turn-taking).
  const engineLabel = engineStatusLabel(liveSessionActive, turnController.liveEngineStatus);
  const liveEngineStatus = turnController.liveEngineStatus;
  const liveDeckStatus: "connecting" | "live" | "off" = liveOwnsControls(
    liveSessionActive,
    liveEngineStatus,
  )
    ? liveEngineStatus === "live"
      ? "live"
      : "connecting"
    : "off";

  // For Boardroom: the agitation engine runs DURING presenting (interrupts mid-speech).
  // For Defense: the agitation engine does NOT run during presenting (no interruptions).
  // For Q&A/Drill: runs during normal Q&A turns.
  const isBoardroomPresenting =
    experience === "boardroom" && isPresenting && !isProcessing;
  const agitationActive =
    voice.isListening &&
    !isProcessing &&
    (isBoardroomPresenting || (isUserTurn && !isPresenting));

  const agitation = useAgitationEngine({
    personas: personas.map((p) => ({ id: p.id, archetype: p.archetype })),
    interimTranscript: voice.interimTranscript,
    finalTranscript: voice.finalTranscript,
    isListening: agitationActive,
    coachingMode: experience === "drill" ? "drill" : "pure-spar",
    drillTarget: drillTarget || undefined,
    onInterrupt: handleInterrupt,
  });

  // End session
  async function handleEnd() {
    setShowEndDialog(false);
    setEnding(true);
    // The live session is released by the composed stop(); clear the room's
    // activation flag so the engine UI never reports Live after teardown.
    setLiveSessionActive(false);
    voice.stop();
    // Cancel the recorder (don't save a partial clip)
    if (recorder.isRecording) {
      recorder.cancel();
    }
    try {
      const res = await fetch(`/api/sessions/${sessionId}/end`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to end session");
      onSessionEnded();
    } catch (e) {
      setError(String(e));
      setEnding(false);
    }
  }

  // "I need a moment" — pauses panel, shows a coach whisper
  function handleNeedMoment() {
    setCaptions((prev) => [
      ...prev,
      {
        id: `coach-${Date.now()}`,
        role: "persona",
        personaName: "Coach",
        content: "Pause. Take a breath. Acknowledge the concern in one sentence, then answer with one piece of evidence.",
        type: "coach_whisper" as MessageType,
        createdAt: Date.now(),
      },
    ]);
  }

  if (loading) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-white" />
        <p className="text-sm text-muted-foreground">Entering the room...</p>
      </div>
    );
  }

  if (error && captions.length === 0) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-3 px-6 text-center">
        <AlertCircle className="h-7 w-7 text-destructive" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={onExit}>
          Back to Home
        </Button>
      </div>
    );
  }

  const elapsedDisplay = formatTime(elapsedSec);

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      {/* Top bar — glass, tightened to py-3 */}
      <div
        className="flex items-center justify-between px-4 py-3 sm:px-6"
        style={{
          background: "rgba(10, 10, 10, 0.55)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "inset 0 1px 0 0 rgba(255, 255, 255, 0.06)",
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => setShowEndDialog(true)} className="h-8 w-8" aria-label="Exit session">
            <X className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-white">
                {scenarioLabel}
              </p>
              {experience === "drill" && drillTarget && (
                <span className="flex-shrink-0 rounded border border-[#2a2a2a] bg-[#171717] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-neutral-300">
                  Drill: {drillTarget.replace(/-/g, " ")}
                </span>
              )}
              {experience === "boardroom" && (
                <span className="flex-shrink-0 rounded border border-amber-500/20 bg-amber-500/[0.06] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-amber-300/80">
                  Boardroom
                </span>
              )}
              {experience === "defense" && (
                <span className="flex-shrink-0 rounded border border-[#2a2a2a] bg-[#171717] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-neutral-300">
                  Defense
                </span>
              )}
              <EngineStatusChip label={engineLabel} />
            </div>
            <p className="hidden sm:block text-xs text-neutral-500 max-w-xl truncate">
              {roomContext}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-xs text-neutral-400">
            <Clock className="h-3.5 w-3.5" />
            {elapsedDisplay}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEndDialog(true)}
            disabled={ending}
          >
            {ending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Ending...
              </>
            ) : (
              "End Session"
            )}
          </Button>
        </div>
      </div>

      {/* Body — stacked on mobile, 2-column on desktop */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Mobile panel — presence strip (below lg, stacks on top) */}
        <div
          className="lg:hidden flex-shrink-0 border-b border-white/[0.06] overflow-x-auto px-4 py-3"
          style={{
            background: "rgba(10, 10, 10, 0.4)",
          }}
        >
          <PresenceRail
            personas={personas}
            states={personaStates}
            agitation={agitation}
            layout="strip"
          />
        </div>

        {/* Main area — content + conversation */}
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          {/* Content strip — show what the user is defending */}
          {rawMaterial && (
            <div className="flex-shrink-0 border-b border-[#1a1a1a] px-4 py-2.5 lg:px-6">
              <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase tracking-wider text-neutral-600 flex-shrink-0">
                  Defending
                </span>
                <p className="text-xs text-neutral-300 truncate flex-1">
                  {rawMaterial.length > 120
                    ? rawMaterial.slice(0, 120) + "…"
                    : rawMaterial}
                </p>
                {claims.length > 0 && (
                  <span className="text-[10px] text-neutral-600 flex-shrink-0">
                    {claims.length} {claims.length === 1 ? "claim" : "claims"} extracted
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Boardroom live-pressure banner — shows the panel's agitation
              building in real-time while the user presents. This is the
              "interrupt meter visibility" fix: in Boardroom, you should SEE
              the panel getting agitated before they cut you off. */}
          {experience === "boardroom" && isPresenting && voice.isListening && (
            <div className="flex-shrink-0 border-b border-[#1a1a1a] px-4 py-2 lg:px-6">
              <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase tracking-wider text-amber-500/70 flex-shrink-0 animate-pulse">
                  Under pressure
                </span>
                <div className="flex gap-1.5 flex-1 min-w-0">
                  {personas.map((p) => {
                    const score = agitation[p.id] || 0;
                    const dots = Math.min(5, Math.floor(score / 20));
                    const danger = score >= 80;
                    return (
                      <div key={p.id} className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-[9px] uppercase tracking-wider text-neutral-600 hidden sm:inline">
                          {p.name.replace("The ", "")}
                        </span>
                        <div className="flex gap-0.5">
                          {[0,1,2,3,4].map((i) => (
                            <div
                              key={i}
                              className={cn(
                                "h-1.5 w-1.5 rounded-full transition-colors duration-300",
                                i < dots
                                  ? danger
                                    ? "bg-red-400"
                                    : "bg-amber-400"
                                  : "bg-neutral-800"
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Conversation feed — scrollable */}
          <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-6">
            <div className="mx-auto max-w-2xl space-y-3">
              {/* Presenting prompt (Defense & Boardroom) */}
              {isPresenting && captions.length === 0 && (
                <div className="spar-fade-up rounded-md border border-[#1a1a1a] bg-[#0f0f0f] px-5 py-6 text-center">
                  {settling ? (
                    <>
                      <div className="flex items-center justify-center gap-2 mb-2">
                        {personas.map((p) => (
                          <div key={p.id} className="flex flex-col items-center gap-1">
                            <div className="h-2 w-2 animate-pulse rounded-full bg-neutral-500" />
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-neutral-600">
                        The panel is taking their seats...
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-neutral-300 mb-1">
                        {experience === "boardroom"
                          ? "Present. They will interrupt you."
                          : "The floor is yours."}
                      </p>
                      <p className="text-xs text-neutral-600">
                        {experience === "boardroom"
                          ? "Present your material. The panel will cut in when they detect weakness. Click "
                          : "Present your material. The panel is listening. Click "}
                        <span className="text-neutral-400">Done Presenting</span>
                        {" "}when you're ready for Q&A.
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Boardroom "resume presenting" cue — shows after an interrupt
                  resolves, reminding the user to continue their presentation
                  (not switch to Q&A mode). Auto-dismisses when they start
                  speaking again. */}
              {experience === "boardroom" && isPresenting && isUserTurn && !voice.isListening && captions.length > 0 && (
                <div className="spar-fade-up rounded-md border border-amber-500/20 bg-amber-500/[0.03] px-4 py-2.5 text-center">
                  <p className="text-xs text-amber-300/80">
                    Continue presenting — or click <span className="text-amber-200">Done Presenting</span> if you're finished.
                  </p>
                </div>
              )}

              {/* Coach analysis card (shown after presentation, before Q&A).
                  Shows the full read: strengths, weakness, anticipated attack,
                  and the coach's headline read. The user clicks "Begin Q&A"
                  when they're ready — no auto-dismiss timer. */}
              {coachAnalysis && (
                <div className="spar-fade-up rounded-md border border-[#2a2a2a] bg-[#171717] px-4 py-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#1a1a1a]">
                      <span className="text-[10px] font-bold text-neutral-300">CO</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">
                        Coach read
                      </p>
                      <p className="text-sm text-neutral-200 leading-relaxed">
                        {coachAnalysis.coachRead}
                      </p>
                    </div>
                  </div>

                  {/* Strengths */}
                  {coachAnalysis.strengths.length > 0 && (
                    <div className="mb-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-neutral-600 mb-1">
                        What worked
                      </p>
                      <ul className="space-y-1">
                        {coachAnalysis.strengths.map((s, i) => (
                          <li key={i} className="text-xs text-neutral-400 flex items-start gap-1.5">
                            <span className="text-neutral-600 mt-0.5">·</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Weakness */}
                  {coachAnalysis.weakness && (
                    <div className="mb-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-neutral-600 mb-1">
                        The weakness
                      </p>
                      <p className="text-xs text-neutral-300">{coachAnalysis.weakness}</p>
                    </div>
                  )}

                  {/* Anticipated attack */}
                  {coachAnalysis.anticipatedAttack && (
                    <div className="mb-3">
                      <p className="text-[10px] uppercase tracking-wider text-amber-500/60 mb-1">
                        They'll attack first
                      </p>
                      <p className="text-xs text-amber-300/80">{coachAnalysis.anticipatedAttack}</p>
                    </div>
                  )}

                  {/* Begin Q&A button */}
                  <button
                    onClick={() => beginQA()}
                    className="w-full flex items-center justify-center gap-2 px-4 h-10 rounded-md bg-neutral-100 text-black text-xs font-medium hover:bg-white transition-all mt-1"
                  >
                    Begin Q&A
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Analyzing presentation indicator */}
              {analyzingPresentation && (
                <div className="flex items-center justify-center gap-2 py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />
                  <span className="text-xs text-neutral-500">
                    The panel is reviewing your presentation...
                  </span>
                </div>
              )}

              {captions.map((c) => (
                <CaptionRow key={c.id} entry={c} />
              ))}
              {/* Processing indicator */}
              {isProcessing && (
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <span className="flex gap-0.5">
                    <span className="spar-thinking-dot inline-block h-1.5 w-1.5 rounded-full bg-neutral-400" />
                    <span className="spar-thinking-dot inline-block h-1.5 w-1.5 rounded-full bg-neutral-400" />
                    <span className="spar-thinking-dot inline-block h-1.5 w-1.5 rounded-full bg-neutral-400" />
                  </span>
                  The panel is thinking...
                </div>
              )}
              <div ref={captionsEndRef} />
            </div>
          </div>
        </div>

        {/* Right rail — panelist presence (desktop only, lg+) */}
        <aside
          className="hidden lg:flex flex-col border-l border-white/[0.05] bg-[#0a0a0a] overflow-y-auto px-5 py-5"
          style={{ width: "380px", minWidth: "320px", maxWidth: "420px" }}
        >
          <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-600 mb-4">
            The Panel
          </p>
          <PresenceRail
            personas={personas}
            states={personaStates}
            agitation={agitation}
            layout="rail"
          />
        </aside>
      </div>

      {/* Bottom bar — narrow, glass */}
      <div
        className="flex-shrink-0"
        style={{
          background: "rgba(10, 10, 10, 0.65)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "inset 0 -1px 0 0 rgba(255, 255, 255, 0.04), 0 -8px 24px -12px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-2 sm:px-6">
          {/* Left — I need a moment */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNeedMoment}
            disabled={!isUserTurn || isProcessing || audioPlaying}
            className="text-neutral-400 hover:text-white"
          >
            <Hand className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">I need a moment</span>
          </Button>

          {/* Center — engine-aware speak controls */}
          <RoomControlDeck
            isSupported={voice.isSupported}
            connectionError={connectionError}
            coachAnalysisOpen={coachAnalysis !== null}
            analyzingPresentation={analyzingPresentation}
            isPresenting={isPresenting}
            drillRetry={drillRetry}
            drillAttempts={drillAttempts}
            isUserTurn={isUserTurn}
            isProcessing={isProcessing}
            isListening={voice.isListening}
            audioPlaying={audioPlaying}
            liveStatus={liveDeckStatus}
            waveformAmplitude={waveformAmplitude}
            onStartSpeaking={handleStartSpeaking}
            onStopSpeaking={handleStopSpeaking}
            onDonePresenting={handleDonePresenting}
            onRetry={handleConnectionRetry}
          />

          {/* Right — End session */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowEndDialog(true)}
            disabled={ending}
            className="text-neutral-400 hover:text-red-400"
          >
            End
          </Button>
        </div>
      </div>

      {/* Browser support warning */}
      {!voice.isSupported && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 px-6">
          <div className="max-w-sm text-center">
            <AlertCircle className="h-10 w-10 mx-auto mb-4 text-neutral-500" />
            <h2 className="text-lg font-semibold text-white mb-2">
              Voice sparring needs Chrome or Edge
            </h2>
            <p className="text-sm text-neutral-400 mb-4">
              The Web Speech API (which powers live transcription) isn&apos;t available in this browser. Please switch to Chrome or Edge to use the Sparring Room.
            </p>
            <Button variant="outline" onClick={onExit}>
              Back to Home
            </Button>
          </div>
        </div>
      )}

      {/* Mic permission error */}
      {voice.error && (
        <div className="fixed bottom-20 left-4 right-4 z-40 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {voice.error}
        </div>
      )}

      {/* Error toast */}
      {error && captions.length > 0 && (
        <div className="fixed bottom-20 left-4 right-4 z-40 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* End session dialog */}
      <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this sparring session?</AlertDialogTitle>
            <AlertDialogDescription>
              The panel will stop and your coach will write the debrief. You can&apos;t resume this session — but the patterns will be remembered next time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep sparring</AlertDialogCancel>
            <AlertDialogAction onClick={handleEnd}>End &amp; get coached</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Live engine UI helpers ─────────────────────────────────────────────
// The engine ladder (gemini-live → cascade) lives in the hooks; the room
// only maps its state onto the UI. `liveSessionActive` is the room's own
// record that its one-activation Live session is running — the hook-level
// status alone can read "live" after a stop() and must not drive the UI.

// The engine helpers (engineStatusLabel, liveOwnsControls, recordsTurnAudio,
// startsRecorderOnFallback, liveUserInterimCaption) now live in ./room-state
// and are re-exported here for the pinned test surface.
export {
  engineStatusLabel,
  liveOwnsControls,
  recordsTurnAudio,
  startsRecorderOnFallback,
  liveUserInterimCaption,
} from "./room-state";

/** Small quiet status chip: which voice engine is running the room. */
export function EngineStatusChip({ label }: { label: EngineStatusLabel }) {
  return (
    <span
      data-engine={label.toLowerCase()}
      title={label === "Live" ? "Gemini Live voice engine" : "Classic voice engine"}
      className={cn(
        "flex-shrink-0 rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-wider",
        label === "Live"
          ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300/80"
          : "border-[#2a2a2a] bg-[#171717] text-neutral-400",
        label === "Connecting" && "animate-pulse",
      )}
    >
      {label}
    </span>
  );
}

export interface RoomControlDeckProps {
  isSupported: boolean;
  connectionError: boolean;
  coachAnalysisOpen: boolean;
  analyzingPresentation: boolean;
  isPresenting: boolean;
  drillRetry: boolean;
  drillAttempts: number;
  isUserTurn: boolean;
  isProcessing: boolean;
  isListening: boolean;
  audioPlaying: boolean;
  /** "off" — the classic click flow owns the deck; otherwise the live engine does. */
  liveStatus: "connecting" | "live" | "off";
  waveformAmplitude: number;
  onStartSpeaking: () => void;
  onStopSpeaking: () => void;
  onDonePresenting: () => void;
  onRetry: () => void;
}

/**
 * The room's speak-control deck. In live mode ("connecting"/"live") the
 * per-turn Speak/Done buttons are hidden — one mic activation keeps the mic
 * live and the server VAD owns turn-taking and barge-in. In every other
 * state the existing click flow renders unchanged.
 */
export function RoomControlDeck({
  isSupported,
  connectionError,
  coachAnalysisOpen,
  analyzingPresentation,
  isPresenting,
  drillRetry,
  drillAttempts,
  isUserTurn,
  isProcessing,
  isListening,
  audioPlaying,
  liveStatus,
  waveformAmplitude,
  onStartSpeaking,
  onStopSpeaking,
  onDonePresenting,
  onRetry,
}: RoomControlDeckProps) {
  return (
    <div className="flex items-center gap-3">
      {!isSupported ? (
        <div className="text-center">
          <p className="text-xs text-neutral-500">
            Voice needs Chrome or Edge
          </p>
        </div>
      ) : connectionError ? (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 h-10 rounded-md border border-[#3a3a3a] bg-[#171717] text-xs font-medium text-neutral-200 hover:bg-[#1a1a1a] transition-all"
        >
          <Loader2 className="h-3.5 w-3.5" />
          Retry
        </button>
      ) : liveStatus !== "off" ? (
        // Live engine owns the room: no per-turn controls, mic stays live.
        liveStatus === "live" ? (
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/[0.08]">
              <Mic className="h-5 w-5 text-emerald-300" />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 hidden sm:inline">
              Mic live — just talk, interruption is instant
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 hidden sm:inline">
              Connecting the live engine…
            </span>
          </div>
        )
      ) : coachAnalysisOpen ? (
        // Coach analysis card is showing — hint the user to read it
        // and click "Begin Q&A" in the card above
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#171717]">
            <FileText className="h-4 w-4 text-neutral-400" />
          </div>
          <span className="text-[10px] uppercase tracking-wider text-neutral-500 hidden sm:inline">
            Read the coach read above — then begin Q&amp;A
          </span>
        </div>
      ) : analyzingPresentation ? (
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">
            Panel is reviewing...
          </span>
        </div>
      ) : isPresenting ? (
        // Defense mode: mic + "Done Presenting" button
        <div className="flex items-center gap-3">
          {isListening ? (
            <button
              onClick={onDonePresenting}
              className="flex items-center gap-2 px-4 h-10 rounded-md bg-neutral-100 text-black text-xs font-medium hover:bg-white transition-all"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              Done Presenting
            </button>
          ) : (
            <button
              onClick={onStartSpeaking}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-black transition-transform active:scale-95"
              aria-label="Start presenting"
            >
              <Mic className="h-5 w-5" />
            </button>
          )}
          <span className="text-[10px] uppercase tracking-wider text-neutral-500 hidden sm:inline">
            {isListening
              ? "Presenting... click Done when finished"
              : "Click to present"}
          </span>
        </div>
      ) : drillRetry && isUserTurn && !isProcessing ? (
        // Drill retry: show "Try again" with attempt count instead of
        // the normal mic button. The user is re-answering after a
        // deterministic correction. They must answer WITHOUT the
        // drilled weakness to advance to the next question.
        <div className="flex items-center gap-3">
          {isListening ? (
            <button
              onClick={onStopSpeaking}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-black transition-transform active:scale-95"
              aria-label="Stop speaking"
            >
              <Square className="h-4 w-4 fill-current" />
            </button>
          ) : (
            <button
              onClick={onStartSpeaking}
              className="group flex items-center gap-2 px-4 h-10 rounded-md bg-neutral-100 text-black text-xs font-medium hover:bg-white transition-all"
              aria-label="Try again"
            >
              <Mic className="h-3.5 w-3.5" />
              Try again
            </button>
          )}
          <span className="text-[10px] uppercase tracking-wider text-amber-400/70 hidden sm:inline">
            {isListening
              ? `Answering — attempt ${drillAttempts + 1}`
              : `Attempt ${drillAttempts + 1} — answer without the weakness`}
          </span>
        </div>
      ) : isUserTurn && !isProcessing ? (
        isListening ? (
          <button
            onClick={onStopSpeaking}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-black transition-transform active:scale-95"
            aria-label="Stop speaking"
          >
            <Square className="h-4 w-4 fill-current" />
          </button>
        ) : (
          <button
            onClick={onStartSpeaking}
            className="group flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-black transition-transform active:scale-95"
            aria-label="Start speaking"
          >
            <Mic className="h-5 w-5" />
          </button>
        )
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-neutral-600">
          <Pause className="h-4 w-4" />
        </div>
      )}
      {/* Waveform — shows whenever the user is speaking (classic modes;
          the live deck carries its own quiet indicator above) */}
      {!analyzingPresentation && liveStatus === "off" && (
        isListening ? (
          <WaveformBar amplitude={waveformAmplitude} />
        ) : (
          <span className="text-[10px] uppercase tracking-wider text-neutral-500 hidden sm:inline">
            {isUserTurn && !isProcessing
              ? isPresenting
                ? "Click to present"
                : "Click to speak"
              : isProcessing
              ? "Panel is responding"
              : audioPlaying
              ? "Panel is speaking"
              : "Wait for your turn"}
          </span>
        )
      )}
    </div>
  );
}

/** A single caption row — user or persona. */
/**
 * The panelist presence rail — the room's signature element. Every panelist
 * is an EQUAL-SIZE circular presence (user-locked: no panelist towers over
 * another — the room is a peer panel, not a hierarchy). The rail (desktop)
 * stacks full entries with one-liners; the strip (mobile) is compact rows.
 * Persona states map onto the room's state language (thinking → gathering),
 * and agitation at 80+ pulses the avatar — the interrupt tell, finally wired.
 */
export function PresenceRail({
  personas,
  states,
  agitation,
  layout = "rail",
}: {
  personas: SessionPersona[];
  states: Record<string, "idle" | "listening" | "thinking" | "speaking" | "about-to-interrupt">;
  agitation: Record<string, number>;
  layout?: "rail" | "strip";
}) {
  const ordered = [...personas].sort((a, b) => a.seatOrder - b.seatOrder);

  const presenceFor = (id: string): PresenceState => {
    const s = states[id];
    if (s === "speaking") return "speaking";
    if (s === "thinking" || s === "about-to-interrupt") return "gathering";
    return "listening";
  };

  if (layout === "strip") {
    return (
      <div className="flex items-center gap-6">
        {ordered.map((p) => (
          <div key={p.id} className="flex-shrink-0">
            <PanelistPresence
              archetype={p.archetype}
              name={p.name}
              status={presenceFor(p.id)}
              variant="row"
              aboutToInterrupt={(agitation[p.id] ?? 0) >= 80}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      {ordered.map((p) => (
        <PanelistPresence
          key={p.id}
          archetype={p.archetype}
          name={p.name}
          status={presenceFor(p.id)}
          variant="portrait"
          aboutToInterrupt={(agitation[p.id] ?? 0) >= 80}
        />
      ))}
    </div>
  );
}

export function CaptionRow({ entry }: { entry: CaptionEntry }) {
  const isUser = entry.role === "user";
  const isCoach = entry.type === "coach_whisper";
  const isInterruption = entry.type === "interruption";
  const isOpening = entry.type === "opening";

  if (isCoach) {
    return (
      <div className="spar-fade-up rounded-md border border-[#1a1a1a] bg-[#0f0f0f] px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-neutral-600 mb-1">
          Coach whisper
        </p>
        <p className="text-sm text-neutral-300 italic">{entry.content}</p>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex justify-end spar-fade-up">
        <div className="max-w-[85%]">
          <div className="mb-1 text-right text-[10px] uppercase tracking-wider text-neutral-500">
            {entry.isLive ? "Speaking..." : "You"}
          </div>
          <div
            className={cn(
              "rounded-md rounded-br-sm border px-4 py-2.5 text-sm text-neutral-200",
              entry.isLive
                ? "border-[#1a1a1a] bg-[#0a0a0a]"
                : "border-[#2a2a2a] bg-[#171717]"
            )}
          >
            {entry.content}
          </div>
        </div>
      </div>
    );
  }

  // Persona
  return (
    <div className="flex gap-3 spar-fade-up">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-medium text-white/90">
            {entry.personaName}
          </span>
          {isOpening && (
            <span className="rounded border border-[#2a2a2a] bg-[#171717] px-1 py-px text-[9px] uppercase tracking-wider text-neutral-300">
              Opening
            </span>
          )}
          {isInterruption && (
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">
              Interrupting
            </span>
          )}
          {typeof entry.claimRef === "number" && entry.claimRef > 0 && (
            <span className="rounded border border-[#1a1a1a] bg-[#0f0f0f] px-1 py-px text-[9px] uppercase tracking-wider text-neutral-500">
              → Claim {entry.claimRef}
            </span>
          )}
        </div>
        <div
          className={cn(
            "rounded-md rounded-bl-sm border px-4 py-2.5 text-sm text-neutral-200",
            entry.archetype && "spar-caption-accent",
            isInterruption
              ? "border-[#2a2a2a] bg-[#141414] ml-2"
              : "border-[#1a1a1a] bg-[#0f0f0f]"
          )}
          style={
            entry.archetype
              ? {
                  borderLeft: `2px solid color-mix(in oklab, ${
                    ARCHETYPES[entry.archetype].accentHue
                  } 45%, transparent)`,
                }
              : undefined
          }
        >
          {entry.content}
        </div>
      </div>
    </div>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function safeParseArray<T>(s: string): T[] {
  try {
    return JSON.parse(s) as T[];
  } catch {
    return [];
  }
}
