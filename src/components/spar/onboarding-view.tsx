"use client";

import { useState } from "react";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
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
  { id: "thesis", label: "Thesis Defense", desc: "Defending your research" },
  { id: "pitch", label: "Investor Pitch", desc: "Raising a round" },
  { id: "board", label: "Board Update", desc: "Reporting to leadership" },
  { id: "interview", label: "Interview", desc: "Job or promotion" },
  { id: "conference", label: "Conference Talk", desc: "Presenting to an audience" },
  { id: "custom", label: "Something Else", desc: "Custom scenario" },
];

const FOCUS_OPTIONS = [
  { id: "confidence", label: "Confidence under pressure", desc: "Stop freezing when challenged" },
  { id: "hedging", label: "Hedging less", desc: "Drop the qualifiers" },
  { id: "concision", label: "Being more concise", desc: "Get to the point faster" },
  { id: "evidence", label: "Better evidence", desc: "Ground claims in data" },
  { id: "recovery", label: "Recovery speed", desc: "Bounce back from interruptions" },
  { id: "unsure", label: "I don't know yet", desc: "Just spar and find out" },
];

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
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Step indicator */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                "h-1 w-8 rounded-full transition-colors",
                i <= step ? "bg-white" : "bg-neutral-800"
              )}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-[280px]">
          {step === 0 && (
            <div>
              <h2 className="text-center text-2xl font-semibold tracking-tight text-white">
                What are you preparing for?
              </h2>
              <p className="mt-2 text-center text-sm text-neutral-500">
                We&apos;ll configure the room for your specific situation.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-2.5">
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
                          : "bg-[#101010] border-[#202020] hover:bg-[#161616] hover:border-[#2a2a2a]"
                      )}
                    >
                      <p className="text-sm font-medium text-white">{opt.label}</p>
                      <p className="mt-0.5 text-[11px] text-neutral-500">{opt.desc}</p>
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
                Your coach will focus on this during sessions.
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
                          : "bg-[#101010] border-[#202020] hover:bg-[#161616] hover:border-[#2a2a2a]"
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
                Your coach will use this in sessions.
              </p>
              <div className="mt-8">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canProceed) handleNext();
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
              <ArrowLeft className="h-4 w-4" /> Home
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
            {step === 2 ? "Start" : "Next"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
