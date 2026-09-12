"use client";

import { useEffect, useState } from "react";
import { Nav, type NavView } from "@/components/spar/nav";
import { HomeView } from "@/components/spar/home-view";
import { PracticeView } from "@/components/spar/practice-view";
import { SparringRoom } from "@/components/spar/sparring-room";
import { DebriefView } from "@/components/spar/debrief-view";
import { SCENARIOS } from "@/lib/scenarios";
import type { ExperienceKey, DrillTarget } from "@/lib/experiences";
import { GraduationCap, TrendingUp, Hammer } from "lucide-react";
import { Button } from "@/components/ui/button";

type View = NavView | "sparring" | "debrief";

export default function Page() {
  const [view, setView] = useState<View>("home");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [scenarioLabel, setScenarioLabel] = useState<string | undefined>();
  const [userName, setUserName] = useState<string>("there");
  const [experience, setExperience] = useState<ExperienceKey>("defense");
  const [drillTarget, setDrillTarget] = useState<DrillTarget | null>(null);
  const [coachingEnabled, setCoachingEnabled] = useState(true);
  const [coachingFocus, setCoachingFocus] = useState("");

  // Load user once
  useEffect(() => {
    fetch("/api/user")
      .then((r) => r.json())
      .then((d) => {
        if (d?.name) setUserName(d.name);
      })
      .catch(() => {});
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
