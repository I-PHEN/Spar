"use client";

import { useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  MessageSquareText,
  Briefcase,
  GraduationCap,
  Users,
  ShieldCheck,
  Flame,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PanelIntensityKey, PrimaryTrackKey } from "@/lib/user";
import { SparLogo } from "./spar-logo";
import { Kwesi } from "./kwesi-mascot";
import { combineMomentDateAndTime, formatDateInputValue } from "@/lib/moment-calendar";

interface OnboardingViewProps {
  onComplete: (data: { name: string }) => void;
  onBack: () => void;
  initialName?: string;
}

const STEP_LABELS = ["Your profile", "Panel style"];

interface TrackOption {
  id: PrimaryTrackKey;
  domain: "sparring" | "commercial" | "academic" | "interview";
  title: string;
  desc: string;
  icon: typeof MessageSquareText;
}

const TRACK_OPTIONS: TrackOption[] = [
  {
    id: "debate",
    domain: "sparring",
    title: "Debate & Arguments",
    desc: "Sharpen arguments, rebuttals, and thinking on your feet",
    icon: MessageSquareText,
  },
  {
    id: "pitch",
    domain: "commercial",
    title: "Pitches & Presentations",
    desc: "Defend a startup pitch, proposal, or board deck",
    icon: Briefcase,
  },
  {
    id: "academic",
    domain: "academic",
    title: "Academic & Research",
    desc: "Prepare for a thesis defense, viva, or seminar Q&A",
    icon: GraduationCap,
  },
  {
    id: "interview",
    domain: "interview",
    title: "Interviews & Career",
    desc: "Practice tough behavioral or technical interviews",
    icon: Users,
  },
];

interface PanelStyleOption {
  id: PanelIntensityKey;
  title: string;
  badge?: string;
  desc: string;
  icon: typeof ShieldCheck;
}

const PANEL_STYLE_OPTIONS: PanelStyleOption[] = [
  {
    id: "gentle",
    title: "Supportive & Constructive",
    desc: "Fair pushback that helps me build confidence and structure",
    icon: ShieldCheck,
  },
  {
    id: "moderate",
    title: "Direct & Challenging",
    badge: "Recommended",
    desc: "Tough follow-ups that test my logic and proof",
    icon: Flame,
  },
  {
    id: "aggressive",
    title: "Fast-Paced Pressure",
    desc: "Quick interruptions that train me to speak concisely",
    icon: Zap,
  },
];

export function OnboardingView({
  onComplete,
  onBack,
  initialName = "",
}: OnboardingViewProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialName === "there" ? "" : initialName);
  const [selectedTrack, setSelectedTrack] = useState<PrimaryTrackKey>("debate");
  const [selectedIntensity, setSelectedIntensity] =
    useState<PanelIntensityKey>("moderate");
  const [momentTitle, setMomentTitle] = useState("");
  const [momentDate, setMomentDate] = useState("");
  const [saving, setSaving] = useState(false);

  const activeTrack =
    TRACK_OPTIONS.find((t) => t.id === selectedTrack) ?? TRACK_OPTIONS[0];

  function handleStep1Next() {
    setStep(1);
  }

  function handleStep1Skip() {
    setStep(1);
  }

  async function saveUpcomingMoment() {
    if (!momentTitle.trim()) return;

    const fallbackDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const safeDate =
      (momentDate ? combineMomentDateAndTime(momentDate) : null) ??
      fallbackDate.toISOString();

    try {
      await fetch("/api/upcoming-moment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: momentTitle.trim(),
          date: safeDate,
        }),
      });
    } catch {
      // Non-blocking
    }
  }

  async function handleFinish() {
    const finalName = name.trim() || "Operator";
    setSaving(true);

    const preferencesPayload = {
      primaryTrack: selectedTrack,
      defaultDomain: activeTrack.domain,
      panelIntensity: selectedIntensity,
    };

    try {
      await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: finalName,
          completeOnboarding: true,
          preferences: preferencesPayload,
        }),
      });
    } catch {
      // Continue cleanly even if write lags
    }

    // Persist upcoming moment AFTER /api/user guarantees user cookie/record exists
    await saveUpcomingMoment();

    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "spar:user-preferences:v1",
          JSON.stringify(preferencesPayload),
        );
        window.localStorage.setItem(
          "spar:last-config",
          JSON.stringify({
            experience: "open_spar",
            drillTarget: "hedging",
            hasMaterial: false,
            seats: [
              {
                id: "seat-1",
                archetype: "skeptic",
                name: "Ada",
                intensity:
                  selectedIntensity === "gentle"
                    ? 1
                    : selectedIntensity === "aggressive"
                    ? 3
                    : 2,
                behaviorStyle: selectedIntensity,
                filled: true,
              },
            ],
          }),
        );
      }
    } catch {
      // Ignore storage errors
    }

    setSaving(false);
    onComplete({ name: finalName });
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* Ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 h-[400px] w-[600px] -translate-x-1/2 opacity-20"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(198,255,61,0.08) 0%, transparent 70%)",
        }}
      />

      {/* Minimal header — logo only */}
      <header className="relative z-20 flex items-center justify-center px-6 py-5">
        <div className="flex items-center gap-2.5">
          <SparLogo size="sm" />
          <span className="font-semibold tracking-tight text-white">Spar</span>
        </div>
      </header>

      {/* Main content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-xl">
          {/* Step indicator + label */}
          <div className="mb-8 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              {[0, 1].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 rounded-full transition-all duration-300",
                    i === step
                      ? "w-10 bg-[#C6FF3D]"
                      : i < step
                      ? "w-6 bg-neutral-400"
                      : "w-6 bg-neutral-800"
                  )}
                />
              ))}
            </div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-medium">
              Step {step + 1} of 2 · {STEP_LABELS[step]}
            </p>
          </div>

          {/* Step content */}
          <div className="min-h-[320px]">
            {step === 0 && (
              <div>
                <Kwesi
                  pose="hype"
                  size="sm"
                  line="Welcome to the gym. Tell me what you're preparing for and I'll set your corner."
                  className="mb-5 justify-center"
                />
                <h2 className="font-display text-center text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  What are you preparing for?
                </h2>
                <p className="mt-2 text-center text-sm text-neutral-400">
                  Pick your main track so Spar tailors your panel and defaults automatically.
                </p>

                <div className="mt-6">
                  <label
                    htmlFor="user-name"
                    className="mb-1.5 block text-[10px] uppercase tracking-wider text-neutral-400 font-medium"
                  >
                    Your name
                  </label>
                  <input
                    id="user-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="How the panel should address you"
                    autoFocus
                    className="w-full rounded-lg border border-[#232327] bg-[#0B0B0D] px-3.5 h-11 text-sm text-white placeholder:text-neutral-600 focus:border-[#34343B] focus:outline-none"
                  />
                </div>

                <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {TRACK_OPTIONS.map((track) => {
                    const Icon = track.icon;
                    const active = selectedTrack === track.id;
                    return (
                      <button
                        key={track.id}
                        type="button"
                        onClick={() => setSelectedTrack(track.id)}
                        className={cn(
                          "flex flex-col items-start p-4 text-left",
                          active
                            ? "spar-chunky-card-volt"
                            : "spar-chunky-card spar-chunky-card-interactive"
                        )}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <Icon
                            className={cn(
                              "h-4 w-4",
                              active ? "text-[var(--accent)]" : "text-neutral-400"
                            )}
                          />
                          <span className="text-sm font-semibold text-white">
                            {track.title}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-neutral-400">
                          {track.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <Kwesi
                  pose="listening"
                  size="sm"
                  line="Pick how hard the panel pushes. You can dial this up or down anytime."
                  className="mb-5 justify-center"
                />
                <h2 className="font-display text-center text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  How should the panel challenge you?
                </h2>
                <p className="mt-2 text-center text-sm text-neutral-400">
                  Choose the default pressure level for your rooms. You can change this anytime in Settings.
                </p>

                <div className="mt-6 space-y-2.5">
                  {PANEL_STYLE_OPTIONS.map((style) => {
                    const Icon = style.icon;
                    const active = selectedIntensity === style.id;
                    return (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => setSelectedIntensity(style.id)}
                        className={cn(
                          "flex w-full items-start gap-3.5 p-4 text-left",
                          active
                            ? "spar-chunky-card-volt"
                            : "spar-chunky-card spar-chunky-card-interactive"
                        )}
                      >
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                          <Icon
                            className={cn(
                              "h-4 w-4",
                              active ? "text-[var(--accent)]" : "text-neutral-400"
                            )}
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">
                              {style.title}
                            </span>
                            {style.badge && (
                              <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                                {style.badge}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs leading-relaxed text-neutral-400">
                            {style.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Optional upcoming event */}
                <div className="mt-6 rounded-xl border border-[#232327] bg-[#121215] p-4">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    Upcoming Moment (optional)
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="moment-title" className="sr-only">
                        Moment title
                      </label>
                      <input
                        id="moment-title"
                        type="text"
                        value={momentTitle}
                        onChange={(e) => setMomentTitle(e.target.value)}
                        placeholder="e.g. Finals, Thesis Defense, Series A Pitch"
                        className="w-full rounded-lg border border-[#232327] bg-[#0B0B0D] px-3 h-10 text-xs text-white placeholder:text-neutral-600 focus:border-[#34343B] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="moment-date" className="sr-only">
                        Target date
                      </label>
                      <input
                        id="moment-date"
                        type="date"
                        min={formatDateInputValue(new Date())}
                        value={momentDate}
                        onChange={(e) => setMomentDate(e.target.value)}
                        className="w-full rounded-lg border border-[#232327] bg-[#0B0B0D] px-3 h-10 text-xs text-white placeholder:text-neutral-600 focus:border-[#34343B] focus:outline-none [color-scheme:dark]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between">
            {step === 0 ? (
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep(0)}
                className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}

            <div className="flex items-center gap-3">
              {step === 0 && (
                <button
                  type="button"
                  onClick={handleStep1Skip}
                  className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  Skip
                </button>
              )}
              <button
                type="button"
                onClick={step === 0 ? handleStep1Next : handleFinish}
                disabled={saving}
                className="spar-volt-btn flex items-center gap-2 rounded-2xl px-6 h-11 text-xs font-bold text-[#0B0D06] disabled:opacity-50"
              >
                {step === 0 ? "Continue" : "Finish Setup"}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
