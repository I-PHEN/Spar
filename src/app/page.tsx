"use client";

import { useEffect, useState } from "react";
import { Nav, type NavView } from "@/components/spar/nav";
import { HomeView } from "@/components/spar/home-view";
import { PracticeView } from "@/components/spar/practice-view";
import { SparringRoom } from "@/components/spar/sparring-room";
import { DebriefView } from "@/components/spar/debrief-view";
import { SCENARIOS } from "@/lib/scenarios";
import { GraduationCap, TrendingUp, Hammer } from "lucide-react";
import { Button } from "@/components/ui/button";

type View = NavView | "sparring" | "debrief";

export default function Page() {
  const [view, setView] = useState<View>("home");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [scenarioLabel, setScenarioLabel] = useState<string | undefined>();
  const [userName, setUserName] = useState<string>("there");

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
      // v1: these are placeholders. Still switch the view to show the placeholder.
      setView(v);
      return;
    }
    setView(v);
  }

  function handleSessionCreated(sessionId: string) {
    setActiveSessionId(sessionId);
    setView("sparring");
  }

  // Quick spar — jump straight from Home topic input into the room.
  function handleQuickSparStarted(sessionId: string) {
    setActiveSessionId(sessionId);
    setView("sparring");
  }

  function handleSessionEnded() {
    // Fetch the session to get the scenario label for the debrief header
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
            onQuickSparStarted={handleQuickSparStarted}
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
        {view === "coach" && <ComingSoonView icon={<GraduationCap className="h-6 w-6" />} title="Coach" description="The development layer. Active programs, skill map, pattern insights, recommended drills. Shipping in the next solid thing." />}
        {view === "progress" && <ComingSoonView icon={<TrendingUp className="h-6 w-6" />} title="Progress" description="Session history, growth trends, your communication profile. Shipping in the next solid thing." />}
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
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-white ring-1 ring-white/15">
        {icon}
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">{description}</p>
      <div className="mt-6 flex items-center gap-1.5 rounded-md border border-border/60 bg-card/40 px-3 py-2 text-xs text-muted-foreground/70">
        <Hammer className="h-3 w-3" />
        Under active construction
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-auto border-t border-border/40 bg-background/40 px-4 py-4 sm:px-6">
      <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground/60">
        <span>
          Spar — the sparring room for your next big moment.
        </span>
        <span className="font-mono">v1.0 — text sparring MVP</span>
      </div>
    </footer>
  );
}
