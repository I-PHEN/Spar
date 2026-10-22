"use client";

import { useState } from "react";
import { ArrowRight, ArrowLeft, Swords } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingViewProps {
  onComplete: (data: { name: string }) => void;
  onBack: () => void;
  initialName?: string;
}

const STEP_LABELS = ["Upcoming moment", "Your name"];

export function OnboardingView({
  onComplete,
  onBack,
  initialName = "",
}: OnboardingViewProps) {
  const [step, setStep] = useState(0);
  const [momentTitle, setMomentTitle] = useState("");
  const [momentDate, setMomentDate] = useState("");
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);

  async function saveMoment() {
    if (!momentTitle.trim()) return;

    // Use selected date or default to 14 days from now if omitted
    const dateObj = momentDate
      ? new Date(momentDate)
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const safeDate = Number.isNaN(dateObj.getTime())
      ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      : dateObj.toISOString();

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
      // Non-blocking: continue even if moment POST fails
    }
  }

  async function handleStep1Next() {
    setSaving(true);
    await saveMoment();
    setSaving(false);
    setStep(1);
  }

  function handleStep1Skip() {
    setStep(1);
  }

  async function handleFinish() {
    const finalName = name.trim() || "Operator";
    setSaving(true);
    try {
      await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: finalName }),
      });
    } catch {
      // Continue even if user name write fails
    }
    setSaving(false);
    onComplete({ name: finalName });
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 h-[400px] w-[600px] -translate-x-1/2 opacity-20"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.04) 0%, transparent 70%)",
        }}
      />

      {/* Minimal header — logo only */}
      <header className="relative z-20 flex items-center justify-center px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#101010]">
            <Swords className="h-4 w-4 text-neutral-300" />
          </div>
          <span className="font-semibold tracking-tight text-white">Spar</span>
        </div>
      </header>

      {/* Main content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Step indicator + label */}
          <div className="mb-10 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              {[0, 1].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 rounded-full transition-all duration-300",
                    i === step
                      ? "w-10 bg-white"
                      : i < step
                      ? "w-6 bg-neutral-400"
                      : "w-6 bg-neutral-800"
                  )}
                />
              ))}
            </div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-medium">
              {STEP_LABELS[step]}
            </p>
          </div>

          {/* Step content */}
          <div className="min-h-[260px]">
            {step === 0 && (
              <div>
                <h2 className="text-center text-2xl font-semibold tracking-tight text-white">
                  What are you preparing for?
                </h2>
                <p className="mt-2 text-center text-sm text-neutral-400">
                  Set your upcoming high-stakes moment to anchor your practice countdown.
                </p>

                <div className="mt-6 space-y-4">
                  <div>
                    <label
                      htmlFor="moment-title"
                      className="mb-1.5 block text-[10px] uppercase tracking-wider text-neutral-400 font-medium"
                    >
                      Moment title
                    </label>
                    <input
                      id="moment-title"
                      type="text"
                      value={momentTitle}
                      onChange={(e) => setMomentTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleStep1Next();
                      }}
                      placeholder="e.g. Series A Pitch, Thesis Defense, Executive Review"
                      autoFocus
                      className="w-full rounded-md border border-[#202020] bg-[#0a0a0a] px-3 h-11 text-sm text-white placeholder:text-neutral-600 focus:border-[#3a3a3a] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="moment-date"
                      className="mb-1.5 block text-[10px] uppercase tracking-wider text-neutral-400 font-medium"
                    >
                      Target date (optional)
                    </label>
                    <input
                      id="moment-date"
                      type="date"
                      value={momentDate}
                      onChange={(e) => setMomentDate(e.target.value)}
                      className="w-full rounded-md border border-[#202020] bg-[#0a0a0a] px-3 h-11 text-sm text-white placeholder:text-neutral-600 focus:border-[#3a3a3a] focus:outline-none [color-scheme:dark]"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="text-center">
                <h2 className="text-2xl font-semibold tracking-tight text-white">
                  What should we call you?
                </h2>
                <p className="mt-2 text-sm text-neutral-400">
                  Your coach and the panel will address you by this name.
                </p>
                <div className="mt-8 mx-auto max-w-xs">
                  <label htmlFor="user-name" className="sr-only">
                    Your name
                  </label>
                  <input
                    id="user-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleFinish();
                    }}
                    placeholder="Your name"
                    autoFocus
                    className="w-full rounded-md border border-[#202020] bg-[#0a0a0a] px-4 h-12 text-center text-base text-white placeholder:text-neutral-600 focus:border-[#3a3a3a] focus:outline-none"
                  />
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
                className="flex items-center gap-2 px-5 h-10 rounded-md text-sm font-medium bg-neutral-100 text-black hover:bg-white transition-all disabled:opacity-50"
              >
                {step === 0 ? "Continue" : "Start Spar"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
