/**
 * Phase 1: For each WorkoutSession with no linked ActivitySession, create a shell
 * ActivitySession (type strength) and set relatedWorkoutSessionId.
 * Idempotent: safe to re-run; skips workouts that already have linked activities.
 *
 * Usage: npx tsx scripts/backfill-strength-activity-sessions.ts
 * Requires DATABASE_URL (e.g. from .env).
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import {
  activitySessionTimeSource,
  workoutSessionTimeSource,
  type ActivitySessionTimeSource
} from "../lib/time.ts";

function createPrisma() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }
  const adapter = new PrismaPg(databaseUrl);
  return new PrismaClient({ adapter, log: ["error", "warn"] });
}

function durationMinutes(startedAt: Date, endedAt: Date | null) {
  if (!endedAt) return null;
  const ms = endedAt.getTime() - startedAt.getTime();
  return ms > 0 ? ms / 60_000 : null;
}

function mapTimeSource(raw: string | null | undefined): ActivitySessionTimeSource | null {
  if (raw === workoutSessionTimeSource.apiDefault) {
    return activitySessionTimeSource.apiDefault;
  }
  if (raw === workoutSessionTimeSource.userProvided) {
    return activitySessionTimeSource.userProvided;
  }
  return null;
}

function inferModality(sessionType: string | null | undefined) {
  if (!sessionType) return "weightlifting";
  const t = sessionType.toLowerCase();
  if (t.includes("functional") || t.includes("crossfit") || t.includes("metcon")) {
    return "functional_fitness";
  }
  return "weightlifting";
}

async function main() {
  const prisma = createPrisma();
  const workouts = await prisma.workoutSession.findMany({
    where: { linkedActivitySessions: { none: {} } },
    orderBy: { startedAt: "asc" }
  });

  let created = 0;
  for (const session of workouts) {
    await prisma.activitySession.create({
      data: {
        type: "strength",
        modality: inferModality(session.sessionType),
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        durationMinutes: durationMinutes(session.startedAt, session.endedAt),
        timeSource: mapTimeSource(session.timeSource),
        timezone: session.timezone,
        source: "manual",
        notes: session.notes ?? undefined,
        relatedWorkoutSession: { connect: { id: session.id } }
      }
    });
    created += 1;
  }

  console.info(
    `[backfill-strength-activities] WorkoutSessions without link: ${workouts.length}; created ActivitySessions: ${created}`
  );
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
