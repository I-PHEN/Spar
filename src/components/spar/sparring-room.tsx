"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Send,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { Transcript, type TranscriptMessage } from "./transcript";
import { TelemetryBar } from "./telemetry-bar";
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

interface LiveMessage extends TranscriptMessage {
  streamProgress?: number;
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
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [personaStates, setPersonaStates] = useState<Record<string, PersonaState>>({});
  const [personaMoods, setPersonaMoods] = useState<Record<string, PersonaMood>>({});
  const [composerValue, setComposerValue] = useState("");
  const [isUserTurn, setIsUserTurn] = useState(false);
  const [waitingForPersonas, setWaitingForPersonas] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showClaimsPanel, setShowClaimsPanel] = useState(false);
  const [sessionStart] = useState(Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);
  const [lastPersonaAt, setLastPersonaAt] = useState<number | null>(null);
  const [liveWords, setLiveWords] = useState(0);
  const [liveHedges, setLiveHedges] = useState(0);
  const [liveHasEvidence, setLiveHasEvidence] = useState(false);

  // Use a ref to track in-flight spar calls (prevent double-submits)
  const sparInFlight = useRef(false);

  // Timer
  useEffect(() => {
    const t = setInterval(() => setElapsedSec(Math.floor((Date.now() - sessionStart) / 1000)), 1000);
    return () => clearInterval(t);
  }, [sessionStart]);

  // Live telemetry as user types
  useEffect(() => {
    const s = quickStats(composerValue);
    setLiveWords(s.words);
    setLiveHedges(s.hedges);
    setLiveHasEvidence(s.hasEvidence);
  }, [composerValue]);

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

        setPersonas(session.personas);
        setClaims(parsedClaims);
        setScenarioLabel(scenario?.label || session.scenario);
        setRoomContext(scenario?.roomContext || "");

        const states: Record<string, PersonaState> = {};
        const moods: Record<string, PersonaMood> = {};
        for (const p of session.personas) {
          states[p.id] = "listening";
          moods[p.id] = "listening";
        }
        setPersonaStates(states);
        setPersonaMoods(moods);

        // Open the session
        const oRes = await fetch(`/api/sessions/${sessionId}/open`, {
          method: "POST",
        });
        if (!oRes.ok) throw new Error("Failed to open session");
        const oData = await oRes.json();
        if (!mounted) return;

        if (oData.alreadyStarted && Array.isArray(oData.messages)) {
          // Restoring — map stored messages to live messages
          setMessages(
            oData.messages.map((m: any) => ({
              id: m.id,
              role: m.role,
              personaId: m.personaId,
              personaName: session.personas.find((p: SessionPersona) => p.id === m.personaId)?.name,
              archetype: session.personas.find((p: SessionPersona) => p.id === m.personaId)?.archetype,
              content: m.content,
              type: m.type,
              claimRef: m.claimRef,
              createdAt: m.createdAt,
            }))
          );
          setIsUserTurn(true);
        } else if (oData.message) {
          const m = oData.message;
          setPersonaStates((prev) => ({ ...prev, [m.personaId]: "speaking" }));
          setPersonaMoods((prev) => ({ ...prev, [m.personaId]: m.mood }));
          setMessages([
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
              streaming: true,
              streamProgress: 0,
              createdAt: m.createdAt,
            },
          ]);
          // Stream the opening message
          streamMessage(m.id, m.content).then(() => {
            setPersonaStates((prev) => ({ ...prev, [m.personaId]: "listening" }));
            setLastPersonaAt(Date.now());
            setIsUserTurn(true);
          });
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

  // Stream a message character-by-character. Returns a promise that resolves
  // when the full content has been revealed.
  const streamMessage = useCallback((messageId: string, content: string) => {
    return new Promise<void>((resolve) => {
      let chars = 0;
      const totalLen = content.length;
      // Reveal ~3 chars per 25ms = ~120 chars/sec. Fast enough to feel live,
      // slow enough to read.
      const revealPerTick = Math.max(1, Math.floor(totalLen / 120));
      const interval = setInterval(() => {
        chars = Math.min(totalLen, chars + revealPerTick);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, streamProgress: chars, streaming: chars < totalLen }
              : m
          )
        );
        if (chars >= totalLen) {
          clearInterval(interval);
          resolve();
        }
      }, 25);
    });
  }, []);

  // Handle user submitting a message
  const handleSend = useCallback(async () => {
    if (sparInFlight.current) return;
    const text = composerValue.trim();
    if (!text || !isUserTurn || waitingForPersonas) return;

    sparInFlight.current = true;
    const responseMs = lastPersonaAt ? Date.now() - lastPersonaAt : 0;

    // Add user message
    const userMsgId = `u-${Date.now()}`;
    const userMessage: LiveMessage = {
      id: userMsgId,
      role: "user",
      content: text,
      type: "normal",
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setComposerValue("");
    setIsUserTurn(false);
    setWaitingForPersonas(true);

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
          ? { userMessage: text, responseMs }
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
        // Mark persona as speaking
        setPersonaStates((prev) => ({ ...prev, [pr.personaId]: "speaking" }));
        setPersonaMoods((prev) => ({ ...prev, [pr.personaId]: pr.mood }));

        // Add the message in streaming state
        setMessages((prev) => [
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
            streaming: true,
            streamProgress: 0,
            createdAt: pr.createdAt,
          },
        ]);

        // Wait for the typing animation to complete
        await streamMessage(pr.id, pr.content);

        // Persona done — back to listening
        setPersonaStates((prev) => ({ ...prev, [pr.personaId]: "listening" }));
        setLastPersonaAt(Date.now());

        userTurn = data.isUserTurn;
      }

      setIsUserTurn(true);
      setWaitingForPersonas(false);
    } catch (e) {
      setError(String(e));
      setIsUserTurn(true);
      setWaitingForPersonas(false);
    } finally {
      sparInFlight.current = false;
    }
  }, [composerValue, isUserTurn, waitingForPersonas, lastPersonaAt, sessionId, streamMessage]);

  // End the session
  async function handleEnd() {
    setShowEndDialog(false);
    setEnding(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/end`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to end session");
      onSessionEnded();
    } catch (e) {
      setError(String(e));
      setEnding(false);
    }
  }

  // Keyboard: Cmd/Ctrl+Enter to send
  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-white" />
        <p className="text-sm text-muted-foreground">Entering the room...</p>
      </div>
    );
  }

  if (error && messages.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
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
    <div className="flex h-[100dvh] flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-2.5 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => setShowEndDialog(true)} className="h-8 w-8" aria-label="Exit session">
            <X className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {scenarioLabel}
            </p>
            <p className="hidden sm:block text-[11px] text-muted-foreground/60 line-clamp-1">
              {roomContext}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
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

      {/* Main 3-column area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: material / claims (desktop only) */}
        <aside className="hidden lg:flex w-64 flex-col border-r border-border/60 bg-card/20">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
              Your material
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {claims.length > 0 ? (
              <div className="space-y-3">
                <p className="text-[11px] text-muted-foreground/70">
                  {claims.length} key {claims.length === 1 ? "claim" : "claims"} extracted. The panel will challenge these.
                </p>
                {claims.map((c) => {
                  return (
                    <div
                      key={c.id}
                      className="rounded-md border border-border/40 bg-muted/20 p-3"
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span
                          className="rounded px-1 py-px text-[9px] uppercase tracking-wider font-mono"
                          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)' }}
                        >
                          Claim {c.id}
                        </span>
                        <span className="text-xs font-medium text-foreground/80 truncate">
                          {c.label}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-foreground/80">
                        {c.claim}
                      </p>
                      {c.evidence && (
                        <p className="mt-1.5 text-[11px] text-muted-foreground/60 italic">
                          Evidence: {c.evidence}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="h-8 w-8 mx-auto text-muted-foreground/30" />
                <p className="mt-2 text-xs text-muted-foreground/60">
                  No material. You&apos;re defending from memory.
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* Center: transcript + composer */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Mobile: persona strip */}
          <div className="lg:hidden border-b border-border/40 bg-card/20 px-3 py-2.5">
            <div className="flex gap-2 overflow-x-auto">
              {personas.map((p) => (
                <div key={p.id} className="flex-shrink-0 w-44">
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

          {/* Transcript */}
          <div className="flex-1 overflow-y-auto">
            <Transcript
              messages={messages.map((m) => ({
                ...m,
                content:
                  m.streaming && typeof m.streamProgress === "number"
                    ? m.content.slice(0, m.streamProgress)
                    : m.content,
              }))}
              personaStates={personaStates}
            />
          </div>

          {/* Composer + telemetry */}
          <div className="border-t border-border/60 bg-background/80 backdrop-blur-md">
            <div className="px-4 py-3 sm:px-6">
              <div className="relative">
                <Textarea
                  value={composerValue}
                  onChange={(e) => setComposerValue(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={
                    waitingForPersonas
                      ? "The panel is speaking..."
                      : isUserTurn
                      ? "Make your case. The panel is listening."
                      : "Waiting for the panel..."
                  }
                  disabled={!isUserTurn || waitingForPersonas || ending}
                  rows={2}
                  className="resize-none pr-24 text-sm"
                />
                <div className="absolute bottom-2 right-2 flex items-center gap-2">
                  <span className="hidden sm:inline text-[10px] text-muted-foreground/50">
                    ⌘↵ to send
                  </span>
                  <Button
                    size="sm"
                    onClick={handleSend}
                    disabled={!isUserTurn || waitingForPersonas || !composerValue.trim() || ending}
                  >
                    <Send className="h-3.5 w-3.5 mr-1" />
                    Speak
                  </Button>
                </div>
              </div>
            </div>
            <TelemetryBar
              words={liveWords}
              hedges={liveHedges}
              latencyMs={lastPersonaAt ? Date.now() - lastPersonaAt : 0}
              hasEvidence={liveHasEvidence}
              muted={waitingForPersonas || !isUserTurn}
            />
          </div>
        </main>

        {/* Right: persona panel (desktop only) */}
        <aside className="hidden lg:flex w-80 flex-col border-l border-border/60 bg-card/20">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
              The panel
            </span>
            <span className="text-[11px] text-muted-foreground/50">
              {personas.length} {personas.length === 1 ? "seat" : "seats"}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {personas.map((p) => (
              <PersonaCard
                key={p.id}
                archetype={p.archetype}
                name={p.name}
                behaviorStyle={p.behaviorStyle}
                state={personaStates[p.id] || "idle"}
                mood={personaMoods[p.id] || "neutral"}
              />
            ))}
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                {error}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile: toggle claims panel */}
      {claims.length > 0 && (
        <button
          onClick={() => setShowClaimsPanel(true)}
          className="lg:hidden fixed bottom-20 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow-lg"
          aria-label="View your material"
        >
          <FileText className="h-4 w-4" />
        </button>
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
            <AlertDialogAction onClick={handleEnd}>End & get coached</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
