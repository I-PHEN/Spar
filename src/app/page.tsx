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
import { CoachView } from "@/components/spar/coach-view";
import { sessionLabel } from "@/lib/session-label";
import type { ExperienceKey, DrillTarget } from "@/lib/experiences";
import { TrendingUp, Hammer } from "lucide-react";

type View = NavView | "hero" | "auth" | "onboarding" | "sparring" | "debrief";

export default function Page() {
  // Always start at the hero — it's the landing page.
  // The user clicks "Enter the Sparring Room" to proceed.
  const [view, setView] = useState<View>("hero");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [scenarioLabel, setScenarioLabel] = useState<string | undefined>();
  const [userName, setUserName] = useState<string>("there");
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [experience, setExperience] = useState<ExperienceKey>("open_spar");
  const [drillTarget, setDrillTarget] = useState<DrillTarget | null>(null);
  const [activeCourseLesson, setActiveCourseLesson] = useState<{
    courseId: string;
    lessonId: string;
  } | null>(null);

  // Load user name (for the dashboard after they enter)
  useEffect(() => {
    fetch("/api/user")
      .then((r) => r.json())
      .then((d) => {
        if (d?.name && d.name !== "Founder") {
          setUserName(d.name);
          setHasCompletedOnboarding(true);
        }
      })
      .catch(() => {});
  }, []);

  function navigate(v: NavView) {
    if (v === "coach" || v === "progress") {
      setView(v);
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
    // "Get Started" and "Sign In" both go to the auth screen
    setView("auth");
  }

  function handleAuthContinue(enteredName?: string) {
    if (enteredName && enteredName.trim()) {
      setUserName(enteredName.trim());
      fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: enteredName.trim() }),
      }).catch(() => {});
    }
    // After auth: ALWAYS go to onboarding
    // (We check hasCompletedOnboarding to skip onboarding for returning users)
    if (hasCompletedOnboarding) {
      setView("home");
    } else {
      setView("onboarding");
    }
  }

  function handleSessionCreated(
    sessionId: string,
    exp: ExperienceKey,
    target: DrillTarget | null,
    lessonMeta?: { courseId: string; lessonId: string }
  ) {
    setActiveSessionId(sessionId);
    setExperience(exp);
    setDrillTarget(target);
    setActiveCourseLesson(lessonMeta ?? null);
    setView("sparring");
  }

  function handleSessionEnded() {
    if (activeSessionId) {
      fetch(`/api/sessions/${activeSessionId}`)
        .then((r) => r.json())
        .then((d) => {
          setScenarioLabel(sessionLabel(d?.session?.scenario ?? ""));
        })
        .catch(() => {});
    }
    if (activeCourseLesson) {
      fetch("/api/coach/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: activeCourseLesson.courseId,
          lessonId: activeCourseLesson.lessonId,
          sessionId: activeSessionId,
        }),
      }).catch(() => {});
    }
    setView("debrief");
  }

  function handleSparAgain() {
    setActiveSessionId(null);
    if (activeCourseLesson) {
      setActiveCourseLesson(null);
      setView("coach");
    } else {
      setView("practice");
    }
  }

  function handleBackHome() {
    setActiveSessionId(null);
    if (activeCourseLesson) {
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

  // Hero — full screen, no app nav. Has its own minimal header.
  if (view === "hero") {
    return <HeroView onEnter={handleHeroEnter} />;
  }

  // Auth — Sign In / Sign Up screen (fake for now)
  if (view === "auth") {
    return (
      <AuthView
        onContinue={handleAuthContinue}
        onBack={() => setView("hero")}
      />
    );
  }

  // Onboarding — full screen, no nav
  if (view === "onboarding") {
    return (
      <OnboardingView
        initialName={userName}
        onComplete={handleOnboardingComplete}
        onBack={() => setView("auth")}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Nav current={view} onNavigate={navigate} />
      <main className="flex-1 pb-16 md:pb-0">
        {view === "home" && (
          <HomeView
            userName={userName}
            onEnterSparringRoom={() => setView("practice")}
            onOpenDebrief={(sessionId, label) => {
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
            onBackHome={handleBackHome}
            onSparAgain={handleSparAgain}
          />
        )}
        {view === "coach" && (
          <CoachView onSessionCreated={handleSessionCreated} />
        )}
        {view === "progress" && (
          <ComingSoonView
            icon={<TrendingUp className="h-6 w-6" />}
            title="Progress"
            description="Session history, growth trends, your communication profile. Shipping in the next solid thing."
          />
        )}
      </main>
    </div>
  );
}

function ComingSoonView({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-6 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-md border border-[#202020] bg-[#101010] text-neutral-300">
        {icon}
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">
        {title}
      </h1>
      <p className="mt-2 text-sm text-neutral-400 max-w-md">{description}</p>
      <div className="mt-6 flex items-center gap-1.5 rounded-md border border-[#1a1a1a] bg-[#0f0f0f] px-3 py-2 text-xs text-neutral-500">
        <Hammer className="h-3 w-3" />
        Under active construction
      </div>
    </div>
  );
}
