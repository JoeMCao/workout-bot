import { isIntentionalCardioActivity } from "@/lib/activity-classification";
import { prisma } from "@/lib/prisma";
import { getTrainingPlan } from "@/lib/services/training-plan";
import {
  DEFAULT_USER_TIMEZONE,
  getLocalDateKey,
  getServerNow,
  getStartOfLocalWeekUtc,
  shiftLocalDateKey
} from "@/lib/time";
import { weeklyTrainingTargetsSchema } from "@/lib/validation";
import { queryWhoopHealthContextDays } from "@/lib/whoop/health-context-query";

function sum(values: Array<number | null | undefined>) {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function average(values: Array<number | null | undefined>) {
  const present = values.filter((value): value is number => value != null);
  if (present.length === 0) return null;
  return Math.round((sum(present) / present.length) * 10) / 10;
}

function roundMinutes(value: number) {
  return Math.round(value);
}

function weekRange(weekStart: string) {
  const start = getStartOfLocalWeekUtc(new Date(`${weekStart}T12:00:00.000Z`));
  const nextWeek = shiftLocalDateKey(weekStart, 7, DEFAULT_USER_TIMEZONE);
  const end = getStartOfLocalWeekUtc(new Date(`${nextWeek}T12:00:00.000Z`));
  return { start, end };
}

export async function getWeeklyTrainingReview({
  weekStart
}: {
  weekStart?: string;
} = {}) {
  const currentWeekStart = getLocalDateKey(
    getStartOfLocalWeekUtc(getServerNow(), DEFAULT_USER_TIMEZONE),
    DEFAULT_USER_TIMEZONE
  );
  const reviewedWeekStart = weekStart ?? shiftLocalDateKey(currentWeekStart, -7);
  const plan = await getTrainingPlan({ weekStart: reviewedWeekStart });
  const { start, end } = weekRange(reviewedWeekStart);
  const weekEnd = shiftLocalDateKey(reviewedWeekStart, 6, DEFAULT_USER_TIMEZONE);

  const [strengthSessions, activities, health] = await Promise.all([
    prisma.workoutSession.findMany({
      where: {
        startedAt: { gte: start, lt: end },
        endedAt: { not: null },
        sets: { some: {} }
      },
      select: { id: true, startedAt: true }
    }),
    prisma.activitySession.findMany({
      where: { startedAt: { gte: start, lt: end } },
      orderBy: { startedAt: "asc" },
      select: {
        id: true,
        type: true,
        startedAt: true,
        durationMinutes: true,
        zone2Minutes: true,
        strain: true,
        source: true
      }
    }),
    queryWhoopHealthContextDays({ anchorDate: weekEnd, days: 7 })
  ]);

  const cardio = activities.filter((activity) =>
    isIntentionalCardioActivity(activity.type)
  );
  const walks = activities.filter((activity) => activity.type === "walk");
  const heat = activities.filter((activity) => activity.type === "sauna");
  const surf = activities.filter((activity) => activity.type === "surf");
  const runs = activities.filter((activity) => activity.type === "run");
  const byType = new Map<string, { sessions: number; durationMinutes: number; zone2Minutes: number }>();

  for (const activity of activities) {
    const existing = byType.get(activity.type) ?? {
      sessions: 0,
      durationMinutes: 0,
      zone2Minutes: 0
    };
    existing.sessions += 1;
    existing.durationMinutes += activity.durationMinutes ?? 0;
    existing.zone2Minutes += activity.zone2Minutes ?? 0;
    byType.set(activity.type, existing);
  }

  const parsedTargets = weeklyTrainingTargetsSchema.safeParse(plan.plan?.targets);

  return {
    weekStart: reviewedWeekStart,
    weekEnd,
    timezone: DEFAULT_USER_TIMEZONE,
    plan,
    targets: parsedTargets.success ? parsedTargets.data : null,
    actual: {
      strengthSessions: strengthSessions.length,
      cardioSessions: cardio.length,
      cardioMinutes: roundMinutes(sum(cardio.map((activity) => activity.durationMinutes))),
      walkSessions: walks.length,
      walkMinutes: roundMinutes(sum(walks.map((activity) => activity.durationMinutes))),
      zone2Minutes: roundMinutes(sum(cardio.map((activity) => activity.zone2Minutes))),
      runSessions: runs.length,
      heatSessions: heat.length,
      heatMinutes: roundMinutes(sum(heat.map((activity) => activity.durationMinutes))),
      surfSessions: surf.length,
      surfMinutes: roundMinutes(sum(surf.map((activity) => activity.durationMinutes)))
    },
    activitiesByType: [...byType.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([type, totals]) => ({
        type,
        sessions: totals.sessions,
        durationMinutes: roundMinutes(totals.durationMinutes),
        zone2Minutes: roundMinutes(totals.zone2Minutes)
      })),
    recovery: {
      daysWithRecovery: health.context.filter((day) => day.recovery?.recoveryScore != null)
        .length,
      averageRecoveryScore: average(
        health.context.map((day) => day.recovery?.recoveryScore)
      ),
      daysWithSleep: health.context.filter(
        (day) => day.sleep?.sleepPerformancePercentage != null
      ).length,
      averageSleepPerformance: average(
        health.context.map((day) => day.sleep?.sleepPerformancePercentage)
      )
    },
    countingRules: {
      strengthSessions: "Completed WorkoutSessions with at least one logged set.",
      cardioSessions:
        "Intentional zone2, hiit, stairmaster, run, hike, swim, and bike ActivitySessions. Walks are reported separately.",
      walks: "Walk ActivitySessions, reported separately from intentional cardio training.",
      zone2Minutes:
        "Observed zone 2 minutes from cardio ActivitySessions. Surf is reported separately and does not satisfy the prescribed Zone 2 target.",
      heat: "Sauna ActivitySessions.",
      surf: "Reported separately; never assumed to be hard training."
    }
  };
}
