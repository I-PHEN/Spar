"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Mic,
  Square,
  Loader2,
  Clock,
  AlertCircle,
  FileText,
  Pause,
  ArrowRight,
  VolumeX,
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
import { Kwesi } from "./kwesi-mascot";
import {
  engineStatusLabel,
  liveOwnsControls,
  recordsTurnAudio,
  startsRecorderOnFallback,
  type EngineStatusLabel,
  type PresenceState,
} from "./room-state";
import { ARCHETYPES } from "@/lib/personas";
import { detectLiveDrillViolation, evaluateDrillTurn, getDrillDefinition } from "@/lib/drills";
import { useVoiceRecognition, playBase64Audio } from "@/hooks/use-voice";
import { useTurnController } from "@/hooks/use-turn-controller";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { useAgitationEngine, type DrillTarget } from "@/hooks/use-agitation";
import { playActivationClick, useWaveformAmplitude } from "@/hooks/use-sound";
import { SCENARIOS } from "@/lib/scenarios";
import { PERSONA_VOICES } from "@/lib/providers/deepgram-tts";
import type { LivePersona } from "@/lib/spar/live-turn-service";
import { readStoredUserPreferences } from "@/lib/user-preferences";
import { formatRoomDisplaySubtitle } from "@/lib/domains";
import {
  extractVoiceProfileFromContext,
  resolveDeepgramVoiceModel,
} from "@/lib/voice-accents";
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
    if (typeof window !== "undefined") {
      if (!readStoredUserPreferences().buzzerSoundEnabled) return;
    }
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
  const [materialTitle, setMaterialTitle] = useState<string | null>(null);
  const [scenarioLabel, setScenarioLabel] = useState<string>("");
  const [roomContext, setRoomContext] = useState<string>("");
  const [coachingFocus, setCoachingFocus] = useState<string | null>(null);
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
  const [drillRepOutcomes, setDrillRepOutcomes] = useState<
    Array<"clean-1" | "clean-2" | "clean-3">
  >([]);
  const [drillLastReason, setDrillLastReason] = useState<string | null>(null);
  const userTurnStartedAtRef = useRef<number | null>(null);
  const speechStartedAtRef = useRef<number | null>(null);
  const [connectionError, setConnectionError] = useState(false);
  const [captionOnlyMode, setCaptionOnlyMode] = useState(false);
  const [dismissedNoticeKey, setDismissedNoticeKey] = useState<string | null>(null);
  const [personaStates, setPersonaStates] = useState<Record<string, PersonaState>>({});
  const [loading, setLoading] = useState(true);
  // Quiet "taking their seats" beat while /open generates the opening line.
  const [opening, setOpening] = useState(true);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [sessionStart] = useState(Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);

  // Voice state
  // Presentation capture retains the long-form recognizer. Every live Q&A
  // turn is owned by the low-latency controller (Flux -> generator -> Aura).
  const presentationVoice = useVoiceRecognition();

  // Gemini Live configuration: built once the panel has loaded for single-panelist
  // non-drill sessions. Drill Mode requires the turn-controlled cascade for
  // deterministic heuristic interrupts & retry state, and multi-panelist rooms
  // require the cascade so panelists rotate turn-by-turn with distinct voices.
  const liveConfig = useMemo(() => {
    if (personas.length !== 1 || experience === "drill") return undefined;
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
      drillTarget,
      roomContext,
      coachingFocus,
      materialTitle,
      rawMaterial: rawMaterial || null,
    };
  }, [personas, experience, scenarioLabel, claims, drillTarget, roomContext, coachingFocus, materialTitle, rawMaterial]);

  const voiceProfile = useMemo(
    () => extractVoiceProfileFromContext(roomContext),
    [roomContext],
  );
  const defaultCascadeVoice = useMemo(() => {
    const lead = [...personas].sort((a, b) => a.seatOrder - b.seatOrder)[0];
    if (!lead || !voiceProfile.hasExplicitProfile) return "aura-2-zeus-en";
    return resolveDeepgramVoiceModel({
      archetype: lead.archetype,
      seatOrder: lead.seatOrder,
      roomContext,
    }).v1Model;
  }, [personas, roomContext, voiceProfile.hasExplicitProfile]);
  const resolveCascadeVoice = useCallback(
    (persona: LivePersona) => {
      if (!voiceProfile.hasExplicitProfile) {
        return (
          PERSONA_VOICES[persona.archetype as keyof typeof PERSONA_VOICES] ??
          "aura-2-zeus-en"
        );
      }
      return resolveDeepgramVoiceModel({
        archetype: persona.archetype as ArchetypeKey,
        seatOrder: persona.seatOrder,
        roomContext,
      }).v1Model;
    },
    [roomContext, voiceProfile.hasExplicitProfile],
  );

  const turnController = useTurnController({
    sessionId,
    voiceModel: defaultCascadeVoice,
    resolveVoiceModel: resolveCascadeVoice,
    live: liveConfig,
    onLiveInterrupted: () => {
      // Barge-in: flicker the lead panelist's presence (the live voice).
      const lead = [...personas].sort((a, b) => a.seatOrder - b.seatOrder)[0];
      if (!lead) return;
      setInterruptedPersonaId(lead.id);
      window.setTimeout(() => setInterruptedPersonaId(null), 650);
    },
  });
  const voice = isPresenting ? presentationVoice : turnController;
  const recorder = useAudioRecorder();
  // Counter for user messages — used to key audio clips in IndexedDB.
  // Each user turn (presentation + each Q&A answer) gets a unique index.
  const messageIndexRef = useRef(0);
  const [isUserTurn, setIsUserTurn] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  // Barge-in acknowledgment: which panelist's presence flickers (live mode).
  const [interruptedPersonaId, setInterruptedPersonaId] = useState<string | null>(null);

  // Live engine (Gemini Live): the room tracks whether its one-activation mic
  // session is running. The hook-level status can still read "live" after a
  // stop() (it only transitions on the next session), so the room derives its
  // engine UI from this flag AND the status — never the status alone.
  const [liveSessionActive, setLiveSessionActive] = useState(false);
  // Hands-free Auto-Mic: automatically arms the mic when it's the user's turn
  // and auto-sends after a natural pause (~1.6s Drill / ~2.1s Q&A).
  const [handsFree, setHandsFree] = useState(true);

  useEffect(() => {
    setHandsFree(readStoredUserPreferences().autoMicEnabled);
  }, []);

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

  // Timer
  useEffect(() => {
    const t = setInterval(() => setElapsedSec(Math.floor((Date.now() - sessionStart) / 1000)), 1000);
    return () => clearInterval(t);
  }, [sessionStart]);

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

  // Mirror panelist captions cleanly without ChatGPT token-streaming clutter:
  // in classic Cascade mode wait until speech starts or completes before
  // showing the caption; in Live voice mode reflect spoken output captions.
  const showActiveAssistantCaption =
    Boolean(turnController.assistantCaption) &&
    ((liveSessionActive && turnController.liveEngineStatus === "live") ||
      turnController.turn.status === "speaking");

  useEffect(() => {
    setCaptions((previous) => {
      let next = previous.filter((caption) =>
        !caption.isLive && !caption.id.startsWith("user:") && !caption.id.startsWith("assistant:"),
      );
      for (const message of turnController.messages) {
        if (message.role !== "assistant") continue;
        const persona = message.persona;
        const entry: CaptionEntry = {
          id: message.id,
          role: "persona",
          personaId: persona?.id,
          personaName: persona?.name,
          archetype: persona?.archetype as ArchetypeKey | undefined,
          content: message.content,
          type: message.metadata?.type ?? "normal",
          claimRef: message.metadata?.claimRef,
          mood: message.metadata?.mood as PersonaMood | undefined,
          createdAt: Date.now(),
        };
        const index = next.findIndex((caption) => caption.id === message.id);
        next = index < 0 ? [...next, entry] : next.map((caption, current) => current === index ? { ...caption, ...entry } : caption);
      }
      if (showActiveAssistantCaption && turnController.assistantCaption) {
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
  }, [turnController.messages, turnController.assistantCaption, turnController.assistantMetadata, turnController.turn.turnId, turnController.activePersona, showActiveAssistantCaption]);

  useEffect(() => {
    if (isPresenting) return;
    const busy = turnController.turn.status === "finalizing" || turnController.turn.status === "generating" || turnController.turn.status === "speaking";
    setIsProcessing(busy);
    setAudioPlaying(turnController.turn.status === "speaking");
    if (turnController.error) {
      const parsed = formatRoomErrorMessage(turnController.error);
      if (parsed?.isAudioOnlyDegradation) {
        setCaptionOnlyMode(true);
        setConnectionError(false);
        setIsUserTurn(true);
      } else if (parsed) {
        setError(parsed.message);
        setConnectionError(true);
      }
    }
    const personaId = turnController.activePersona?.id;
    if (personaId) {
      setPersonaStates((previous) => {
        const next: Record<string, PersonaState> = {};
        for (const k of Object.keys(previous)) {
          next[k] =
            k === personaId
              ? turnController.turn.status === "speaking"
                ? "speaking"
                : busy
                ? "thinking"
                : "listening"
              : "listening";
        }
        return next;
      });
    }
  }, [isPresenting, turnController.turn.status, turnController.error, turnController.activePersona, turnController.assistantMetadata]);

  // Track when the floor returns to the user so recovery-speed drills can measure onset latency.
  useEffect(() => {
    if (isUserTurn && !isProcessing && !audioPlaying) {
      userTurnStartedAtRef.current = Date.now();
      speechStartedAtRef.current = null;
    }
  }, [isUserTurn, isProcessing, audioPlaying]);

  // Initial load: fetch session + open + warm up spar-stream in parallel
  useEffect(() => {
    let mounted = true;
    (async () => {
      // Launch session metadata load, /open, and route compilation warmup concurrently
      const sessionPromise = fetch(`/api/sessions/${sessionId}`);
      const openPromise = fetch(`/api/sessions/${sessionId}/open`, {
        method: "POST",
      });
      fetch(`/api/sessions/${sessionId}/spar-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _warmup: true }),
      }).catch(() => {});

      try {
        const sRes = await sessionPromise;
        if (!sRes.ok) throw new Error("Session not found");
        const sData = await sRes.json();
        if (!mounted) return;

        const session = sData.session;
        const parsedClaims: ExtractedClaim[] = session.extractedClaims
          ? safeParseArray(session.extractedClaims)
          : [];
        const scenario = SCENARIOS[session.scenario as keyof typeof SCENARIOS];
        const scenarioLabel = scenario?.label || "Custom Session";
        const roomContext = session.roomContext || scenario?.roomContext || "";

        setPersonas(session.personas);
        setClaims(parsedClaims);
        setRawMaterial(session.rawMaterial || "");
        setMaterialTitle(session.materialTitle ?? null);
        setScenarioLabel(scenarioLabel);
        setRoomContext(roomContext);
        setCoachingFocus(session.coachingFocus ?? null);

        const states: Record<string, PersonaState> = {};
        for (const p of session.personas) {
          states[p.id] = "listening";
        }
        setPersonaStates(states);

        // Paint the room NOW while /open finishes in parallel.
        if (mounted) setLoading(false);

        const oRes = await openPromise;
        if (!oRes.ok) throw new Error("Failed to open session");
        const oData = await oRes.json();
        if (!mounted) return;
        setOpening(false);

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
          setIsPresenting(true);
          setIsUserTurn(false);
          setSettling(true);

          setTimeout(() => {
            if (mounted) {
              setSettling(false);
              setIsUserTurn(true);
            }
          }, 500);
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
              if (mounted) setCaptionOnlyMode(true);
            }
            setAudioPlaying(false);
          } else {
            setCaptionOnlyMode(true);
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
      }
    })();
    return () => {
      mounted = false;
    };
  }, [sessionId]);

  // Handle user pressing "Speak" (or "Start presenting")
  const handleStartSpeaking = useCallback(() => {
    if (!voice.isSupported) return;
    setError(null);
    setConnectionError(false);
    speechStartedAtRef.current = Date.now();
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
      setError(null);
      setConnectionError(false);
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
    if (experience === "drill" && drillTarget) {
      const spokenText = (
        voice.finalTranscript +
        " " +
        voice.interimTranscript +
        " " +
        turnController.transcriptPreview
      ).trim();
      const onsetMs =
        userTurnStartedAtRef.current && speechStartedAtRef.current
          ? Math.max(0, speechStartedAtRef.current - userTurnStartedAtRef.current)
          : undefined;
      const evaluation = evaluateDrillTurn(spokenText, drillTarget, onsetMs);

      if (!evaluation.clean) {
        setDrillRetryBoth(true);
        setDrillAttempts((n) => n + 1);
        setDrillLastReason(evaluation.reason || null);
        const leadPersonaId = [...personas].sort(
          (a, b) => a.seatOrder - b.seatOrder
        )[0]?.id;
        submitTurn(true, leadPersonaId, false, { drillInterrupt: true });
        return;
      }

      const attemptsUsed = drillAttempts + 1;
      const outcome: "clean-1" | "clean-2" | "clean-3" =
        attemptsUsed === 1
          ? "clean-1"
          : attemptsUsed === 2
          ? "clean-2"
          : "clean-3";
      setDrillRepOutcomes((prev) => [...prev, outcome]);
      setDrillLastReason(null);
      submitTurn(false, undefined, false, { drillClean: true });
      return;
    }

    const isDrillClean = experience === "drill" && drillRetryRef.current;
    submitTurn(false, undefined, false, isDrillClean ? { drillClean: true } : undefined);
  }, [
    submitTurn,
    experience,
    drillTarget,
    voice.finalTranscript,
    voice.interimTranscript,
    turnController.transcriptPreview,
    drillAttempts,
    personas,
    setDrillRetryBoth,
  ]);

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
        setDrillLastReason(reason || null);
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

  // ─── Hands-Free Auto-Mic Loop (Free-Tier Friendly) ────────────────────
  // 1. Auto-arm microphone when panelist finishes and it becomes the user's turn.
  useEffect(() => {
    if (
      !shouldAutoStartMic({
        handsFree,
        isSupported: voice.isSupported,
        isPresenting,
        isUserTurn,
        isProcessing,
        audioPlaying,
        isListening: voice.isListening,
        opening,
        loading,
        showEndDialog,
        connectionError,
        coachAnalysisOpen: coachAnalysis !== null,
        liveStatus: liveDeckStatus,
      })
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      handleStartSpeaking();
    }, 280);
    return () => window.clearTimeout(timer);
  }, [
    handsFree,
    voice.isSupported,
    isPresenting,
    isUserTurn,
    isProcessing,
    audioPlaying,
    voice.isListening,
    opening,
    loading,
    showEndDialog,
    connectionError,
    coachAnalysis,
    liveDeckStatus,
    handleStartSpeaking,
  ]);

  // 2. Smart silence auto-send after user finishes a complete utterance (~1.6s Drill / ~2.1s Q&A).
  useEffect(() => {
    if (
      !handsFree ||
      isPresenting ||
      !isUserTurn ||
      isProcessing ||
      !voice.isListening ||
      liveDeckStatus !== "off" ||
      showEndDialog
    ) {
      return;
    }

    const spokenText = `${voice.finalTranscript} ${voice.interimTranscript} ${turnController.transcriptPreview}`.trim();
    const wordCount = spokenText.split(/\s+/).filter(Boolean).length;
    if (wordCount < 1) return;

    const silenceDelayMs =
      wordCount === 1
        ? autoSendSilenceMs(experience) + 400
        : autoSendSilenceMs(experience);

    const timer = window.setTimeout(() => {
      handleStopSpeaking();
    }, silenceDelayMs);

    return () => window.clearTimeout(timer);
  }, [
    handsFree,
    isPresenting,
    isUserTurn,
    isProcessing,
    voice.isListening,
    voice.finalTranscript,
    voice.interimTranscript,
    turnController.transcriptPreview,
    liveDeckStatus,
    experience,
    showEndDialog,
    handleStopSpeaking,
  ]);

  // 3. Spacebar shortcut to send early (or start/stop manually at any time).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "Space" || e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (showEndDialog || isPresenting || liveDeckStatus !== "off") return;
      if (!isUserTurn || isProcessing) return;

      e.preventDefault();
      if (voice.isListening) {
        handleStopSpeaking();
      } else {
        handleStartSpeaking();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    showEndDialog,
    isPresenting,
    liveDeckStatus,
    isUserTurn,
    isProcessing,
    voice.isListening,
    handleStopSpeaking,
    handleStartSpeaking,
  ]);

  const handleToggleHandsFree = useCallback(() => {
    setHandsFree((prev) => {
      const next = !prev;
      if (!next && voice.isListening) {
        const spoken = `${voice.finalTranscript} ${voice.interimTranscript}`.trim();
        if (!spoken) {
          voice.stop();
        }
      } else if (
        next &&
        !voice.isListening &&
        isUserTurn &&
        !isProcessing &&
        !audioPlaying &&
        !isPresenting
      ) {
        handleStartSpeaking();
      }
      return next;
    });
  }, [
    voice,
    isUserTurn,
    isProcessing,
    audioPlaying,
    isPresenting,
    handleStartSpeaking,
  ]);

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
        <p className="text-sm text-muted-foreground">
          {formatRoomErrorMessage(error)?.message ?? error}
        </p>
        <Button variant="outline" onClick={onExit}>
          Back to Home
        </Button>
      </div>
    );
  }

  const elapsedDisplay = formatTime(elapsedSec);
  const displayTitle = materialTitle?.trim() || scenarioLabel;
  const displaySubtitle = formatRoomDisplaySubtitle(roomContext);
  const audioStatusNotice = buildAudioStatusNotice({
    usingTtsFallback: turnController.usingTtsFallback,
    usingSttFallback: turnController.usingSttFallback,
    captionOnlyMode,
  });
  const formattedToastError = error
    ? (formatRoomErrorMessage(error)?.message ?? error)
    : null;
  const latestPersonaCaption =
    [...captions]
      .reverse()
      .find((c) => c.role === "persona" && c.content.trim().length > 0) ?? null;

  return (
    <div className="relative flex h-[100dvh] flex-col bg-[var(--bg-base)] text-[var(--text-primary)] overflow-hidden">
      {/* Top bar — calm single-purpose matte obsidian */}
      <div className="flex items-center justify-between border-b border-[#232327] bg-[#0B0B0D] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => setShowEndDialog(true)} className="h-8 w-8" aria-label="Exit session">
            <X className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-display text-[15px] font-bold tracking-tight text-white">
                {displayTitle}
              </p>
              {experience === "drill" && drillTarget && (
                <span className="flex-shrink-0 rounded-md border border-[#232327] bg-[#18181D] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-neutral-300">
                  Drill: {drillTarget.replace(/-/g, " ")}
                </span>
              )}
              {experience === "boardroom" && (
                <span className="flex-shrink-0 rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-amber-300/80">
                  Boardroom
                </span>
              )}
              {experience === "defense" && (
                <span className="flex-shrink-0 rounded-md border border-[#232327] bg-[#18181D] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-neutral-300">
                  Defense
                </span>
              )}
              <EngineStatusChip label={engineLabel} />
            </div>
            {(displaySubtitle || claims.length > 0) && (
              <p className="hidden sm:block text-xs text-neutral-500 max-w-xl truncate">
                {[
                  displaySubtitle,
                  claims.length > 0
                    ? `${claims.length} ${claims.length === 1 ? "claim" : "claims"}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-xl border-2 border-[var(--border-strong)] bg-[#141418] px-3 py-1 font-mono text-xs font-medium text-[var(--text-primary)] shadow-[0_2px_0_0_#060608]">
            <Clock className="h-3.5 w-3.5 text-[#C6FF3D]" />
            {elapsedDisplay}
          </div>
          <button
            type="button"
            onClick={() => setShowEndDialog(true)}
            disabled={ending}
            className="flex items-center gap-1.5 rounded-xl border border-[#2C2C34] bg-[#18181D] px-3.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-red-500/50 hover:bg-red-500/12 hover:text-red-300 active:scale-[0.98] disabled:opacity-50"
          >
            {ending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Ending...
              </>
            ) : (
              "End Session"
            )}
          </button>
        </div>
      </div>

      {/* Voice / Caption fallback status banner */}
      {audioStatusNotice && dismissedNoticeKey !== audioStatusNotice.key && (
        <RoomStatusNotice
          notice={audioStatusNotice}
          onDismiss={() => setDismissedNoticeKey(audioStatusNotice.key)}
        />
      )}

      {/* Contextual sub-strips (Coach target, Drill HUD, Boardroom agitation) */}
      {coachingFocus && (
        <div className="flex-shrink-0 border-b border-[#232327] bg-[#121215] px-4 py-2 lg:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] flex-shrink-0" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--accent)] font-semibold flex-shrink-0">
              Target Rule
            </span>
            <p className="text-xs text-neutral-200 truncate flex-1">
              {coachingFocus}
            </p>
          </div>
        </div>
      )}

      {experience === "drill" && drillTarget && (
        <DrillHudStrip
          drillTarget={drillTarget}
          outcomes={drillRepOutcomes}
          drillRetry={drillRetry}
          drillAttempts={drillAttempts}
          lastReason={drillLastReason}
          liveTranscript={
            voice.isListening
              ? `${voice.finalTranscript} ${voice.interimTranscript}`.trim()
              : ""
          }
        />
      )}

      {experience === "boardroom" && isPresenting && voice.isListening && (
        <div className="flex-shrink-0 border-b border-[#232327] px-4 py-2 lg:px-6">
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
                    <span className="text-[9px] uppercase tracking-wider text-neutral-600">
                      {p.name.replace("The ", "")}
                    </span>
                    <div className="flex gap-0.5">
                      {[0, 1, 2, 3, 4].map((i) => (
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

      {/* Face-to-Face Centered Stage + Bottom AI Caption */}
      <main
        aria-live="polite"
        className="flex flex-1 flex-col items-center justify-between overflow-y-auto px-4 py-6 sm:px-8"
      >
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-6">
          <PresenceRail
            personas={personas}
            states={personaStates}
            agitation={agitation}
            layout="stage"
            interruptedPersonaId={interruptedPersonaId}
          />

          {/* Opening beat */}
          {opening && !latestPersonaCaption && !isPresenting && (
            <div className="flex items-center justify-center gap-2 text-xs text-neutral-500">
              <span className="flex gap-0.5">
                <span className="spar-thinking-dot inline-block h-1.5 w-1.5 rounded-full bg-neutral-400" />
                <span className="spar-thinking-dot inline-block h-1.5 w-1.5 rounded-full bg-neutral-400" />
                <span className="spar-thinking-dot inline-block h-1.5 w-1.5 rounded-full bg-neutral-400" />
              </span>
              The panel is taking their seats…
            </div>
          )}

          {/* Presenting prompt (Defense & Boardroom) */}
          {isPresenting && !latestPersonaCaption && (
            <div className="spar-fade-up w-full max-w-lg rounded-xl border border-[#232327] bg-[#121215] px-5 py-5 text-center">
              {settling ? (
                <p className="text-xs text-neutral-500">
                  The panel is taking their seats...
                </p>
              ) : (
                <>
                  <p className="mb-1 text-sm text-neutral-200">
                    {experience === "boardroom"
                      ? "Present. They will interrupt you."
                      : "The floor is yours."}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {experience === "boardroom"
                      ? "Present your material. The panel will cut in when they detect weakness. Click "
                      : "Present your material. The panel is listening. Click "}
                    <span className="text-neutral-300">Done Presenting</span>
                    {" "}when you&apos;re ready for Q&amp;A.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Boardroom resume presenting cue */}
          {experience === "boardroom" && isPresenting && isUserTurn && !voice.isListening && captions.length > 0 && (
            <div className="spar-fade-up rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-2 text-center">
              <p className="text-xs text-amber-300/80">
                Continue presenting — or click <span className="text-amber-200">Done Presenting</span> if you&apos;re finished.
              </p>
            </div>
          )}

          {/* Coach analysis card (shown after presentation, before Q&A) */}
          {coachAnalysis && (
            <div className="spar-fade-up w-full max-w-xl rounded-xl border border-[#232327] bg-[#121215] px-5 py-4 text-left">
              <div className="mb-3 flex items-start gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[#232327] bg-[#18181D]">
                  <span className="text-[10px] font-bold text-neutral-300">CO</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-neutral-500">
                    Coach read
                  </p>
                  <p className="text-sm leading-relaxed text-neutral-200">
                    {coachAnalysis.coachRead}
                  </p>
                </div>
              </div>

              {coachAnalysis.strengths.length > 0 && (
                <div className="mb-2.5">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-neutral-600">
                    What worked
                  </p>
                  <ul className="space-y-1">
                    {coachAnalysis.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-neutral-400">
                        <span className="mt-0.5 text-neutral-600">·</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {coachAnalysis.weakness && (
                <div className="mb-2.5">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-neutral-600">
                    The weakness
                  </p>
                  <p className="text-xs text-neutral-300">{coachAnalysis.weakness}</p>
                </div>
              )}

              {coachAnalysis.anticipatedAttack && (
                <div className="mb-3">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-amber-500/60">
                    They&apos;ll attack first
                  </p>
                  <p className="text-xs text-amber-300/80">{coachAnalysis.anticipatedAttack}</p>
                </div>
              )}

              <button
                onClick={() => beginQA()}
                className="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-neutral-100 px-4 text-xs font-medium text-black transition-colors hover:bg-white"
              >
                Begin Q&amp;A
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Analyzing presentation indicator */}
          {analyzingPresentation && (
            <div className="flex items-center justify-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />
              <span className="text-xs text-neutral-500">
                The panel is reviewing your presentation...
              </span>
            </div>
          )}
        </div>

        {/* Bottom Closed-Caption Track — AI panelist message only (never ChatGPT chat bubbles) */}
        {!coachAnalysis && latestPersonaCaption && (
          <div className="w-full max-w-2xl shrink-0 pt-3">
            <AiStageCaption entry={latestPersonaCaption} />
          </div>
        )}
      </main>

      {/* Bottom control deck — centered voice controls only */}
      <div className="flex-shrink-0 border-t border-[#232327] bg-[#0B0B0D]">
        <div className="flex items-center justify-center px-4 py-2.5 sm:px-6">
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
            handsFree={handsFree}
            onToggleHandsFree={handleToggleHandsFree}
            onStartSpeaking={handleStartSpeaking}
            onStopSpeaking={handleStopSpeaking}
            onDonePresenting={handleDonePresenting}
            onRetry={handleConnectionRetry}
          />
        </div>
      </div>

      {/* Browser support warning */}
      {!voice.isSupported && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 px-6">
          <div className="max-w-sm text-center">
            <Kwesi pose="shake-it-off" size="md" className="mb-4 justify-center" />
            <h2 className="font-display text-lg font-bold text-white mb-2">
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
      {voice.error && <RoomToast>{voice.error}</RoomToast>}

      {/* Error toast */}
      {formattedToastError && captions.length > 0 && (
        <RoomToast onDismiss={() => setError(null)}>{formattedToastError}</RoomToast>
      )}

      {/* End session dialog */}
      <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <AlertDialogContent className="rounded-[24px] border-2 border-[var(--border-strong)] bg-[#141418] text-white shadow-[0_6px_0_0_#060608]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-lg font-bold tracking-tight text-white">
              End this sparring session?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-neutral-400">
              The panel will stop and your coach will write the debrief. You can&apos;t resume this session — but the patterns will be remembered next time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl border border-[#2C2C34] bg-[#18181D] text-neutral-200 hover:bg-[#22222A] hover:text-white">
              Keep sparring
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleEnd} className="spar-white-btn rounded-xl px-4">
              End &amp; get coached
            </AlertDialogAction>
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

export interface FormattedRoomError {
  message: string;
  isAudioOnlyDegradation: boolean;
  isBlockingConnectionError: boolean;
}

/** Translate internal engine codes into calm user-facing beta guidance. */
export function formatRoomErrorMessage(
  rawError: string | null,
): FormattedRoomError | null {
  if (!rawError || !rawError.trim()) return null;
  const trimmed = rawError.trim();
  const lower = trimmed.toLowerCase();

  if (
    lower === "browser-speech-unavailable" ||
    lower === "playback-unavailable" ||
    lower.includes("audio playback failed")
  ) {
    return {
      message:
        "Panel voice unavailable right now — panel questions appear in captions below so you can finish this round.",
      isAudioOnlyDegradation: true,
      isBlockingConnectionError: false,
    };
  }

  if (
    lower === "rate-limited" ||
    lower.includes("429") ||
    lower.includes("rate limit") ||
    lower.includes("quota")
  ) {
    return {
      message:
        "High beta traffic right now — tap Retry in a few seconds (your session is saved).",
      isAudioOnlyDegradation: false,
      isBlockingConnectionError: true,
    };
  }

  if (
    lower === "service-unavailable" ||
    lower === "network-loss" ||
    lower === "spar stream failed." ||
    lower.includes("failed to fetch") ||
    lower.includes("network")
  ) {
    return {
      message:
        "Connection hiccup while reaching the panel — tap Retry to pick up right where you left off.",
      isAudioOnlyDegradation: false,
      isBlockingConnectionError: true,
    };
  }

  if (
    lower === "provider-error" ||
    lower === "live-turn-error" ||
    lower.includes("could not finish this turn")
  ) {
    return {
      message: "The panelist paused unexpectedly — tap Retry to continue.",
      isAudioOnlyDegradation: false,
      isBlockingConnectionError: true,
    };
  }

  return {
    message: trimmed,
    isAudioOnlyDegradation: false,
    isBlockingConnectionError: true,
  };
}

export interface AudioStatusNoticeData {
  key: "caption-only" | "tts-fallback" | "stt-fallback";
  tone: "amber" | "volt";
  label: string;
  detail: string;
}

/** Prioritize audio degradation notices cleanly for beta sessions. */
export function buildAudioStatusNotice(params: {
  usingTtsFallback: boolean;
  usingSttFallback: boolean;
  captionOnlyMode: boolean;
}): AudioStatusNoticeData | null {
  if (params.captionOnlyMode) {
    return {
      key: "caption-only",
      tone: "amber",
      label: "Caption-only mode",
      detail:
        "Panel audio is unavailable right now — read panel questions in captions below and keep speaking normally.",
    };
  }
  if (params.usingTtsFallback) {
    return {
      key: "tts-fallback",
      tone: "amber",
      label: "Backup voice active",
      detail:
        "Switched to browser voice (live audio limit reached) — your mic and captions still work normally.",
    };
  }
  if (params.usingSttFallback) {
    return {
      key: "stt-fallback",
      tone: "volt",
      label: "Browser mic active",
      detail:
        "Live transcription switched to browser speech recognition — keep speaking normally.",
    };
  }
  return null;
}

/** Calm Fight Night status strip for non-blocking voice/caption fallbacks. */
export function RoomStatusNotice({
  notice,
  onDismiss,
}: {
  notice: AudioStatusNoticeData;
  onDismiss?: () => void;
}) {
  const isAmber = notice.tone === "amber";
  return (
    <div
      role="status"
      className={cn(
        "flex-shrink-0 border-b px-4 py-2 lg:px-6",
        isAmber
          ? "border-[#FF5A1F]/30 bg-[#1B120E] text-[#FFD3C2]"
          : "border-[#C6FF3D]/25 bg-[#14170E] text-[#E6FFAA]",
      )}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {notice.key === "stt-fallback" ? (
            <Mic className="h-3.5 w-3.5 shrink-0 text-[#C6FF3D]" />
          ) : (
            <VolumeX className="h-3.5 w-3.5 shrink-0 text-[#FF5A1F]" />
          )}
          <span
            className={cn(
              "shrink-0 rounded-md border px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider",
              isAmber
                ? "border-[#FF5A1F]/35 bg-[#FF5A1F]/15 text-[#FF5A1F]"
                : "border-[#C6FF3D]/35 bg-[#C6FF3D]/15 text-[#C6FF3D]",
            )}
          >
            {notice.label}
          </span>
          <p className="truncate text-xs">{notice.detail}</p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss notice"
            className="shrink-0 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Quiet announcement toast — screen readers hear it the moment it lands. */
export function RoomToast({
  children,
  onDismiss,
}: {
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div
      role="alert"
      className="fixed top-16 left-4 right-4 z-40 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-[#1B1113] px-4 py-2.5 text-xs sm:text-sm text-red-300"
    >
      <span>{children}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="shrink-0 rounded-md p-1 text-red-300/70 transition-colors hover:bg-red-500/15 hover:text-red-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/** Small quiet status chip: which voice engine is running the room. */
export function EngineStatusChip({ label }: { label: EngineStatusLabel }) {
  return (
    <span
      data-engine={label.toLowerCase()}
      title={label === "Live" ? "Gemini Live voice engine" : "Classic voice engine"}
      className={cn(
        "flex-shrink-0 rounded-md border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
        label === "Live"
          ? "border-[#C6FF3D]/45 bg-[#C6FF3D]/12 text-[#C6FF3D]"
          : "border-[#232327] bg-[#18181D] text-neutral-400",
        label === "Connecting" && "animate-pulse",
      )}
    >
      {label}
    </span>
  );
}

export function shouldAutoStartMic(params: {
  handsFree: boolean;
  isSupported: boolean;
  isPresenting: boolean;
  isUserTurn: boolean;
  isProcessing: boolean;
  audioPlaying: boolean;
  isListening: boolean;
  opening: boolean;
  loading: boolean;
  showEndDialog: boolean;
  connectionError: boolean;
  coachAnalysisOpen: boolean;
  liveStatus: "connecting" | "live" | "off";
}): boolean {
  return (
    params.handsFree &&
    params.isSupported &&
    !params.isPresenting &&
    params.isUserTurn &&
    !params.isProcessing &&
    !params.audioPlaying &&
    !params.isListening &&
    !params.opening &&
    !params.loading &&
    !params.showEndDialog &&
    !params.connectionError &&
    !params.coachAnalysisOpen &&
    params.liveStatus === "off"
  );
}

export function autoSendSilenceMs(experience: string): number {
  return experience === "drill" ? 1600 : 2100;
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
  handsFree?: boolean;
  onToggleHandsFree?: () => void;
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
  handsFree,
  onToggleHandsFree,
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
          className="flex items-center gap-2 px-4 h-10 rounded-lg border border-[#34343B] bg-[#18181D] text-xs font-medium text-neutral-200 hover:bg-[#202026] transition-colors"
        >
          <Loader2 className="h-3.5 w-3.5" />
          Retry
        </button>
      ) : liveStatus !== "off" ? (
        // Live engine owns the room: no per-turn controls, mic stays live.
        liveStatus === "live" ? (
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#C6FF3D]/40 bg-[#C6FF3D]/12">
              <Mic className="h-5 w-5 text-[#C6FF3D]" />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">
              Mic live — just talk, interruption is instant
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">
              Connecting the live engine…
            </span>
          </div>
        )
      ) : coachAnalysisOpen ? (
        // Coach analysis card is showing — hint the user to read it
        // and click "Begin Q&A" in the card above
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#232327] bg-[#18181D]">
            <FileText className="h-4 w-4 text-neutral-400" />
          </div>
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">
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
              className="spar-volt-btn flex items-center gap-2 px-5 h-11 rounded-full text-xs"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              Done Presenting
            </button>
          ) : (
            <button
              onClick={onStartSpeaking}
              className="spar-volt-btn flex h-14 w-14 items-center justify-center rounded-full"
              aria-label="Start presenting"
            >
              <Mic className="h-5 w-5" />
            </button>
          )}
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">
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
              className="spar-volt-btn flex h-14 w-14 items-center justify-center rounded-full"
              aria-label="Stop speaking"
            >
              <Square className="h-4 w-4 fill-current" />
            </button>
          ) : (
            <button
              onClick={onStartSpeaking}
              className="spar-volt-btn group flex items-center gap-2 px-5 h-11 rounded-full text-xs"
              aria-label="Try again"
            >
              <Mic className="h-3.5 w-3.5" />
              Try again
            </button>
          )}
          <span className="text-[10px] uppercase tracking-wider text-amber-400/70">
            {isListening
              ? `Answering — attempt ${drillAttempts + 1}`
              : `Attempt ${drillAttempts + 1} — answer without the weakness`}
          </span>
        </div>
      ) : isUserTurn && !isProcessing ? (
        isListening ? (
          <button
            onClick={onStopSpeaking}
            className="spar-volt-btn flex h-14 w-14 items-center justify-center rounded-full"
            aria-label="Stop speaking"
          >
            <Square className="h-4 w-4 fill-current" />
          </button>
        ) : (
          <button
            onClick={onStartSpeaking}
            className="spar-volt-btn group flex h-14 w-14 items-center justify-center rounded-full"
            aria-label="Start speaking"
          >
            <Mic className="h-5 w-5" />
          </button>
        )
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#232327] bg-neutral-900 text-neutral-600">
          <Pause className="h-4 w-4" />
        </div>
      )}
      {/* Waveform — shows whenever the user is speaking (classic modes;
          the live deck carries its own quiet indicator above) */}
      {!analyzingPresentation && liveStatus === "off" && (
        isListening ? (
          <WaveformBar amplitude={waveformAmplitude} />
        ) : (
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">
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
      {onToggleHandsFree && liveStatus === "off" && !isPresenting && (
        <button
          type="button"
          onClick={onToggleHandsFree}
          className={cn(
            "rounded-full border px-3 py-1 text-[10px] font-semibold tracking-wide transition-colors",
            handsFree
              ? "border-[#C6FF3D]/55 bg-[#C6FF3D]/12 text-[#C6FF3D] hover:bg-[#C6FF3D]/20"
              : "border-[#232327] bg-[#18181D] text-neutral-400 hover:border-[#34343B] hover:text-neutral-200",
          )}
          title={
            handsFree
              ? "Hands-free auto-mic is enabled. Click to switch to manual."
              : "Manual click-to-talk mode. Click to enable hands-free auto-mic."
          }
        >
          {handsFree ? "Auto-Mic On · Space to send" : "Manual Mic"}
        </button>
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
  interruptedPersonaId,
}: {
  personas: SessionPersona[];
  states: Record<string, "idle" | "listening" | "thinking" | "speaking" | "about-to-interrupt">;
  agitation: Record<string, number>;
  layout?: "rail" | "strip" | "stage";
  /** The panelist whose turn a live barge-in just cut off (flicker). */
  interruptedPersonaId?: string | null;
}) {
  const ordered = [...personas].sort((a, b) => a.seatOrder - b.seatOrder);

  const presenceFor = (id: string): PresenceState => {
    const s = states[id];
    if (s === "speaking") return "speaking";
    if (s === "thinking" || s === "about-to-interrupt") return "gathering";
    return "listening";
  };

  if (layout === "stage") {
    return (
      <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-14">
        {ordered.map((p) => (
          <PanelistPresence
            key={p.id}
            archetype={p.archetype}
            name={p.name}
            status={presenceFor(p.id)}
            variant="stage"
            aboutToInterrupt={(agitation[p.id] ?? 0) >= 80}
            interrupted={interruptedPersonaId === p.id}
          />
        ))}
      </div>
    );
  }

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
              interrupted={interruptedPersonaId === p.id}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {ordered.map((p) => (
        <PanelistPresence
          key={p.id}
          archetype={p.archetype}
          name={p.name}
          status={presenceFor(p.id)}
          variant="portrait"
          aboutToInterrupt={(agitation[p.id] ?? 0) >= 80}
          interrupted={interruptedPersonaId === p.id}
        />
      ))}
    </div>
  );
}

/** Closed-caption subtitle rendered directly over the stage background (zero card/border). */
export function AiStageCaption({ entry }: { entry: CaptionEntry }) {
  const isInterruption = entry.type === "interruption";
  const accentHue = entry.archetype
    ? ARCHETYPES[entry.archetype].accentHue
    : undefined;

  return (
    <div className="spar-fade-up mx-auto max-w-2xl px-4 py-2 text-center">
      <div className="mb-1.5 flex items-center justify-center gap-2">
        {accentHue && (
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: accentHue }}
          />
        )}
        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
          {entry.personaName}
        </span>
        {isInterruption && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#FF5A1F]">
            · Interrupting
          </span>
        )}
        {typeof entry.claimRef === "number" && entry.claimRef > 0 && (
          <span className="text-[10px] text-neutral-600">
            · Claim {entry.claimRef}
          </span>
        )}
      </div>
      <p className="text-[15px] leading-relaxed text-[#E4E4E7] sm:text-base">
        {entry.content}
      </p>
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
      <div className="spar-fade-up rounded-xl border border-[#232327] bg-[#121215] px-4 py-3">
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
              "rounded-xl rounded-br-sm border px-4 py-2.5 text-sm text-neutral-200",
              entry.isLive
                ? "border-[#C6FF3D]/45 bg-[#0E0E11]"
                : "border-[#C6FF3D]/30 bg-[#18181D]"
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
            <span className="rounded-md border border-[#232327] bg-[#18181D] px-1.5 py-px text-[9px] uppercase tracking-wider text-neutral-300">
              Opening
            </span>
          )}
          {isInterruption && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#FF5A1F]">
              Interrupting
            </span>
          )}
          {typeof entry.claimRef === "number" && entry.claimRef > 0 && (
            <span className="rounded-md border border-[#232327] bg-[#121215] px-1.5 py-px text-[9px] uppercase tracking-wider text-neutral-500">
              → Claim {entry.claimRef}
            </span>
          )}
        </div>
        <div
          className={cn(
            "rounded-xl rounded-bl-sm border px-4 py-2.5 text-sm text-neutral-200",
            entry.archetype && "spar-caption-accent",
            isInterruption
              ? "border-[#FF5A1F]/45 bg-[#18181D] ml-2"
              : "border-[#232327] bg-[#121215]"
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

export function DrillHudStrip({
  drillTarget,
  outcomes,
  drillRetry,
  drillAttempts,
  lastReason,
  liveTranscript,
}: {
  drillTarget: DrillTarget;
  outcomes: ReadonlyArray<"clean-1" | "clean-2" | "clean-3">;
  drillRetry: boolean;
  drillAttempts: number;
  lastReason: string | null;
  liveTranscript?: string;
}) {
  const def = getDrillDefinition(drillTarget);
  const slotCount = Math.max(5, outcomes.length + (drillRetry ? 1 : 0));
  const liveState =
    liveTranscript && liveTranscript.trim().length > 0
      ? detectLiveDrillViolation(liveTranscript, drillTarget)
      : null;

  // Compute current consecutive 1st-try clean streak
  let streak = 0;
  for (let i = outcomes.length - 1; i >= 0; i--) {
    if (outcomes[i] === "clean-1") streak++;
    else break;
  }

  return (
    <div className="flex-shrink-0 border-b border-[#232327] bg-[#121215] px-4 py-2.5 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="rounded-md border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--accent-text)] flex-shrink-0">
            Drill · {def.label}
          </span>
          <p className="text-xs text-[var(--text-secondary)] truncate">
            {def.description}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Live constraint / buzzer indicator while speaking */}
          {liveState && liveState.label && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums transition-colors",
                liveState.violated
                  ? "border-rose-500/40 bg-rose-500/15 text-rose-300 animate-pulse"
                  : liveState.wordCount >= 12 && drillTarget === "over-explaining"
                  ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                  : "border-[#C6FF3D]/40 bg-[#C6FF3D]/12 text-[#C6FF3D]"
              )}
            >
              {liveState.label}
            </span>
          )}

          {/* Rep progress slots */}
          <div className="flex items-center gap-1.5" aria-label="Drill rep progress">
            {Array.from({ length: slotCount }).map((_, idx) => {
              const outcome = outcomes[idx];
              const isCurrent = idx === outcomes.length;
              return (
                <div
                  key={idx}
                  className={cn(
                    "h-2 w-5 rounded-full transition-all",
                    outcome === "clean-1"
                      ? "bg-[var(--accent)]"
                      : outcome === "clean-2"
                      ? "bg-amber-400"
                      : outcome === "clean-3"
                      ? "bg-rose-400"
                      : isCurrent && drillRetry
                      ? "bg-amber-400/50 animate-pulse"
                      : "bg-white/10"
                  )}
                  title={
                    outcome === "clean-1"
                      ? `Rep ${idx + 1}: Clean on 1st try`
                      : outcome === "clean-2"
                      ? `Rep ${idx + 1}: Clean on 2nd try`
                      : outcome === "clean-3"
                      ? `Rep ${idx + 1}: Clean on 3+ tries`
                      : `Rep ${idx + 1}`
                  }
                />
              );
            })}
            <span className="ml-1 font-mono text-[10px] text-[var(--text-secondary)] tabular-nums">
              {outcomes.length} clean{streak >= 2 ? ` · ${streak} streak` : ""}
            </span>
          </div>

          {/* Active retry / rep badge */}
          {drillRetry ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-medium text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              Attempt #{drillAttempts + 1}
              {lastReason ? ` · ${lastReason}` : " · Restate cleanly"}
            </span>
          ) : (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 font-mono text-[10px] text-[var(--text-tertiary)] tabular-nums">
              Rep #{outcomes.length + 1}
            </span>
          )}
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
