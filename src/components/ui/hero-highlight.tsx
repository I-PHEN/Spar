"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { cn } from "@/lib/utils";

interface HeroHighlightProps {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
}

/**
 * Interactive dot-matrix stage with radial edge vignette and a cursor-tracked
 * Spar cobalt reveal layer, adapted from Aceternity HeroHighlight.
 */
export function HeroHighlight({
  children,
  className,
  containerClassName,
}: HeroHighlightProps) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const prefersReducedMotion = useReducedMotion();

  const spotlightMask = useMotionTemplate`
    radial-gradient(
      200px circle at ${mouseX}px ${mouseY}px,
      black 0%,
      transparent 85%
    )
  `;

  function handleMouseMove({ currentTarget, clientX, clientY }: MouseEvent<HTMLDivElement>) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  return (
    <div
      onMouseMove={prefersReducedMotion ? undefined : handleMouseMove}
      className={cn(
        "group relative flex w-full items-center justify-center overflow-hidden bg-transparent py-10 sm:py-12",
        containerClassName,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_45%,transparent_100%)]"
      >
        <div className="absolute inset-0 bg-dot-thick-neutral opacity-65" />
        {!prefersReducedMotion && (
          <motion.div
            className="absolute inset-0 bg-dot-thick-cobalt opacity-0 transition duration-300 group-hover:opacity-100"
            style={{
              WebkitMaskImage: spotlightMask,
              maskImage: spotlightMask,
            }}
          />
        )}
      </div>

      <div className={cn("relative z-10 w-full", className)}>{children}</div>
    </div>
  );
}

interface HighlightProps {
  children: ReactNode;
  className?: string;
}

/** Compute normalized 0..1 highlight sweep progress from scroll position. */
export function computeHighlightProgress(
  scrollY: number,
  startScroll: number,
  endScroll: number,
): number {
  if (scrollY <= 4 || scrollY <= startScroll) return 0;
  if (endScroll <= startScroll) return 1;
  return Math.min(1, Math.max(0, (scrollY - startScroll) / (endScroll - startScroll)));
}

/**
 * Scroll-linked reversible cobalt highlight: sweeps left-to-right while scrolling
 * down toward the quote, and smoothly reverses back to unhighlighted at page top.
 */
export function Highlight({ children, className }: HighlightProps) {
  const prefersReducedMotion = useReducedMotion();
  const spanRef = useRef<HTMLSpanElement>(null);
  const rangeRef = useRef<{ start: number; end: number }>({
    start: 20,
    end: 240,
  });

  const { scrollY } = useScroll();
  const rawProgress = useMotionValue(prefersReducedMotion ? 1 : 0);

  useEffect(() => {
    if (prefersReducedMotion) {
      rawProgress.set(1);
      return;
    }

    function measureRange() {
      const node = spanRef.current;
      if (!node) return;
      const docTop = node.getBoundingClientRect().top + window.scrollY;
      const vh = window.innerHeight || 800;
      const start = Math.max(20, Math.round(docTop - vh * 0.88));
      const end = Math.max(start + 140, Math.round(docTop - vh * 0.48));
      rangeRef.current = { start, end };
      rawProgress.set(computeHighlightProgress(window.scrollY, start, end));
    }

    measureRange();
    window.addEventListener("resize", measureRange);
    return () => window.removeEventListener("resize", measureRange);
  }, [prefersReducedMotion, rawProgress]);

  useMotionValueEvent(scrollY, "change", (latestY) => {
    if (prefersReducedMotion) return;
    const { start, end } = rangeRef.current;
    rawProgress.set(computeHighlightProgress(latestY, start, end));
  });

  const smoothProgress = useSpring(rawProgress, {
    stiffness: 260,
    damping: 32,
    mass: 0.4,
  });
  const widthPercent = useTransform(smoothProgress, [0, 1], [0, 100]);
  const backgroundSize = useMotionTemplate`${widthPercent}% 100%`;

  return (
    <motion.span
      ref={spanRef}
      style={{
        backgroundSize,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "left center",
        display: "inline",
      }}
      className={cn(
        "relative rounded-md bg-gradient-to-r from-[#2F65F6]/35 to-[#1D4ED8]/45 px-2 py-0.5 text-[#F5F5F7] [box-decoration-break:clone]",
        className,
      )}
    >
      {children}
    </motion.span>
  );
}
