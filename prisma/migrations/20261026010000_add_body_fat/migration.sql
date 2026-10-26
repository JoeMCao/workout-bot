CREATE TABLE "BodyFat" (
    "id" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BodyFat_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BodyFat_percentage_check" CHECK ("percentage" > 0 AND "percentage" <= 100)
);
CREATE UNIQUE INDEX "BodyFat_sourceName_measuredAt_key" ON "BodyFat"("sourceName", "measuredAt");
CREATE INDEX "BodyFat_measuredAt_idx" ON "BodyFat"("measuredAt");
