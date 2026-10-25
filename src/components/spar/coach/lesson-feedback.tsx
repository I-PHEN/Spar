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
    <div className="space-y-4">
      {/* Response Preview Block (Compact) */}
      <div className="rounded-xl border border-white/10 bg-[#0e0e0e] p-3.5 space-y-1">
        <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
          <span>YOUR RESPONSE</span>
          <span className="tabular-nums">{wordCount} words</span>
        </div>
        <p className="text-xs sm:text-sm text-neutral-200 line-clamp-2 italic">
          “{learnerResponse}”
        </p>
      </div>

      {/* 4 Measured Dimensions in a tight 4-col strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-[#111111] p-2.5">
          <p className="text-[10px] font-mono uppercase text-neutral-400">Directness</p>
          <p
            className={cn(
              "mt-0.5 text-xs font-semibold truncate",
              hasDirectOpening ? "text-white" : "text-neutral-400"
            )}
          >
            {hasDirectOpening ? "Direct start" : "Stalled opener"}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#111111] p-2.5">
          <p className="text-[10px] font-mono uppercase text-neutral-400">Economy</p>
          <p
            className={cn(
              "mt-0.5 text-xs font-semibold font-mono tabular-nums truncate",
              wordEconomyGood ? "text-white" : "text-neutral-400"
            )}
          >
            {wordCount}/{targetMaxWords}w
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#111111] p-2.5">
          <p className="text-[10px] font-mono uppercase text-neutral-400">Fillers</p>
          <p
            className={cn(
              "mt-0.5 text-xs font-semibold font-mono tabular-nums truncate",
              totalFillerAndHedges === 0 ? "text-white" : "text-neutral-400"
            )}
          >
            {totalFillerAndHedges === 0 ? "0 detected" : `${totalFillerAndHedges} hedges`}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#111111] p-2.5">
          <p className="text-[10px] font-mono uppercase text-neutral-400">Evidence</p>
          <p
            className={cn(
              "mt-0.5 text-xs font-semibold truncate",
              hasConcreteNumbers ? "text-white" : "text-neutral-400"
            )}
          >
            {hasConcreteNumbers ? "Quantified" : "No baseline"}
          </p>
        </div>
      </div>

      {/* 1 Thing Done Well + 1 Improvement in tight 2 cols */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="rounded-xl border border-white/15 bg-white/[0.03] p-3 space-y-1">
          <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-300 font-semibold">
            Strong Reflex
          </p>
          <p className="text-xs text-white leading-relaxed line-clamp-2">{didWell}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#141414] p-3 space-y-1">
          <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
            Adjustment
          </p>
          <p className="text-xs text-neutral-300 leading-relaxed line-clamp-2">{toImprove}</p>
        </div>
      </div>

      {/* Suggested Rewrite (Compact) */}
      <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-3 space-y-1">
        <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
          Executive Benchmark
        </span>
        <p className="text-xs text-white font-medium italic line-clamp-2">
          “{suggestedRewrite}”
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-white/[0.08]">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="rounded-full border-white/15 bg-transparent text-xs text-white hover:bg-white/[0.06] h-8 px-3.5"
          >
            <RotateCcw className="mr-1.5 h-3 w-3" />
            Retry
          </Button>

          {onLaunchChamber && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={launchingChamber}
              onClick={onLaunchChamber}
              className="rounded-full border-white/15 bg-white/[0.04] text-xs text-white hover:bg-white/[0.09] h-8 px-3.5"
            >
              <Play className="mr-1.5 h-3 w-3 fill-current" />
              Role-Play Room
            </Button>
          )}
        </div>

        <Button
          type="button"
          size="sm"
          onClick={onCompleteLesson}
          className="rounded-full bg-white text-black hover:bg-neutral-200 text-xs font-bold h-8 px-4 shadow-md"
        >
          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
          Complete Lesson
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
