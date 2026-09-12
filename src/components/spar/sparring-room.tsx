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
import { useVoiceRecognition, playBase64Audio } from "@/hooks/use-voice";
import { SCENARIOS } from "@/lib/scenarios";
import { quickStats } from "@/lib/telemetry";
import type {
  ArchetypeKey,
  BehaviorStyle,
  ExtractedClaim,
  MessageType,
  PersonaMood,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface SparringRoomProps {
  sessionId: string;
  onSessionEnded: () => void;
  onExit: () => void;
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
}: SparringRoomProps) {
  const [personas, setPersonas] = useState<SessionPersona[]>([]);
  const [claims, setClaims] = useState<ExtractedClaim[]>([]);
  const [scenarioLabel, setScenarioLabel] = useState<string>("");
  const [roomContext, setRoomContext] = useState<string>("");
  const [captions, setCaptions] = useState<CaptionEntry[]>([]);
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

          // Play the opening audio
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
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [sessionId]);

  // Handle user pressing "Speak"
  const handleStartSpeaking = useCallback(() => {
    if (!voice.isSupported) return;
    voice.reset();
    voice.start();
  }, [voice]);

  // Handle user pressing "Done" (stop speaking)
  const handleStopSpeaking = useCallback(async () => {
    voice.stop();

    // Wait a brief moment for final transcript to settle
    await new Promise((r) => setTimeout(r, 300));

    const transcript = voice.finalTranscript.trim();
    if (!transcript || transcript.length < 3) {
      return;
    }

    if (sparInFlight.current) return;
    sparInFlight.current = true;
    setIsUserTurn(false);
    setIsProcessing(true);

    // Add the finalized user message to captions
    setCaptions((prev) => [
      ...prev.filter((c) => !c.isLive),
      {
        id: `u-${Date.now()}`,
        role: "user",
        content: transcript,
        type: "normal",
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
        const body = first ? { userMessage: transcript } : {};
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
        setPersonaStates((prev) => ({ ...prev, [pr.personaId]: "thinking" }));
        await new Promise((r) => setTimeout(r, 600));

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

      setIsUserTurn(true);
      setIsProcessing(false);
    } catch (e) {
      setError(String(e));
      setIsUserTurn(true);
      setIsProcessing(false);
    } finally {
      sparInFlight.current = false;
    }
  }, [voice, sessionId]);

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
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-background/80 px-4 py-2.5 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => setShowEndDialog(true)} className="h-8 w-8" aria-label="Exit session">
            <X className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">
              {scenarioLabel}
            </p>
            <p className="hidden sm:block text-[11px] text-neutral-500 line-clamp-1">
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

      {/* Main area — panel-centric for voice */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* The Panel — horizontal on all screen sizes */}
        <div className="flex-shrink-0 border-b border-white/[0.06] px-4 py-4 sm:px-6 sm:py-5">
          <div className="mx-auto flex max-w-3xl items-start justify-center gap-3 sm:gap-4">
            {personas.map((p) => (
              <div key={p.id} className="flex-1 max-w-[200px]">
                <PersonaCard
                  archetype={p.archetype}
                  name={p.name}
                  behaviorStyle={p.behaviorStyle}
                  state={personaStates[p.id] || "idle"}
                  mood={personaMoods[p.id] || "neutral"}
                  compact
                />
              </div>
            ))}
          </div>
        </div>

        {/* Captions — the conversation transcript */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="mx-auto max-w-2xl space-y-4">
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

        {/* Claims toggle (mobile) */}
        {claims.length > 0 && (
          <button
            onClick={() => setShowClaimsPanel(true)}
            className="lg:hidden fixed bottom-24 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20"
            aria-label="View your material"
          >
            <FileText className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Bottom control bar — voice controls */}
      <div className="flex-shrink-0 border-t border-white/[0.06] bg-background/90 backdrop-blur-xl">
        {/* Subtle live telemetry */}
        <TelemetryBar
          words={liveWords}
          hedges={liveHedges}
          latencyMs={0}
          hasEvidence={liveHasEvidence}
          muted={!voice.isListening}
        />
        {/* Main controls */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          {/* Left — I need a moment */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNeedMoment}
            disabled={!isUserTurn || isProcessing || audioPlaying}
            className="text-neutral-400 hover:text-white"
          >
            <Hand className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">I need a moment</span>
            <span className="sm:hidden">Moment</span>
          </Button>

          {/* Center — Speak / Done button */}
          <div className="flex flex-col items-center gap-1">
            {!voice.isSupported ? (
              <div className="text-center">
                <p className="text-xs text-neutral-500 mb-2">
                  Voice needs Chrome or Edge
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onExit}
                >
                  Back to Home
                </Button>
              </div>
            ) : isUserTurn && !isProcessing ? (
              voice.isListening ? (
                <button
                  onClick={handleStopSpeaking}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-black shadow-lg transition-transform active:scale-95"
                  aria-label="Stop speaking"
                >
                  <Square className="h-5 w-5 fill-current" />
                </button>
              ) : (
                <button
                  onClick={handleStartSpeaking}
                  className="group flex h-16 w-16 items-center justify-center rounded-full bg-white text-black shadow-lg transition-transform active:scale-95 spar-ready-glow"
                  aria-label="Start speaking"
                >
                  <Mic className="h-6 w-6" />
                </button>
              )
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-neutral-500">
                <Pause className="h-5 w-5" />
              </div>
            )}
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">
              {voice.isListening
                ? "Listening... click to stop"
                : isUserTurn && !isProcessing
                ? "Click to speak"
                : isProcessing
                ? "Panel is responding"
                : audioPlaying
                ? "Panel is speaking"
                : "Wait for your turn"}
            </span>
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
        <div className="fixed bottom-24 left-4 right-4 z-40 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {voice.error}
        </div>
      )}

      {/* Error toast */}
      {error && captions.length > 0 && (
        <div className="fixed bottom-24 left-4 right-4 z-40 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
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
      <div className="spar-fade-up rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
          Coach whisper
        </p>
        <p className="text-sm text-white/80 italic">{entry.content}</p>
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
              "rounded-2xl rounded-br-sm border px-4 py-2.5 text-sm text-white/90",
              entry.isLive
                ? "border-white/10 bg-white/[0.03]"
                : "border-white/10 bg-white/5"
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
            <span className="rounded border border-white/20 bg-white/5 px-1 py-px text-[9px] uppercase tracking-wider text-white/80">
              Opening
            </span>
          )}
          {isInterruption && (
            <span className="text-[10px] uppercase tracking-wider text-white/60">
              Interrupting
            </span>
          )}
          {typeof entry.claimRef === "number" && entry.claimRef > 0 && (
            <span className="rounded border border-white/10 bg-white/5 px-1 py-px text-[9px] uppercase tracking-wider text-neutral-400">
              → Claim {entry.claimRef}
            </span>
          )}
        </div>
        <div
          className={cn(
            "rounded-2xl rounded-bl-sm border px-4 py-2.5 text-sm text-white/90",
            isInterruption
              ? "border-white/20 bg-white/[0.03] ml-2"
              : "border-white/[0.06] bg-card/70 border-l-white/20"
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
