-- AlterTable
ALTER TABLE "TurnMetric" ADD COLUMN "voiceEngine" TEXT;
ALTER TABLE "TurnMetric" ADD COLUMN "firstLiveAudioMs" INTEGER;
ALTER TABLE "TurnMetric" ADD COLUMN "interruptions" INTEGER;
