"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// TypeScript declarations for the Web Speech API (not in standard lib.dom.d.ts).
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  0: SpeechRecognitionAlternative;
  length: number;
}
interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}
interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export interface UseVoiceRecognitionResult {
  /** Whether the browser supports speech recognition */
  isSupported: boolean;
  /** Whether we're currently listening */
  isListening: boolean;
  /** The live (interim) transcript — updates as the user speaks */
  interimTranscript: string;
  /** The finalized transcript segments accumulated so far */
  finalTranscript: string;
  /** Error message if something went wrong */
  error: string | null;
  /** Start listening */
  start: () => void;
  /** Stop listening and finalize the transcript */
  stop: () => void;
  /** Reset all transcripts to empty */
  reset: () => void;
}

/**
 * Browser-side speech recognition via the Web Speech API.
 *
 * This gives us live (interim) transcription for free — no server round-trip
 * needed. The interim transcript updates as the user speaks. When they stop,
 * the final transcript is ready to send to the persona LLM.
 *
 * Browser support: Chrome, Edge, Safari (14+). Not Firefox.
 * Requires HTTPS (or localhost).
 */
export function useVoiceRecognition(): UseVoiceRecognitionResult {
  // Check support lazily — avoids setState-in-effect.
  const [isSupported] = useState(() => {
    if (typeof window === "undefined") return false;
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  });
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldRestartRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      return;
    }

    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      if (final) {
        setFinalTranscript((prev) => prev + final);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech") {
        // No speech detected — not a real error, just silence.
        return;
      }
      if (event.error === "aborted") {
        // User stopped — not an error.
        return;
      }
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone access denied. Please allow microphone access to spar.");
        setIsListening(false);
        shouldRestartRef.current = false;
        return;
      }
      setError(`Speech recognition error: ${event.error}`);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
      // Auto-restart if the user hasn't explicitly stopped (the Web Speech API
      // stops on its own after ~60s of silence — we want continuous listening
      // while the user is in "speaking" mode).
      if (shouldRestartRef.current) {
        try {
          recognition.start();
        } catch {
          // If start() is called too quickly after end, it can throw.
          // The timeout below handles this.
          setTimeout(() => {
            if (shouldRestartRef.current) {
              try {
                recognition.start();
              } catch {
                // give up
              }
            }
          }, 100);
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldRestartRef.current = false;
      try {
        recognition.abort();
      } catch {
        // already stopped
      }
    };
  }, []);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    setError(null);
    setInterimTranscript("");
    setFinalTranscript("");
    shouldRestartRef.current = true;
    try {
      recognitionRef.current.start();
    } catch {
      // Already started — ignore.
    }
  }, []);

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    shouldRestartRef.current = false;
    try {
      recognitionRef.current.stop();
    } catch {
      // already stopped
    }
    setIsListening(false);
  }, []);

  const reset = useCallback(() => {
    setInterimTranscript("");
    setFinalTranscript("");
    setError(null);
  }, []);

  return {
    isSupported,
    isListening,
    interimTranscript,
    finalTranscript,
    error,
    start,
    stop,
    reset,
  };
}

/**
 * Play a base64-encoded WAV audio string.
 * Returns a promise that resolves when playback finishes.
 */
export function playBase64Audio(base64: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Convert base64 to blob
      const byteChars = atob(base64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Audio playback failed"));
      };
      audio.play().catch((err) => {
        URL.revokeObjectURL(url);
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}
