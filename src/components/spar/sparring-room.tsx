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
      resumePresenting: boolean = false,
      drillFlags?: { drillInterrupt?: boolean; drillClean?: boolean }
    ) => {
      voice.stop();

      await new Promise((r) => setTimeout(r, 300));

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
          type: "normal",
          createdAt: Date.now(),
        },
      ]);

      // Mark all personas as listening
      setPersonaStates((prev) => {
        const next: Record<string, PersonaState> = {};
        for (const k of Object.keys(prev)) next[k] = "listening";
        return { ...prev, ...next };
      });

      try {
        // Use the streaming endpoint for faster perceived latency
        const response = await fetch(`/api/sessions/${sessionId}/spar-stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userMessage: transcript,
            isInterrupt: isInterrupt,
            forcedPersonaId: interruptingPersonaId,
            // Drill flags: drillInterrupt → deterministic correction (no LLM).
            // drillClean → LLM generates next question, deterministic ack prepended.
            drillInterrupt: drillFlags?.drillInterrupt ?? false,
            drillClean: drillFlags?.drillClean ?? false,
          }),
        });

        if (!response.ok) throw new Error("Spar stream failed");
        if (!response.body) throw new Error("No response body");

        // Read the SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let currentPersonaId = "";
        let currentPersonaName = "";
        let currentArchetype: ArchetypeKey | undefined;
        let currentCaptionId = "";
        let currentCaptionText = "";
        let captionStarted = false;
        let audioQueue: Promise<void>[] = [];
        let isUserTurn = false;

        const processEvent = async (eventType: string, data: string) => {
          let parsed: any;
          try {
            parsed = JSON.parse(data);
          } catch {
            return;
          }

          if (eventType === "start") {
            currentPersonaId = parsed.personaId;
            currentPersonaName = parsed.personaName;
            currentArchetype = parsed.archetype;
            currentCaptionId = `p-${Date.now()}`;
            currentCaptionText = "";
            captionStarted = false;

            // Persona starts thinking
            setPersonaStates((prev) => ({
              ...prev,
              [currentPersonaId]: "thinking",
            }));
          } else if (eventType === "sentence") {
            if (!captionStarted) {
              captionStarted = true;
              // Switch from thinking to speaking
              setPersonaStates((prev) => ({
                ...prev,
                [currentPersonaId]: "speaking",
              }));
              // Create the caption with the first sentence
              setCaptions((prev) => [
                ...prev,
                {
                  id: currentCaptionId,
                  role: "persona",
                  personaId: currentPersonaId,
                  personaName: currentPersonaName,
                  archetype: currentArchetype,
                  content: parsed.text,
                  type: isInterrupt ? "interruption" : "normal",
                  createdAt: Date.now(),
                },
              ]);
              currentCaptionText = parsed.text;
            } else {
              // Append to existing caption
              currentCaptionText += " " + parsed.text;
              setCaptions((prev) =>
                prev.map((c) =>
                  c.id === currentCaptionId
                    ? { ...c, content: currentCaptionText }
                    : c
                )
              );
            }

            // Play audio for this sentence
            if (parsed.audio) {
              setAudioPlaying(true);
              try {
                await playBase64Audio(parsed.audio);
              } catch (e) {
                console.error("Audio playback failed:", e);
              }
              setAudioPlaying(false);
            }
          } else if (eventType === "done") {
            isUserTurn = parsed.isUserTurn;

            // Update mood
            if (parsed.mood && currentPersonaId) {
              setPersonaMoods((prev) => ({
                ...prev,
                [currentPersonaId]: parsed.mood,
              }));
            }

            // Persona done — back to listening
            setPersonaStates((prev) => ({
              ...prev,
              [currentPersonaId]: "listening",
            }));
          } else if (eventType === "error") {
            console.error("[spar-stream] Error:", parsed.message);
            setError(parsed.message);
          }
        };

        // Read the stream
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE events
          const events = buffer.split("\n\n");
          buffer = events.pop() || "";

          for (const event of events) {
            const lines = event.split("\n");
            let eventType = "message";
            let data = "";

            for (const line of lines) {
              if (line.startsWith("event: ")) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith("data: ")) {
                data = line.slice(6);
              }
            }

            if (data) {
              await processEvent(eventType, data);
            }
          }
        }

        // Wait for any remaining audio
        await Promise.all(audioQueue);

        if (resumePresenting) {
          setIsPresenting(true);
        }
        // Drill state management:
        // - drillClean (user answered cleanly after correction): reset retry
        //   state and attempts — the user is back to a fresh question.
        // - drillInterrupt (another correction fired): keep retry state —
        //   the user stays in "Try again" mode. Attempts were incremented
        //   in handleInterrupt.
        // - Normal turn (no drill flags): no change to drill state.
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
    },
    [voice, sessionId]
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
      // Now Q&A begins — use the streaming endpoint for the first question
      const sparResponse = await fetch(`/api/sessions/${sessionId}/spar-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!sparResponse.ok) throw new Error("Failed to start Q&A");
      if (!sparResponse.body) throw new Error("No Q&A response body");

      // Read the SSE stream (same logic as submitTurn)
      const qaReader = sparResponse.body.getReader();
      const qaDecoder = new TextDecoder();
      let qaBuffer = "";
      let qaPersonaId = "";
      let qaCaptionId = "";
      let qaCaptionText = "";
      let qaStarted = false;

      while (true) {
        const { done, value } = await qaReader.read();
        if (done) break;

        qaBuffer += qaDecoder.decode(value, { stream: true });
        const events = qaBuffer.split("\n\n");
        qaBuffer = events.pop() || "";

        for (const event of events) {
          const lines = event.split("\n");
          let eventType = "message";
          let data = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) eventType = line.slice(7).trim();
            else if (line.startsWith("data: ")) data = line.slice(6);
          }

          if (!data) continue;
          let parsed: any;
          try { parsed = JSON.parse(data); } catch { continue; }

          if (eventType === "start") {
            qaPersonaId = parsed.personaId;
            qaCaptionId = `qa-${Date.now()}`;
            qaCaptionText = "";
            qaStarted = false;
            setPersonaStates((prev) => ({ ...prev, [qaPersonaId]: "thinking" }));
          } else if (eventType === "sentence") {
            if (!qaStarted) {
              qaStarted = true;
              setPersonaStates((prev) => ({ ...prev, [qaPersonaId]: "speaking" }));
              setCaptions((prev) => [
                ...prev,
                {
                  id: qaCaptionId,
                  role: "persona",
                  personaId: parsed.personaId || qaPersonaId,
                  personaName: parsed.personaName,
                  archetype: parsed.archetype,
                  content: parsed.text,
                  type: "normal",
                  createdAt: Date.now(),
                },
              ]);
              qaCaptionText = parsed.text;
            } else {
              qaCaptionText += " " + parsed.text;
              setCaptions((prev) =>
                prev.map((c) => c.id === qaCaptionId ? { ...c, content: qaCaptionText } : c)
              );
            }
            if (parsed.audio) {
              setAudioPlaying(true);
              try { await playBase64Audio(parsed.audio); } catch (e) { console.error(e); }
              setAudioPlaying(false);
            }
          } else if (eventType === "done") {
            if (parsed.mood && qaPersonaId) {
              setPersonaMoods((prev) => ({ ...prev, [qaPersonaId]: parsed.mood }));
            }
            setPersonaStates((prev) => ({ ...prev, [qaPersonaId]: "listening" }));
          }
        }
      }

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
            ) : connectionError ? (
              // Error recovery: smart retry.
              // - If pendingPresentation exists AND coachAnalysis is null →
              //   the present endpoint failed → retry submitPresentation.
              // - If coachAnalysis was set (then cleared by beginQA) but
              //   beginQA failed → retry beginQA. We detect this with a ref.
              // - Otherwise → restart the mic.
              <button
                onClick={() => {
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
                }}
                className="flex items-center gap-2 px-4 h-10 rounded-md border border-[#3a3a3a] bg-[#171717] text-xs font-medium text-neutral-200 hover:bg-[#1a1a1a] transition-all"
              >
                <Loader2 className="h-3.5 w-3.5" />
                Retry
              </button>
            ) : coachAnalysis ? (
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
            ) : drillRetry && isUserTurn && !isProcessing ? (
              // Drill retry: show "Try again" with attempt count instead of
              // the normal mic button. The user is re-answering after a
              // deterministic correction. They must answer WITHOUT the
              // drilled weakness to advance to the next question.
              <div className="flex items-center gap-3">
                {voice.isListening ? (
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
                    className="group flex items-center gap-2 px-4 h-10 rounded-md bg-neutral-100 text-black text-xs font-medium hover:bg-white transition-all"
                    aria-label="Try again"
                  >
                    <Mic className="h-3.5 w-3.5" />
                    Try again
                  </button>
                )}
                <span className="text-[10px] uppercase tracking-wider text-amber-400/70 hidden sm:inline">
                  {voice.isListening
                    ? `Answering — attempt ${drillAttempts + 1}`
                    : `Attempt ${drillAttempts + 1} — answer without the weakness`}
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
