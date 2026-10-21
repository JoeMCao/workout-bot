CREATE TABLE "BloodPressure" (
  "id" TEXT NOT NULL,
  "sourceName" TEXT NOT NULL,
  "measuredAt" TIMESTAMP(3) NOT NULL,
  "systolic" DOUBLE PRECISION,
  "diastolic" DOUBLE PRECISION,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BloodPressure_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BloodPressure_systolic_check" CHECK ("systolic" > 0 AND "systolic" <= 500),
  CONSTRAINT "BloodPressure_diastolic_check" CHECK ("diastolic" > 0 AND "diastolic" <= 500)
);
CREATE UNIQUE INDEX "BloodPressure_sourceName_measuredAt_key" ON "BloodPressure"("sourceName", "measuredAt");
CREATE INDEX "BloodPressure_measuredAt_idx" ON "BloodPressure"("measuredAt");
CREATE TABLE "OmronPulse" (
  "id" TEXT NOT NULL,
  "sourceName" TEXT NOT NULL,
  "measuredAt" TIMESTAMP(3) NOT NULL,
  "bpm" DOUBLE PRECISION NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OmronPulse_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OmronPulse_bpm_check" CHECK ("bpm" > 0 AND "bpm" <= 500)
);
CREATE UNIQUE INDEX "OmronPulse_sourceName_measuredAt_key" ON "OmronPulse"("sourceName", "measuredAt");
CREATE INDEX "OmronPulse_measuredAt_idx" ON "OmronPulse"("measuredAt");
