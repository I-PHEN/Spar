"use client";

import { Sword, Home, Dumbbell, GraduationCap, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavView = "home" | "practice" | "coach" | "progress";

interface NavProps {
  current: NavView | "sparring" | "debrief";
  onNavigate: (view: NavView) => void;
}

const NAV_ITEMS: Array<{ key: NavView; label: string; icon: typeof Home }> = [
  { key: "home", label: "Home", icon: Home },
  { key: "practice", label: "Practice", icon: Dumbbell },
  { key: "coach", label: "Coach", icon: GraduationCap },
  { key: "progress", label: "Progress", icon: TrendingUp },
];

/**
 * The 4-item nav. Clean. Purposeful. No more.
 * Per brief section 2: Home / Practice / Coach / Progress.
 * Coach and Progress are placeholders in v1 (clickable but show "coming soon").
 */
export function Nav({ current, onNavigate }: NavProps) {
  // Map sparring → practice (sparring is a sub-state of practice)
  const activeKey: NavView =
    current === "sparring" || current === "debrief" ? "practice" : current;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/80 backdrop-blur-md px-4 sm:px-6 py-3">
      <div className="flex items-center gap-2.5">
        <div className="relative flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/30">
          <Sword className="h-4 w-4 text-primary" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-semibold tracking-tight text-foreground">
            SharkPit
          </span>
          <span className="hidden sm:inline text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
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
                "group relative flex items-center gap-2 rounded-md px-2.5 sm:px-3 py-1.5 text-sm transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className={cn("h-4 w-4", isActive && "text-primary")} />
              <span className="hidden sm:inline">{item.label}</span>
              {isActive && (
                <span className="absolute -bottom-[13px] left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
