"use client";

import { useEffect, useState } from "react";
import { Nav, type NavView } from "@/components/spar/nav";
import { HeroView } from "@/components/spar/hero-view";
import { AuthView } from "@/components/spar/auth-view";
import { OnboardingView } from "@/components/spar/onboarding-view";
import { HomeView } from "@/components/spar/home-view";
import { PracticeView } from "@/components/spar/practice-view";
import { SparringRoom } from "@/components/spar/sparring-room";
import { DebriefView } from "@/components/spar/debrief-view";
import {
  SettingsModal,
  type SettingsTabKey,
} from "@/components/spar/settings-view";
import {
  CoachView,
  type ActiveCourseLessonContext,
} from "@/components/spar/coach-view";
import { sessionLabel } from "@/lib/session-label";
import {
  parseSupabaseHashCallback,
  parseSupabaseHashError,
  parseSupabaseQueryCallback,
  verifySupabaseTokenHash,
} from "@/lib/supabase";
import type { ExperienceKey, DrillTarget } from "@/lib/experiences";
import {
  LAST_CONFIG_STORAGE_KEY,
  USER_PREFERENCES_STORAGE_KEY,
  syncLastConfigFromPreferences,
  writeStoredUserPreferences,
  type UserPreferences,
} from "@/lib/user-preferences";
import { applyAccentTheme } from "@/lib/accent-themes";
import { Loader2 } from "lucide-react";
import { SparLogo } from "@/components/spar/spar-logo";

function hydrateUserPreferences(prefs?: Partial<UserPreferences> | null) {
  if (!prefs || typeof prefs !== "object") return;
  const normalized = writeStoredUserPreferences(prefs);
  applyAccentTheme(normalized.accentColor);
  try {
    if (!window.localStorage.getItem(LAST_CONFIG_STORAGE_KEY)) {
      syncLastConfigFromPreferences(normalized);
    }
  } catch {
    // Ignore storage access errors
  }
}

type View = NavView | "hero" | "auth" | "onboarding" | "sparring" | "debrief";

export default function Page() {
  // Always start at the hero for unauthenticated visitors.
  const [view, setView] = useState<View>("hero");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [scenarioLabel, setScenarioLabel] = useState<string | undefined>();
  const [userName, setUserName] = useState<string>("there");
  const [userEmail, setUserEmail] = useState<string>("");
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTabKey>("account");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCompletingAuth, setIsCompletingAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [recoveryAccessToken, setRecoveryAccessToken] = useState<string | null>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [experience, setExperience] = useState<ExperienceKey>("open_spar");
  const [drillTarget, setDrillTarget] = useState<DrillTarget | null>(null);
  const [activeCourseLesson, setActiveCourseLesson] =
    useState<ActiveCourseLessonContext | null>(null);
  const [coachReturnCourseId, setCoachReturnCourseId] = useState<string | null>(
    null
  );

  // Load user session (and exchange any Supabase OAuth / email verification callback)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const queryCb = parseSupabaseQueryCallback(window.location.search);
    const hashError = parseSupabaseHashError(window.location.hash);
    const oauthError = queryCb?.error || hashError;
    if (oauthError) {
      document.documentElement.removeAttribute("data-spar-oauth");
      setAuthError(oauthError);
      setView("auth");
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }

    async function finalizeTokenLogin(accessToken: string, type?: string) {
      setIsCompletingAuth(true);
      try {
        if (type === "recovery") {
          setRecoveryAccessToken(accessToken);
          setView("auth");
          window.history.replaceState(null, "", window.location.pathname);
          return;
        }
        const res = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken }),
        });
        const d = await res.json();
        window.history.replaceState(null, "", window.location.pathname);
        if (d?.user?.name) {
          if (d.user.preferences) {
            hydrateUserPreferences(d.user.preferences);
          }
          setIsAuthenticated(true);
          setUserName(d.user.name);
          if (typeof d.user.email === "string") {
            setUserEmail(d.user.email);
          }
          const hasSupabase = Boolean(d.supabaseConfigured);
          setSupabaseConfigured(hasSupabase);
          setCloudSyncEnabled(
            Boolean(
              hasSupabase &&
                d.user.email &&
                d.user.email !== "founder@spar.local",
            ),
          );
          const completed = Boolean(d.user.hasCompletedOnboarding);
          setHasCompletedOnboarding(completed);
          setView(completed ? "home" : "onboarding");
        } else {
          setAuthError(d?.error || "Could not complete sign-in.");
          setView("auth");
        }
      } catch {
        setAuthError("Could not complete sign-in. Please try again.");
        setView("auth");
      } finally {
        document.documentElement.removeAttribute("data-spar-oauth");
        setIsCompletingAuth(false);
      }
    }

    const hashTokens = parseSupabaseHashCallback(window.location.hash);
    if (hashTokens) {
      void finalizeTokenLogin(hashTokens.accessToken, hashTokens.type);
      return;
    }

    if (queryCb?.tokenHash) {
      setIsCompletingAuth(true);
      verifySupabaseTokenHash(queryCb.tokenHash, queryCb.type ?? "signup")
        .then((verified) => finalizeTokenLogin(verified.accessToken, queryCb.type))
        .catch((err) => {
          document.documentElement.removeAttribute("data-spar-oauth");
          window.history.replaceState(null, "", window.location.pathname);
          setAuthError(
            err instanceof Error
              ? err.message
              : "Verification link expired. Please request a new one.",
          );
          setView("auth");
          setIsCompletingAuth(false);
        });
      return;
    }

    if (queryCb?.code) {
      document.documentElement.removeAttribute("data-spar-oauth");
      window.history.replaceState(null, "", window.location.pathname);
      setAuthError("Sign-in session expired or used an unsupported redirect. Please try again.");
      setView("auth");
      return;
    }

    document.documentElement.removeAttribute("data-spar-oauth");

    fetch("/api/user")
      .then((r) => r.json())
      .then((d) => {
        if (d?.preferences) {
          hydrateUserPreferences(d.preferences);
        }
        if (typeof d?.email === "string") {
          setUserEmail(d.email);
        }
        setSupabaseConfigured(Boolean(d?.supabaseConfigured));
        setCloudSyncEnabled(Boolean(d?.cloudSyncEnabled));
        if (d?.authenticated) {
          setIsAuthenticated(true);
          if (d.name && d.name !== "Founder") {
            setUserName(d.name);
          }
          const completed = Boolean(d.hasCompletedOnboarding);
          setHasCompletedOnboarding(completed);
          setView((prev) =>
            prev === "hero" || prev === "auth"
              ? completed
                ? "home"
                : "onboarding"
              : prev
          );
        } else if (d?.name && d.name !== "Founder") {
          setUserName(d.name);
        }
      })
      .catch(() => {});
  }, []);

  function syncUserFromServer(preserveEnteredName?: boolean) {
    fetch("/api/user")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        if (d.preferences) {
          hydrateUserPreferences(d.preferences);
        }
        if (typeof d.email === "string") {
          setUserEmail(d.email);
        }
        setSupabaseConfigured(Boolean(d.supabaseConfigured));
        setCloudSyncEnabled(Boolean(d.cloudSyncEnabled));
        if (!preserveEnteredName && d.name && d.name !== "Founder") {
          setUserName(d.name);
        }
      })
      .catch(() => {});
  }

  function openSettings(tab: SettingsTabKey = "account") {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }

  function handleSignOut() {
    try {
      window.localStorage.removeItem(USER_PREFERENCES_STORAGE_KEY);
      window.localStorage.removeItem(LAST_CONFIG_STORAGE_KEY);
    } catch {
      // Ignore storage access errors
    }
    applyAccentTheme("default");
    setSettingsOpen(false);
    setIsAuthenticated(false);
    setHasCompletedOnboarding(false);
    setUserName("there");
    setUserEmail("");
    setCloudSyncEnabled(false);
    setView("hero");
  }

  function navigate(v: NavView) {
    if (v === "settings") {
      openSettings("account");
      return;
    }
    if (v === "coach") {
      setCoachReturnCourseId(null);
      setView("coach");
      return;
    }
    if (v === "progress") {
      setView(hasCompletedOnboarding ? "home" : "hero");
      return;
    }
    // If user clicks "Home" from the nav while on hero/onboarding, and they've
    // already onboarded, go to the dashboard. Otherwise stay on hero.
    if (v === "home") {
      if (hasCompletedOnboarding) {
        setView("home");
      } else {
        setView("hero");
      }
      return;
    }
    if (v === "practice") {
      // If they haven't onboarded yet, send them through onboarding first
      if (!hasCompletedOnboarding) {
        setView("onboarding");
      } else {
        setView("practice");
      }
      return;
    }
    setView(v);
  }

  function handleHeroEnter() {
    if (isAuthenticated) {
      setView(hasCompletedOnboarding ? "home" : "onboarding");
      return;
    }
    setAuthError(null);
    setView("auth");
  }

  function handleAuthContinue(
    enteredName?: string,
    onboardedFromServer?: boolean,
  ) {
    setIsAuthenticated(true);
    setAuthError(null);
    if (enteredName && enteredName.trim()) {
      setUserName(enteredName.trim());
    }
    const doneOnboarding =
      typeof onboardedFromServer === "boolean"
        ? onboardedFromServer
        : hasCompletedOnboarding;
    setHasCompletedOnboarding(doneOnboarding);
    syncUserFromServer(Boolean(enteredName && enteredName.trim()));
    setView(doneOnboarding ? "home" : "onboarding");
  }

  function handleSessionCreated(
    sessionId: string,
    exp: ExperienceKey,
    target: DrillTarget | null,
    lessonMeta?: ActiveCourseLessonContext
  ) {
    setActiveSessionId(sessionId);
    setExperience(exp);
    setDrillTarget(target);
    setActiveCourseLesson(lessonMeta ?? null);
    setCoachReturnCourseId(lessonMeta?.courseId ?? null);
    setView("sparring");
  }

  function handleSessionEnded() {
    const lessonToRecord = activeCourseLesson;
    const endedSessionId = activeSessionId;
    if (endedSessionId) {
      fetch(`/api/sessions/${endedSessionId}`)
        .then((r) => r.json())
        .then((d) => {
          const s = d?.session;
          setScenarioLabel(
            s?.materialTitle?.trim() || sessionLabel(s?.scenario ?? "")
          );
          const hasUserTurn =
            Array.isArray(s?.messages) &&
            s.messages.some((m: { role?: string }) => m.role === "user");
          if (lessonToRecord && hasUserTurn) {
            fetch("/api/coach/progress", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                courseId: lessonToRecord.courseId,
                lessonId: lessonToRecord.lessonId,
                sessionId: endedSessionId,
              }),
            }).catch(() => {});
          }
        })
        .catch(() => {});
    }
    setView("debrief");
  }

  function handleSparAgain() {
    setActiveSessionId(null);
    if (activeCourseLesson) {
      setCoachReturnCourseId(activeCourseLesson.courseId);
      setActiveCourseLesson(null);
      setView("coach");
    } else {
      setView("practice");
    }
  }

  function handleBackHome() {
    setActiveSessionId(null);
    if (activeCourseLesson) {
      setCoachReturnCourseId(activeCourseLesson.courseId);
      setActiveCourseLesson(null);
      setView("coach");
    } else {
      setView("home");
    }
  }

  function handleOnboardingComplete(data: { name: string }) {
    if (data.name && data.name.trim()) {
      setUserName(data.name.trim());
    }
    setHasCompletedOnboarding(true);
    setExperience("open_spar");
    syncUserFromServer(true);
    setView("home");
  }

  // Sparring Room is full-screen — no nav.
  if (view === "sparring" && activeSessionId) {
    return (
      <SparringRoom
        sessionId={activeSessionId}
        onSessionEnded={handleSessionEnded}
        onExit={handleBackHome}
        experience={experience}
        drillTarget={drillTarget}
      />
    );
  }

  if (isCompletingAuth) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <SparLogo size="lg" className="mb-4" />
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
          <span>Signing you in...</span>
        </div>
        <p className="mt-1.5 text-xs text-neutral-500">
          Syncing your account and preferences
        </p>
      </div>
    );
  }

  // Hero — full screen, no app nav. Has its own minimal header.
  if (view === "hero") {
    return <HeroView onEnter={handleHeroEnter} />;
  }

  // Auth — Google OAuth / Email Sign In
  if (view === "auth") {
    return (
      <AuthView
        initialError={authError}
        recoveryToken={recoveryAccessToken}
        onRecoveryComplete={() => setRecoveryAccessToken(null)}
        onContinue={(enteredName, onboarded) => {
          setRecoveryAccessToken(null);
          handleAuthContinue(enteredName, onboarded);
        }}
        onBack={() => {
          setRecoveryAccessToken(null);
          setView("hero");
        }}
      />
    );
  }

  // Onboarding — full screen, no nav
  if (view === "onboarding") {
    return (
      <OnboardingView
        initialName={userName === "there" ? "" : userName}
        onComplete={handleOnboardingComplete}
        onBack={() => setView("auth")}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Nav
        current={view}
        onNavigate={navigate}
        userName={userName}
        userEmail={userEmail}
        cloudSyncEnabled={cloudSyncEnabled}
        onOpenSettings={openSettings}
        onSignOut={handleSignOut}
      />
      <main className="flex-1 pb-16 md:pb-0">
        {view === "home" && (
          <HomeView
            userName={userName}
            onEnterSparringRoom={() => setView("practice")}
            onOpenDebrief={(sessionId, label) => {
              setActiveCourseLesson(null);
              setActiveSessionId(sessionId);
              setScenarioLabel(label);
              setView("debrief");
            }}
          />
        )}
        {view === "practice" && (
          <PracticeView
            onSessionCreated={handleSessionCreated}
            onCancel={handleBackHome}
          />
        )}
        {view === "debrief" && activeSessionId && (
          <DebriefView
            sessionId={activeSessionId}
            scenarioLabel={scenarioLabel}
            courseContext={activeCourseLesson}
            onBackHome={handleBackHome}
            onSparAgain={handleSparAgain}
          />
        )}
        {view === "coach" && (
          <CoachView
            key={coachReturnCourseId ?? "catalog"}
            initialScreen={coachReturnCourseId ? "roadmap" : "catalog"}
            initialSelectedCourseId={coachReturnCourseId ?? undefined}
            onSessionCreated={handleSessionCreated}
          />
        )}
      </main>
      {settingsOpen && (
        <SettingsModal
          open={settingsOpen}
          initialTab={settingsTab}
          onClose={() => setSettingsOpen(false)}
          userName={userName}
          userEmail={userEmail}
          supabaseConfigured={supabaseConfigured}
          cloudSyncEnabled={cloudSyncEnabled}
          onUserUpdated={(newName) => setUserName(newName)}
          onSignOut={handleSignOut}
        />
      )}
    </div>
  );
}
