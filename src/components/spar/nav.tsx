"use client";

import { useEffect, useRef, useState } from "react";
import { Home, LogOut, Settings, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { SparLogo } from "./spar-logo";
import type { SettingsTabKey } from "./settings-view";

export type NavView = "home" | "practice" | "coach" | "progress" | "settings";

interface NavProps {
  current: NavView | "sparring" | "debrief";
  onNavigate: (view: NavView) => void;
  userName?: string;
  userEmail?: string;
  cloudSyncEnabled?: boolean;
  onOpenSettings?: (tab?: SettingsTabKey) => void;
  onSignOut?: () => void;
}

const NAV_ITEMS: Array<{ key: NavView; label: string; icon: typeof Home }> = [
  { key: "home", label: "Home", icon: Home },
  { key: "coach", label: "Coach", icon: Target },
];

function resolveDisplayName(userName?: string): string {
  const cleaned = userName?.trim() ?? "";
  if (!cleaned || cleaned === "there") {
    return "Account";
  }
  return cleaned;
}

function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return "AC";
}

interface ProfileMenuContentProps {
  displayName: string;
  initials: string;
  subtitle: string;
  signingOut: boolean;
  onSelectTab: (tab: SettingsTabKey) => void;
  onLogOut: () => void;
}

export function ProfileMenuContent({
  displayName,
  initials,
  subtitle,
  signingOut,
  onSelectTab,
  onLogOut,
}: ProfileMenuContentProps) {
  return (
    <div
      role="menu"
      aria-label="User profile menu"
      className="w-60 rounded-xl border border-[#2C2C31] bg-[#18181B] p-1.5 text-left shadow-2xl"
    >
      <div className="flex items-center gap-2.5 px-2.5 py-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2A2A30] text-xs font-semibold text-[#F4F4F5]">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[#F4F4F5]">
            {displayName}
          </p>
          <p className="truncate text-xs text-[#9E9EA7]">{subtitle}</p>
        </div>
      </div>

      <div className="my-1 border-t border-[#27272C]" />

      <button
        type="button"
        role="menuitem"
        onClick={() => onSelectTab("account")}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-[#E4E4E7] transition-colors hover:bg-[#242429] hover:text-white"
      >
        <Settings className="h-4 w-4 text-[#A1A1AA]" />
        <span>Settings</span>
      </button>

      <div className="my-1 border-t border-[#27272C]" />

      <button
        type="button"
        role="menuitem"
        disabled={signingOut}
        onClick={onLogOut}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-[#E4E4E7] transition-colors hover:bg-[#242429] hover:text-white disabled:opacity-50"
      >
        <LogOut className="h-4 w-4 text-[#A1A1AA]" />
        <span>{signingOut ? "Logging out..." : "Log out"}</span>
      </button>
    </div>
  );
}

export function Nav({
  current,
  onNavigate,
  userName,
  userEmail,
  cloudSyncEnabled = false,
  onOpenSettings,
  onSignOut,
}: NavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const desktopMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);

  const activeKey: NavView =
    current === "practice" || current === "sparring" || current === "debrief"
      ? "home"
      : current;

  const displayName = resolveDisplayName(userName);
  const initials = getInitials(displayName);
  const subtitle =
    userEmail?.trim() ||
    (cloudSyncEnabled ? "Cloud sync active" : "Local workspace");

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (desktopMenuRef.current?.contains(target)) return;
      if (mobileMenuRef.current?.contains(target)) return;
      setMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  function handleSelectTab(tab: SettingsTabKey) {
    setMenuOpen(false);
    if (onOpenSettings) {
      onOpenSettings(tab);
      return;
    }
    onNavigate("settings");
  }

  async function handleLogOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
    } catch {
      // Proceed with local cleanup even if request fails
    } finally {
      setSigningOut(false);
      setMenuOpen(false);
      onSignOut?.();
    }
  }

  return (
    <>
      {/* Desktop top bar — solid matte */}
      <header className="sticky top-0 z-30 hidden h-14 items-center justify-between border-b border-[#232327] bg-[#0E0E11] px-6 md:flex">
        <div className="flex items-center gap-2.5">
          <SparLogo size="sm" />
          <span className="font-semibold tracking-tight text-[#F4F4F5]">
            Spar
          </span>
        </div>

        <div className="flex items-center gap-3">
          <nav
            className="flex items-center gap-1"
            aria-label="Primary navigation"
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeKey === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onNavigate(item.key)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[#1F1F24] text-[#F4F4F5]"
                      : "text-[#9E9EA7] hover:bg-[#17171B] hover:text-[#F4F4F5]",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      isActive ? "text-[#F4F4F5]" : "text-[#8E8E98]",
                    )}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div ref={desktopMenuRef} className="relative flex items-center">
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              title={displayName}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Open user profile menu"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4F4F5]/40",
                menuOpen
                  ? "border-[#52525B] bg-[#2C2C33] text-white"
                  : "border-[#323238] bg-[#242429] text-[#F4F4F5] hover:border-[#4A4A54] hover:bg-[#2C2C33]",
              )}
            >
              {initials}
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full z-50 mt-2">
                <ProfileMenuContent
                  displayName={displayName}
                  initials={initials}
                  subtitle={subtitle}
                  signingOut={signingOut}
                  onSelectTab={handleSelectTab}
                  onLogOut={handleLogOut}
                />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile bottom nav — solid matte */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-[#232327] bg-[#0E0E11] pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeKey === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors",
                isActive ? "text-[#F4F4F5]" : "text-[#8E8E98]",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          );
        })}

        <div
          ref={mobileMenuRef}
          className="relative flex flex-1 justify-center"
        >
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Open user profile menu"
            className={cn(
              "flex w-full flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors",
              menuOpen ? "text-[#F4F4F5]" : "text-[#8E8E98]",
            )}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2A2A30] text-[10px] font-semibold text-[#F4F4F5]">
              {initials}
            </span>
            <span>Profile</span>
          </button>

          {menuOpen && (
            <div className="absolute bottom-full right-3 z-50 mb-2">
              <ProfileMenuContent
                displayName={displayName}
                initials={initials}
                subtitle={subtitle}
                signingOut={signingOut}
                onSelectTab={handleSelectTab}
                onLogOut={handleLogOut}
              />
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
