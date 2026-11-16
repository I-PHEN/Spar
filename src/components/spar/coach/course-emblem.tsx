"use client";

import React from "react";
import {
  Compass,
  Flame,
  MessageSquare,
  Shield,
  Sparkles,
  Swords,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface CourseEmblemProps {
  category: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

/** Icon resolver mapping course category / topic to a tailored duotone icon */
export function getCourseEmblemIcon(category: string, iconClass: string) {
  const lower = category.toLowerCase();
  if (lower.includes("pressure") || lower.includes("recovery") || lower.includes("fire")) {
    return <Zap className={iconClass} />;
  }
  if (lower.includes("q&a") || lower.includes("defense") || lower.includes("boardroom")) {
    return <Shield className={iconClass} />;
  }
  if (lower.includes("communication") || lower.includes("vocal") || lower.includes("concision")) {
    return <MessageSquare className={iconClass} />;
  }
  if (lower.includes("strategy") || lower.includes("instinct") || lower.includes("presence")) {
    return <Compass className={iconClass} />;
  }
  return <Swords className={iconClass} />;
}

export function CourseEmblem({
  category,
  size = "md",
  className,
}: CourseEmblemProps) {
  const sizeClasses = {
    sm: "h-11 w-11",
    md: "h-16 w-16",
    lg: "h-[72px] w-[72px]",
    xl: "h-20 w-20",
  }[size];

  const iconSizes = {
    sm: "h-5 w-5",
    md: "h-7 w-7",
    lg: "h-8 w-8",
    xl: "h-9 w-9",
  }[size];

  const cornerClass = size === "sm" ? "rounded-xl" : "rounded-[18px]";
  const backOffsetClass =
    size === "sm"
      ? "translate-x-1 translate-y-1 rotate-[5deg]"
      : "translate-x-1.5 translate-y-1.5 rotate-[6deg]";

  return (
    <div className={cn("relative flex-shrink-0 select-none", sizeClasses, className)}>
      {/* Background stacked tile (offset & rotated for physical depth) */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 border border-[var(--border-subtle)] bg-[var(--surface-1)] opacity-40 transition-transform duration-300",
          cornerClass,
          backOffsetClass
        )}
        style={{
          boxShadow: "0 6px 16px -6px rgba(0,0,0,0.7)",
        }}
      />

      {/* Front primary emblem tile */}
      <div
        className={cn(
          "relative flex h-full w-full items-center justify-center border border-[var(--border-subtle)] bg-[var(--surface-2)] transition-transform duration-200 group-hover:scale-[1.02]",
          cornerClass,
          "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_8px_20px_-8px_rgba(0,0,0,0.6)]"
        )}
        style={{
          backgroundImage:
            "linear-gradient(135deg, var(--surface-2) 0%, rgba(47, 101, 246, 0.14) 100%)",
        }}
      >
        {/* Subtle radial inner sheen */}
        <div
          aria-hidden="true"
          className={cn("pointer-events-none absolute inset-0 opacity-40", cornerClass)}
          style={{
            background:
              "radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.12), transparent 60%)",
          }}
        />

        {/* Duotone Accent Icon */}
        <div className="relative z-10 text-[var(--accent)]">
          {getCourseEmblemIcon(category, iconSizes)}
        </div>
      </div>
    </div>
  );
}
