"use client";

import { useCallback, useRef, useState } from "react";
import { saveAudioClip } from "@/lib/audio-db";

export interface UseAudioRecorderResult {
  /** Whether the browser supports MediaRecorder */
  isSupported: boolean;
  /** Whether we're currently recording */
  isRecording: boolean;
  /** Error message if something went wrong */
  error: string | null;
  /** Start recording. Returns true if recording started successfully. */
  start: (sessionId: string, messageIndex: number) => boolean;
  /** Stop recording and save the clip to IndexedDB. Returns the duration in seconds. */
  stop: () => Promise<number>;
  /** Cancel the current recording without saving */
  cancel: () => void;
}

/**
 * Audio recorder hook — captures the user's mic via MediaRecorder API.
 *
 * Runs ALONGSIDE the Web Speech API (useVoiceRecognition). Both access the
 * mic simultaneously — modern browsers support this. The Web Speech API
 * gives us transcription; MediaRecorder gives us the audio for playback.
 *
 * Each speaking turn = one clip saved to IndexedDB, keyed by
 * `${sessionId}:${messageIndex}`. The debrief fetches these clips and
 * renders play buttons.
 *
 * Browser support: Chrome, Edge, Firefox, Safari 14.1+.
 * Audio format: webm/opus (Chrome/Firefox) or mp4 (Safari).
 */
export function useAudioRecorder(): UseAudioRecorderResult {
  const [isSupported] = useState(() => {
    if (typeof window === "undefined") return false;
    return typeof MediaRecorder !== "undefined";
  });
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const sessionKeyRef = useRef<{ sessionId: string; messageIndex: number } | null>(
    null
  );

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const start = useCallback(
    (sessionId: string, messageIndex: number): boolean => {
      if (!isSupported) return false;
      if (isRecording) return false;

      setError(null);
      sessionKeyRef.current = { sessionId, messageIndex };
      chunksRef.current = [];

      // Request mic access. This runs alongside the Web Speech API's mic
      // access — both can hold the mic simultaneously in modern browsers.
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          streamRef.current = stream;

          // Pick the best available mime type
          const mimeType = getSupportedMimeType();
          const recorder = new MediaRecorder(
            stream,
            mimeType ? { mimeType } : undefined
          );
          mediaRecorderRef.current = recorder;

          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              chunksRef.current.push(e.data);
            }
          };

          recorder.onstop = () => {
            const blob = new Blob(chunksRef.current, {
              type: mimeType || "audio/webm",
            });
            const duration = (Date.now() - startTimeRef.current) / 1000;

            // Save to IndexedDB (fire and forget — non-blocking)
            if (sessionKeyRef.current && blob.size > 0) {
              const key = `${sessionKeyRef.current.sessionId}:${sessionKeyRef.current.messageIndex}`;
              saveAudioClip(key, blob, duration).catch(() => {
                // Non-fatal — recording is a nice-to-have
              });
            }

            cleanupStream();
            setIsRecording(false);
          };

          recorder.onerror = (e) => {
            console.error("[audio-recorder] Error:", e);
            setError("Recording failed");
            cleanupStream();
            setIsRecording(false);
          };

          startTimeRef.current = Date.now();
          recorder.start();
          setIsRecording(true);
        })
        .catch((err) => {
          console.error("[audio-recorder] Mic access failed:", err);
          // Don't set an error — the Web Speech API might still work.
          // Recording is a silent fallback: if it fails, the user just
          // doesn't get playback. The session continues normally.
          setIsRecording(false);
        });

      return true;
    },
    [isSupported, isRecording, cleanupStream]
  );

  const stop = useCallback(async (): Promise<number> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      cleanupStream();
      setIsRecording(false);
      return 0;
    }

    // Stop the recorder — the onstop handler saves the clip + cleans up
    return new Promise((resolve) => {
      const duration = (Date.now() - startTimeRef.current) / 1000;
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const finalDuration = (Date.now() - startTimeRef.current) / 1000;

        if (sessionKeyRef.current && blob.size > 0) {
          const key = `${sessionKeyRef.current.sessionId}:${sessionKeyRef.current.messageIndex}`;
          saveAudioClip(key, blob, finalDuration).catch(() => {});
        }

        cleanupStream();
        setIsRecording(false);
        resolve(finalDuration);
      };
      recorder.stop();
    });
  }, [cleanupStream]);

  const cancel = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      // Remove the onstop handler so we don't save the cancelled clip
      recorder.onstop = null;
      recorder.stop();
    }
    cleanupStream();
    setIsRecording(false);
  }, [cleanupStream]);

  return {
    isSupported,
    isRecording,
    error,
    start,
    stop,
    cancel,
  };
}

/**
 * Find the best supported audio mime type for MediaRecorder.
 * Prefers webm/opus (Chrome/Firefox), falls back to mp4 (Safari).
 */
function getSupportedMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];

  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return null;
}
