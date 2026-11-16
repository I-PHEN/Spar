"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Cloud,
  HardDrive,
  Loader2,
  LogOut,
  Mic,
  MicOff,
  Palette,
  Search,
  SlidersHorizontal,
  User,
  Volume2,
  X,
} from "lucide-react";
import {
  ACCENT_THEME_LIST,
  applyAccentTheme,
  type AccentThemeKey,
} from "@/lib/accent-themes";
import { DOMAIN_PRESET_LIST, type DomainKey } from "@/lib/domains";
import {
  DEFAULT_USER_PREFERENCES,
  derivePrimaryTrackFromDomain,
  readStoredUserPreferences,
  syncLastConfigFromPreferences,
  writeStoredUserPreferences,
  type DefaultModeKey,
  type PanelIntensityKey,
  type UserPreferences,
} from "@/lib/user-preferences";
import { VOICE_TONE_LIST, type VoiceToneKey } from "@/lib/voice-accents";
import { cn } from "@/lib/utils";

export type SettingsTabKey = "account" | "appearance" | "defaults" | "audio";

export interface SettingsViewProps {
  open?: boolean;
  initialTab?: SettingsTabKey;
  onClose?: () => void;
  userName: string;
  userEmail?: string;
  supabaseConfigured?: boolean;
  cloudSyncEnabled?: boolean;
  onUserUpdated: (name: string) => void;
  onSignOut: () => void;
}

const INTENSITY_OPTIONS: Array<{ key: PanelIntensityKey; label: string }> = [
  { key: "gentle", label: "Gentle" },
  { key: "moderate", label: "Moderate" },
  { key: "aggressive", label: "Aggressive" },
];

const MODE_OPTIONS: Array<{ key: DefaultModeKey; label: string }> = [
  { key: "open_spar", label: "Q&A" },
  { key: "drill", label: "Drill" },
];

const SETTINGS_TABS: Array<{
  key: SettingsTabKey;
  label: string;
  icon: typeof User;
  keywords: string;
}> = [
  {
    key: "account",
    label: "Account",
    icon: User,
    keywords: "account profile display name email sync cloud local sign out log out",
  },
  {
    key: "appearance",
    label: "Appearance",
    icon: Palette,
    keywords:
      "appearance accent color colour theme default blue green yellow pink orange display",
  },
  {
    key: "defaults",
    label: "Room Defaults",
    icon: SlidersHorizontal,
    keywords:
      "room defaults domain debate commercial academic interview mode q&a drill panel intensity gentle moderate aggressive",
  },
  {
    key: "audio",
    label: "Audio & Mic",
    icon: Mic,
    keywords:
      "audio mic microphone voice tone authoritative warm crisp auto-mic hands-free buzzer chime test sound",
  },
];

type SaveStatus = "idle" | "saving" | "saved" | "error";

function SolidSwitch({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
        checked ? "bg-[var(--accent)]" : "bg-[#38383E]",
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 rounded-full transition-transform",
          checked
            ? "translate-x-[18px] bg-[var(--accent-foreground)]"
            : "translate-x-[3px] bg-[#D4D4D8]",
        )}
      />
    </button>
  );
}

export function SettingsView({
  open = true,
  initialTab = "account",
  onClose,
  userName,
  userEmail: initialEmail = "",
  supabaseConfigured: initialSupabaseConfigured = false,
  cloudSyncEnabled: initialCloudSyncEnabled = false,
  onUserUpdated,
  onSignOut,
}: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabKey>(initialTab);
  const [searchQuery, setSearchQuery] = useState("");

  const [name, setName] = useState(userName);
  const [savedName, setSavedName] = useState(userName);
  const [email, setEmail] = useState<string>(initialEmail);
  const [supabaseConfigured, setSupabaseConfigured] = useState(
    initialSupabaseConfigured,
  );
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(
    initialCloudSyncEnabled,
  );
  const [prefs, setPrefs] = useState<Required<UserPreferences>>(() =>
    readStoredUserPreferences(),
  );
  const prefsRef = useRef<Required<UserPreferences>>(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [savingName, setSavingName] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Mic level check state
  const [micTesting, setMicTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAudioCtxRef = useRef<AudioContext | null>(null);
  const micRafRef = useRef<number | null>(null);

  const saveSeqRef = useRef(0);
  const savedTimerRef = useRef<number | null>(null);

  // Sync requested tab cleanly each time modal opens
  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab);
    setSearchQuery("");
    setError(null);
  }, [open, initialTab]);

  // Hydrate fresh account & preference state whenever Settings opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    fetch("/api/user")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        if (d.name && d.name !== "Founder") {
          setName(d.name);
          setSavedName(d.name);
        }
        if (typeof d.email === "string") setEmail(d.email);
        setSupabaseConfigured(Boolean(d.supabaseConfigured));
        setCloudSyncEnabled(Boolean(d.cloudSyncEnabled));
        if (d.preferences && typeof d.preferences === "object") {
          const synced = writeStoredUserPreferences(d.preferences);
          prefsRef.current = synced;
          setPrefs(synced);
          applyAccentTheme(synced.accentColor);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const stopMicCheck = useCallback(() => {
    if (micRafRef.current !== null) {
      cancelAnimationFrame(micRafRef.current);
      micRafRef.current = null;
    }
    if (micStreamRef.current) {
      for (const track of micStreamRef.current.getTracks()) {
        track.stop();
      }
      micStreamRef.current = null;
    }
    if (micAudioCtxRef.current) {
      void micAudioCtxRef.current.close().catch(() => {});
      micAudioCtxRef.current = null;
    }
    setMicTesting(false);
    setMicLevel(0);
  }, []);

  const handleClose = useCallback(() => {
    stopMicCheck();
    onClose?.();
  }, [onClose, stopMicCheck]);

  // Body scroll lock & Esc shortcut while modal is open
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, handleClose]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current !== null) {
        window.clearTimeout(savedTimerRef.current);
      }
      stopMicCheck();
    };
  }, [stopMicCheck]);

  // Filter sidebar tabs by search query and auto-focus matching tab
  const visibleTabs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return SETTINGS_TABS;
    return SETTINGS_TABS.filter(
      (t) =>
        t.label.toLowerCase().includes(q) || t.keywords.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  useEffect(() => {
    if (
      visibleTabs.length > 0 &&
      !visibleTabs.some((t) => t.key === activeTab)
    ) {
      setActiveTab(visibleTabs[0].key);
    }
  }, [visibleTabs, activeTab]);

  if (!open) return null;

  function markSavedBadge() {
    if (savedTimerRef.current !== null) {
      window.clearTimeout(savedTimerRef.current);
    }
    setSaveStatus("saved");
    savedTimerRef.current = window.setTimeout(() => {
      setSaveStatus((curr) => (curr === "saved" ? "idle" : curr));
    }, 2400);
  }

  async function updatePreference(patch: Partial<UserPreferences>) {
    setError(null);
    const derivedTrack = patch.defaultDomain
      ? { primaryTrack: derivePrimaryTrackFromDomain(patch.defaultDomain) }
      : {};
    const nextPrefs = writeStoredUserPreferences({
      ...prefsRef.current,
      ...patch,
      ...derivedTrack,
    });
    prefsRef.current = nextPrefs;
    setPrefs(nextPrefs);
    if (patch.accentColor !== undefined) {
      applyAccentTheme(nextPrefs.accentColor);
    }

    if (
      patch.defaultDomain !== undefined ||
      patch.defaultMode !== undefined ||
      patch.panelIntensity !== undefined
    ) {
      syncLastConfigFromPreferences(nextPrefs);
    }

    const seq = ++saveSeqRef.current;
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: nextPrefs }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to save preference");
      }
      if (seq === saveSeqRef.current) {
        if (typeof data.supabaseConfigured === "boolean") {
          setSupabaseConfigured(data.supabaseConfigured);
        }
        if (typeof data.cloudSyncEnabled === "boolean") {
          setCloudSyncEnabled(data.cloudSyncEnabled);
        }
        markSavedBadge();
      }
    } catch (err) {
      if (seq === saveSeqRef.current) {
        setSaveStatus("error");
        setError(
          err instanceof Error ? err.message : "Could not save preferences",
        );
      }
    }
  }

  async function handleSaveName(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Display name must be at least 2 characters.");
      return;
    }
    setSavingName(true);
    setSaveStatus("saving");
    setError(null);
    try {
      const res = await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Could not update display name");
      }
      const persistedName = data.name || trimmed;
      setName(persistedName);
      setSavedName(persistedName);
      if (typeof data.cloudSyncEnabled === "boolean") {
        setCloudSyncEnabled(data.cloudSyncEnabled);
      }
      onUserUpdated(persistedName);
      markSavedBadge();
    } catch (err) {
      setSaveStatus("error");
      setError(
        err instanceof Error ? err.message : "Failed to save display name",
      );
    } finally {
      setSavingName(false);
    }
  }

  function playTestChime() {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 90;
      osc.type = "sine";
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.42);
      osc.start();
      osc.stop(ctx.currentTime + 0.42);
      osc.onended = () => {
        void ctx.close().catch(() => {});
      };
    } catch {
      // Ignore browser audio errors
    }
  }

  async function toggleMicCheck() {
    if (micTesting) {
      stopMicCheck();
      return;
    }
    setMicError(null);
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setMicError("Microphone access is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) {
        setMicTesting(true);
        return;
      }

      const ctx = new AudioCtx();
      micAudioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      setMicTesting(true);

      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sumSq = 0;
        for (let i = 0; i < data.length; i++) {
          const centered = (data[i] - 128) / 128;
          sumSq += centered * centered;
        }
        const rms = Math.sqrt(sumSq / data.length);
        const scaled = Math.min(100, Math.round(rms * 340));
        setMicLevel(scaled);
        micRafRef.current = requestAnimationFrame(tick);
      };
      micRafRef.current = requestAnimationFrame(tick);
    } catch {
      stopMicCheck();
      setMicError(
        "Microphone permission denied or no input device available.",
      );
    }
  }

  async function handleSignOut() {
    stopMicCheck();
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
    } catch {
      // Proceed cleanly to local sign-out
    }
    onSignOut();
  }

  const nameDirty = name.trim() !== savedName.trim();
  const activeTabMeta =
    SETTINGS_TABS.find((t) => t.key === activeTab) ?? SETTINGS_TABS[0];
  const micStatusLabel = !micTesting
    ? "Check microphone input before entering a room"
    : micLevel > 82
      ? "Strong signal — avoid peaking"
      : micLevel >= 12
        ? "Clean voice level"
        : "Listening — speak normally";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          handleClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#1C1C1F] text-[#F4F4F5] sm:h-[580px] sm:max-h-[86vh] sm:max-w-[780px] sm:flex-row sm:rounded-2xl sm:border sm:border-[#2C2C31] sm:shadow-2xl"
      >
        {/* Left Navigation Rail (Solid Charcoal) */}
        <aside className="flex shrink-0 flex-col border-b border-[#26262A] bg-[#141416] sm:w-[228px] sm:border-b-0 sm:border-r">
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <h1
              id="settings-dialog-title"
              className="text-[15px] font-semibold tracking-tight text-[#F4F4F5]"
            >
              Settings
            </h1>
            {onClose && (
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close settings"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#A1A1AA] transition-colors hover:bg-[#2A2A2E] hover:text-[#F4F4F5] sm:hidden"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="px-3 pb-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#71717A]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search"
                aria-label="Search settings"
                className="h-8 w-full rounded-lg border border-[#2C2C31] bg-[#1E1E22] pl-8 pr-3 text-xs text-[#F4F4F5] placeholder:text-[#71717A] focus:border-[#52525B] focus:outline-none"
              />
            </div>
          </div>

          <nav
            aria-label="Settings sections"
            className="flex gap-1 overflow-x-auto px-3 pb-3 sm:flex-col sm:overflow-visible"
          >
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const selected = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors",
                    selected
                      ? "bg-[#2A2A2E] text-[#F4F4F5]"
                      : "text-[#A1A1AA] hover:bg-[#1E1E22] hover:text-[#F4F4F5]",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      selected ? "text-[#F4F4F5]" : "text-[#8E8E98]",
                    )}
                  />
                  <span>{tab.label}</span>
                </button>
              );
            })}
            {visibleTabs.length === 0 && (
              <p className="px-2.5 py-2 text-xs text-[#71717A]">
                No matching sections
              </p>
            )}
          </nav>
        </aside>

        {/* Right Content Pane (Shows one category at a time) */}
        <div className="flex min-w-0 flex-1 flex-col bg-[#1C1C1F]">
          <header className="flex shrink-0 items-center justify-between border-b border-[#26262A] px-6 py-4">
            <h2 className="text-[15px] font-semibold tracking-tight text-[#F4F4F5]">
              {activeTabMeta.label}
            </h2>

            <div className="flex items-center gap-3">
              {saveStatus === "saving" && (
                <span className="inline-flex items-center gap-1.5 text-xs text-[#A1A1AA]">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Saving...</span>
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-[#D4D4D8]">
                  <Check className="h-3.5 w-3.5 text-[#4ADE80]" />
                  <span>Saved</span>
                </span>
              )}
              {onClose && (
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close settings"
                  className="hidden h-7 w-7 items-center justify-center rounded-md text-[#A1A1AA] transition-colors hover:bg-[#2A2A2E] hover:text-[#F4F4F5] sm:inline-flex"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {error && (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-[#5C2B2E] bg-[#2D1A1C] px-3.5 py-2.5 text-xs text-[#FCA5A5]"
              >
                {error}
              </div>
            )}

            {/* Tab 1: Account */}
            {activeTab === "account" && (
              <div className="divide-y divide-[#26262A]">
                <form
                  onSubmit={handleSaveName}
                  className="flex flex-col gap-3 py-4 first:pt-1 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <label
                      htmlFor="settings-display-name"
                      className="text-sm font-medium text-[#F4F4F5]"
                    >
                      Display name
                    </label>
                    <p className="mt-0.5 text-xs text-[#8E8E98]">
                      Used by the panel and shown on your profile menu.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 sm:w-64">
                    <input
                      id="settings-display-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="h-9 min-w-0 flex-1 rounded-lg border border-[#34343A] bg-[#25252A] px-3 text-xs text-[#F4F4F5] placeholder:text-[#71717A] focus:border-[#52525B] focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={savingName || !nameDirty}
                      className={cn(
                        "inline-flex h-9 shrink-0 items-center justify-center rounded-lg px-3.5 text-xs font-medium transition-colors",
                        nameDirty && !savingName
                          ? "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]"
                          : "cursor-not-allowed border border-[#2C2C31] bg-[#25252A] text-[#71717A]",
                      )}
                    >
                      {savingName ? "Saving" : "Save"}
                    </button>
                  </div>
                </form>

                <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#F4F4F5]">
                      Workspace sync
                    </p>
                    <p className="mt-0.5 text-xs text-[#8E8E98]">
                      {email || "Local workspace identity"}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 self-start rounded-lg border border-[#2C2C31] bg-[#232328] px-3 py-1.5 text-xs font-medium text-[#E4E4E7] sm:self-center">
                    {cloudSyncEnabled ? (
                      <>
                        <Cloud className="h-3.5 w-3.5 text-[#4ADE80]" />
                        <span>Cloud Sync Active</span>
                      </>
                    ) : supabaseConfigured ? (
                      <>
                        <HardDrive className="h-3.5 w-3.5 text-[#D4D4D8]" />
                        <span>Local Session</span>
                      </>
                    ) : (
                      <>
                        <HardDrive className="h-3.5 w-3.5 text-[#8E8E98]" />
                        <span>Local Workspace Only</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <p className="text-sm font-medium text-[#F4F4F5]">
                      Session
                    </p>
                    <p className="mt-0.5 text-xs text-[#8E8E98]">
                      Log out of your account on this device.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#34343A] bg-[#25252A] px-3 text-xs font-medium text-[#E4E4E7] transition-colors hover:border-[#5C2B2E] hover:bg-[#2D1A1C] hover:text-[#FCA5A5]"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Log out</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: Appearance */}
            {activeTab === "appearance" && (
              <div className="divide-y divide-[#26262A]">
                <div className="space-y-4 py-4 first:pt-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#F4F4F5]">
                        Accent color
                      </p>
                      <p className="mt-0.5 text-xs text-[#8E8E98]">
                        Display color used for primary actions, focus rings, and active selections.
                      </p>
                    </div>
                    <span className="text-xs font-medium text-[#A1A1AA]">
                      {ACCENT_THEME_LIST.find((t) => t.key === prefs.accentColor)
                        ?.label ?? "Default"}
                    </span>
                  </div>

                  <div
                    role="radiogroup"
                    aria-label="Accent color"
                    className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                  >
                    {ACCENT_THEME_LIST.map((theme) => {
                      const selected = prefs.accentColor === theme.key;
                      return (
                        <button
                          key={theme.key}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          disabled={loading}
                          onClick={() =>
                            void updatePreference({
                              accentColor: theme.key as AccentThemeKey,
                            })
                          }
                          className={cn(
                            "flex items-center justify-between gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
                            selected
                              ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[#F4F4F5]"
                              : "border-[#2A2A2E] bg-[#161619] text-[#D4D4D8] hover:border-[#3A3A42] hover:bg-[#1E1E22] hover:text-white",
                          )}
                        >
                          <span className="flex items-center gap-2.5">
                            <span
                              aria-hidden="true"
                              className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/15"
                              style={{ backgroundColor: theme.swatch }}
                            />
                            <span>{theme.label}</span>
                          </span>
                          <Check
                            className={cn(
                              "h-3.5 w-3.5 shrink-0 transition-opacity",
                              selected
                                ? "text-[var(--accent-text)] opacity-100"
                                : "opacity-0",
                            )}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#F4F4F5]">
                      Live accent preview
                    </p>
                    <p className="mt-0.5 text-xs text-[#8E8E98]">
                      Applies immediately across buttons, switches, and progress indicators.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent-text)]">
                      Active filter
                    </span>
                    <span className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-foreground)]">
                      Start session
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Room Defaults */}
            {activeTab === "defaults" && (
              <div className="divide-y divide-[#26262A]">
                <div className="flex flex-col gap-3 py-4 first:pt-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#F4F4F5]">
                      Subject domain
                    </p>
                    <p className="mt-0.5 text-xs text-[#8E8E98]">
                      Default domain in Practice and track order in Coach.
                    </p>
                  </div>
                  <div className="inline-flex flex-wrap rounded-lg border border-[#2C2C31] bg-[#141416] p-1">
                    {DOMAIN_PRESET_LIST.map((domain) => {
                      const active = prefs.defaultDomain === domain.key;
                      return (
                        <button
                          key={domain.key}
                          type="button"
                          disabled={loading}
                          onClick={() =>
                            void updatePreference({
                              defaultDomain: domain.key as DomainKey,
                            })
                          }
                          className={cn(
                            "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                            active
                              ? "bg-[#2C2C32] text-[#F4F4F5]"
                              : "text-[#8E8E98] hover:text-[#F4F4F5]",
                          )}
                        >
                          {domain.shortLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#F4F4F5]">
                      Default mode
                    </p>
                    <p className="mt-0.5 text-xs text-[#8E8E98]">
                      Initial session style on new Practice setups.
                    </p>
                  </div>
                  <div className="inline-flex rounded-lg border border-[#2C2C31] bg-[#141416] p-1">
                    {MODE_OPTIONS.map((mode) => {
                      const active = prefs.defaultMode === mode.key;
                      return (
                        <button
                          key={mode.key}
                          type="button"
                          disabled={loading}
                          onClick={() =>
                            void updatePreference({ defaultMode: mode.key })
                          }
                          className={cn(
                            "rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors",
                            active
                              ? "bg-[#2C2C32] text-[#F4F4F5]"
                              : "text-[#8E8E98] hover:text-[#F4F4F5]",
                          )}
                        >
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#F4F4F5]">
                      Panel intensity
                    </p>
                    <p className="mt-0.5 text-xs text-[#8E8E98]">
                      Synced across every panel seat by default.
                    </p>
                  </div>
                  <div className="inline-flex rounded-lg border border-[#2C2C31] bg-[#141416] p-1">
                    {INTENSITY_OPTIONS.map((item) => {
                      const active = prefs.panelIntensity === item.key;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          disabled={loading}
                          onClick={() =>
                            void updatePreference({ panelIntensity: item.key })
                          }
                          className={cn(
                            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                            active
                              ? "bg-[#2C2C32] text-[#F4F4F5]"
                              : "text-[#8E8E98] hover:text-[#F4F4F5]",
                          )}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Audio & Mic */}
            {activeTab === "audio" && (
              <div className="divide-y divide-[#26262A]">
                <div className="flex flex-col gap-3 py-4 first:pt-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#F4F4F5]">
                      Voice tone
                    </p>
                    <p className="mt-0.5 text-xs text-[#8E8E98]">
                      Delivery pacing across panelists.
                    </p>
                  </div>
                  <div className="inline-flex rounded-lg border border-[#2C2C31] bg-[#141416] p-1">
                    {VOICE_TONE_LIST.map((tone) => {
                      const active = prefs.voiceTone === tone.key;
                      return (
                        <button
                          key={tone.key}
                          type="button"
                          disabled={loading}
                          onClick={() =>
                            void updatePreference({
                              voiceTone: tone.key as VoiceToneKey,
                            })
                          }
                          className={cn(
                            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                            active
                              ? "bg-[#2C2C32] text-[#F4F4F5]"
                              : "text-[#8E8E98] hover:text-[#F4F4F5]",
                          )}
                        >
                          {tone.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <p className="text-sm font-medium text-[#F4F4F5]">
                      Hands-free auto-mic
                    </p>
                    <p className="mt-0.5 text-xs text-[#8E8E98]">
                      Arms your microphone automatically when the panel finishes
                      speaking.
                    </p>
                  </div>
                  <SolidSwitch
                    checked={prefs.autoMicEnabled}
                    label="Hands-Free Auto-Mic"
                    onToggle={() =>
                      void updatePreference({
                        autoMicEnabled: !prefs.autoMicEnabled,
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#F4F4F5]">
                      Live drill buzzer sound
                    </p>
                    <p className="mt-0.5 text-xs text-[#8E8E98]">
                      Subtle audio chime when a panelist interrupts a drill
                      turn.
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={playTestChime}
                      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[#34343A] bg-[#25252A] px-2.5 text-xs font-medium text-[#E4E4E7] transition-colors hover:bg-[#2F2F36]"
                    >
                      <Volume2 className="h-3.5 w-3.5 text-[#A1A1AA]" />
                      <span>Test chime</span>
                    </button>
                    <SolidSwitch
                      checked={prefs.buzzerSoundEnabled}
                      label="Live Drill Buzzer Sound"
                      onToggle={() =>
                        void updatePreference({
                          buzzerSoundEnabled: !prefs.buzzerSoundEnabled,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-3 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-[#F4F4F5]">
                        Microphone level check
                      </p>
                      <p className="mt-0.5 text-xs text-[#8E8E98]">
                        {micStatusLabel}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void toggleMicCheck()}
                      className={cn(
                        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors",
                        micTesting
                          ? "border border-[#5C2B2E] bg-[#2D1A1C] text-[#FCA5A5] hover:bg-[#3A2023]"
                          : "border border-[#34343A] bg-[#25252A] text-[#F4F4F5] hover:bg-[#2F2F36]",
                      )}
                    >
                      {micTesting ? (
                        <>
                          <MicOff className="h-3.5 w-3.5" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Mic className="h-3.5 w-3.5" />
                          <span>Test Microphone</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#26262A]">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-75",
                        micLevel > 82 ? "bg-[#FBBF24]" : "bg-[var(--accent)]",
                      )}
                      style={{
                        width: `${micTesting ? Math.max(4, micLevel) : 0}%`,
                      }}
                    />
                  </div>

                  {micError && (
                    <p className="text-xs text-[#FCA5A5]">{micError}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const SettingsModal = SettingsView;
export { DEFAULT_USER_PREFERENCES };
