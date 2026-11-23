"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
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
  accentColor: string;
  icon: typeof MessageSquareText;
}

const TRACK_OPTIONS: TrackOption[] = [
  {
    id: "debate",
    domain: "sparring",
    title: "Debate & Arguments",
    desc: "Sharpen arguments, rebuttals, and thinking on your feet",
    accentColor: "#FF5A1F",
    icon: MessageSquareText,
  },
  {
    id: "pitch",
    domain: "commercial",
    title: "Pitches & Presentations",
    desc: "Defend a startup pitch, proposal, or board deck",
    accentColor: "#38BDF8",
    icon: Briefcase,
  },
  {
    id: "academic",
    domain: "academic",
    title: "Academic & Research",
    desc: "Prepare for a thesis defense, viva, or seminar Q&A",
    accentColor: "#FACC15",
    icon: GraduationCap,
  },
  {
    id: "interview",
    domain: "interview",
    title: "Interviews & Career",
    desc: "Practice tough behavioral or technical interviews",
    accentColor: "#A78BFA",
    icon: Users,
  },
];

interface PanelStyleOption {
  id: PanelIntensityKey;
  title: string;
  badge?: string;
  desc: string;
  accentColor: string;
  icon: typeof ShieldCheck;
}

const PANEL_STYLE_OPTIONS: PanelStyleOption[] = [
  {
    id: "gentle",
    title: "Supportive & Constructive",
    desc: "Fair pushback that helps me build confidence and structure",
    accentColor: "#34D399",
    icon: ShieldCheck,
  },
  {
    id: "moderate",
    title: "Direct & Challenging",
    badge: "Recommended",
    desc: "Tough follow-ups that test my logic and proof",
    accentColor: "#C6FF3D",
    icon: Flame,
  },
  {
    id: "aggressive",
    title: "Fast-Paced Pressure",
    desc: "Quick interruptions that train me to speak concisely",
    accentColor: "#FF5A1F",
    icon: Zap,
  },
];

const SELECTED_CARD_CLASS =
  "spar-chunky-card-volt border-[#C6FF3D] bg-[#1A2408] ring-2 ring-[#C6FF3D]/40 shadow-[0_5px_0_0_#6B8E1A,0_0_24px_-4px_rgba(198,255,61,0.35)]";

const UNSELECTED_CARD_CLASS =
  "spar-chunky-card spar-chunky-card-interactive opacity-80 hover:opacity-100 border-[#282831] bg-[#121215]";

function getIconTileStyle(accentColor: string, active: boolean): CSSProperties {
  if (active) {
    return {
      backgroundColor: accentColor,
      borderColor: accentColor,
      color: "#0B0D06",
    };
  }
  return {
    backgroundColor: `${accentColor}1A`,
    borderColor: `${accentColor}4D`,
    color: accentColor,
  };
}

function SelectionIndicator({ active }: { active: boolean }) {
  if (active) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#C6FF3D] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#0B0D06]">
        <Check className="h-3 w-3 stroke-[3]" />
        Selected
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="h-5 w-5 shrink-0 rounded-full border-2 border-[#383842] bg-[#0B0B0D]"
    />
  );
}

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
  const [saving, setSaving] = useState(false);

  const activeTrack =
    TRACK_OPTIONS.find((t) => t.id === selectedTrack) ?? TRACK_OPTIONS[0];

  function handleStep1Next() {
    setStep(1);
  }

  function handleStep1Skip() {
    setStep(1);
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
    <div className="relative flex min-h-screen flex-col overflow-x-clip bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* Vibrant Fight Night multi-point backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="absolute -top-24 left-1/2 h-[440px] w-[760px] -translate-x-1/2 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(198,255,61,0.18) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute top-1/4 -right-24 h-[380px] w-[420px] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(255,90,31,0.09) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-0 -left-24 h-[360px] w-[420px] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(56,189,248,0.08) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Minimal header — logo only */}
      <header className="relative z-20 flex items-center justify-center px-6 py-5">
        <div className="flex items-center gap-2.5">
          <SparLogo size="md" />
          <span className="font-display text-base font-bold tracking-tight text-white">
            Spar
          </span>
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
                    "h-1.5 rounded-full transition-all duration-300",
                    i === step
                      ? "w-10 bg-[#C6FF3D]"
                      : i < step
                      ? "w-6 bg-[#6B8E1A]"
                      : "w-6 bg-[#26262E]"
                  )}
                />
              ))}
            </div>
            <p className="inline-flex items-center rounded-full border border-[#C6FF3D]/40 bg-[#C6FF3D]/12 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#C6FF3D]">
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
                <p className="mt-2 text-center text-sm text-[var(--text-secondary)]">
                  Pick your main track so Spar tailors your panel and defaults automatically.
                </p>

                <div className="mt-6">
                  <label
                    htmlFor="user-name"
                    className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-400"
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
                    className="w-full rounded-xl border-2 border-[#2A2A33] bg-[#101014] px-4 h-12 text-sm text-white placeholder:text-neutral-500 transition-colors focus:border-[#C6FF3D] focus:bg-[#14170E] focus:outline-none focus:ring-2 focus:ring-[#C6FF3D]/25"
                  />
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {TRACK_OPTIONS.map((track) => {
                    const Icon = track.icon;
                    const active = selectedTrack === track.id;
                    return (
                      <button
                        key={track.id}
                        type="button"
                        aria-pressed={active}
                        data-selected={active ? "true" : "false"}
                        onClick={() => setSelectedTrack(track.id)}
                        className={cn(
                          "flex flex-col items-start p-4 text-left cursor-pointer",
                          active ? SELECTED_CARD_CLASS : UNSELECTED_CARD_CLASS
                        )}
                      >
                        <div className="mb-3 flex w-full items-center justify-between gap-2">
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 transition-colors"
                            style={getIconTileStyle(track.accentColor, active)}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <SelectionIndicator active={active} />
                        </div>
                        <span
                          className={cn(
                            "text-sm font-bold tracking-tight",
                            active ? "font-display text-[#C6FF3D]" : "text-white"
                          )}
                        >
                          {track.title}
                        </span>
                        <p
                          className={cn(
                            "mt-1 text-xs leading-relaxed",
                            active ? "text-neutral-200" : "text-neutral-400"
                          )}
                        >
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
                <p className="mt-2 text-center text-sm text-[var(--text-secondary)]">
                  Choose the default pressure level for your rooms. You can change this anytime in Settings.
                </p>

                <div className="mt-6 space-y-3">
                  {PANEL_STYLE_OPTIONS.map((style) => {
                    const Icon = style.icon;
                    const active = selectedIntensity === style.id;
                    return (
                      <button
                        key={style.id}
                        type="button"
                        aria-pressed={active}
                        data-selected={active ? "true" : "false"}
                        onClick={() => setSelectedIntensity(style.id)}
                        className={cn(
                          "flex w-full items-center gap-3.5 p-4 text-left cursor-pointer",
                          active ? SELECTED_CARD_CLASS : UNSELECTED_CARD_CLASS
                        )}
                      >
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 transition-colors"
                          style={getIconTileStyle(style.accentColor, active)}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "text-sm font-bold tracking-tight",
                                active ? "font-display text-[#C6FF3D]" : "text-white"
                              )}
                            >
                              {style.title}
                            </span>
                            {style.badge && (
                              <span className="rounded-full border border-[#C6FF3D]/40 bg-[#C6FF3D]/15 px-2 py-0.5 text-[10px] font-bold text-[#C6FF3D]">
                                {style.badge}
                              </span>
                            )}
                          </div>
                          <p
                            className={cn(
                              "mt-0.5 text-xs leading-relaxed",
                              active ? "text-neutral-200" : "text-neutral-400"
                            )}
                          >
                            {style.desc}
                          </p>
                        </div>
                        <SelectionIndicator active={active} />
                      </button>
                    );
                  })}
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
                className="flex items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep(0)}
                className="flex items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}

            <div className="flex items-center gap-3">
              {step === 0 && (
                <button
                  type="button"
                  onClick={handleStep1Skip}
                  className="text-xs font-medium text-neutral-400 hover:text-white transition-colors"
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
