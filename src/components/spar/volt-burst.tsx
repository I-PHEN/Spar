"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const VOLT_SPARKS = [
  { dx: -76, dy: -46, size: 7, color: "#C6FF3D", rotate: -35, delay: 0 },
  { dx: -44, dy: -62, size: 5, color: "#F5F5F7", rotate: 20, delay: 0.03 },
  { dx: 12, dy: -64, size: 8, color: "#C6FF3D", rotate: 45, delay: 0.01 },
  { dx: 58, dy: -52, size: 6, color: "#A3E635", rotate: -20, delay: 0.05 },
  { dx: 86, dy: -22, size: 7, color: "#C6FF3D", rotate: 30, delay: 0.02 },
  { dx: -88, dy: -8, size: 5, color: "#A3E635", rotate: 15, delay: 0.06 },
  { dx: -56, dy: 20, size: 6, color: "#F5F5F7", rotate: -40, delay: 0.04 },
  { dx: 42, dy: 22, size: 5, color: "#C6FF3D", rotate: 25, delay: 0.07 },
  { dx: 82, dy: 12, size: 6, color: "#F5F5F7", rotate: -15, delay: 0.03 },
  { dx: -16, dy: -56, size: 5, color: "#C6FF3D", rotate: 50, delay: 0.08 },
] as const;

/** Lightweight one-shot Electric Volt celebration burst (respects reduced motion). */
export function VoltBurst({
  active = true,
  className,
}: {
  active?: boolean;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  if (!active || prefersReducedMotion) return null;

  return (
    <div
      aria-hidden="true"
      data-testid="volt-burst"
      className={cn("pointer-events-none absolute inset-0 overflow-visible", className)}
    >
      {VOLT_SPARKS.map((spark, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0, scale: 0.4, x: 0, y: 0, rotate: 0 }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0.5, 1.15, 0.3],
            x: spark.dx,
            y: spark.dy,
            rotate: spark.rotate,
          }}
          transition={{
            duration: 0.75,
            delay: spark.delay,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="absolute left-0 top-0 inline-block rounded-[2px]"
          style={{
            width: spark.size,
            height: spark.size,
            backgroundColor: spark.color,
          }}
        />
      ))}
    </div>
  );
}
