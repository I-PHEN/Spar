"use client";

import { useState } from "react";
import { ArrowRight, ArrowLeft, Swords } from "lucide-react";

interface AuthViewProps {
  onContinue: (name?: string) => void;
  onBack: () => void;
}

/**
 * Honest Auth screen — name-only operator entry.
 *
 * No fake credentials, email, or unbacked Terms line.
 * Provides a direct name input and a "Skip for now" affordance for fast iteration.
 */
export function AuthView({ onContinue, onBack }: AuthViewProps) {
  const [name, setName] = useState("");

  const trimmedName = name.trim();

  function handleSubmit() {
    onContinue(trimmedName || undefined);
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 h-[400px] w-[600px] -translate-x-1/2 opacity-20"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.04) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#101010]">
            <Swords className="h-4 w-4 text-neutral-300" />
          </div>
          <span className="font-semibold tracking-tight text-white text-lg">Spar</span>
        </div>

        {/* Heading */}
        <h1 className="mb-1 text-xl font-semibold tracking-tight text-white">
          Enter the Sparring Room
        </h1>
        <p className="mb-6 text-sm text-neutral-500">
          Choose the name the panel will address you by.
        </p>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label
              htmlFor="auth-name"
              className="mb-1.5 block text-[10px] uppercase tracking-wider text-neutral-400 font-medium"
            >
              Your name
            </label>
            <input
              id="auth-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              placeholder="Your name"
              autoFocus
              className="w-full rounded-md border border-[#202020] bg-[#0a0a0a] px-3 h-11 text-sm text-white placeholder:text-neutral-600 focus:border-[#3a3a3a] focus:outline-none"
            />
          </div>

          {/* Continue button */}
          <button
            onClick={handleSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-neutral-100 h-11 text-sm font-medium text-black transition-all hover:bg-white"
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>

          {/* Skip for now affordance */}
          <button
            type="button"
            onClick={() => onContinue()}
            className="w-full text-center text-xs text-neutral-500 hover:text-neutral-300 py-1 transition-colors"
          >
            Skip for now
          </button>
        </div>

        {/* Back */}
        <button
          onClick={onBack}
          className="mt-6 flex w-full items-center justify-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to home
        </button>
      </div>
    </div>
  );
}
