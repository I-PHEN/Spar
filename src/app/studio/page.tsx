"use client";

import { useState } from "react";
import { CourseStudio } from "@/components/spar/course-studio";
import { SparringRoom } from "@/components/spar/sparring-room";
import { DebriefView } from "@/components/spar/debrief-view";
import type { DrillTarget, ExperienceKey } from "@/lib/experiences";

export default function StudioPage() {
  const [testSession, setTestSession] = useState<{
    id: string;
    experience: ExperienceKey;
    drillTarget: DrillTarget | null;
    phase: "sparring" | "debrief";
  } | null>(null);

  if (testSession?.phase === "sparring") {
    return (
      <SparringRoom
        sessionId={testSession.id}
        experience={testSession.experience}
        drillTarget={testSession.drillTarget}
        onSessionEnded={() =>
          setTestSession((prev) =>
            prev ? { ...prev, phase: "debrief" } : null
          )
        }
        onExit={() => setTestSession(null)}
      />
    );
  }

  if (testSession?.phase === "debrief") {
    return (
      <DebriefView
        sessionId={testSession.id}
        scenarioLabel="Studio Test Drill"
        onBackHome={() => setTestSession(null)}
        onSparAgain={() => setTestSession(null)}
      />
    );
  }

  return (
    <CourseStudio
      onLaunchTestSession={(id, experience, drillTarget) =>
        setTestSession({ id, experience, drillTarget, phase: "sparring" })
      }
    />
  );
}
