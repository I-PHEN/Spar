"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Mic,
  Square,
  Loader2,
  ChevronLeft,
  Clock,
  AlertCircle,
  Hand,
  FileText,
  Pause,
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
import { PersonaCard } from "./persona-card";
import { TelemetryBar } from "./telemetry-bar";
import { WaveformBar } from "./waveform-bar";
import { useVoiceRecognition, playBase64Audio } from "@/hooks/use-voice";
import { useAgitationEngine, type CoachingMode, type DrillTarget } from "@/hooks/use-agitation";
import { playActivationClick, useWaveformAmplitude } from "@/hooks/use-sound";
import { SCENARIOS } from "@/lib/scenarios";
import { EXPERIENCES, type ExperienceKey } from "@/lib/experiences";
import { quickStats } from "@/lib/telemetry";
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
  coachingEnabled?: boolean;
  coachingFocus?: string;
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

interface SparResponse {
  isUserTurn: boolean;
  nextPersonaId: string | null;
  personaResponse: {
    id: string;
    personaId: string;
    personaName: string;
    archetype: ArchetypeKey;
    behaviorStyle: BehaviorStyle;
    seatOrder: number;
    content: string;
    type: MessageType;
    claimRef: number | null;
    mood: PersonaMood;
    audio: string | null;
    createdAt: string;
  } | null;
}

export function SparringRoom({
  sessionId,
  onSessionEnded,
  onExit,
  experience = "open_spar",
  drillTarget = null,
  coachingEnabled = true,
  coachingFocus = "",
}: SparringRoomProps) {
  const [personas, setPersonas] = useState<SessionPersona[]>([]);
  const [claims, setClaims] = useState<ExtractedClaim[]>([]);
  const [rawMaterial, setRawMaterial] = useState<string>("");
  const [scenarioLabel, setScenarioLabel] = useState<string>("");
  const [roomContext, setRoomContext] = useState<string>("");
  const [captions, setCaptions] = useState<CaptionEntry[]>([]);
  // Defense flow state
  const [isPresenting, setIsPresenting] = useState(false);
  const [coachRead, setCoachRead] = useState<string | null>(null);
  const [analyzingPresentation, setAnalyzingPresentation] = useState(false);
  const [personaStates, setPersonaStates] = useState<Record<string, PersonaState>>({});
  const [personaMoods, setPersonaMoods] = useState<Record<string, PersonaMood>>({});
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showClaimsPanel, setShowClaimsPanel] = useState(false);
  const [sessionStart] = useState(Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);

  // Voice state
  const voice = useVoiceRecognition();
  const [isUserTurn, setIsUserTurn] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [liveWords, setLiveWords] = useState(0);
  const [liveHedges, setLiveHedges] = useState(0);
  const [liveHasEvidence, setLiveHasEvidence] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);

  const sparInFlight = useRef(false);
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

  // Live telemetry as user speaks
  useEffect(() => {
    const fullText = voice.finalTranscript + voice.interimTranscript;
    const s = quickStats(fullText);
    setLiveWords(s.words);
    setLiveHedges(s.hedges);
    setLiveHasEvidence(s.hasEvidence);
  }, [voice.finalTranscript, voice.interimTranscript]);

  // Show live interim transcript as a caption
  useEffect(() => {
    if (voice.isListening && voice.interimTranscript) {
      setCaptions((prev) => {
        const existing = prev.find((c) => c.isLive);
        if (existing) {
          return prev.map((c) =>
            c.id === existing.id ? { ...c, content: voice.interimTranscript } : c
          );
        }
        return [
          ...prev,
          {
            id: "live-user",
            role: "user" as const,
            content: voice.interimTranscript,
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
  }, [voice.interimTranscript, voice.isListening]);

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
        const moods: Record<string, PersonaMood> = {};
        for (const p of session.personas) {
          states[p.id] = "listening";
          moods[p.id] = "listening";
        }
        setPersonaStates(states);
        setPersonaMoods(moods);

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
          // ─── Defense flow: user presents first ────────────────────────
          // Don't generate an opening. Show "The floor is yours" and
          // wait for the user to present.
          setIsPresenting(true);
          setIsUserTurn(true); // user's turn to speak (present)
        } else if (oData.message) {
          const m = oData.message;
          // Mark the speaking persona
          setPersonaStates((prev) => ({ ...prev, [m.personaId]: "speaking" }));
          setPersonaMoods((prev) => ({ ...prev, [m.personaId]: m.mood }));

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
      }
    })();
    return () => {
      mounted = false;
    };
  }, [sessionId]);

  // Handle user pressing "Speak" (or "Start presenting")
  const handleStartSpeaking = useCallback(() => {
    if (!voice.isSupported) return;
    voice.reset();
    voice.start();
    // Play the activation click — feels like a mic turning on
    playActivationClick();
  }, [voice]);

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
      resumePresenting: boolean = false
    ) => {
      voice.stop();

      // Wait a brief moment for final transcript to settle
      await new Promise((r) => setTimeout(r, 300));

      // Use both final + interim transcript (interim has the words being
      // spoken when the interrupt fired — they may not have been finalized)
      const transcript = (
        voice.finalTranscript +
        " " +
        voice.interimTranscript
      ).trim();
      if (!transcript || transcript.length < 3) {
        return;
      }

      if (sparInFlight.current) return;
      sparInFlight.current = true;
      setIsUserTurn(false);
      setIsProcessing(true);

      // If this is an interrupt, play the audio cue (chair-shift rumble)
      if (isInterrupt) {
        playInterruptCue();
      }

      // Add the finalized user message to captions
      setCaptions((prev) => [
        ...prev.filter((c) => !c.isLive),
        {
          id: `u-${Date.now()}`,
          role: "user",
          content: transcript,
          type: isInterrupt ? "normal" : "normal",
          createdAt: Date.now(),
        },
      ]);

      // Mark all personas as listening (reset from speaking)
      setPersonaStates((prev) => {
        const next: Record<string, PersonaState> = {};
        for (const k of Object.keys(prev)) next[k] = "listening";
        return { ...prev, ...next };
      });

      try {
        let userTurn = false;
        let first = true;
        while (!userTurn) {
          const body = first
            ? {
                userMessage: transcript,
                isInterrupt: isInterrupt,
                forcedPersonaId: interruptingPersonaId,
              }
            : {};
          first = false;

          const res = await fetch(`/api/sessions/${sessionId}/spar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!res.ok) throw new Error("Spar failed");
          const data: SparResponse = await res.json();

          if (!data.personaResponse) {
            userTurn = true;
            break;
          }

          const pr = data.personaResponse;

          // Show "thinking" briefly before the persona speaks
          // (shorter for interrupts — the cue already created tension)
          setPersonaStates((prev) => ({ ...prev, [pr.personaId]: "thinking" }));
          await new Promise((r) => setTimeout(r, isInterrupt ? 300 : 600));

          // Persona speaks
          setPersonaStates((prev) => ({ ...prev, [pr.personaId]: "speaking" }));
          setPersonaMoods((prev) => ({ ...prev, [pr.personaId]: pr.mood }));

          // Add caption
          setCaptions((prev) => [
            ...prev,
            {
              id: pr.id,
              role: "persona",
              personaId: pr.personaId,
              personaName: pr.personaName,
              archetype: pr.archetype,
              content: pr.content,
              type: pr.type,
              claimRef: pr.claimRef,
              mood: pr.mood,
              createdAt: new Date(pr.createdAt).getTime(),
            },
          ]);

          // Play audio
          if (pr.audio) {
            setAudioPlaying(true);
            try {
              await playBase64Audio(pr.audio);
            } catch (e) {
              console.error("Audio playback failed:", e);
            }
            setAudioPlaying(false);
          }

          // Persona done — back to listening
          setPersonaStates((prev) => ({ ...prev, [pr.personaId]: "listening" }));

          userTurn = data.isUserTurn;
        }

        // If this was a Boardroom interrupt during presenting, keep presenting.
        // The user can respond to the interrupt, then continue their presentation.
        if (resumePresenting) {
          setIsPresenting(true);
        }
        setIsUserTurn(true);
        setIsProcessing(false);
      } catch (e) {
        setError(String(e));
        setIsUserTurn(true);
        setIsProcessing(false);
      } finally {
        sparInFlight.current = false;
      }
    },
    [voice, sessionId]
  );

  // Handle user pressing "Done" (stop speaking)
  const handleStopSpeaking = useCallback(() => {
    submitTurn(false);
  }, [submitTurn]);

  // ─── Defense flow: Done Presenting ────────────────────────────────────
  // Called when the user clicks "Done Presenting" in a Defense session.
  // Saves the presentation, analyzes it, shows the coach read, then Q&A begins.
  async function handleDonePresenting() {
    voice.stop();

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

    setIsPresenting(false);
    setAnalyzingPresentation(true);
    setIsUserTurn(false);

    // Add the presentation as a caption
    setCaptions((prev) => [
      ...prev.filter((c) => !c.isLive),
      {
        id: `presentation-${Date.now()}`,
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

      // Show the coach read (if coaching is enabled)
      if (data.coachRead?.coachRead) {
        setCoachRead(data.coachRead.coachRead);
        // Wait a few seconds for the user to read the coach's comment
        await new Promise((r) => setTimeout(r, 6000));
      }

      setAnalyzingPresentation(false);
      setCoachRead(null);

      // Now Q&A begins — the panel asks the first question
      // Call the spar endpoint to get the first question
      const sparRes = await fetch(`/api/sessions/${sessionId}/spar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!sparRes.ok) throw new Error("Failed to start Q&A");
      const sparData: SparResponse = await sparRes.json();

      if (sparData.personaResponse) {
        const pr = sparData.personaResponse;
        setPersonaStates((prev) => ({ ...prev, [pr.personaId]: "thinking" }));
        await new Promise((r) => setTimeout(r, 600));
        setPersonaStates((prev) => ({ ...prev, [pr.personaId]: "speaking" }));
        setPersonaMoods((prev) => ({ ...prev, [pr.personaId]: pr.mood }));

        setCaptions((prev) => [
          ...prev,
          {
            id: pr.id,
            role: "persona",
            personaId: pr.personaId,
            personaName: pr.personaName,
            archetype: pr.archetype,
            content: pr.content,
            type: pr.type,
            claimRef: pr.claimRef,
            mood: pr.mood,
            createdAt: new Date(pr.createdAt).getTime(),
          },
        ]);

        if (pr.audio) {
          setAudioPlaying(true);
          try {
            await playBase64Audio(pr.audio);
          } catch (e) {
            console.error("Audio playback failed:", e);
          }
          setAudioPlaying(false);
        }

        setPersonaStates((prev) => ({ ...prev, [pr.personaId]: "listening" }));
      }

      setIsUserTurn(true);
    } catch (e) {
      setError(String(e));
      setAnalyzingPresentation(false);
      setIsUserTurn(true);
    }
  }

  // ─── The Agitation Engine ────────────────────────────────────────────
  // Watches the live transcript for heuristic triggers (hedges, long answers,
  // vague quantifiers). When a persona's agitation hits 100, fires an interrupt.
  const handleInterrupt = useCallback(
    (personaId: string, reason: string) => {
      console.log(`[agitation] Interrupt fired: ${personaId} (${reason})`);
      // For Boardroom: interrupt during presenting → resume presenting after
      const shouldResume = experience === "boardroom" && isPresenting;
      submitTurn(true, personaId, shouldResume);
    },
    [submitTurn, experience, isPresenting]
  );

  // ─── Waveform + activation sound ──────────────────────────────────────
  // Track amplitude while listening (for the subtle waveform bar)
  const waveformAmplitude = useWaveformAmplitude(voice.isListening);

  // For Boardroom: the agitation engine runs DURING presenting (interrupts mid-speech).
  // For Defense: the agitation engine does NOT run during presenting (no interruptions).
  // For Open Spar/Drill: runs during normal Q&A turns.
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
    voice.stop();
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
        {/* Mobile panel — horizontal scroll (below lg, stacks on top) */}
        <div
          className="lg:hidden flex-shrink-0 border-b border-white/[0.06] overflow-x-auto px-4 py-3"
          style={{
            background: "rgba(10, 10, 10, 0.4)",
          }}
        >
          <div className="flex gap-2.5">
            {personas.map((p) => (
              <div key={p.id} className="flex-shrink-0 w-[200px]">
                <PersonaCard
                  archetype={p.archetype}
                  name={p.name}
                  behaviorStyle={p.behaviorStyle}
                  state={personaStates[p.id] || "idle"}
                  mood={personaMoods[p.id] || "neutral"}
                  agitation={agitation[p.id] || 0}
                  variant="compact"
                />
              </div>
            ))}
          </div>
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

          {/* Conversation feed — scrollable */}
          <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-6">
            <div className="mx-auto max-w-2xl space-y-3">
              {/* Presenting prompt (Defense & Boardroom) */}
              {isPresenting && captions.length === 0 && (
                <div className="spar-fade-up rounded-md border border-[#1a1a1a] bg-[#0f0f0f] px-5 py-6 text-center">
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
                </div>
              )}

              {/* Coach read (shown after presentation, before Q&A) */}
              {coachRead && (
                <div className="spar-fade-up rounded-md border border-[#2a2a2a] bg-[#171717] px-4 py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#1a1a1a]">
                      <span className="text-[10px] font-bold text-neutral-300">CO</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">
                        Coach
                      </p>
                      <p className="text-sm text-neutral-200 leading-relaxed">
                        {coachRead}
                      </p>
                    </div>
                  </div>
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

        {/* Right sidebar — Panel (desktop only, lg+) */}
        <aside
          className="hidden lg:flex flex-col border-l border-white/[0.05] bg-[#0a0a0a] overflow-y-auto px-3 py-4"
          style={{ width: "380px", minWidth: "320px", maxWidth: "420px" }}
        >
          <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-600 px-1 mb-3">
            The Panel
          </p>
          {personas.map((p) => (
            <PersonaCard
              key={p.id}
              archetype={p.archetype}
              name={p.name}
              behaviorStyle={p.behaviorStyle}
              state={personaStates[p.id] || "idle"}
              mood={personaMoods[p.id] || "neutral"}
              agitation={agitation[p.id] || 0}
              variant="sidebar"
            />
          ))}
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

          {/* Center — Speak / Done button + status */}
          <div className="flex items-center gap-3">
            {!voice.isSupported ? (
              <div className="text-center">
                <p className="text-xs text-neutral-500">
                  Voice needs Chrome or Edge
                </p>
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
                {voice.isListening ? (
                  <button
                    onClick={handleDonePresenting}
                    className="flex items-center gap-2 px-4 h-10 rounded-md bg-neutral-100 text-black text-xs font-medium hover:bg-white transition-all"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                    Done Presenting
                  </button>
                ) : (
                  <button
                    onClick={handleStartSpeaking}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-black transition-transform active:scale-95"
                    aria-label="Start presenting"
                  >
                    <Mic className="h-5 w-5" />
                  </button>
                )}
                <span className="text-[10px] uppercase tracking-wider text-neutral-500 hidden sm:inline">
                  {voice.isListening
                    ? "Presenting... click Done when finished"
                    : "Click to present"}
                </span>
              </div>
            ) : isUserTurn && !isProcessing ? (
              voice.isListening ? (
                <button
                  onClick={handleStopSpeaking}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-black transition-transform active:scale-95"
                  aria-label="Stop speaking"
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
              ) : (
                <button
                  onClick={handleStartSpeaking}
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
            {/* Waveform — shows whenever the user is speaking, across ALL modes */}
            {!analyzingPresentation && (
              voice.isListening ? (
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

/** A single caption row — user or persona. */
function CaptionRow({ entry }: { entry: CaptionEntry }) {
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
            isInterruption
              ? "border-[#2a2a2a] bg-[#141414] ml-2"
              : "border-[#1a1a1a] bg-[#0f0f0f]"
          )}
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
