import { prisma } from "@/lib/prisma";
import { getTrainingPlan } from "@/lib/services/training-plan";
import { getWeeklyTrainingReview } from "@/lib/services/weekly-training-review";
import {
  DEFAULT_USER_TIMEZONE,
  getLocalDateKey,
  getServerNow,
  getStartOfLocalDateUtc,
  getStartOfLocalWeekUtc,
  shiftLocalDateKey
} from "@/lib/time";
import { normalizeExerciseName } from "@/lib/validation";
import { queryWhoopHealthContextDays } from "@/lib/whoop/health-context-query";
import { getWhoopStatus } from "@/lib/whoop/sync";
import { refreshWhoopIfStale } from "@/lib/whoop/refresh-if-stale";
import {
  buildPlannedExerciseProgress,
  selectDashboardSlot,
  selectDashboardExerciseNames,
  summarizeWeek,
  type DashboardPlanSlot,
  type DashboardSlotStatus,
  type ExerciseHistorySet,
  type OverviewLookbackWeeks
} from "./plan-progress";

function exerciseNamesFromJson(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((name): name is string => typeof name === "string" && name.trim().length > 0);
}

function asSlotStatus(value: string): DashboardSlotStatus {
  if (
    value === "planned" ||
    value === "in_progress" ||
    value === "completed" ||
    value === "skipped" ||
    value === "replaced"
  ) {
    return value;
  }
  return "planned";
}

function planSlotForDashboard(
  slot: Awaited<ReturnType<typeof getTrainingPlan>>["slots"][number]
): DashboardPlanSlot {
  return {
    id: slot.id,
    plannedDate: slot.plannedDate,
    focus: slot.focus,
    status: asSlotStatus(slot.status),
    exerciseNames: exerciseNamesFromJson(slot.exerciseNames),
    actualExerciseNames: uniqueExerciseNames(slot.workoutSession?.sets ?? []),
    notes: slot.notes,
    workoutSessionId: slot.workoutSession?.id ?? null,
    workoutSessionEnded: slot.workoutSession?.endedAt != null
  };
}

function uniqueExerciseNames(
  sets: Array<{ exercise: { name: string } }>
) {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const set of sets) {
    const normalized = normalizeExerciseName(set.exercise.name);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    names.push(set.exercise.name);
  }
  return names;
}

async function latestCompletedWorkoutSlot(): Promise<DashboardPlanSlot | null> {
  const workout = await prisma.workoutSession.findFirst({
    where: { endedAt: { not: null } },
    orderBy: { startedAt: "desc" },
    include: {
      sets: {
        orderBy: { completedAt: "asc" },
        select: { exercise: { select: { name: true } } }
      }
    }
  });
  if (!workout) return null;

  return {
    id: workout.id,
    plannedDate: getLocalDateKey(workout.startedAt, DEFAULT_USER_TIMEZONE),
    focus: workout.goal ?? workout.sessionType ?? "Latest completed workout",
    status: "completed",
    exerciseNames: [],
    actualExerciseNames: uniqueExerciseNames(workout.sets),
    notes: workout.notes,
    workoutSessionId: workout.id,
    workoutSessionEnded: true
  };
}

export async function getPlanDrivenOverview({
  date = getServerNow(),
  lookbackWeeks = 8
}: {
  date?: Date;
  lookbackWeeks?: OverviewLookbackWeeks;
} = {}) {
  const today = getLocalDateKey(date, DEFAULT_USER_TIMEZONE);
  const weekStart = getLocalDateKey(
    getStartOfLocalWeekUtc(date, DEFAULT_USER_TIMEZONE),
    DEFAULT_USER_TIMEZONE
  );
  let whoopRefresh: Awaited<ReturnType<typeof refreshWhoopIfStale>> | null = null;
  try {
    whoopRefresh = await refreshWhoopIfStale({ maxAgeMinutes: 10 });
  } catch {
    whoopRefresh = null;
  }
  const tomorrow = shiftLocalDateKey(today, 1, DEFAULT_USER_TIMEZONE);
  const [weeklyReview, todayActivities] = await Promise.all([
    getWeeklyTrainingReview({ weekStart }),
    prisma.activitySession.findMany({
      where: {
        startedAt: {
          gte: getStartOfLocalDateUtc(today, DEFAULT_USER_TIMEZONE),
          lt: getStartOfLocalDateUtc(tomorrow, DEFAULT_USER_TIMEZONE)
        },
        type: { not: "strength" }
      },
      orderBy: { startedAt: "asc" },
      select: {
        id: true,
        type: true,
        modality: true,
        sourceActivityType: true,
        durationMinutes: true,
        avgHeartRate: true,
        source: true
      }
    })
  ]);
  const plan = weeklyReview.plan;
  const slots = plan.slots.map(planSlotForDashboard);
  const selected = selectDashboardSlot({
    planIsActive: plan.plan?.status === "active",
    slots,
    today
  });

  const fallbackSlot = selected ? null : await latestCompletedWorkoutSlot();
  const displayedSlot = selected?.slot ?? fallbackSlot;
  const slotSource = selected?.source ?? (fallbackSlot ? "latest" : null);
  const startDateKey = shiftLocalDateKey(
    today,
    -lookbackWeeks * 7,
    DEFAULT_USER_TIMEZONE
  );
  const exerciseSelection = displayedSlot
    ? selectDashboardExerciseNames(displayedSlot)
    : { exerciseNames: [], source: "planned" as const };
  const normalizedNames = [
    ...new Set(exerciseSelection.exerciseNames.map(normalizeExerciseName))
  ];

  const historyRows =
    normalizedNames.length > 0
      ? await prisma.exerciseSet.findMany({
          where: {
            exercise: { normalizedName: { in: normalizedNames } }
          },
          orderBy: { completedAt: "asc" },
          select: {
            id: true,
            setNumber: true,
            weight: true,
            reps: true,
            exercise: { select: { normalizedName: true } },
            session: { select: { id: true, startedAt: true } }
          }
        })
      : [];

  const historyByName = new Map<string, ExerciseHistorySet[]>();
  for (const row of historyRows) {
    const rows = historyByName.get(row.exercise.normalizedName) ?? [];
    rows.push({
      id: row.id,
      sessionId: row.session.id,
      sessionDateKey: getLocalDateKey(row.session.startedAt, DEFAULT_USER_TIMEZONE),
      setNumber: row.setNumber,
      weight: row.weight,
      reps: row.reps
    });
    historyByName.set(row.exercise.normalizedName, rows);
  }

  const exercises = exerciseSelection.exerciseNames.map((exerciseName) =>
    buildPlannedExerciseProgress({
      exerciseName,
      rows: historyByName.get(normalizeExerciseName(exerciseName)) ?? [],
      startDateKey,
      endDateKey: today,
      currentSessionId: displayedSlot?.workoutSessionId
    })
  );

  let recoveryContext: {
    localDate: string;
    recoveryScore: number | null;
    sleepPerformancePercentage: number | null;
  } | null = null;
  if (displayedSlot?.plannedDate === today) {
    try {
      const health = await queryWhoopHealthContextDays({ anchorDate: today, days: 1 });
      const current = health.context[0];
      recoveryContext = {
        localDate: today,
        recoveryScore: current?.recovery?.recoveryScore ?? null,
        sleepPerformancePercentage:
          current?.sleep?.sleepPerformancePercentage ?? null
      };
    } catch {
      recoveryContext = null;
    }
  }

  return {
    today,
    timezone: DEFAULT_USER_TIMEZONE,
    lookbackWeeks,
    plan: plan.plan,
    displayedSlot,
    slotSource,
    exerciseSource: exerciseSelection.source,
    noUpcomingWorkout: slotSource === "latest",
    week: summarizeWeek(plan.plan?.status === "active" ? slots : []),
    weeklyTargets: {
      targets: weeklyReview.targets,
      actual: weeklyReview.actual,
      countingRules: weeklyReview.countingRules
    },
    todayActivities,
    whoopRefresh,
    recoveryContext,
    exercises
  };
}

export async function getDataHealthData() {
  const [workoutSessionsTotal, withLinkedActivity, whoop] = await Promise.all([
    prisma.workoutSession.count(),
    prisma.workoutSession.count({
      where: { linkedActivitySessions: { some: {} } }
    }),
    getWhoopStatus()
  ]);

  return {
    whoop,
    workoutActivityLinks: {
      workoutSessionsTotal,
      withLinkedActivity,
      withoutLinkedActivity: workoutSessionsTotal - withLinkedActivity
    }
  };
}
