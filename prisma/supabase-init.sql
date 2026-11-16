-- Spar Supabase Initialization SQL
-- Paste and run this script once in your Supabase SQL Editor (or run Prisma db push with schema.postgres.prisma).

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "onboardedAt" TIMESTAMPTZ,
  "preferences" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "UpcomingMoment" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "detail" TEXT,
  "date" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Session" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "experience" TEXT NOT NULL DEFAULT 'open_spar',
  "drillTarget" TEXT,
  "coachingEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "coachingFocus" TEXT,
  "scenario" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "rawMaterial" TEXT,
  "materialTitle" TEXT,
  "roomContext" TEXT,
  "extractedClaims" TEXT,
  "presentationAnalysis" TEXT,
  "status" TEXT NOT NULL DEFAULT 'configured',
  "startedAt" TIMESTAMPTZ,
  "endedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "telemetry" TEXT
);

CREATE TABLE IF NOT EXISTS "SessionPersona" (
  "id" TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL REFERENCES "Session"("id") ON DELETE CASCADE,
  "archetype" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "behaviorStyle" TEXT NOT NULL DEFAULT 'moderate',
  "seatOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "SessionMessage" (
  "id" TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL REFERENCES "Session"("id") ON DELETE CASCADE,
  "personaId" TEXT REFERENCES "SessionPersona"("id") ON DELETE SET NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'normal',
  "claimRef" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "SessionSummary" (
  "id" TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL UNIQUE REFERENCES "Session"("id") ON DELETE CASCADE,
  "momentDescription" TEXT NOT NULL,
  "whatWentWell" TEXT NOT NULL,
  "thePattern" TEXT NOT NULL,
  "oneThingToPractice" TEXT NOT NULL,
  "telemetryInsights" TEXT NOT NULL,
  "shareableSummary" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "SessionFeedback" (
  "id" TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL UNIQUE REFERENCES "Session"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "tags" TEXT,
  "comment" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "PatternMemory" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "tag" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "occurrences" INTEGER NOT NULL DEFAULT 1,
  "lastSeen" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("userId", "tag")
);

CREATE TABLE IF NOT EXISTS "SkillSnapshot" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "sessionId" TEXT NOT NULL UNIQUE REFERENCES "Session"("id") ON DELETE CASCADE,
  "clarity" DOUBLE PRECISION NOT NULL,
  "recovery" DOUBLE PRECISION NOT NULL,
  "concision" DOUBLE PRECISION NOT NULL,
  "presence" DOUBLE PRECISION NOT NULL,
  "evidence" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "TurnMetric" (
  "id" TEXT PRIMARY KEY,
  "turnId" TEXT NOT NULL UNIQUE,
  "sessionId" TEXT NOT NULL REFERENCES "Session"("id") ON DELETE CASCADE,
  "traceId" TEXT,
  "experience" TEXT,
  "persona" TEXT,
  "transcriptConfidence" DOUBLE PRECISION,
  "selectedRegion" TEXT,
  "transcriptFinalizedOffsetMs" DOUBLE PRECISION,
  "serverGenerationStartedOffsetMs" DOUBLE PRECISION,
  "firstTokenOffsetMs" DOUBLE PRECISION,
  "firstPhraseOffsetMs" DOUBLE PRECISION,
  "firstTtsByteOffsetMs" DOUBLE PRECISION,
  "firstPlaybackOffsetMs" DOUBLE PRECISION,
  "cancellationOffsetMs" DOUBLE PRECISION,
  "generationProvider" TEXT,
  "generationModel" TEXT,
  "ttsProvider" TEXT,
  "ttsModel" TEXT,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "cachedTokens" INTEGER,
  "estimatedCostUsd" DOUBLE PRECISION,
  "fallbackReason" TEXT,
  "cancelled" BOOLEAN NOT NULL DEFAULT FALSE,
  "orderingFailureCount" INTEGER NOT NULL DEFAULT 0,
  "voiceEngine" TEXT,
  "firstLiveAudioMs" INTEGER,
  "interruptions" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- REST-synced tester feedback & course tables
CREATE TABLE IF NOT EXISTS public.spar_feedback (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.spar_courses (
  id TEXT PRIMARY KEY,
  slug TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Foreign-key & lookup indexes
CREATE INDEX IF NOT EXISTS "UpcomingMoment_userId_idx" ON public."UpcomingMoment"("userId");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON public."Session"("userId");
CREATE INDEX IF NOT EXISTS "SessionPersona_sessionId_idx" ON public."SessionPersona"("sessionId");
CREATE INDEX IF NOT EXISTS "SessionMessage_sessionId_idx" ON public."SessionMessage"("sessionId");
CREATE INDEX IF NOT EXISTS "SessionMessage_personaId_idx" ON public."SessionMessage"("personaId");
CREATE INDEX IF NOT EXISTS "PatternMemory_userId_idx" ON public."PatternMemory"("userId");
CREATE INDEX IF NOT EXISTS "SkillSnapshot_userId_idx" ON public."SkillSnapshot"("userId");
CREATE INDEX IF NOT EXISTS "TurnMetric_sessionId_idx" ON public."TurnMetric"("sessionId");
CREATE INDEX IF NOT EXISTS "TurnMetric_updatedAt_idx" ON public."TurnMetric"("updatedAt");

-- Enable Row-Level Security across all public tables
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."UpcomingMoment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SessionPersona" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SessionMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SessionSummary" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SessionFeedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PatternMemory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SkillSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TurnMetric" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spar_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spar_courses ENABLE ROW LEVEL SECURITY;

-- Policies for REST-synced feedback, courses, users, sessions, and moments
CREATE POLICY "Allow user select" ON public."User" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow user insert" ON public."User" FOR INSERT TO anon, authenticated WITH CHECK (length(trim(email)) > 0);
CREATE POLICY "Allow user update" ON public."User" FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (length(trim(email)) > 0);

CREATE POLICY "Allow upcoming moment select" ON public."UpcomingMoment" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow upcoming moment insert" ON public."UpcomingMoment" FOR INSERT TO anon, authenticated WITH CHECK (length(trim(id)) > 0 AND length(trim("userId")) > 0 AND length(trim(title)) > 0);
CREATE POLICY "Allow upcoming moment update" ON public."UpcomingMoment" FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (length(trim(id)) > 0 AND length(trim("userId")) > 0 AND length(trim(title)) > 0);

CREATE POLICY "Allow session select" ON public."Session" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow session insert" ON public."Session" FOR INSERT TO anon, authenticated WITH CHECK (length(trim(id)) > 0);
CREATE POLICY "Allow session update" ON public."Session" FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (length(trim(id)) > 0);

CREATE POLICY "Allow summary select" ON public."SessionSummary" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow summary insert" ON public."SessionSummary" FOR INSERT TO anon, authenticated WITH CHECK (length(trim(id)) > 0);
CREATE POLICY "Allow summary update" ON public."SessionSummary" FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (length(trim(id)) > 0);

CREATE POLICY "Users read own pattern memory" ON public."PatternMemory" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public."User" u WHERE u.id = "userId" AND u.email = (SELECT auth.jwt() ->> 'email')));
CREATE POLICY "Users read own session feedback" ON public."SessionFeedback" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public."User" u WHERE u.id = "userId" AND u.email = (SELECT auth.jwt() ->> 'email')));
CREATE POLICY "Users read own skill snapshots" ON public."SkillSnapshot" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public."User" u WHERE u.id = "userId" AND u.email = (SELECT auth.jwt() ->> 'email')));
CREATE POLICY "Users read own session personas" ON public."SessionPersona" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public."Session" s JOIN public."User" u ON u.id = s."userId" WHERE s.id = "sessionId" AND u.email = (SELECT auth.jwt() ->> 'email')));
CREATE POLICY "Users read own session messages" ON public."SessionMessage" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public."Session" s JOIN public."User" u ON u.id = s."userId" WHERE s.id = "sessionId" AND u.email = (SELECT auth.jwt() ->> 'email')));
CREATE POLICY "Users read own turn metrics" ON public."TurnMetric" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public."Session" s JOIN public."User" u ON u.id = s."userId" WHERE s.id = "sessionId" AND u.email = (SELECT auth.jwt() ->> 'email')));

CREATE POLICY "Allow feedback insert" ON public.spar_feedback FOR INSERT TO anon, authenticated WITH CHECK (rating BETWEEN 1 AND 5);
CREATE POLICY "Allow feedback select" ON public.spar_feedback FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow courses select" ON public.spar_courses FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow courses insert" ON public.spar_courses FOR INSERT TO anon, authenticated WITH CHECK (length(trim(id)) > 0 AND length(trim(title)) > 0);
CREATE POLICY "Allow courses update" ON public.spar_courses FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (length(trim(id)) > 0 AND length(trim(title)) > 0);

