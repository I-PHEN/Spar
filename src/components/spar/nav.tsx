"use client";

import { Swords, Home, Target, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavView = "home" | "practice" | "coach" | "progress";

interface NavProps {
  current: NavView | "sparring" | "debrief";
  onNavigate: (view: NavView) => void;
}

// Per user spec: Home, Practice (Swords), Coach (Target), Progress (TrendingUp)
const NAV_ITEMS: Array<{ key: NavView; label: string; icon: typeof Home }> = [
  { key: "home", label: "Home", icon: Home },
  { key: "practice", label: "Practice", icon: Swords },
  { key: "coach", label: "Coach", icon: Target },
  { key: "progress", label: "Progress", icon: TrendingUp },
];

/**
 * Nav: desktop top bar + mobile bottom bar.
 *
 * Both use a premium glass effect:
 *   - Semi-transparent background (content shows through subtly)
 *   - Heavy backdrop blur + saturation boost (the glass look)
 *   - Inset top highlight (light catching the top edge of the glass)
 *   - Subtle border to define the glass edge
 *
 * Mobile bottom nav per spec:
 *   fixed bottom-0, 64px, 4 items, active = white dot above icon + white text.
 */
export function Nav({ current, onNavigate }: NavProps) {
  const activeKey: NavView =
    current === "sparring" || current === "debrief" ? "practice" : current;

  return (
    <>
      {/* Desktop top bar — glass */}
      <header
        className="sticky top-0 z-30 hidden items-center justify-between px-6 py-3 md:flex"
        style={{
          background: "rgba(10, 10, 10, 0.55)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "inset 0 1px 0 0 rgba(255, 255, 255, 0.06)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-md bg-white/5 ring-1 ring-white/15">
            <Swords className="h-4 w-4 text-foreground" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-semibold tracking-tight text-foreground">
              Spar
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
              Sparring Room
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeKey === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                className={cn(
                  "group relative flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className={cn("h-4 w-4", isActive && "text-foreground")} />
                <span>{item.label}</span>
                {isActive && (
                  <span className="absolute -bottom-[13px] left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-full bg-foreground" />
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Mobile bottom nav — glass */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around pb-[env(safe-area-inset-bottom)] md:hidden"
        style={{
          background: "rgba(10, 10, 10, 0.65)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "inset 0 -1px 0 0 rgba(255, 255, 255, 0.04), 0 -8px 24px -12px rgba(0, 0, 0, 0.5)",
        }}
        aria-label="Primary navigation"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeKey === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={cn(
                "flex min-h-[48px] min-w-[48px] flex-col items-center justify-center gap-1 transition-colors",
                isActive ? "text-white" : "text-neutral-500"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {/* Active indicator: 4px dot above icon */}
              {isActive && (
                <span className="mb-0.5 h-1 w-1 rounded-full bg-white" />
              )}
              {!isActive && <span className="mb-0.5 h-1 w-1" />}
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
