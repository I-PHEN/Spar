"use client";

import { useState } from "react";
import { ArrowRight, ArrowLeft, Check, Swords } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingViewProps {
  onComplete: (data: {
    name: string;
    preparingFor: string;
    focusArea: string;
  }) => void;
  onBack: () => void;
}

const PREPARING_FOR_OPTIONS = [
  { id: "thesis", label: "Thesis Defense", desc: "Defending your research before a committee" },
  { id: "pitch", label: "Investor Pitch", desc: "Pitching to a panel of investors" },
  { id: "board", label: "Board Update", desc: "Reporting to your board of directors" },
  { id: "interview", label: "Job Interview", desc: "Behavioral or technical interview" },
  { id: "conference", label: "Conference Talk", desc: "Presenting to an audience + Q&A" },
  { id: "custom", label: "Something Else", desc: "Custom high-stakes moment" },
];

const FOCUS_OPTIONS = [
  { id: "confidence", label: "Confidence under pressure", desc: "Stop freezing when challenged" },
  { id: "hedging", label: "Hedging less", desc: "Drop the qualifiers and be direct" },
  { id: "concision", label: "Being more concise", desc: "Get to the point faster" },
  { id: "evidence", label: "Better evidence", desc: "Ground claims in specific data" },
  { id: "recovery", label: "Recovery speed", desc: "Bounce back from interruptions" },
  { id: "unsure", label: "I don't know yet", desc: "Just spar and find out" },
];

const STEP_LABELS = ["Preparing for", "Focus area", "Your name"];

export function OnboardingView({ onComplete, onBack }: OnboardingViewProps) {
  const [step, setStep] = useState(0);
  const [preparingFor, setPreparingFor] = useState("");
  const [focusArea, setFocusArea] = useState("");
  const [name, setName] = useState("");

  const canProceed = step === 0
    ? !!preparingFor
    : step === 1
    ? !!focusArea
    : name.trim().length >= 2;

  function handleNext() {
    if (step < 2) {
      setStep(step + 1);
    } else {
      onComplete({ name: name.trim(), preparingFor, focusArea });
    }
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
        <div className="w-full max-w-lg">
          {/* Step indicator + label */}
          <div className="mb-10 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              {[0, 1, 2].map((i) => (
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
            <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">
              {STEP_LABELS[step]}
            </p>
          </div>

          {/* Step content */}
          <div className="min-h-[300px]">
            {step === 0 && (
              <div>
                <h2 className="text-center text-2xl font-semibold tracking-tight text-white">
                  What are you preparing for?
                </h2>
                <p className="mt-2 text-center text-sm text-neutral-500">
                  We&apos;ll configure the panel for your specific situation.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-2">
                  {PREPARING_FOR_OPTIONS.map((opt) => {
                    const isSelected = preparingFor === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setPreparingFor(opt.id)}
                        className={cn(
                          "relative rounded-md border p-4 text-left transition-all",
                          isSelected
                            ? "bg-[#171717] border-[#343434]"
                            : "bg-[#101010] border-[#202020] hover:bg-[#141414] hover:border-[#2a2a2a]"
                        )}
                      >
                        <p className="text-sm font-medium text-white">{opt.label}</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
                          {opt.desc}
                        </p>
                        {isSelected && (
                          <div className="absolute top-3 right-3">
                            <Check className="h-3.5 w-3.5 text-neutral-300" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <h2 className="text-center text-2xl font-semibold tracking-tight text-white">
                  What do you want to work on?
                </h2>
                <p className="mt-2 text-center text-sm text-neutral-500">
                  Your coach will prioritize this during sessions and in the debrief.
                </p>
                <div className="mt-6 space-y-2">
                  {FOCUS_OPTIONS.map((opt) => {
                    const isSelected = focusArea === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setFocusArea(opt.id)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-md border p-4 text-left transition-all",
                          isSelected
                            ? "bg-[#171717] border-[#343434]"
                            : "bg-[#101010] border-[#202020] hover:bg-[#141414] hover:border-[#2a2a2a]"
                        )}
                      >
                        <div>
                          <p className="text-sm font-medium text-white">{opt.label}</p>
                          <p className="mt-0.5 text-[11px] text-neutral-500">{opt.desc}</p>
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 flex-shrink-0 text-neutral-300" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="text-center">
                <h2 className="text-2xl font-semibold tracking-tight text-white">
                  What should we call you?
                </h2>
                <p className="mt-2 text-sm text-neutral-500">
                  Your coach and the panel will use this in sessions.
                </p>
                <div className="mt-8 mx-auto max-w-xs">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canProceed) handleNext();
                    }}
                    placeholder="Your name"
                    autoFocus
                    className="w-full rounded-md border border-[#202020] bg-[#0a0a0a] px-4 h-14 text-center text-lg text-white placeholder:text-neutral-600 focus:border-[#3a3a3a] focus:outline-none"
                  />
                </div>
                <p className="mt-4 text-[11px] text-neutral-600">
                  You can change this later.
                </p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="mt-10 flex items-center justify-between">
            {step > 0 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            ) : (
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={!canProceed}
              className={cn(
                "flex items-center gap-2 px-5 h-11 rounded-md text-sm font-medium transition-all",
                canProceed
                  ? "bg-neutral-100 text-black hover:bg-white"
                  : "bg-neutral-900 text-neutral-600 cursor-not-allowed"
              )}
            >
              {step === 2 ? "Start Spar" : "Continue"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
