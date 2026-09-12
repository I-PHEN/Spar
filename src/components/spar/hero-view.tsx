"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Swords,
  Mic,
  Brain,
  Repeat,
  Target,
  ShieldCheck,
} from "lucide-react";

interface HeroViewProps {
  onEnter: () => void;
}

/**
 * Hero section — the landing page.
 *
 * Full viewport, no app nav. Has its own minimal header.
 * Tells you what the product is, how it works, and why it's different.
 */
export function HeroView({ onEnter }: HeroViewProps) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 h-[600px] w-[900px] -translate-x-1/2 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.05) 0%, transparent 60%)",
        }}
      />

      {/* Minimal header */}
      <header className="relative z-20 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#101010]">
            <Swords className="h-4 w-4 text-neutral-300" />
          </div>
          <span className="font-semibold tracking-tight text-white">Spar</span>
        </div>
        <button
          onClick={onEnter}
          className="text-sm text-neutral-400 hover:text-white transition-colors"
        >
          Sign In
        </button>
      </header>

      {/* Hero content */}
      <div className="relative z-10 flex flex-1 flex-col items-center px-4 py-8">
        {/* Waveform + headline */}
        <div className="mx-auto max-w-2xl text-center">
          <HeroWaveform />

          <h1 className="mt-8 text-4xl font-bold tracking-tight text-white sm:text-5xl sm:leading-[1.05]">
            The sparring room for
            <br />
            your next big moment.
          </h1>

          <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-neutral-400">
            Every person who creates anything eventually stands in a room and
            must defend it. The grad student before a thesis committee. The
            founder before investors. The PM before leadership. Spar trains you
            for that room.
          </p>

          <button
            onClick={onEnter}
            className="group mt-8 inline-flex items-center gap-2 rounded-md bg-neutral-100 px-6 h-12 text-sm font-medium text-black transition-all hover:bg-white"
          >
            Get Started
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>

          <p className="mt-3 text-[11px] text-neutral-600">
            Free to start. No credit card required.
          </p>
        </div>

        {/* How it works — 3 steps */}
        <div className="mx-auto mt-20 w-full max-w-3xl">
          <p className="mb-6 text-center text-[11px] uppercase tracking-[0.2em] text-neutral-600">
            How it works
          </p>
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-[#1a1a1a] bg-[#1a1a1a] sm:grid-cols-3">
            <StepColumn
              num="01"
              icon={<Mic className="h-4 w-4" />}
              title="Enter the room"
              desc="Bring your pitch, your thesis, your proposal. An AI panel of 2-3 personas waits. The Skeptic. The Nitpicker. The So-What."
            />
            <StepColumn
              num="02"
              icon={<Brain className="h-4 w-4" />}
              title="Defend under pressure"
              desc="They interrupt mid-sentence. They reference your actual claims. They get harder if you're breezing through. You practice recovery."
            />
            <StepColumn
              num="03"
              icon={<Repeat className="h-4 w-4" />}
              title="Get coached, not scored"
              desc="After the session, your coach gives you a debrief. Not grades. A narrative. What happened, what you did well, the pattern, one thing to fix."
            />
          </div>
        </div>

        {/* Why Spar is different */}
        <div className="mx-auto mt-16 w-full max-w-3xl">
          <p className="mb-6 text-center text-[11px] uppercase tracking-[0.2em] text-neutral-600">
            Why it works
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FeatureRow
              icon={<Target className="h-4 w-4" />}
              title="Cross-session memory"
              desc="The panel remembers your patterns. It knows you hedge on financials. It probes there next time."
            />
            <FeatureRow
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Drill your weakness"
              desc="Pick one thing to fix — hedging, over-explaining, recovery speed. Every instance gets interrupted until you stop doing it."
            />
            <FeatureRow
              icon={<Brain className="h-4 w-4" />}
              title="Coaching that adapts"
              desc="The more you spar, the more the system knows you. It's not a chatbot. It's a room that reacts to you."
            />
          </div>
        </div>

        {/* CTA repeat */}
        <div className="mx-auto mt-16 max-w-2xl text-center">
          <p className="text-sm text-neutral-400">
            The panel is waiting. Are you ready?
          </p>
          <button
            onClick={onEnter}
            className="group mt-4 inline-flex items-center gap-2 rounded-md bg-neutral-100 px-6 h-12 text-sm font-medium text-black transition-all hover:bg-white"
          >
            Enter the Sparring Room
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* Social proof */}
        <div className="mx-auto mt-20 max-w-2xl border-t border-[#1a1a1a] pt-6 text-center">
          <p className="text-[11px] uppercase tracking-[0.15em] text-neutral-600">
            Built for people who can&apos;t afford to freeze in the real room
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-neutral-500">
            <span>Thesis defenses</span>
            <span className="text-neutral-700">·</span>
            <span>Investor pitches</span>
            <span className="text-neutral-700">·</span>
            <span>Board presentations</span>
            <span className="text-neutral-700">·</span>
            <span>Grant reviews</span>
            <span className="text-neutral-700">·</span>
            <span>Job interviews</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepColumn({
  num,
  icon,
  title,
  desc,
}: {
  num: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="bg-[#0d0d0d] p-5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-neutral-600">{num}</span>
        <span className="text-neutral-400">{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-300">{title}</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-neutral-500">{desc}</p>
    </div>
  );
}

function FeatureRow({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-md border border-[#1a1a1a] bg-[#0d0d0d] p-4">
      <div className="flex items-center gap-2 text-neutral-300">
        {icon}
        <span className="text-xs font-medium">{title}</span>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">{desc}</p>
    </div>
  );
}

function HeroWaveform() {
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 80);
    const mountedTimer = setTimeout(() => setMounted(true), 0);
    return () => {
      clearInterval(interval);
      clearTimeout(mountedTimer);
    };
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center gap-[2px] h-8">
        {Array.from({ length: 32 }, (_, i) => (
          <div
            key={i}
            className="w-[2px] rounded-full bg-neutral-500"
            style={{ height: "6px", opacity: 0.3 }}
          />
        ))}
      </div>
    );
  }

  const bars = Array.from({ length: 32 }, (_, i) => {
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
            height: `${Math.round(h)}px`,
            opacity: Math.round((0.3 + (h / 24) * 0.4) * 100) / 100,
            transition: "height 80ms ease-out, opacity 80ms ease-out",
          }}
        />
      ))}
    </div>
  );
}
