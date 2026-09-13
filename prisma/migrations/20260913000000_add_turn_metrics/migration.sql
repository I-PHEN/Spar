-- CreateTable
CREATE TABLE "TurnMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "turnId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "traceId" TEXT,
    "experience" TEXT,
    "persona" TEXT,
    "transcriptConfidence" REAL,
    "selectedRegion" TEXT,
    "transcriptFinalizedOffsetMs" REAL,
    "serverGenerationStartedOffsetMs" REAL,
    "firstTokenOffsetMs" REAL,
    "firstPhraseOffsetMs" REAL,
    "firstTtsByteOffsetMs" REAL,
    "firstPlaybackOffsetMs" REAL,
    "cancellationOffsetMs" REAL,
    "generationProvider" TEXT,
    "generationModel" TEXT,
    "ttsProvider" TEXT,
    "ttsModel" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "cachedTokens" INTEGER,
    "estimatedCostUsd" REAL,
    "fallbackReason" TEXT,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "orderingFailureCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TurnMetric_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TurnMetric_turnId_key" ON "TurnMetric"("turnId");

-- CreateIndex
CREATE INDEX "TurnMetric_sessionId_idx" ON "TurnMetric"("sessionId");

-- CreateIndex
CREATE INDEX "TurnMetric_updatedAt_idx" ON "TurnMetric"("updatedAt");
