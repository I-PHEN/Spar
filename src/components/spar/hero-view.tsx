"use client";

import { useEffect, useState, useRef } from "react";
import {
  ArrowRight,
  Swords,
  Mic,
  Repeat,
  AlertCircle,
} from "lucide-react";
import { SparringMockup } from "./sparring-mockup";

interface HeroViewProps {
  onEnter: () => void;
}

/**
 * Hero section — the landing page.
 *
 * Full viewport, no app nav. Has its own minimal header.
 * The centerpiece is an animated sparring room mockup that auto-plays.
 *
 * Sections:
 *   1. Hero (headline + CTA + animated mockup)
 *   2. How it works (3 steps with mini visualizations)
 *   3. Why it works (proof points)
 *   4. Final CTA + social proof
 */
export function HeroView({ onEnter }: HeroViewProps) {
  const mockupRef = useRef<HTMLDivElement>(null);

  function scrollToMockup() {
    mockupRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 h-[600px] w-[900px] -translate-x-1/2 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.04) 0%, transparent 60%)",
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

      {/* ─── Section 1: Hero ─────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center px-4 pt-8 pb-16">
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
            founder before investors. The PM before leadership. Spar trains
            you for that room.
          </p>

          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              onClick={onEnter}
              className="group inline-flex items-center gap-2 rounded-md bg-neutral-100 px-6 h-12 text-sm font-medium text-black transition-all hover:bg-white"
            >
              Get Started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={scrollToMockup}
              className="inline-flex items-center gap-2 rounded-md border border-[#2a2a2a] bg-[#101010] px-6 h-12 text-sm font-medium text-neutral-300 transition-all hover:bg-[#141414] hover:border-[#3a3a3a] hover:text-white"
            >
              Watch demo
            </button>
          </div>
        </div>

        {/* Animated product mockup — the centerpiece */}
        <div ref={mockupRef} className="mx-auto mt-12 w-full max-w-2xl scroll-mt-20">
          <SparringMockup />
        </div>
      </div>

      {/* ─── Section 2: How it works ────────────────────────────────── */}
      <div className="border-t border-[#141414] px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <p className="mb-8 text-center text-[11px] uppercase tracking-[0.2em] text-neutral-600">
            How it works
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StepVisual
              num="01"
              icon={<Mic className="h-4 w-4" />}
              title="Enter the room"
              desc="Bring your pitch, your thesis, your proposal. 1–3 panelists — Ada opens with a direct challenge."
              visual={<EnterRoomVisual />}
            />
            <StepVisual
              num="02"
              icon={<AlertCircle className="h-4 w-4" />}
              title="Defend under pressure"
              desc="They interrupt mid-sentence. They reference your actual claims. They get harder if you're breezing through."
              visual={<InterruptVisual />}
            />
            <StepVisual
              num="03"
              icon={<Repeat className="h-4 w-4" />}
              title="Get coached"
              desc="After the session, your coach gives you a debrief — not grades, a narrative. What happened, what to fix."
              visual={<CoachVisual />}
            />
          </div>
        </div>
      </div>

      {/* ─── Section 3: Why it works ─────────────────────────────────── */}
      <div className="border-t border-[#141414] px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <p className="mb-8 text-center text-[11px] uppercase tracking-[0.2em] text-neutral-600">
            Why it works
          </p>
          <div className="space-y-3">
            <ProofPoint
              stat="The panel remembers."
              desc="After repeated sessions, it tracks where you hesitate or hedge. The panel probes your recurring weak spots next time."
            />
            <ProofPoint
              stat="Every weakness gets hammered."
              desc="Pick hedging or fillers. The room pushes back immediately so you correct the habit under real pressure. Drill mode is targeted and direct."
            />
            <ProofPoint
              stat="Not a chatbot. A room."
              desc="The panel doesn't wait for you to finish monologue. They interrupt mid-sentence when you dodge or overclaim. The pressure is real."
            />
          </div>
        </div>
      </div>

      {/* ─── Section 4: Final CTA + social proof ────────────────────── */}
      <div className="border-t border-[#141414] px-4 py-20 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-white">
            The panel is waiting.
          </h2>
          <p className="mt-2 text-sm text-neutral-400">
            Are you ready?
          </p>
          <button
            onClick={onEnter}
            className="group mt-6 inline-flex items-center gap-2 rounded-md bg-neutral-100 px-6 h-12 text-sm font-medium text-black transition-all hover:bg-white"
          >
            Enter the Sparring Room
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        <div className="mx-auto mt-20 max-w-2xl border-t border-[#1a1a1a] pt-6">
          <p className="text-[11px] uppercase tracking-[0.15em] text-neutral-600">
            Built for people who can&apos;t afford to freeze in the real room
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-neutral-500">
            <span>Q&amp;A sparring</span>
            <span className="text-neutral-700">·</span>
            <span>Targeted drills</span>
            <span className="text-neutral-700">·</span>
            <span>Thesis defense</span>
            <span className="text-neutral-700">·</span>
            <span>Investor pitches</span>
            <span className="text-neutral-700">·</span>
            <span>Executive reviews</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step Visuals (mini animations) ─────────────────────────────────────

function StepVisual({
  num,
  icon,
  title,
  desc,
  visual,
}: {
  num: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  visual: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-[#1a1a1a] bg-[#0d0d0d] p-5">
      {/* Mini visualization */}
      <div
        aria-hidden="true"
        className="mb-4 h-24 overflow-hidden rounded border border-[#141414] bg-[#080808]"
      >
        {visual}
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-neutral-600">{num}</span>
        <span className="text-neutral-400">{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-300">
          {title}
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-neutral-500">{desc}</p>
    </div>
  );
}

function EnterRoomVisual() {
  return (
    <div className="flex h-full items-center justify-center gap-3 p-3">
      {/* YOU */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#101010] text-[8px] font-bold text-neutral-300">
          U
        </div>
        <span className="text-[7px] uppercase text-neutral-600">You</span>
      </div>
      {/* Arrow */}
      <div className="h-px w-4 bg-[#1a1a1a]" />
      {/* Ada — circular presence, the true default */}
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-center gap-1">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full text-[9px] font-semibold text-white"
            style={{
              background: "color-mix(in oklab, oklch(0.68 0.13 250) 25%, #161616)",
              boxShadow: "inset 0 0 0 1px color-mix(in oklab, oklch(0.68 0.13 250) 35%, transparent)",
            }}
          >
            A
          </div>
          <span className="text-[7px] text-neutral-400">Ada</span>
        </div>
        <div className="flex flex-col items-center gap-1 opacity-40">
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-[#2a2a2a] text-[8px] text-neutral-600">
            +
          </div>
          <span className="text-[7px] text-neutral-600">Seat 2</span>
        </div>
      </div>
    </div>
  );
}

function InterruptVisual() {
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const interval = setInterval(() => setPulse((p) => !p), 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-full flex-col justify-center px-3">
      <div className="flex items-center gap-1.5">
        <div
          className={`h-1.5 w-1.5 rounded-full transition-colors ${
            pulse ? "bg-white" : "bg-[#2a2a2a]"
          }`}
        />
        <span
          className={`text-[8px] uppercase tracking-wider transition-colors ${
            pulse ? "text-white" : "text-neutral-600"
          }`}
        >
          Ada — Speaking
        </span>
      </div>
      <div
        className={`mt-1.5 rounded border px-2 py-1 text-[8px] transition-all duration-500 ${
          pulse
            ? "border-[#2a2a2a] bg-[#0f0f0f] text-neutral-200"
            : "border-[#141414] bg-[#080808] text-neutral-600"
        }`}
      >
        {pulse ? "Hold on. Drop the qualifier." : "..."}
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <div className="h-1 w-1 rounded-full bg-[#2a2a2a]" />
        <span className="text-[7px] uppercase text-neutral-600">
          Interrupting
        </span>
      </div>
    </div>
  );
}

function CoachVisual() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const interval = setInterval(() => {
      setStep((s) => (s + 1) % 3);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const sections = [
    { label: "The Moment", active: step === 0 },
    { label: "What You Did Well", active: step === 1 },
    { label: "The Pattern", active: step === 2 },
  ];

  return (
    <div className="flex h-full flex-col justify-center px-3 gap-1">
      {sections.map((s, i) => (
        <div
          key={i}
          className={`flex items-center gap-1.5 transition-all duration-500 ${
            s.active ? "opacity-100" : "opacity-30"
          }`}
        >
          <div
            className={`h-1 w-1 rounded-full transition-colors ${
              s.active ? "bg-white" : "bg-[#2a2a2a]"
            }`}
          />
          <span
            className={`text-[8px] uppercase tracking-wider transition-colors ${
              s.active ? "text-neutral-300" : "text-neutral-600"
            }`}
          >
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Proof Points ────────────────────────────────────────────────────────

function ProofPoint({ stat, desc }: { stat: string; desc: string }) {
  return (
    <div className="rounded-md border border-[#1a1a1a] bg-[#0d0d0d] p-5">
      <h3 className="text-base font-semibold text-white">{stat}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">{desc}</p>
    </div>
  );
}

// ─── Hero Waveform ───────────────────────────────────────────────────────

function HeroWaveform() {
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      const timer = setTimeout(() => setMounted(true), 0);
      return () => clearTimeout(timer);
    }
    const interval = setInterval(() => setTick((t) => t + 1), 80);
    const mountedTimer = setTimeout(() => setMounted(true), 0);
    return () => {
      clearInterval(interval);
      clearTimeout(mountedTimer);
    };
  }, []);

  if (!mounted) {
    return (
      <div
        aria-hidden="true"
        className="flex items-center justify-center gap-[2px] h-8"
      >
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
    <div
      aria-hidden="true"
      className="flex items-center justify-center gap-[2px] h-8"
    >
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
