/**
 * Pure serialization for GET /api/sessions/recent — no Prisma imports.
 */

export type RecentSetPayload = {
  id: string;
  sessionId: string;
  exerciseId: string;
  setNumber: number | null;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  rir: number | null;
  painFlag: boolean;
  painNotes: string | null;
  notes: string | null;
  completedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type RecentExercisePayload = {
  id: string;
  name: string;
  sets: RecentSetPayload[];
};

type ExerciseRef = { id: string; name: string };

type SetRowInput = {
  id: string;
  sessionId: string;
  exerciseId: string;
  setNumber: number | null;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  rir: number | null;
  painFlag: boolean;
  painNotes: string | null;
  notes: string | null;
  completedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  exercise: ExerciseRef | null;
};

export type WorkoutSessionRecentInput = {
  id: string;
  startedAt: Date;
  timeSource: string | null;
  timezone: string;
  endedAt: Date | null;
  sessionType: string | null;
  goal: string | null;
  readinessScore: number | null;
  energy: number | null;
  soreness: string | null;
  sleepQuality: string | null;
  notes: string | null;
  lowBackPain: boolean | null;
  lowBackPainSeverity: string | null;
  elbowIrritation: string | null;
  neckTightness: string | null;
  shoulderIrritation: string | null;
  fatigueLevel: string | null;
  motivationLevel: string | null;
  sorenessAreas: unknown;
  readinessNotes: string | null;
  whoopRecoveryScore: number | null;
  whoopSleepPerformance: number | null;
  whoopSleepEfficiency: number | null;
  whoopHrvRmssd: number | null;
  whoopRestingHeartRate: number | null;
  whoopStrainYesterday: number | null;
  whoopDataFetchedAt: Date | null;
  whoopRaw: unknown;
  createdAt: Date;
  updatedAt: Date;
  sets?: SetRowInput[] | null;
};

export type RecentWorkoutSessionPayload = ReturnType<
  typeof serializeWorkoutSessionForRecentApi
>;

function iso(d: Date | null | undefined): string | null {
  if (d == null) return null;
  return d.toISOString();
}

function serializeSetRow(set: SetRowInput): RecentSetPayload {
  return {
    id: set.id,
    sessionId: set.sessionId,
    exerciseId: set.exerciseId,
    setNumber: set.setNumber,
    weight: set.weight,
    reps: set.reps,
    rpe: set.rpe,
    rir: set.rir,
    painFlag: set.painFlag,
    painNotes: set.painNotes,
    notes: set.notes,
    completedAt: set.completedAt.toISOString(),
    createdAt: set.createdAt.toISOString(),
    updatedAt: set.updatedAt.toISOString()
  };
}

/** Group sets by exerciseId; qualitative context lives on each set’s `notes`. */
export function buildRecentExercisesPayload(
  sets: SetRowInput[] | null | undefined
): RecentExercisePayload[] {
  const safeSets = sets ?? [];
  const map = new Map<string, RecentExercisePayload>();
  const orderIds: string[] = [];

  for (const set of safeSets) {
    const exRef = set.exercise;
    if (!exRef?.id) {
      continue;
    }

    if (!map.has(set.exerciseId)) {
      map.set(set.exerciseId, {
        id: exRef.id,
        name: exRef.name,
        sets: []
      });
      orderIds.push(set.exerciseId);
    }
    map.get(set.exerciseId)!.sets.push(serializeSetRow(set));
  }

  return orderIds
    .map((id) => map.get(id))
    .filter((x): x is RecentExercisePayload => x != null);
}

export function serializeWorkoutSessionForRecentApi(session: WorkoutSessionRecentInput) {
  const exercises = buildRecentExercisesPayload(session.sets ?? []);

  return {
    id: session.id,
    startedAt: session.startedAt.toISOString(),
    timeSource: session.timeSource,
    timezone: session.timezone,
    endedAt: iso(session.endedAt),
    sessionType: session.sessionType,
    goal: session.goal,
    readinessScore: session.readinessScore,
    energy: session.energy,
    soreness: session.soreness,
    sleepQuality: session.sleepQuality,
    notes: session.notes,
    lowBackPain: session.lowBackPain,
    lowBackPainSeverity: session.lowBackPainSeverity,
    elbowIrritation: session.elbowIrritation,
    neckTightness: session.neckTightness,
    shoulderIrritation: session.shoulderIrritation,
    fatigueLevel: session.fatigueLevel,
    motivationLevel: session.motivationLevel,
    sorenessAreas: session.sorenessAreas,
    readinessNotes: session.readinessNotes,
    whoopRecoveryScore: session.whoopRecoveryScore,
    whoopSleepPerformance: session.whoopSleepPerformance,
    whoopSleepEfficiency: session.whoopSleepEfficiency,
    whoopHrvRmssd: session.whoopHrvRmssd,
    whoopRestingHeartRate: session.whoopRestingHeartRate,
    whoopStrainYesterday: session.whoopStrainYesterday,
    whoopDataFetchedAt: iso(session.whoopDataFetchedAt),
    whoopRaw: session.whoopRaw,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    exercises
  };
}

export function serializeRecentWorkoutSessionsForApi(
  sessions: WorkoutSessionRecentInput[]
): RecentWorkoutSessionPayload[] {
  return sessions.map(serializeWorkoutSessionForRecentApi);
}
