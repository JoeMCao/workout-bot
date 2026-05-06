import { prisma } from "@/lib/prisma";
import {
  activitySessionTimeSource,
  workoutSessionTimeSource,
  type ActivitySessionTimeSource
} from "@/lib/time";

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

export type StrengthShellBackfillResult = {
  eligible: number;
  created: number;
};

/**
 * For each WorkoutSession with no linked ActivitySession, create a shell ActivitySession
 * (type strength) and set relatedWorkoutSessionId. Idempotent; same as
 * `scripts/backfill-strength-activity-sessions.ts`.
 */
export async function backfillStrengthActivityShells(): Promise<StrengthShellBackfillResult> {
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

  return { eligible: workouts.length, created };
}
