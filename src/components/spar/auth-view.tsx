"use client";

import { useState } from "react";
import { ArrowRight, ArrowLeft, Swords } from "lucide-react";

interface AuthViewProps {
  onContinue: () => void;
  onBack: () => void;
}

/**
 * Fake Sign In / Sign Up screen.
 *
 * No real auth yet — this is a placeholder that looks professional.
 * The user enters an email (or clicks "Continue"), and it proceeds to
 * onboarding (first time) or practice (returning).
 */
export function AuthView({ onContinue, onBack }: AuthViewProps) {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const canContinue =
    mode === "signup"
      ? email.trim().length >= 3 && name.trim().length >= 2
      : email.trim().length >= 3;

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

        {/* Mode toggle */}
        <div className="mb-6 flex rounded-md border border-[#1a1a1a] bg-[#0a0a0a] p-1">
          <button
            onClick={() => setMode("signup")}
            className={`flex-1 rounded py-2 text-sm font-medium transition-all ${
              mode === "signup"
                ? "bg-[#171717] text-white"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            Sign Up
          </button>
          <button
            onClick={() => setMode("signin")}
            className={`flex-1 rounded py-2 text-sm font-medium transition-all ${
              mode === "signin"
                ? "bg-[#171717] text-white"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            Sign In
          </button>
        </div>

        {/* Heading */}
        <h1 className="mb-1 text-xl font-semibold tracking-tight text-white">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mb-6 text-sm text-neutral-500">
          {mode === "signup"
            ? "Start sparring in under a minute."
            : "Sign in to continue your training."}
        </p>

        {/* Form */}
        <div className="space-y-3">
          {mode === "signup" && (
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-neutral-500">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canContinue) onContinue();
                }}
                placeholder="Your name"
                className="w-full rounded-md border border-[#202020] bg-[#0a0a0a] px-3 h-11 text-sm text-white placeholder:text-neutral-600 focus:border-[#3a3a3a] focus:outline-none"
              />
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-neutral-500">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canContinue) onContinue();
              }}
              placeholder="you@example.com"
              className="w-full rounded-md border border-[#202020] bg-[#0a0a0a] px-3 h-11 text-sm text-white placeholder:text-neutral-600 focus:border-[#3a3a3a] focus:outline-none"
            />
          </div>
        </div>

        {/* Continue button */}
        <button
          onClick={onContinue}
          disabled={!canContinue}
          className={`mt-5 flex w-full items-center justify-center gap-2 rounded-md h-11 text-sm font-medium transition-all ${
            canContinue
              ? "bg-neutral-100 text-black hover:bg-white"
              : "bg-neutral-900 text-neutral-600 cursor-not-allowed"
          }`}
        >
          {mode === "signup" ? "Create Account" : "Sign In"}
          <ArrowRight className="h-4 w-4" />
        </button>

        <p className="mt-3 text-center text-[11px] text-neutral-600">
          By continuing, you agree to Spar&apos;s Terms and Privacy Policy.
        </p>

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
