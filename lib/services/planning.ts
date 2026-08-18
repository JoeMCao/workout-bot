import { getWhoopStatus } from "@/lib/whoop/sync";
import { queryWhoopHealthContextDays } from "@/lib/whoop/health-context-query";
import { DEFAULT_USER_TIMEZONE } from "@/lib/time";
import { serializeRecentWorkoutSessionsForApi } from "@/lib/sessions/recent-response";
import {
  getDatabaseTime,
  getExerciseHistory,
  getRecentWorkoutSessions
} from "@/lib/services/workout";
import { listRecentActivitySessions } from "@/lib/services/activity";
import { getTrainingPlan } from "@/lib/services/training-plan";

function publicRecoveryContext(
  context: Awaited<ReturnType<typeof queryWhoopHealthContextDays>>["context"]
) {
  return context.map(({ localDate, sleep, recovery }) => ({
    localDate,
    sleep: sleep
      ? {
          id: sleep.id,
          sourceSleepId: sleep.sourceSleepId,
          startedAt: sleep.startedAt,
          endedAt: sleep.endedAt,
          scoreState: sleep.scoreState,
          sleepPerformancePercentage: sleep.sleepPerformancePercentage,
          sleepConsistencyPercentage: sleep.sleepConsistencyPercentage,
          sleepEfficiencyPercentage: sleep.sleepEfficiencyPercentage,
          sleepNeededSeconds: sleep.sleepNeededSeconds,
          sleepDurationSeconds: sleep.sleepDurationSeconds,
          timeInBedSeconds: sleep.timeInBedSeconds,
          awakeTimeSeconds: sleep.awakeTimeSeconds,
          slowWaveSleepSeconds: sleep.slowWaveSleepSeconds,
          remSleepSeconds: sleep.remSleepSeconds,
          lightSleepSeconds: sleep.lightSleepSeconds,
          respiratoryRate: sleep.respiratoryRate,
          updatedAt: sleep.updatedAt
        }
      : null,
    recovery: recovery
      ? {
          id: recovery.id,
          sourceRecoveryId: recovery.sourceRecoveryId,
          cycleId: recovery.cycleId,
          sleepId: recovery.sleepId,
          scoreState: recovery.scoreState,
          recoveryScore: recovery.recoveryScore,
          restingHeartRate: recovery.restingHeartRate,
          hrvRmssdMilli: recovery.hrvRmssdMilli,
          spo2Percentage: recovery.spo2Percentage,
          skinTempCelsius: recovery.skinTempCelsius,
          updatedAt: recovery.updatedAt
        }
      : null
  }));
}

function publicActivityContext(
  activity: Awaited<ReturnType<typeof listRecentActivitySessions>>[number]
) {
  const safeActivity = { ...activity };
  delete (safeActivity as { rawPayloadJson?: unknown }).rawPayloadJson;
  return safeActivity;
}

export async function getRecoveryContext({
  anchorDate,
  days = 3
}: {
  anchorDate?: string;
  days?: number;
} = {}) {
  const context = await queryWhoopHealthContextDays({ anchorDate, days });
  return {
    timezone: context.timezone,
    anchorDate: context.anchorDate,
    days: context.days,
    context: publicRecoveryContext(context.context)
  };
}

function serializeHistoryRow(set: Awaited<ReturnType<typeof getExerciseHistory>>[number]) {
  return {
    id: set.id,
    exerciseName: set.exercise.name,
    session: set.session,
    setNumber: set.setNumber,
    weight: set.weight,
    reps: set.reps,
    rpe: set.rpe,
    rir: set.rir,
    painFlag: set.painFlag,
    painNotes: set.painNotes,
    notes: set.notes,
    completedAt: set.completedAt
  };
}

export async function getTrainingContext({
  sessionLimit = 5,
  activityLimit = 10,
  exerciseNames = [],
  recoveryDays = 3
}: {
  sessionLimit?: number;
  activityLimit?: number;
  exerciseNames?: string[];
  recoveryDays?: number;
} = {}) {
  const names = [...new Set(exerciseNames.map((name) => name.trim()).filter(Boolean))].slice(0, 5);
  const [dbNow, sessions, activities, recovery, whoop, historyRows] =
    await Promise.all([
      getDatabaseTime(),
      getRecentWorkoutSessions(sessionLimit),
      listRecentActivitySessions({ limit: activityLimit }),
      getRecoveryContext({ days: recoveryDays }),
      getWhoopStatus(),
      Promise.all(names.map(async (name) => [name, await getExerciseHistory(name, 10)] as const))
    ]);

  const trainingPlan = await getTrainingPlan();

  return {
    now: { dbNow, timezone: DEFAULT_USER_TIMEZONE },
    trainingPlan,
    workouts: serializeRecentWorkoutSessionsForApi(sessions),
    activities: activities.map(publicActivityContext),
    exerciseHistory: Object.fromEntries(
      historyRows.map(([name, rows]) => [name, rows.map(serializeHistoryRow)])
    ),
    recovery,
    whoop
  };
}
