-- CreateTable
CREATE TABLE "ActivitySession" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "modality" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "durationMinutes" DOUBLE PRECISION,
    "intensity" TEXT,
    "avgHeartRate" INTEGER,
    "maxHeartRate" INTEGER,
    "minHeartRate" INTEGER,
    "calories" INTEGER,
    "distanceMeters" DOUBLE PRECISION,
    "strain" DOUBLE PRECISION,
    "zone0Minutes" DOUBLE PRECISION,
    "zone1Minutes" DOUBLE PRECISION,
    "zone2Minutes" DOUBLE PRECISION,
    "zone3Minutes" DOUBLE PRECISION,
    "zone4Minutes" DOUBLE PRECISION,
    "zone5Minutes" DOUBLE PRECISION,
    "source" TEXT,
    "notes" TEXT,
    "relatedWorkoutSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivitySession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivitySession_startedAt_idx" ON "ActivitySession"("startedAt");

-- CreateIndex
CREATE INDEX "ActivitySession_type_idx" ON "ActivitySession"("type");

-- CreateIndex
CREATE INDEX "ActivitySession_relatedWorkoutSessionId_idx" ON "ActivitySession"("relatedWorkoutSessionId");

-- AddForeignKey
ALTER TABLE "ActivitySession" ADD CONSTRAINT "ActivitySession_relatedWorkoutSessionId_fkey" FOREIGN KEY ("relatedWorkoutSessionId") REFERENCES "WorkoutSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
