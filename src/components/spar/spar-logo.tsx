import { cn } from "@/lib/utils";

interface SparLogoProps {
  size?: "sm" | "md" | "lg";
  withTile?: boolean;
  variant?: "default" | "volt-tile" | "blades";
  className?: string;
}

const STANDALONE_SIZES: Record<NonNullable<SparLogoProps["size"]>, string> = {
  sm: "h-6 w-6",
  md: "h-7 w-7",
  lg: "h-9 w-9",
};

const VOLT_SVG_SIZES: Record<NonNullable<SparLogoProps["size"]>, string> = {
  sm: "h-7 w-7",
  md: "h-8 w-8",
  lg: "h-10 w-10",
};

const TILE_SIZES: Record<NonNullable<SparLogoProps["size"]>, string> = {
  sm: "h-8 w-8 rounded-lg",
  md: "h-9 w-9 rounded-lg",
  lg: "h-10 w-10 rounded-xl",
};

const MARK_SIZES: Record<NonNullable<SparLogoProps["size"]>, string> = {
  sm: "h-5 w-5",
  md: "h-6 w-6",
  lg: "h-6 w-6",
};

/** Custom Counter-Blades brand mark for Spar (matches src/app/icon.svg 1:1) */
export function SparLogo({
  size = "md",
  withTile = false,
  variant,
  className,
}: SparLogoProps) {
  const resolvedVariant = variant ?? (withTile ? "blades" : "volt-tile");
  const isVoltTile = resolvedVariant === "volt-tile" || resolvedVariant === "default";

  // Standalone Volt tile SVG — zero wrapper divs, matches browser favicon 1:1
  if (isVoltTile && !withTile) {
    return (
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className={cn("shrink-0", VOLT_SVG_SIZES[size], className)}
      >
        <rect width="40" height="40" rx="10" fill="#C6FF3D" />
        <g transform="translate(6 6) scale(0.7)">
          <path d="M4 8L25 2L35 11L14 17L4 8Z" fill="#0B0B0D" />
          <path d="M14 17L35 11L26 23L5 29L14 17Z" fill="#2E3D0B" />
          <path d="M5 29L26 23L36 32L15 38L5 29Z" fill="#1A2207" />
        </g>
      </svg>
    );
  }

  const topFill = isVoltTile ? "#0B0B0D" : "#F5F5F7";
  const middleFill = isVoltTile ? "#2E3D0B" : "#6B8E1A";
  const bottomFill = isVoltTile ? "#1A2207" : "#C6FF3D";

  const mark = (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn(
        "shrink-0",
        withTile ? MARK_SIZES[size] : STANDALONE_SIZES[size],
        !withTile && className,
      )}
    >
      <path d="M4 8L25 2L35 11L14 17L4 8Z" fill={topFill} />
      <path d="M14 17L35 11L26 23L5 29L14 17Z" fill={middleFill} />
      <path d="M5 29L26 23L36 32L15 38L5 29Z" fill={bottomFill} />
    </svg>
  );

  if (!withTile) {
    return mark;
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center",
        isVoltTile
          ? "border-2 border-[#D9FF73] bg-[#C6FF3D] shadow-[0_3px_0_0_#6B8E1A]"
          : "border border-[var(--border-subtle)] bg-[var(--surface-1)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]",
        TILE_SIZES[size],
        className,
      )}
    >
      {mark}
    </div>
  );
}
