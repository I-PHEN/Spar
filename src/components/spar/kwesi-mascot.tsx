"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export type KwesiPose =
  | "hype"
  | "listening"
  | "proud"
  | "thinking"
  | "shake-it-off";

export type KwesiVariant = "cornerman" | "strategist";
export type KwesiSize = "sm" | "md" | "lg" | "xl";

export interface KwesiProps {
  /** Emotional/coaching state (maps 1:1 to a future Rive state machine input). */
  pose?: KwesiPose;
  /** Visual character take: "cornerman" (towel) vs "strategist" (headband & mic). */
  variant?: KwesiVariant;
  /** Display footprint for the SVG avatar. */
  size?: KwesiSize;
  /** Optional short gritty-warm coaching line shown in a chunky speech bubble. */
  line?: string;
  /** Optional header tag inside the speech bubble (defaults to "KWESI · COACH"). */
  badgeLabel?: string;
  /** Whether to show the Kwesi corner badge above the speech line. */
  showNameBadge?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<KwesiSize, string> = {
  sm: "h-16 w-16",
  md: "h-24 w-24",
  lg: "h-32 w-32",
  xl: "h-40 w-40",
};

const POSE_LABELS: Record<KwesiPose, string> = {
  hype: "Kwesi pumped up in your corner",
  listening: "Kwesi listening closely",
  proud: "Kwesi nodding proudly",
  thinking: "Kwesi analyzing the next move",
  "shake-it-off": "Kwesi signaling to shake it off and reset",
};

function KwesiEffects({ pose }: { pose: KwesiPose }) {
  if (pose === "hype") {
    return (
      <g aria-hidden="true">
        {/* Electric Volt spark bolts */}
        <path
          d="M18 34L25 22L22 31L29 31L20 43L23 34H18Z"
          fill="#C6FF3D"
        />
        <path
          d="M100 26L107 16L104 24L110 24L102 35L105 26H100Z"
          fill="#C6FF3D"
        />
        <circle cx="24" cy="18" r="2.5" fill="#C6FF3D" opacity="0.85" />
        <circle cx="96" cy="44" r="2" fill="#C6FF3D" opacity="0.7" />
      </g>
    );
  }

  if (pose === "listening") {
    return (
      <g aria-hidden="true">
        {/* Subtle listening radar arcs */}
        <path
          d="M16 52C12 46 12 38 16 32"
          stroke="#C6FF3D"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.75"
        />
        <path
          d="M10 57C4 48 4 36 10 27"
          stroke="#C6FF3D"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.4"
        />
      </g>
    );
  }

  if (pose === "proud") {
    return (
      <g aria-hidden="true">
        {/* Volt star bursts */}
        <path
          d="M21 20L23.5 26.5L30 29L23.5 31.5L21 38L18.5 31.5L12 29L18.5 26.5L21 20Z"
          fill="#C6FF3D"
        />
        <path
          d="M99 18L100.8 22.2L105 24L100.8 25.8L99 30L97.2 25.8L93 24L97.2 22.2L99 18Z"
          fill="#C6FF3D"
          opacity="0.9"
        />
      </g>
    );
  }

  if (pose === "thinking") {
    return (
      <g aria-hidden="true">
        {/* Tactical thought dots */}
        <circle cx="94" cy="34" r="2.5" fill="#C6FF3D" opacity="0.55" />
        <circle cx="101" cy="26" r="3.5" fill="#C6FF3D" opacity="0.8" />
        <circle cx="109" cy="17" r="4.5" fill="#C6FF3D" />
      </g>
    );
  }

  // shake-it-off: warm Ember + Volt reset arcs
  return (
    <g aria-hidden="true">
      <path
        d="M14 68C10 56 11 42 18 32"
        stroke="#FF5A1F"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M106 68C110 56 109 42 102 32"
        stroke="#C6FF3D"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.85"
      />
    </g>
  );
}

function KwesiFace({
  pose,
  variant,
}: {
  pose: KwesiPose;
  variant: KwesiVariant;
}) {
  const skinBase = variant === "cornerman" ? "#7A4B2E" : "#835233";
  const skinShadow = variant === "cornerman" ? "#5E3720" : "#643B22";
  const skinHighlight = variant === "cornerman" ? "#935C3B" : "#9B6341";

  const eyeShiftX = pose === "thinking" ? 2.2 : pose === "listening" ? -1.2 : 0;
  const eyeShiftY = pose === "thinking" ? -1.5 : 0;

  return (
    <g>
      {/* Ears */}
      <circle cx="33" cy="54" r="6.5" fill={skinShadow} />
      <circle cx="87" cy="54" r="6.5" fill={skinShadow} />

      {/* Neck */}
      <rect x="49" y="75" width="22" height="16" rx="8" fill={skinShadow} />

      {/* Head */}
      <rect
        x="34"
        y="25"
        width="52"
        height="55"
        rx="24"
        fill={skinBase}
        stroke="#0B0B0D"
        strokeWidth="2.5"
      />
      {/* Subtle chin/jaw contour */}
      <path
        d="M37 60C41 73 50 78 60 78C70 78 79 73 83 60C77 68 69 72 60 72C51 72 43 68 37 60Z"
        fill={skinShadow}
        opacity="0.55"
      />
      {/* Brow warmth */}
      <ellipse
        cx="52"
        cy="36"
        rx="11"
        ry="4.5"
        fill={skinHighlight}
        opacity="0.35"
      />

      {/* Hair & Headgear */}
      {variant === "cornerman" ? (
        <g>
          {/* Short cropped cornerman cut + silver temple character */}
          <path
            d="M34 45C34 29 44 20 60 20C76 20 86 29 86 45C83 37 74 33 60 33C46 33 37 37 34 45Z"
            fill="#17171B"
            stroke="#0B0B0D"
            strokeWidth="2"
          />
          <path
            d="M35 42C36 37 38 35 41 34L39 43Z"
            fill="#D4D4D8"
            opacity="0.75"
          />
          <path
            d="M85 42C84 37 82 35 79 34L81 43Z"
            fill="#D4D4D8"
            opacity="0.75"
          />
        </g>
      ) : (
        <g>
          {/* Geometric fade + Electric Volt headband + corner headset */}
          <path
            d="M35 37C35 24 44 17 60 17C76 17 85 24 85 37H35Z"
            fill="#16161B"
            stroke="#0B0B0D"
            strokeWidth="2"
          />
          {/* Volt athletic headband */}
          <rect
            x="33"
            y="32"
            width="54"
            height="9"
            rx="4.5"
            fill="#C6FF3D"
            stroke="#0B0B0D"
            strokeWidth="2"
          />
          <rect x="35" y="37.5" width="50" height="2.5" rx="1" fill="#6B8E1A" />
          {/* Corner coach headset & boom mic */}
          <rect
            x="83"
            y="45"
            width="7"
            height="14"
            rx="3.5"
            fill="#18181D"
            stroke="#C6FF3D"
            strokeWidth="1.5"
          />
          <path
            d="M86 58C86 67 79 70 69 70"
            stroke="#26262E"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="67" cy="70" r="2.6" fill="#C6FF3D" />
        </g>
      )}

      {/* Eyebrows */}
      {pose === "hype" && (
        <g stroke="#141110" strokeWidth="3.2" strokeLinecap="round">
          <path d="M43 44L54 42" />
          <path d="M66 42L77 44" />
        </g>
      )}
      {pose === "listening" && (
        <g stroke="#141110" strokeWidth="3" strokeLinecap="round">
          <path d="M43 45H54" />
          <path d="M66 45H77" />
        </g>
      )}
      {pose === "proud" && (
        <g stroke="#141110" strokeWidth="3" strokeLinecap="round">
          <path d="M43 44C46 42 51 42 54 44" />
          <path d="M66 44C69 42 74 42 77 44" />
        </g>
      )}
      {pose === "thinking" && (
        <g stroke="#141110" strokeWidth="3" strokeLinecap="round">
          <path d="M43 46L54 45" />
          <path d="M66 42C70 40 74 41 77 43" />
        </g>
      )}
      {pose === "shake-it-off" && (
        <g stroke="#141110" strokeWidth="3" strokeLinecap="round">
          <path d="M43 46C46 44 50 44 54 45" />
          <path d="M66 45C70 44 74 44 77 46" />
        </g>
      )}

      {/* Eyes */}
      <g>
        {/* Left eye */}
        <circle cx="49" cy="52" r="4.8" fill="#F5F5F7" />
        <circle
          cx={49 + eyeShiftX}
          cy={52 + eyeShiftY}
          r="2.7"
          fill="#0B0B0D"
        />
        <circle
          cx={49.9 + eyeShiftX}
          cy={50.9 + eyeShiftY}
          r="0.9"
          fill="#FFFFFF"
        />

        {/* Right eye (proud does a confident wink) */}
        {pose === "proud" ? (
          <path
            d="M66 52C68.5 49 73.5 49 76 52"
            stroke="#0B0B0D"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        ) : (
          <>
            <circle cx="71" cy="52" r="4.8" fill="#F5F5F7" />
            <circle
              cx={71 + eyeShiftX}
              cy={52 + eyeShiftY}
              r="2.7"
              fill="#0B0B0D"
            />
            <circle
              cx={71.9 + eyeShiftX}
              cy={50.9 + eyeShiftY}
              r="0.9"
              fill="#FFFFFF"
            />
          </>
        )}
      </g>

      {/* Nose */}
      <path
        d="M58 54C57 58 58 60 60 60C62 60 63 58 62 54"
        stroke={skinShadow}
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* Mouth per pose */}
      {pose === "hype" && (
        <path
          d="M49 64C52 71 68 71 71 64H49Z"
          fill="#F5F5F7"
          stroke="#0B0B0D"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}
      {pose === "listening" && (
        <path
          d="M54 66H66"
          stroke="#1B120E"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      )}
      {pose === "proud" && (
        <path
          d="M50 64C54 70 66 70 70 64"
          stroke="#F5F5F7"
          strokeWidth="3"
          strokeLinecap="round"
        />
      )}
      {pose === "thinking" && (
        <path
          d="M54 66C57 65 62 65 65 67"
          stroke="#1B120E"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      )}
      {pose === "shake-it-off" && (
        <path
          d="M52 65C56 68 64 68 68 65"
          stroke="#1B120E"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      )}
    </g>
  );
}

function KwesiTorsoAndHands({
  pose,
  variant,
}: {
  pose: KwesiPose;
  variant: KwesiVariant;
}) {
  return (
    <g>
      {/* Shoulders / Vest or Corner Jacket */}
      <path
        d="M24 114C24 94 38 84 60 84C82 84 96 94 96 114H24Z"
        fill="#18181D"
        stroke="#0B0B0D"
        strokeWidth="2.5"
      />

      {variant === "cornerman" ? (
        <g>
          {/* Signature Electric Volt corner towel draped around neck */}
          <path
            d="M39 85C43 97 45 108 44 114H54C55 105 53 93 48 83L39 85Z"
            fill="#C6FF3D"
            stroke="#0B0B0D"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M81 85C77 97 75 108 76 114H66C65 105 67 93 72 83L81 85Z"
            fill="#C6FF3D"
            stroke="#0B0B0D"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Deep olive towel stripe */}
          <path d="M45 105H53" stroke="#6B8E1A" strokeWidth="3" />
          <path d="M67 105H75" stroke="#6B8E1A" strokeWidth="3" />
          {/* Inner dark tee */}
          <path d="M51 86L60 95L69 86" fill="#27272F" />
        </g>
      ) : (
        <g>
          {/* High-collar Fight-Night track jacket with Volt zip */}
          <path
            d="M44 84L60 94L76 84"
            fill="none"
            stroke="#C6FF3D"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <line
            x1="60"
            y1="94"
            x2="60"
            y2="114"
            stroke="#C6FF3D"
            strokeWidth="2.5"
          />
          <rect x="29" y="96" width="8" height="3" rx="1.5" fill="#C6FF3D" />
          <rect x="83" y="96" width="8" height="3" rx="1.5" fill="#C6FF3D" />
        </g>
      )}

      {/* Taped trainer hands per pose */}
      {pose === "hype" && (
        <g>
          {/* Double fist pump */}
          <rect
            x="17"
            y="71"
            width="16"
            height="17"
            rx="6"
            fill="#F5F5F7"
            stroke="#0B0B0D"
            strokeWidth="2.2"
          />
          <rect x="17" y="84" width="16" height="5" rx="2" fill="#C6FF3D" />
          <rect
            x="87"
            y="67"
            width="16"
            height="17"
            rx="6"
            fill="#F5F5F7"
            stroke="#0B0B0D"
            strokeWidth="2.2"
          />
          <rect x="87" y="80" width="16" height="5" rx="2" fill="#C6FF3D" />
        </g>
      )}

      {pose === "listening" && (
        <g>
          {/* Hand raised attentively near ear */}
          <rect
            x="19"
            y="61"
            width="13"
            height="16"
            rx="6"
            fill="#F5F5F7"
            stroke="#0B0B0D"
            strokeWidth="2.2"
          />
          <rect x="19" y="74" width="13" height="4" rx="2" fill="#C6FF3D" />
        </g>
      )}

      {pose === "proud" && (
        <g>
          {/* Thumbs-up / fist bump forward */}
          <rect
            x="83"
            y="74"
            width="18"
            height="17"
            rx="6"
            fill="#F5F5F7"
            stroke="#0B0B0D"
            strokeWidth="2.2"
          />
          <rect
            x="86"
            y="64"
            width="7"
            height="12"
            rx="3.5"
            fill="#F5F5F7"
            stroke="#0B0B0D"
            strokeWidth="2"
          />
          <rect x="83" y="87" width="18" height="4.5" rx="2" fill="#C6FF3D" />
        </g>
      )}

      {pose === "thinking" && (
        <g>
          {/* Fist resting under chin */}
          <rect
            x="51"
            y="75"
            width="18"
            height="14"
            rx="6"
            fill="#F5F5F7"
            stroke="#0B0B0D"
            strokeWidth="2.2"
          />
          <rect x="52" y="86" width="16" height="4" rx="2" fill="#C6FF3D" />
        </g>
      )}

      {pose === "shake-it-off" && (
        <g>
          {/* Open palms signaling calm reset */}
          <rect
            x="17"
            y="84"
            width="18"
            height="11"
            rx="5.5"
            fill="#F5F5F7"
            stroke="#0B0B0D"
            strokeWidth="2.2"
          />
          <rect x="19" y="92" width="14" height="3.5" rx="1.5" fill="#FF5A1F" />
          <rect
            x="85"
            y="84"
            width="18"
            height="11"
            rx="5.5"
            fill="#F5F5F7"
            stroke="#0B0B0D"
            strokeWidth="2.2"
          />
          <rect x="87" y="92" width="14" height="3.5" rx="1.5" fill="#FF5A1F" />
        </g>
      )}
    </g>
  );
}

/**
 * Kwesi — Spar's corner-coach mascot (V1 SVG + Framer Motion).
 * Props are designed so a V2 Rive state machine can replace the inner renderer
 * without changing any screen integrations.
 */
export function Kwesi({
  pose = "hype",
  variant = "cornerman",
  size = "md",
  line,
  badgeLabel = "KWESI · COACH",
  showNameBadge = true,
  className,
}: KwesiProps) {
  const reducedMotion = useReducedMotion();

  const idleMotion = reducedMotion
    ? undefined
    : pose === "hype"
      ? { y: [0, -4, 0], scaleY: [1, 1.03, 0.98, 1] }
      : pose === "listening"
        ? { rotate: [0, -2.5, 0], y: [0, -1.5, 0] }
        : pose === "proud"
          ? { y: [0, -3, 0], scale: [1, 1.02, 1] }
          : pose === "thinking"
            ? { rotate: [0, 1.8, 0] }
            : { x: [0, -2, 2, 0] };

  const avatar = (
    <motion.div
      data-testid="kwesi-avatar"
      data-pose={pose}
      data-variant={variant}
      animate={idleMotion}
      transition={
        reducedMotion
          ? undefined
          : {
              duration: pose === "hype" ? 1.5 : 2.8,
              repeat: Infinity,
              ease: "easeInOut",
            }
      }
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-2)] shadow-[0_4px_0_0_#060608]",
        pose === "shake-it-off"
          ? "border-[#FF5A1F]/70"
          : "border-[#C6FF3D]/60",
        SIZE_CLASSES[size],
      )}
    >
      <svg
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={POSE_LABELS[pose]}
        className="h-full w-full"
      >
        <defs>
          <radialGradient id={`kwesi-glow-${variant}-${pose}`} cx="50%" cy="45%" r="50%">
            <stop
              offset="0%"
              stopColor={pose === "shake-it-off" ? "#FF5A1F" : "#C6FF3D"}
              stopOpacity="0.22"
            />
            <stop offset="100%" stopColor="#0B0B0D" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle
          cx="60"
          cy="58"
          r="52"
          fill={`url(#kwesi-glow-${variant}-${pose})`}
        />
        <KwesiEffects pose={pose} />
        <KwesiTorsoAndHands pose={pose} variant={variant} />
        <KwesiFace pose={pose} variant={variant} />
      </svg>
    </motion.div>
  );

  if (!line) {
    return (
      <div className={cn("inline-flex items-center", className)}>{avatar}</div>
    );
  }

  return (
    <div
      className={cn("flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4", className)}
    >
      {avatar}
      <div className="relative rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-2)] px-4 py-3 shadow-[0_4px_0_0_#060608]">
        {showNameBadge && (
          <div className="mb-1 flex items-center gap-1.5">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                pose === "shake-it-off" ? "bg-[#FF5A1F]" : "bg-[#C6FF3D]",
              )}
            />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#C6FF3D]">
              {badgeLabel}
            </span>
          </div>
        )}
        <p className="text-sm font-medium leading-snug text-[#F5F5F7]">
          &ldquo;{line}&rdquo;
        </p>
      </div>
    </div>
  );
}
