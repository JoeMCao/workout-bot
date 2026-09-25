CREATE TABLE "SensationCheckIn" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SensationCheckIn_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SensationCheckIn_observedAt_idx" ON "SensationCheckIn"("observedAt");
