"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

interface HeroViewProps {
  onEnter: () => void;
}

/**
 * Hero section — the landing page for first-time users.
 *
 * Full viewport, centered content, animated waveform visual.
 * Replaces Home when the user has no sessions yet.
 */
export function HeroView({ onEnter }: HeroViewProps) {
  return (
    <div className="relative flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4 py-16">
      {/* Subtle ambient glow at the top */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 h-[400px] w-[600px] -translate-x-1/2 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.04) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-2xl text-center">
        {/* Animated waveform visual */}
        <HeroWaveform />

        {/* Headline */}
        <h1 className="mt-8 text-4xl font-bold tracking-tight text-white sm:text-5xl sm:leading-[1.1]">
          The sparring room for
          <br />
          your next big moment.
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-neutral-400">
          Practice defending your ideas under live pressure. An AI panel
          challenges you, interrupts you, and coaches you after. The more
          you spar, the better you get.
        </p>

        {/* CTA */}
        <button
          onClick={onEnter}
          className="group mt-8 inline-flex items-center gap-2 rounded-md bg-neutral-100 px-6 h-12 text-sm font-medium text-black transition-all hover:bg-white"
        >
          Enter the Sparring Room
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>

        {/* Social proof */}
        <div className="mt-12 border-t border-[#1a1a1a] pt-6">
          <p className="text-[11px] uppercase tracking-[0.15em] text-neutral-600">
            For founders, researchers, and leaders preparing for
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-neutral-500">
            <span>Thesis defenses</span>
            <span className="text-neutral-700">·</span>
            <span>Investor pitches</span>
            <span className="text-neutral-700">·</span>
            <span>Board presentations</span>
            <span className="text-neutral-700">·</span>
            <span>Interviews</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Animated waveform — a row of thin bars that pulse with varying heights.
 * Represents the "room being alive." Subtle, not flashy.
 */
function HeroWaveform() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 80);
    return () => clearInterval(interval);
  }, []);

  const bars = Array.from({ length: 32 }, (_, i) => {
    // Each bar has a different phase + frequency for organic movement
    const phase = i * 0.3;
    const frequency = 0.15;
    const baseHeight = 4;
    const amplitude = 16;
    const height = baseHeight + Math.abs(Math.sin(tick * frequency + phase)) * amplitude;
    return height;
  });

  return (
    <div className="flex items-center justify-center gap-[2px] h-8">
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-[2px] rounded-full bg-neutral-500"
          style={{
            height: `${h}px`,
            opacity: 0.3 + (h / 24) * 0.4,
            transition: "height 80ms ease-out, opacity 80ms ease-out",
          }}
        />
      ))}
    </div>
  );
}
