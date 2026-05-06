-- CreateTable
CREATE TABLE "WhoopSleep" (
    "id" TEXT NOT NULL,
    "sourceSleepId" TEXT,
    "localDate" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "scoreState" TEXT,
    "sleepPerformancePercentage" DOUBLE PRECISION,
    "sleepConsistencyPercentage" DOUBLE PRECISION,
    "sleepEfficiencyPercentage" DOUBLE PRECISION,
    "sleepNeededSeconds" INTEGER,
    "sleepDurationSeconds" INTEGER,
    "timeInBedSeconds" INTEGER,
    "awakeTimeSeconds" INTEGER,
    "slowWaveSleepSeconds" INTEGER,
    "remSleepSeconds" INTEGER,
    "lightSleepSeconds" INTEGER,
    "respiratoryRate" DOUBLE PRECISION,
    "rawPayloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhoopSleep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhoopRecovery" (
    "id" TEXT NOT NULL,
    "sourceRecoveryId" TEXT,
    "localDate" TEXT NOT NULL,
    "cycleId" TEXT,
    "sleepId" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "scoreState" TEXT,
    "recoveryScore" INTEGER,
    "restingHeartRate" DOUBLE PRECISION,
    "hrvRmssdMilli" DOUBLE PRECISION,
    "spo2Percentage" DOUBLE PRECISION,
    "skinTempCelsius" DOUBLE PRECISION,
    "rawPayloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhoopRecovery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhoopSleep_sourceSleepId_key" ON "WhoopSleep"("sourceSleepId");

-- CreateIndex
CREATE INDEX "WhoopSleep_localDate_idx" ON "WhoopSleep"("localDate");

-- CreateIndex
CREATE INDEX "WhoopSleep_startedAt_idx" ON "WhoopSleep"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhoopRecovery_sourceRecoveryId_key" ON "WhoopRecovery"("sourceRecoveryId");

-- CreateIndex
CREATE INDEX "WhoopRecovery_localDate_idx" ON "WhoopRecovery"("localDate");

-- CreateIndex
CREATE INDEX "WhoopRecovery_cycleId_idx" ON "WhoopRecovery"("cycleId");

-- CreateIndex
CREATE INDEX "WhoopRecovery_sleepId_idx" ON "WhoopRecovery"("sleepId");
