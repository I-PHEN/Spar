"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Flame, Mic, ShieldAlert, Sparkles, Swords, Target } from "lucide-react";
import { ARCHETYPE_LIST } from "@/lib/personas";
import { cn } from "@/lib/utils";
import { SparLogo } from "./spar-logo";
import { Kwesi, type KwesiPose, type KwesiVariant } from "./kwesi-mascot";

type FontCandidate = "space-grotesk" | "bricolage-grotesque";

const BRAND_SWATCHES = [
  {
    name: "Electric Volt",
    token: "--brand-volt",
    hex: "#C6FF3D",
    role: "Signature primary, active CTAs, your voice, Kwesi",
    textDark: true,
  },
  {
    name: "Volt Ledge",
    token: "--brand-volt-deep",
    hex: "#6B8E1A",
    role: "4px tactile card & button depth ledge, middle mark blade",
    textDark: false,
  },
  {
    name: "Heat Ember",
    token: "--brand-ember",
    hex: "#FF5A1F",
    role: "Interruptions, agitation spikes, pressure moments",
    textDark: false,
  },
  {
    name: "Ember Ledge",
    token: "--brand-ember-deep",
    hex: "#9A2E0B",
    role: "Tactile pressure card ledge",
    textDark: false,
  },
];

const SURFACE_SWATCHES = [
  { name: "Obsidian Base", token: "--bg-base", hex: "#0B0B0D" },
  { name: "Surface 1", token: "--surface-1", hex: "#121215" },
  { name: "Surface 2", token: "--surface-2", hex: "#18181D" },
  { name: "Strong Border", token: "--border-strong", hex: "#34343B" },
];

const KWESI_POSES: Array<{
  pose: KwesiPose;
  label: string;
  line: string;
  context: string;
}> = [
  {
    pose: "hype",
    label: "Hype",
    line: "Gloves up. Give them the headline first — no throat-clearing.",
    context: "Hero, Practice pre-Start, Streak celebration",
  },
  {
    pose: "listening",
    label: "Listening",
    line: "Good pace. Keep your numbers tight on the follow-up.",
    context: "Onboarding step 2, setup review",
  },
  {
    pose: "proud",
    label: "Proud",
    line: "Zero hedging on that last exchange. You held the center.",
    context: "Debrief strong moment, milestone",
  },
  {
    pose: "thinking",
    label: "Thinking",
    line: "Ada will push on payback period next. Lock that figure in.",
    context: "Debrief 'One Thing to Practice'",
  },
  {
    pose: "shake-it-off",
    label: "Shake it off",
    line: "Shake it off. Breathe, drop the qualifiers, hit it again.",
    context: "Tough session debrief, mic/error recovery",
  },
];

export function BrandPreview() {
  const [fontCandidate, setFontCandidate] =
    useState<FontCandidate>("bricolage-grotesque");
  const [kwesiVariant, setKwesiVariant] =
    useState<KwesiVariant>("cornerman");
  const [activePose, setActivePose] = useState<KwesiPose>("hype");
  const [selectedMode, setSelectedMode] = useState<"qa" | "drill">("qa");

  const displayClass =
    fontCandidate === "bricolage-grotesque" ? "font-display" : "font-display-alt";
  const activePoseSpec =
    KWESI_POSES.find((item) => item.pose === activePose) ?? KWESI_POSES[0];

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] pb-24">
      {/* Sticky Decision Bar */}
      <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[#0B0B0D]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>App</span>
            </Link>
            <div className="flex items-center gap-2">
              <SparLogo size="sm" variant="volt-tile" />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#C6FF3D]">
                  Brand Lab · Phase 1
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Fight Night Design System Preview (Dev Only)
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Display font toggle */}
            <div
              role="group"
              aria-label="Display font candidate"
              className="inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface-1)] p-1"
            >
              <button
                type="button"
                onClick={() => setFontCandidate("space-grotesk")}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                  fontCandidate === "space-grotesk"
                    ? "bg-[#C6FF3D] text-[#0B0D06]"
                    : "text-[var(--text-secondary)] hover:text-white",
                )}
              >
                Font A: Space Grotesk
              </button>
              <button
                type="button"
                onClick={() => setFontCandidate("bricolage-grotesque")}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                  fontCandidate === "bricolage-grotesque"
                    ? "bg-[#C6FF3D] text-[#0B0D06]"
                    : "text-[var(--text-secondary)] hover:text-white",
                )}
              >
                Font B: Bricolage Grotesque
              </button>
            </div>

            {/* Kwesi visual take toggle */}
            <div
              role="group"
              aria-label="Kwesi visual take"
              className="inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface-1)] p-1"
            >
              <button
                type="button"
                onClick={() => setKwesiVariant("cornerman")}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                  kwesiVariant === "cornerman"
                    ? "bg-[#C6FF3D] text-[#0B0D06]"
                    : "text-[var(--text-secondary)] hover:text-white",
                )}
              >
                Take A: Cornerman
              </button>
              <button
                type="button"
                onClick={() => setKwesiVariant("strategist")}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                  kwesiVariant === "strategist"
                    ? "bg-[#C6FF3D] text-[#0B0D06]"
                    : "text-[var(--text-secondary)] hover:text-white",
                )}
              >
                Take B: Strategist
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-14 px-4 pt-10 sm:px-6">
        {/* Intro Banner */}
        <section className="spar-chunky-card-volt p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 spar-chip px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#C6FF3D]">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Fight Night · Review Gate 1</span>
              </div>
              <h1
                className={cn(
                  displayClass,
                  "text-3xl font-bold tracking-tight text-white sm:text-5xl",
                )}
              >
                Electric Volt, chunky cards, and Kwesi in your corner.
              </h1>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
                Use the sticky toggles above to switch between{" "}
                <strong className="text-white">Space Grotesk</strong> and{" "}
                <strong className="text-white">Bricolage Grotesque</strong>{" "}
                across all headings, and compare{" "}
                <strong className="text-white">Kwesi Take A (Cornerman)</strong>{" "}
                vs{" "}
                <strong className="text-white">
                  Take B (Strategist)
                </strong>{" "}
                before Phase 2 rolls this out to every screen.
              </p>
            </div>
            <div className="shrink-0">
              <Kwesi
                pose={activePose}
                variant={kwesiVariant}
                size="lg"
                line={activePoseSpec.line}
              />
            </div>
          </div>
        </section>

        {/* Section 1: Logo & App Tile */}
        <section className="space-y-5">
          <div className="flex items-baseline justify-between border-b border-[var(--border-subtle)] pb-3">
            <h2 className={cn(displayClass, "text-2xl font-bold text-white")}>
              1. Logo &amp; App Tile
            </h2>
            <span className="font-mono text-xs text-[var(--text-tertiary)]">
              Counter-Blades · Volt Recolor
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="spar-chunky-card flex flex-col justify-between gap-4 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                  Standalone Mark
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  White / Olive-Volt (#6B8E1A) / Electric Volt (#C6FF3D)
                </p>
              </div>
              <div className="flex items-center gap-5 py-2">
                <SparLogo size="sm" />
                <SparLogo size="md" />
                <SparLogo size="lg" />
              </div>
            </div>

            <div className="spar-chunky-card flex flex-col justify-between gap-4 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                  Dark Surface Tile
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  In-app dark header &amp; card badge treatment
                </p>
              </div>
              <div className="flex items-center gap-4 py-2">
                <SparLogo size="sm" withTile />
                <SparLogo size="md" withTile />
                <SparLogo size="lg" withTile />
              </div>
            </div>

            <div className="spar-chunky-card flex flex-col justify-between gap-4 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#C6FF3D]">
                  Volt App Icon Tile (Favicon)
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  WhatsApp-style solid Volt tile with black blades (`icon.svg`)
                </p>
              </div>
              <div className="flex items-center gap-4 py-2">
                <SparLogo size="sm" variant="volt-tile" />
                <SparLogo size="md" variant="volt-tile" />
                <SparLogo size="lg" variant="volt-tile" />
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Fight Night Palette & Vivid Fighter Hues */}
        <section className="space-y-6">
          <div className="flex items-baseline justify-between border-b border-[var(--border-subtle)] pb-3">
            <h2 className={cn(displayClass, "text-2xl font-bold text-white")}>
              2. Fight Night Palette &amp; Fighter Hues
            </h2>
            <span className="font-mono text-xs text-[var(--text-tertiary)]">
              Volt (#C6FF3D) + Ember (#FF5A1F) + 5 Fighters
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BRAND_SWATCHES.map((swatch) => (
              <div
                key={swatch.token}
                className="spar-chunky-card overflow-hidden p-4"
              >
                <div
                  className="mb-3 flex h-20 items-end justify-between rounded-xl border border-black/25 p-3"
                  style={{ backgroundColor: swatch.hex }}
                >
                  <span
                    className={cn(
                      "font-mono text-xs font-bold",
                      swatch.textDark ? "text-[#0B0D06]" : "text-white",
                    )}
                  >
                    {swatch.hex}
                  </span>
                </div>
                <p className="text-sm font-bold text-white">{swatch.name}</p>
                <p className="font-mono text-[11px] text-[var(--text-tertiary)]">
                  {swatch.token}
                </p>
                <p className="mt-1.5 text-xs leading-snug text-[var(--text-secondary)]">
                  {swatch.role}
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SURFACE_SWATCHES.map((surface) => (
              <div
                key={surface.token}
                className="spar-stat-tile flex items-center gap-3 px-4 py-3"
              >
                <span
                  className="h-8 w-8 shrink-0 rounded-lg border border-white/15"
                  style={{ backgroundColor: surface.hex }}
                />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white">
                    {surface.name}
                  </p>
                  <p className="font-mono text-[11px] text-[var(--text-tertiary)]">
                    {surface.hex}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* 5 Panelist Fighter Hues */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Panelist Fighter Hues (Marcus moved to Electric Violet so he never clashes with Volt)
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {ARCHETYPE_LIST.map((persona) => (
                <div
                  key={persona.key}
                  className="spar-chunky-card p-4"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-black/30 text-sm font-bold text-[#0B0B0D] shadow-[0_3px_0_0_rgba(0,0,0,0.45)]"
                      style={{ backgroundColor: persona.accentHue }}
                    >
                      {persona.initials}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">
                        {persona.defaultName}
                      </p>
                      <p className="truncate font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                        {persona.key}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-snug text-[var(--text-secondary)]">
                    {persona.tagline}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 3: Display Typography Comparison */}
        <section className="space-y-5">
          <div className="flex items-baseline justify-between border-b border-[var(--border-subtle)] pb-3">
            <h2 className={cn(displayClass, "text-2xl font-bold text-white")}>
              3. Display Typography Comparison
            </h2>
            <span className="font-mono text-xs text-[var(--text-tertiary)]">
              Pick A or B · Body stays Geist
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div
              className={cn(
                "spar-chunky-card p-6",
                fontCandidate === "space-grotesk" &&
                  "border-[#C6FF3D] shadow-[0_4px_0_0_#6B8E1A]",
              )}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="spar-chip px-3 py-1 font-mono text-[11px] font-bold text-[#C6FF3D]">
                  Candidate A · Space Grotesk
                </span>
                <button
                  type="button"
                  onClick={() => setFontCandidate("space-grotesk")}
                  className="text-xs font-semibold text-[var(--text-secondary)] hover:text-white"
                >
                  {fontCandidate === "space-grotesk" ? "Selected" : "Preview page with A"}
                </button>
              </div>
              <p className="font-display-alt text-4xl font-bold leading-tight text-white">
                Step into the ring.
              </p>
              <p className="font-display-alt mt-2 text-2xl font-bold text-[#C6FF3D]">
                Defend the premise. Own the room.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">
                Crisp, geometric, engineered fight-night poster feel. Pairs
                tightly with Geist Sans body copy and Geist Mono telemetry.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 font-mono text-xs text-[var(--text-tertiary)]">
                <span className="spar-chip px-2.5 py-1">142 WPM</span>
                <span className="spar-chip px-2.5 py-1">0 HEDGES</span>
                <span className="spar-chip px-2.5 py-1">Q&amp;A · 3 ROUNDS</span>
              </div>
            </div>

            <div
              className={cn(
                "spar-chunky-card p-6",
                fontCandidate === "bricolage-grotesque" &&
                  "border-[#C6FF3D] shadow-[0_4px_0_0_#6B8E1A]",
              )}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="spar-chip px-3 py-1 font-mono text-[11px] font-bold text-[#C6FF3D]">
                  Candidate B · Bricolage Grotesque
                </span>
                <button
                  type="button"
                  onClick={() => setFontCandidate("bricolage-grotesque")}
                  className="text-xs font-semibold text-[var(--text-secondary)] hover:text-white"
                >
                  {fontCandidate === "bricolage-grotesque"
                    ? "Selected"
                    : "Preview page with B"}
                </button>
              </div>
              <p className="font-display text-4xl font-bold leading-tight text-white">
                Step into the ring.
              </p>
              <p className="font-display mt-2 text-2xl font-bold text-[#C6FF3D]">
                Defend the premise. Own the room.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">
                Bolder ink-traps and expressive personality — closer to
                Duolingo / Brilliant warmth while still punchy on obsidian.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 font-mono text-xs text-[var(--text-tertiary)]">
                <span className="spar-chip px-2.5 py-1">142 WPM</span>
                <span className="spar-chip px-2.5 py-1">0 HEDGES</span>
                <span className="spar-chip px-2.5 py-1">Q&amp;A · 3 ROUNDS</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Chunky Tactile Cards, Buttons & Stat Tiles */}
        <section className="space-y-5">
          <div className="flex items-baseline justify-between border-b border-[var(--border-subtle)] pb-3">
            <h2 className={cn(displayClass, "text-2xl font-bold text-white")}>
              4. Chunky Tactile Cards, Buttons &amp; Tiles
            </h2>
            <span className="font-mono text-xs text-[var(--text-tertiary)]">
              Hover to lift · Press to sink into 4px ledge
            </span>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {/* Primary Volt Card */}
            <div className="spar-chunky-card-volt flex flex-col justify-between gap-5 p-6">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C6FF3D]/15 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-[#C6FF3D]">
                  <Mic className="h-3.5 w-3.5" />
                  <span>Primary Card · Volt Ledge</span>
                </span>
                <h3 className={cn(displayClass, "text-2xl font-bold text-white")}>
                  Ready for a quick run?
                </h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  Series A pitch defense against Ada &amp; Marcus. 5-minute fast
                  round.
                </p>
              </div>
              <button
                type="button"
                className="spar-volt-btn inline-flex h-12 w-full items-center justify-center gap-2 px-5 text-sm"
              >
                <Swords className="h-4 w-4" />
                <span>Enter the Ring</span>
              </button>
            </div>

            {/* Interactive Mode Cards */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setSelectedMode("qa")}
                className={cn(
                  "w-full p-5 text-left",
                  selectedMode === "qa"
                    ? "spar-chunky-card-volt"
                    : "spar-chunky-card spar-chunky-card-interactive",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Swords className="h-4 w-4 text-[#C6FF3D]" />
                    <span className={cn(displayClass, "text-lg font-bold text-white")}>
                      Q&amp;A Sparring
                    </span>
                  </div>
                  <span className="spar-chip px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#C6FF3D]">
                    {selectedMode === "qa" ? "ACTIVE" : "SELECT"}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
                  They ask. You answer. They push back in real time.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMode("drill")}
                className={cn(
                  "w-full p-5 text-left",
                  selectedMode === "drill"
                    ? "spar-chunky-card-volt"
                    : "spar-chunky-card spar-chunky-card-interactive",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Target className="h-4 w-4 text-[#C6FF3D]" />
                    <span className={cn(displayClass, "text-lg font-bold text-white")}>
                      Weakness Drill
                    </span>
                  </div>
                  <span className="spar-chip px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#C6FF3D]">
                    {selectedMode === "drill" ? "ACTIVE" : "SELECT"}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
                  Hammer one weak spot until your answer lands clean.
                </p>
              </button>
            </div>

            {/* Ember Pressure Card */}
            <div className="spar-chunky-card-ember flex flex-col justify-between gap-4 p-6">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF5A1F]/15 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-[#FF5A1F]">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>Ember Heat · Interruption</span>
                </span>
                <h3 className={cn(displayClass, "text-xl font-bold text-white")}>
                  Ada cut in on hedge words
                </h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  &ldquo;You said &lsquo;roughly&rsquo; twice. Give me the exact
                  payback number.&rdquo;
                </p>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs text-[#FF5A1F]">
                <span className="h-2 w-2 rounded-full bg-[#FF5A1F]" />
                <span>AGITATION SPIKE · EMBER ACCENT</span>
              </div>
            </div>
          </div>

          {/* Stat Tiles */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="spar-stat-tile flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-[var(--text-secondary)]">Current streak</p>
                <p className={cn(displayClass, "mt-0.5 text-2xl font-bold text-white")}>
                  5 days
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C6FF3D]/15 text-[#C6FF3D]">
                <Flame className="h-5 w-5" />
              </div>
            </div>
            <div className="spar-stat-tile flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-[var(--text-secondary)]">Sessions this week</p>
                <p className={cn(displayClass, "mt-0.5 text-2xl font-bold text-white")}>
                  4 debriefed
                </p>
              </div>
              <span className="spar-chip px-3 py-1 font-mono text-xs font-bold text-[#C6FF3D]">
                +2 vs last wk
              </span>
            </div>
            <div className="spar-stat-tile flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-[var(--text-secondary)]">Top skill</p>
                <p className={cn(displayClass, "mt-0.5 text-2xl font-bold text-white")}>
                  92% Clarity
                </p>
              </div>
              <span className="spar-chip px-3 py-1 font-mono text-xs font-bold text-white">
                0 hedges
              </span>
            </div>
          </div>
        </section>

        {/* Section 5: Kwesi Mascot — All 5 Poses & Side-by-Side Takes */}
        <section className="space-y-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
            <h2 className={cn(displayClass, "text-2xl font-bold text-white")}>
              5. Kwesi (&ldquo;Your Corner&rdquo;) — Poses &amp; Visual Takes
            </h2>
            <span className="font-mono text-xs text-[var(--text-tertiary)]">
              V1 Hand-coded SVG + Framer Motion · Rive-ready API
            </span>
          </div>

          {/* Side-by-Side Take Comparison */}
          <div className="grid gap-4 md:grid-cols-2">
            <div
              className={cn(
                "spar-chunky-card flex items-center justify-between gap-4 p-5",
                kwesiVariant === "cornerman" &&
                  "border-[#C6FF3D] shadow-[0_4px_0_0_#6B8E1A]",
              )}
            >
              <div className="space-y-2">
                <span className="spar-chip inline-block px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-[#C6FF3D]">
                  Take A · Classic Ring Cornerman
                </span>
                <h3 className={cn(displayClass, "text-xl font-bold text-white")}>
                  Cornerman (Volt Towel)
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Veteran trainer silhouette, silver-templed fade, dark vest,
                  and signature Electric Volt towel over his shoulders.
                </p>
                <button
                  type="button"
                  onClick={() => setKwesiVariant("cornerman")}
                  className="text-xs font-semibold text-[#C6FF3D] hover:underline"
                >
                  {kwesiVariant === "cornerman"
                    ? "Active above"
                    : "Switch preview to Take A"}
                </button>
              </div>
              <Kwesi pose={activePose} variant="cornerman" size="lg" />
            </div>

            <div
              className={cn(
                "spar-chunky-card flex items-center justify-between gap-4 p-5",
                kwesiVariant === "strategist" &&
                  "border-[#C6FF3D] shadow-[0_4px_0_0_#6B8E1A]",
              )}
            >
              <div className="space-y-2">
                <span className="spar-chip inline-block px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-[#C6FF3D]">
                  Take B · Modern Fight-Night Coach
                </span>
                <h3 className={cn(displayClass, "text-xl font-bold text-white")}>
                  Strategist (Headband &amp; Mic)
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Geometric high-top fade, Electric Volt sweatband, corner
                  headset boom mic, and zipped track jacket.
                </p>
                <button
                  type="button"
                  onClick={() => setKwesiVariant("strategist")}
                  className="text-xs font-semibold text-[#C6FF3D] hover:underline"
                >
                  {kwesiVariant === "strategist"
                    ? "Active above"
                    : "Switch preview to Take B"}
                </button>
              </div>
              <Kwesi pose={activePose} variant="strategist" size="lg" />
            </div>
          </div>

          {/* All 5 Poses Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {KWESI_POSES.map((item) => {
              const selected = activePose === item.pose;
              return (
                <button
                  key={item.pose}
                  type="button"
                  onClick={() => setActivePose(item.pose)}
                  className={cn(
                    "flex flex-col gap-4 p-5 text-left",
                    selected
                      ? "spar-chunky-card-volt"
                      : "spar-chunky-card spar-chunky-card-interactive",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="spar-chip px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#C6FF3D]">
                      pose=&quot;{item.pose}&quot;
                    </span>
                    <span className="text-xs font-semibold text-[var(--text-tertiary)]">
                      {item.label}
                    </span>
                  </div>
                  <Kwesi
                    pose={item.pose}
                    variant={kwesiVariant}
                    size="md"
                    line={item.line}
                    showNameBadge={false}
                  />
                  <p className="text-[11px] text-[var(--text-tertiary)]">
                    Used in: {item.context}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
