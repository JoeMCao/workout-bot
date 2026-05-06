import type {
  ActivitySession,
  Exercise,
  ExerciseSet,
  Prisma,
  WorkoutSession
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_USER_TIMEZONE,
  formatLocalDate,
  formatLocalShortDate,
  getLocalDateKey,
  getServerNow,
  getStartOfLocalWeekUtc
} from "@/lib/time";
import { queryWhoopHealthContextDays } from "@/lib/whoop/health-context-query";
import { getWhoopStatus } from "@/lib/whoop/sync";

/** Activity rows that are not shells linked to a WorkoutSession (avoids duplicate log/overview lines). */
const standaloneActivityWhere = {
  relatedWorkoutSessionId: null
} satisfies Prisma.ActivitySessionWhereInput;

export const activityFilters = [
  "all",
  "strength",
  "cardio",
  "sauna",
  "cold_plunge",
  "mobility"
] as const;

export type ActivityFilter = (typeof activityFilters)[number];

export const cardioActivityTypes = [
  "zone2",
  "hiit",
  "stairmaster",
  "run",
  "walk",
  "hike",
  "surf",
  "swim",
  "bike"
] as const;

function activityWhereForTrainingLog(
  filter: ActivityFilter
): Prisma.ActivitySessionWhereInput {
  if (filter === "all") {
    return standaloneActivityWhere;
  }
  if (filter === "cardio") {
    return { ...standaloneActivityWhere, type: { in: [...cardioActivityTypes] } };
  }
  return { ...standaloneActivityWhere, type: filter };
}

type WorkoutWithSets = WorkoutSession & {
  sets: Array<ExerciseSet & { exercise: Exercise }>;
  linkedActivitySessions: ActivitySession[];
};

export type ContextTag =
  | "sore"
  | "tired"
  | "neck"
  | "hamstring"
  | "low_back"
  | "cold_plunge"
  | "sauna"
  | "poor_sleep"
  | "high_fatigue"
  | "pain";

export type TrainingLogItem = {
  id: string;
  kind: "strength" | "activity";
  type: string;
  date: string;
  dateKey: string;
  durationMinutes: number | null;
  title: string;
  details: string;
  intensity: string | null;
  notes: string | null;
  source: string;
  tags: ContextTag[];
};

export type StrengthProgressPoint = {
  id: string;
  date: string;
  dateKey: string;
  exerciseName: string;
  setNumber: number | null;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  estimatedOneRepMax: number | null;
  isBestWeight: boolean;
  isBestEstimatedOneRepMax: boolean;
  notes: string | null;
};

export type CardioTrendPoint = {
  id: string;
  date: string;
  dateKey: string;
  type: string;
  modality: string;
  durationMinutes: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  calories: number | null;
  distanceMeters: number | null;
  elevationGainMeters: number | null;
  elevationLossMeters: number | null;
  paceSecondsPerKm: number | null;
  zoneMinutes: number[];
  notes: string | null;
  tags: ContextTag[];
};

export type ContextEvent = {
  id: string;
  date: string;
  dateKey: string;
  source: string;
  label: string;
  tags: ContextTag[];
  notes: string | null;
};

const tagLabels: Record<ContextTag, string> = {
  sore: "Sore",
  tired: "Tired",
  neck: "Neck",
  hamstring: "Hamstring",
  low_back: "Low back",
  cold_plunge: "Cold plunge",
  sauna: "Sauna",
  poor_sleep: "Poor sleep",
  high_fatigue: "High fatigue",
  pain: "Pain"
};

export function labelForTag(tag: ContextTag) {
  return tagLabels[tag];
}

export function isActivityFilter(value: string | undefined): value is ActivityFilter {
  return activityFilters.includes((value ?? "all") as ActivityFilter);
}

export function isCardioActivity(type: string) {
  return cardioActivityTypes.includes(type as (typeof cardioActivityTypes)[number]);
}

export function formatDate(value: string | Date) {
  return formatLocalDate(value);
}

export function formatShortDate(value: string | Date) {
  return formatLocalShortDate(value);
}

export function formatDuration(minutes: number | null) {
  if (minutes == null) return "Not logged";
  if (minutes < 60) return `${Math.round(minutes)} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export function formatDistance(meters: number | null) {
  if (meters == null) return null;
  const miles = meters / 1609.344;
  return `${miles.toFixed(2)} mi`;
}

export function formatElevation(meters: number | null) {
  if (meters == null) return null;
  const feet = meters * 3.28084;
  return `${Math.round(feet)} ft`;
}

export function formatPace(secondsPerKm: number | null) {
  if (secondsPerKm == null) return null;
  const secondsPerMile = Math.round(secondsPerKm * 1.609344);
  const minutes = Math.floor(secondsPerMile / 60);
  const seconds = secondsPerMile % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")} / mi`;
}

function durationFromDates(startedAt: Date, endedAt: Date | null) {
  if (!endedAt) return null;
  return Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));
}

function workoutDuration(session: WorkoutSession) {
  return durationFromDates(session.startedAt, session.endedAt);
}

function compact<T>(values: Array<T | null | undefined | false>) {
  return values.filter(Boolean) as T[];
}

function uniqueTags(tags: ContextTag[]) {
  return Array.from(new Set(tags));
}

function textIncludes(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function tagsFromText(text: string): ContextTag[] {
  const normalized = text.toLowerCase();
  const tags: ContextTag[] = [];

  if (textIncludes(normalized, ["sore", "soreness", "aching"])) tags.push("sore");
  if (textIncludes(normalized, ["tired", "fatigue", "fatigued", "exhausted"])) {
    tags.push("tired");
  }
  if (textIncludes(normalized, ["neck"])) tags.push("neck");
  if (textIncludes(normalized, ["hamstring", "hamstrings"])) tags.push("hamstring");
  if (textIncludes(normalized, ["low back", "lower back", "lumbar"])) {
    tags.push("low_back");
  }
  if (textIncludes(normalized, ["cold plunge", "cold_plunge", "plunge"])) {
    tags.push("cold_plunge");
  }
  if (textIncludes(normalized, ["sauna"])) tags.push("sauna");
  if (textIncludes(normalized, ["poor sleep", "bad sleep", "low sleep"])) {
    tags.push("poor_sleep");
  }
  if (textIncludes(normalized, ["high fatigue", "very fatigued"])) {
    tags.push("high_fatigue");
  }
  if (textIncludes(normalized, ["pain", "irritation", "tightness"])) tags.push("pain");

  return tags;
}

function sorenessAreas(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((area): area is string => typeof area === "string");
}

function tagsForWorkout(session: WorkoutSession): ContextTag[] {
  const text = compact([
    session.notes,
    session.soreness,
    session.sleepQuality,
    session.readinessNotes,
    session.lowBackPainSeverity,
    session.elbowIrritation,
    session.neckTightness,
    session.shoulderIrritation,
    session.fatigueLevel,
    ...sorenessAreas(session.sorenessAreas)
  ]).join(" ");

  const tags = tagsFromText(text);

  if (session.lowBackPain || session.lowBackPainSeverity) tags.push("low_back", "pain");
  if (session.neckTightness && session.neckTightness !== "none") {
    tags.push("neck", "pain");
  }
  if (session.fatigueLevel === "high") tags.push("high_fatigue", "tired");
  if (session.soreness) tags.push("sore");
  if (session.sleepQuality?.toLowerCase().includes("poor")) tags.push("poor_sleep");

  for (const area of sorenessAreas(session.sorenessAreas)) {
    tags.push(...tagsFromText(area));
  }

  return uniqueTags(tags);
}

function tagsForActivity(activity: ActivitySession): ContextTag[] {
  const tags = tagsFromText([activity.type, activity.modality, activity.notes].join(" "));

  if (activity.type === "cold_plunge") tags.push("cold_plunge");
  if (activity.type === "sauna") tags.push("sauna");

  return uniqueTags(tags);
}

function exerciseSummary(sets: Array<ExerciseSet & { exercise: Exercise }>) {
  const exerciseNames = Array.from(new Set(sets.map((set) => set.exercise.name)));
  if (exerciseNames.length === 0) return "No sets logged";
  if (exerciseNames.length <= 3) return exerciseNames.join(", ");
  return `${exerciseNames.slice(0, 3).join(", ")} +${exerciseNames.length - 3} more`;
}

function activityTitle(activity: ActivitySession) {
  return activity.modality ?? activity.type.replace("_", " ");
}

function estimatedOneRepMax(weight: number | null, reps: number | null) {
  if (!weight || !reps) return null;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

function workoutToLogItem(session: WorkoutWithSets): TrainingLogItem {
  return {
    id: session.id,
    kind: "strength",
    type: session.sessionType ?? "strength",
    date: session.startedAt.toISOString(),
    dateKey: getLocalDateKey(session.startedAt),
    durationMinutes: workoutDuration(session),
    title: session.goal ?? session.sessionType ?? "Strength session",
    details: exerciseSummary(session.sets),
    intensity: session.energy ? `Energy ${session.energy}` : null,
    notes: session.notes ?? session.readinessNotes,
    source: "workout_api",
    tags: tagsForWorkout(session)
  };
}

function activityToLogItem(activity: ActivitySession): TrainingLogItem {
  return {
    id: activity.id,
    kind: "activity",
    type: isCardioActivity(activity.type) ? "cardio" : activity.type,
    date: activity.startedAt.toISOString(),
    dateKey: getLocalDateKey(activity.startedAt),
    durationMinutes:
      activity.durationMinutes ?? durationFromDates(activity.startedAt, activity.endedAt),
    title: activityTitle(activity),
    details: compact([
      activity.type,
      activity.avgHeartRate ? `${activity.avgHeartRate} avg HR` : null,
      formatDistance(activity.distanceMeters),
      formatPace(activity.paceSecondsPerKm),
      activity.elevationGainMeters != null
        ? `${formatElevation(activity.elevationGainMeters)} gain`
        : null
    ]).join(" / "),
    intensity: activity.intensity,
    notes: activity.notes,
    source: activity.source ?? "activity_api",
    tags: tagsForActivity(activity)
  };
}

export async function getTrainingLog(filter: ActivityFilter = "all") {
  const includeWorkouts = filter === "all" || filter === "strength";
  const includeActivities = filter !== "strength";

  const [workouts, activities] = await Promise.all([
    includeWorkouts
      ? prisma.workoutSession.findMany({
          orderBy: { startedAt: "desc" },
          take: 250,
          include: {
            sets: { include: { exercise: true }, orderBy: { completedAt: "asc" } },
            linkedActivitySessions: true
          }
        })
      : Promise.resolve([]),
    includeActivities
      ? prisma.activitySession.findMany({
          where: activityWhereForTrainingLog(filter),
          orderBy: { startedAt: "desc" },
          take: 250
        })
      : Promise.resolve([])
  ]);

  return [...workouts.map(workoutToLogItem), ...activities.map(activityToLogItem)].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export async function getOverviewData() {
  const weekStart = getStartOfLocalWeekUtc();

  const [
    totalWorkouts,
    workoutsWithLinkedActivity,
    standaloneActivityCount,
    workoutsThisWeek,
    activitiesThisWeek,
    recentWorkouts,
    recentActivities
  ] = await Promise.all([
    prisma.workoutSession.count(),
    prisma.workoutSession.count({
      where: { linkedActivitySessions: { some: {} } }
    }),
    prisma.activitySession.count({ where: standaloneActivityWhere }),
    prisma.workoutSession.findMany({
      where: { startedAt: { gte: weekStart } },
      include: {
        sets: { include: { exercise: true } },
        linkedActivitySessions: true
      },
      orderBy: { startedAt: "desc" }
    }),
    prisma.activitySession.findMany({
      where: {
        ...standaloneActivityWhere,
        startedAt: { gte: weekStart }
      },
      orderBy: { startedAt: "desc" }
    }),
    prisma.workoutSession.findMany({
      orderBy: { startedAt: "desc" },
      take: 8,
      include: {
        sets: { include: { exercise: true }, orderBy: { completedAt: "asc" } },
        linkedActivitySessions: true
      }
    }),
    prisma.activitySession.findMany({
      where: standaloneActivityWhere,
      orderBy: { startedAt: "desc" },
      take: 12
    })
  ]);

  const latestItems = [
    ...recentWorkouts.map(workoutToLogItem),
    ...recentActivities.map(activityToLogItem)
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const thisWeekLog = [
    ...workoutsThisWeek.map(workoutToLogItem),
    ...activitiesThisWeek.map(activityToLogItem)
  ];

  const contexts = [
    ...recentWorkouts.map((s) => workoutToContextEvent(s, { includeInferredTags: false })),
    ...recentActivities.map((a) => activityToContextEvent(a, { includeInferredTags: false }))
  ]
    .filter((event) => event.tags.length > 0 || event.notes)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  const whoop = await getWhoopStatus();

  let whoopHealthSnap: Awaited<ReturnType<typeof queryWhoopHealthContextDays>>;
  let todayHealth: (typeof whoopHealthSnap.context)[0] | undefined;
  try {
    whoopHealthSnap = await queryWhoopHealthContextDays({ days: 1 });
    todayHealth = whoopHealthSnap.context[0];
  } catch {
    const anchorDate = getLocalDateKey(getServerNow(), DEFAULT_USER_TIMEZONE);
    whoopHealthSnap = {
      timezone: DEFAULT_USER_TIMEZONE,
      anchorDate,
      days: 1,
      context: [{ localDate: anchorDate, sleep: null, recovery: null }]
    };
    todayHealth = whoopHealthSnap.context[0];
  }

  return {
    latest: latestItems[0] ?? null,
    totals: {
      sessions: totalWorkouts + standaloneActivityCount,
      strength: totalWorkouts,
      cardio: await prisma.activitySession.count({
        where: { type: { in: [...cardioActivityTypes] } }
      }),
      sauna: await prisma.activitySession.count({ where: { type: "sauna" } }),
      coldPlunge: await prisma.activitySession.count({ where: { type: "cold_plunge" } }),
      mobility: await prisma.activitySession.count({ where: { type: "mobility" } })
    },
    week: {
      total: thisWeekLog.length,
      strength: workoutsThisWeek.length,
      cardio: activitiesThisWeek.filter((activity) => isCardioActivity(activity.type)).length,
      minutes: Math.round(
        thisWeekLog.reduce((sum, item) => sum + (item.durationMinutes ?? 0), 0)
      )
    },
    recentContext: contexts,
    /** Strength WorkoutSessions ↔ ActivitySession link coverage (`relatedWorkoutSessionId` / `linkedActivitySessions`). */
    workoutActivityLinks: {
      workoutSessionsTotal: totalWorkouts,
      withLinkedActivity: workoutsWithLinkedActivity,
      withoutLinkedActivity: totalWorkouts - workoutsWithLinkedActivity
    },
    whoop,
    whoopHealth: {
      localDate: whoopHealthSnap.anchorDate,
      recoveryScore: todayHealth?.recovery?.recoveryScore ?? null,
      sleepPerformancePercentage: todayHealth?.sleep?.sleepPerformancePercentage ?? null,
      hrvRmssdMilli: todayHealth?.recovery?.hrvRmssdMilli ?? null,
      restingHeartRate: todayHealth?.recovery?.restingHeartRate ?? null,
      lastHealthContextAt: whoop.lastHealthContextAt,
      lastSyncError: whoop.lastSyncError,
      readSleep: whoop.readSleep,
      readRecovery: whoop.readRecovery
    }
  };
}

export async function getExercises() {
  return prisma.exercise.findMany({
    orderBy: { name: "asc" }
  });
}

export async function getStrengthProgress(exerciseId?: string) {
  const exercises = await getExercises();
  const selectedExercise =
    exercises.find((exercise) => exercise.id === exerciseId) ?? exercises[0] ?? null;

  if (!selectedExercise) {
    return { exercises, selectedExercise: null, points: [] };
  }

  const sets = await prisma.exerciseSet.findMany({
    where: { exerciseId: selectedExercise.id },
    include: {
      exercise: true,
      session: {
        select: {
          id: true,
          startedAt: true,
          sessionType: true,
          goal: true
        }
      }
    },
    orderBy: { completedAt: "asc" }
  });

  const bestWeight = Math.max(0, ...sets.map((set) => set.weight ?? 0));
  const bestEstimatedOneRepMax = Math.max(
    0,
    ...sets.map((set) => estimatedOneRepMax(set.weight, set.reps) ?? 0)
  );

  const points: StrengthProgressPoint[] = sets.map((set) => {
    const estimate = estimatedOneRepMax(set.weight, set.reps);
    return {
      id: set.id,
      date: set.completedAt.toISOString(),
      dateKey: getLocalDateKey(set.completedAt),
      exerciseName: set.exercise.name,
      setNumber: set.setNumber,
      weight: set.weight,
      reps: set.reps,
      rpe: set.rpe,
      estimatedOneRepMax: estimate,
      isBestWeight: !!set.weight && set.weight === bestWeight,
      isBestEstimatedOneRepMax: !!estimate && estimate === bestEstimatedOneRepMax,
      notes: set.notes ?? set.painNotes
    };
  });

  return { exercises, selectedExercise, points };
}

export async function getCardioTrends() {
  const activities = await prisma.activitySession.findMany({
    where: { type: { in: [...cardioActivityTypes] } },
    orderBy: { startedAt: "asc" },
    take: 300
  });

  return activities.map((activity): CardioTrendPoint => ({
    id: activity.id,
    date: activity.startedAt.toISOString(),
    dateKey: getLocalDateKey(activity.startedAt),
    type: activity.type,
    modality: activityTitle(activity),
    durationMinutes:
      activity.durationMinutes ?? durationFromDates(activity.startedAt, activity.endedAt),
    avgHeartRate: activity.avgHeartRate,
    maxHeartRate: activity.maxHeartRate,
    calories: activity.calories,
    distanceMeters: activity.distanceMeters,
    elevationGainMeters: activity.elevationGainMeters,
    elevationLossMeters: activity.elevationLossMeters,
    paceSecondsPerKm: activity.paceSecondsPerKm,
    zoneMinutes: [
      activity.zone0Minutes ?? 0,
      activity.zone1Minutes ?? 0,
      activity.zone2Minutes ?? 0,
      activity.zone3Minutes ?? 0,
      activity.zone4Minutes ?? 0,
      activity.zone5Minutes ?? 0
    ],
    notes: activity.notes,
    tags: tagsForActivity(activity)
  }));
}

function workoutToContextEvent(
  session: WorkoutSession,
  options: { includeInferredTags?: boolean } = {}
): ContextEvent {
  const includeInferredTags = options.includeInferredTags ?? true;
  return {
    id: session.id,
    date: session.startedAt.toISOString(),
    dateKey: getLocalDateKey(session.startedAt),
    source: "strength",
    label: session.goal ?? session.sessionType ?? "Workout",
    tags: includeInferredTags ? tagsForWorkout(session) : [],
    notes: session.notes ?? session.readinessNotes ?? session.soreness
  };
}

function activityToContextEvent(
  activity: ActivitySession,
  options: { includeInferredTags?: boolean } = {}
): ContextEvent {
  const includeInferredTags = options.includeInferredTags ?? true;
  return {
    id: activity.id,
    date: activity.startedAt.toISOString(),
    dateKey: getLocalDateKey(activity.startedAt),
    source: activity.type,
    label: activityTitle(activity),
    tags: includeInferredTags ? tagsForActivity(activity) : [],
    notes: activity.notes
  };
}

export async function getContextTimeline() {
  const [workouts, activities] = await Promise.all([
    prisma.workoutSession.findMany({
      orderBy: { startedAt: "desc" },
      take: 200
    }),
    prisma.activitySession.findMany({
      where: standaloneActivityWhere,
      orderBy: { startedAt: "desc" },
      take: 200
    })
  ]);

  return [
    ...workouts.map((s) => workoutToContextEvent(s)),
    ...activities.map((a) => activityToContextEvent(a))
  ]
    .filter((event) => event.tags.length > 0 || event.notes)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function getInsights() {
  const [overview, cardio, context] = await Promise.all([
    getOverviewData(),
    getCardioTrends(),
    getContextTimeline()
  ]);

  const insights: string[] = [];

  insights.push(`You trained strength ${overview.week.strength} times this week.`);

  const recentStairmaster = cardio
    .filter((activity) => activity.type === "stairmaster")
    .slice(-3);
  if (recentStairmaster.length >= 2) {
    const latest = recentStairmaster[recentStairmaster.length - 1];
    const previous = recentStairmaster[recentStairmaster.length - 2];
    if (
      latest.durationMinutes &&
      previous.durationMinutes &&
      latest.durationMinutes > previous.durationMinutes
    ) {
      insights.push("Stairmaster duration increased versus the prior logged session.");
    } else if (
      latest.avgHeartRate &&
      previous.avgHeartRate &&
      latest.avgHeartRate > previous.avgHeartRate
    ) {
      insights.push("Stairmaster average heart rate increased versus the prior logged session.");
    }
  }

  const recentTags = new Set(context.slice(0, 12).flatMap((event) => event.tags));
  if (recentTags.has("hamstring") || recentTags.has("low_back")) {
    insights.push("Left hamstring / low back context appeared recently.");
  }

  const hardButLowHr = cardio
    .slice(-10)
    .find(
      (activity) =>
        activity.notes?.toLowerCase().includes("hard") &&
        activity.avgHeartRate != null &&
        activity.avgHeartRate < 130
    );
  if (hardButLowHr) {
    insights.push("A recent cardio note says it felt hard while average HR stayed relatively low.");
  }

  if (recentTags.has("cold_plunge")) {
    insights.push("Cold plunge before or near training is present in the log; keep tracking it as context.");
  }

  if (overview.week.cardio > 0) {
    insights.push(`You logged ${overview.week.cardio} cardio sessions this week.`);
  }

  return insights;
}
