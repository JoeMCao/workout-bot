-- ActivitySession: provenance for startedAt + default user timezone label
ALTER TABLE "ActivitySession" ADD COLUMN     "timeSource" TEXT,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles';

-- WorkoutSession: same semantics for strength session start time
ALTER TABLE "WorkoutSession" ADD COLUMN     "timeSource" TEXT,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles';
