-- CreateTable
CREATE TABLE "TrainingWeek" (
    "id" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "objective" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSlot" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "plannedDate" TEXT NOT NULL,
    "focus" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "exerciseNames" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSlot_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "WorkoutSession" ADD COLUMN "planSlotId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TrainingWeek_weekStart_key" ON "TrainingWeek"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingSlot_weekId_plannedDate_key" ON "TrainingSlot"("weekId", "plannedDate");

-- CreateIndex
CREATE INDEX "TrainingSlot_plannedDate_status_idx" ON "TrainingSlot"("plannedDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutSession_planSlotId_key" ON "WorkoutSession"("planSlotId");

-- AddForeignKey
ALTER TABLE "TrainingSlot" ADD CONSTRAINT "TrainingSlot_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "TrainingWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_planSlotId_fkey" FOREIGN KEY ("planSlotId") REFERENCES "TrainingSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
