"use client";

import { ArrowRight, CheckCircle2, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PracticeEvaluationResult } from "@/lib/courses";

export interface LessonFeedbackProps {
  learnerResponse: string;
  evaluation: PracticeEvaluationResult;
  launchingChamber?: boolean;
  onRetry: () => void;
  onCompleteLesson: () => void;
  onLaunchChamber?: () => void;
}

export function LessonFeedback({
  learnerResponse,
  evaluation,
  launchingChamber = false,
  onRetry,
  onCompleteLesson,
  onLaunchChamber,
}: LessonFeedbackProps) {
  const {
    wordCount,
    targetMaxWords,
    detectedHedges,
    detectedFillers,
    hasConcreteNumbers,
    hasDirectOpening,
    didWell,
    toImprove,
    suggestedRewrite,
  } = evaluation;

  const totalFillerAndHedges = detectedHedges.length + detectedFillers.length;
  const wordEconomyGood = wordCount >= 5 && wordCount <= targetMaxWords + 10;

  return (
    <div className="space-y-8">
      {/* Your Recorded / Written Attempt */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-neutral-400">
          Your response ({wordCount} {wordCount === 1 ? "word" : "words"})
        </p>
        <blockquote className="rounded-xl border border-white/10 bg-[#121215] p-4 text-sm leading-relaxed text-neutral-200">
          “{learnerResponse}”
        </blockquote>
      </div>

      {/* Measured Dimensions (Only honest, measurable signals) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-white/[0.08] bg-[#111114] p-3.5">
          <p className="text-xs text-neutral-400">Opening directness</p>
          <p
            className={cn(
              "mt-1 text-sm font-semibold",
              hasDirectOpening ? "text-white" : "text-neutral-400"
            )}
          >
            {hasDirectOpening ? "Direct start" : "Stalled opener"}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#111114] p-3.5">
          <p className="text-xs text-neutral-400">Word economy</p>
          <p
            className={cn(
              "mt-1 text-sm font-semibold font-mono tabular-nums",
              wordEconomyGood ? "text-white" : "text-neutral-400"
            )}
          >
            {wordCount} / {targetMaxWords}w target
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#111114] p-3.5">
          <p className="text-xs text-neutral-400">Hedge &amp; filler words</p>
          <p
            className={cn(
              "mt-1 text-sm font-semibold font-mono tabular-nums",
              totalFillerAndHedges === 0 ? "text-white" : "text-neutral-400"
            )}
          >
            {totalFillerAndHedges === 0
              ? "0 detected"
              : `${totalFillerAndHedges} detected`}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#111114] p-3.5">
          <p className="text-xs text-neutral-400">Use of evidence</p>
          <p
            className={cn(
              "mt-1 text-sm font-semibold",
              hasConcreteNumbers ? "text-white" : "text-neutral-400"
            )}
          >
            {hasConcreteNumbers ? "Quantified" : "No numbers cited"}
          </p>
        </div>
      </div>

      {/* 1 Thing Done Well + 1 Specific Improvement */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5 rounded-xl border border-white/15 bg-white/[0.03] p-5 shadow-sm">
          <p className="text-xs font-mono uppercase tracking-wider text-neutral-300">
            What you did well
          </p>
          <p className="text-sm leading-relaxed text-white font-medium">{didWell}</p>
        </div>

        <div className="space-y-1.5 rounded-xl border border-white/10 bg-[#111114] p-5">
          <p className="text-xs font-mono uppercase tracking-wider text-neutral-400">
            One specific improvement
          </p>
          <p className="text-sm leading-relaxed text-neutral-300">
            {toImprove}
          </p>
        </div>
      </div>

      {/* Suggested Rewrite / Demonstration */}
      <div className="space-y-2 border-t border-white/[0.08] pt-6">
        <p className="text-xs font-mono uppercase tracking-wider text-neutral-400">
          Suggested stronger response
        </p>
        <p className="rounded-xl border border-white/20 bg-white/[0.04] p-4 text-sm font-medium leading-relaxed text-white">
          “{suggestedRewrite}”
        </p>
      </div>

      {/* Next-Step Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={onRetry}
            className="rounded-full border-white/15 bg-transparent text-xs text-white hover:bg-white/[0.06] px-4 py-2"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Retry challenge
          </Button>

          {onLaunchChamber && (
            <Button
              variant="outline"
              disabled={launchingChamber}
              onClick={onLaunchChamber}
              className="rounded-full border-white/15 bg-white/[0.04] text-xs text-white hover:bg-white/[0.09] px-4 py-2"
            >
              <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
              {launchingChamber
                ? "Opening Chamber..."
                : "Enter Drill Chamber →"}
            </Button>
          )}
        </div>

        <Button
          onClick={onCompleteLesson}
          className="rounded-full bg-white text-black hover:bg-neutral-200 text-xs sm:text-sm font-semibold px-6 py-2.5 h-10 shadow-md"
        >
          <CheckCircle2 className="mr-1.5 h-4 w-4" />
          Complete &amp; continue
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
