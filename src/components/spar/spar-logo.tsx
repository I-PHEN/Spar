import { cn } from "@/lib/utils";

interface SparLogoProps {
  size?: "sm" | "md" | "lg";
  withTile?: boolean;
  className?: string;
}

const STANDALONE_SIZES: Record<NonNullable<SparLogoProps["size"]>, string> = {
  sm: "h-6 w-6",
  md: "h-7 w-7",
  lg: "h-9 w-9",
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

/** Custom Counter-Blades brand mark for Spar */
export function SparLogo({
  size = "md",
  withTile = false,
  className,
}: SparLogoProps) {
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
      <path d="M4 8L25 2L35 11L14 17L4 8Z" fill="#F5F5F7" />
      <path d="M14 17L35 11L26 23L5 29L14 17Z" fill="#1D4ED8" />
      <path d="M5 29L26 23L36 32L15 38L5 29Z" fill="#2F65F6" />
    </svg>
  );

  if (!withTile) {
    return mark;
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center border border-[var(--border-subtle)] bg-[var(--surface-1)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]",
        TILE_SIZES[size],
        className,
      )}
    >
      {mark}
    </div>
  );
}
