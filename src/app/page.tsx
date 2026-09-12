"use client";

import { useEffect, useState } from "react";
import { Nav, type NavView } from "@/components/spar/nav";
import { HeroView } from "@/components/spar/hero-view";
import { OnboardingView } from "@/components/spar/onboarding-view";
import { HomeView } from "@/components/spar/home-view";
import { PracticeView } from "@/components/spar/practice-view";
import { SparringRoom } from "@/components/spar/sparring-room";
import { DebriefView } from "@/components/spar/debrief-view";
import { SCENARIOS } from "@/lib/scenarios";
import type { ExperienceKey, DrillTarget } from "@/lib/experiences";
import { GraduationCap, TrendingUp, Hammer } from "lucide-react";
import { Button } from "@/components/ui/button";

type View = NavView | "hero" | "onboarding" | "loading" | "sparring" | "debrief";

export default function Page() {
  const [view, setView] = useState<View>("loading");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [scenarioLabel, setScenarioLabel] = useState<string | undefined>();
  const [userName, setUserName] = useState<string>("there");
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [experience, setExperience] = useState<ExperienceKey>("defense");
  const [drillTarget, setDrillTarget] = useState<DrillTarget | null>(null);
  const [coachingEnabled, setCoachingEnabled] = useState(true);
  const [coachingFocus, setCoachingFocus] = useState("");

  // Load user + check if they've done onboarding
  useEffect(() => {
    Promise.all([fetch("/api/user"), fetch("/api/stats")])
      .then(async ([ur, sr]) => {
        const uData = await ur.json();
        const sData = await sr.json();
        if (sData?.totalSessions !== undefined) {
          setSessionCount(sData.totalSessions);
        }
        // Show hero if the user hasn't completed onboarding (name is still "Founder")
        // OR if they have no sessions yet
        if (uData?.name && uData.name !== "Founder") {
          setUserName(uData.name);
          setHasCompletedOnboarding(true);
          setView("home");
        } else if (sData?.totalSessions > 0) {
          // Has sessions but name is still "Founder" — skip hero, go home
          setUserName("there");
          setHasCompletedOnboarding(true);
          setView("home");
        } else {
          // New user — show hero
          setView("hero");
        }
      })
      .catch(() => {
        setView("hero");
      });
  }, []);

  function navigate(v: NavView) {
    if (v === "coach" || v === "progress") {
      setView(v);
      return;
    }
    setView(v);
  }

  function handleSessionCreated(
    sessionId: string,
    exp: ExperienceKey,
    target: DrillTarget | null,
    coaching: boolean,
    focus: string
  ) {
    setActiveSessionId(sessionId);
    setExperience(exp);
    setDrillTarget(target);
    setCoachingEnabled(coaching);
    setCoachingFocus(focus);
    setView("sparring");
  }

  function handleSessionEnded() {
    if (activeSessionId) {
      fetch(`/api/sessions/${activeSessionId}`)
        .then((r) => r.json())
        .then((d) => {
          const key = d?.session?.scenario as keyof typeof SCENARIOS;
          setScenarioLabel(SCENARIOS[key]?.label || d?.session?.scenario);
        })
        .catch(() => {});
    }
    setView("debrief");
  }

  function handleSparAgain() {
    setActiveSessionId(null);
    setView("practice");
  }

  function handleBackHome() {
    setActiveSessionId(null);
    setView("home");
  }

  function handleOnboardingComplete(data: {
    name: string;
    preparingFor: string;
    focusArea: string;
  }) {
    // Update the user's name
    fetch("/api/user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: data.name }),
    }).catch(() => {});

    setUserName(data.name);
    setHasCompletedOnboarding(true);

    // Map onboarding choices to experience defaults
    const preparingMap: Record<string, ExperienceKey> = {
      thesis: "defense",
      pitch: "defense",
      board: "boardroom",
      interview: "open_spar",
      conference: "defense",
      custom: "open_spar",
    };
    const exp = preparingMap[data.preparingFor] || "open_spar";
    setExperience(exp);

    // Map focus area to coaching focus
    const focusMap: Record<string, string> = {
      confidence: "Building confidence under pressure",
      hedging: "Reducing hedge words and qualifiers",
      concision: "Being more concise and direct",
      evidence: "Grounding claims in specific evidence",
      recovery: "Improving recovery speed after interruptions",
      unsure: "",
    };
    setCoachingFocus(focusMap[data.focusArea] || "");

    setView("practice");
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
        coachingEnabled={coachingEnabled}
        coachingFocus={coachingFocus}
      />
    );
  }

  // Loading state — blank page while checking if user has onboarded
  if (view === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-700 border-t-neutral-300" />
      </div>
    );
  }

  // Hero and Onboarding are full-screen — no nav.
  if (view === "hero") {
    return (
      <div className="flex min-h-screen flex-col">
        <Nav current="home" onNavigate={() => setView("hero")} />
        <main className="flex-1">
          <HeroView onEnter={() => setView("onboarding")} />
        </main>
      </div>
    );
  }

  if (view === "onboarding") {
    return (
      <div className="flex min-h-screen flex-col">
        <Nav current="home" onNavigate={() => setView("hero")} />
        <main className="flex-1">
          <OnboardingView
            onComplete={handleOnboardingComplete}
            onBack={() => setView("hero")}
          />
        </main>
      </div>
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
          <ComingSoonView
            icon={<GraduationCap className="h-6 w-6" />}
            title="Coach"
            description="The development layer. Active programs, skill map, pattern insights, recommended drills. Shipping in the next solid thing."
          />
        )}
        {view === "progress" && (
          <ComingSoonView
            icon={<TrendingUp className="h-6 w-6" />}
            title="Progress"
            description="Session history, growth trends, your communication profile. Shipping in the next solid thing."
          />
        )}
      </main>
      <Footer />
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

function Footer() {
  return (
    <footer className="mt-auto border-t border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 sm:px-6">
      <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-neutral-600">
        <span>Spar — the sparring room for your next big moment.</span>
        <span className="font-mono">v1.0 — voice sparring MVP</span>
      </div>
    </footer>
  );
}
