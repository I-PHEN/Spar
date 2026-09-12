"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Play a short, percussive activation sound when recording starts.
 * Feels like a microphone turning on — physical, not musical.
 * Uses the Web Audio API (no audio file needed).
 */
export function playActivationClick() {
  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Short click — a burst of filtered noise, 30ms
    const bufferSize = ctx.sampleRate * 0.03; // 30ms
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // Quick decay envelope — percussive
      const decay = Math.pow(1 - i / bufferSize, 3);
      data[i] = (Math.random() * 2 - 1) * decay * 0.3;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Bandpass filter — makes it sound like a mic click, not white noise
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2000;
    filter.Q.value = 2;

    const gain = ctx.createGain();
    gain.gain.value = 0.15; // quiet

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start();
    source.stop(ctx.currentTime + 0.03);
  } catch {
    // AudioContext not available — silent fallback
  }
}

/**
 * Hook: useWaveformAmplitude
 *
 * Opens a separate getUserMedia stream (for amplitude analysis only —
 * the Web Speech API controls its own mic for transcription). Returns
 * a 0-1 amplitude value that updates ~30fps.
 *
 * Used to render a subtle waveform bar while the user is speaking.
 *
 * @param active Whether to track amplitude (false = cleanup)
 */
export function useWaveformAmplitude(active: boolean): number {
  const [amplitude, setAmplitude] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (!active) {
      // Cleanup
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      analyserRef.current = null;
      // Defer the state reset to avoid setState-in-effect
      queueMicrotask(() => setAmplitude(0));
      return;
    }

    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        function update() {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);

          // Compute average amplitude (0-255 → 0-1)
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length / 255;

          // Apply some gain so quiet speech is still visible
          const boosted = Math.min(1, avg * 2.5);
          setAmplitude(boosted);

          rafRef.current = requestAnimationFrame(update);
        }

        update();
      } catch {
        // Mic access denied or unavailable — amplitude stays 0
      }
    }

    start();

    return () => {
      cancelled = true;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      analyserRef.current = null;
      setAmplitude(0);
    };
  }, [active]);

  return amplitude;
}
