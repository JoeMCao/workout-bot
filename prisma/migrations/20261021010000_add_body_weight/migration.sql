CREATE TABLE "BodyWeight" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'apple_health',
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BodyWeight_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BodyWeight_weightKg_check" CHECK ("weightKg" > 0 AND "weightKg" <= 1000)
);
CREATE UNIQUE INDEX "BodyWeight_source_measuredAt_key" ON "BodyWeight"("source", "measuredAt");
CREATE INDEX "BodyWeight_measuredAt_idx" ON "BodyWeight"("measuredAt");
