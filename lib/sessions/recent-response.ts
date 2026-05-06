/**
 * Pure serialization for GET /api/sessions/recent — no Prisma imports.
 * Keeps response JSON-safe and tolerant of missing WorkoutSessionExercise rows.
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
  sessionExerciseId: string | null;
  displayName: string | null;
  notes: string | null;
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

type SessionExerciseRowInput = {
  id: string;
  exerciseId: string;
  displayName: string | null;
  notes: string | null;
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
  sessionExercises?: SessionExerciseRowInput[] | null;
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

/**
 * Groups sets by exerciseId, merges WorkoutSessionExercise metadata, adds metadata-only exercises with empty sets.
 */
export function buildRecentExercisesPayload(
  sets: SetRowInput[] | null | undefined,
  sessionExercises: SessionExerciseRowInput[] | null | undefined
): RecentExercisePayload[] {
  const safeSets = sets ?? [];
  const safeMeta = sessionExercises ?? [];

  const map = new Map<string, RecentExercisePayload>();

  for (const set of safeSets) {
    const exRef = set.exercise;
    if (!exRef?.id) {
      continue;
    }

    const block =
      map.get(set.exerciseId) ??
      ({
        id: exRef.id,
        name: exRef.name,
        sessionExerciseId: null,
        displayName: null,
        notes: null,
        sets: []
      } satisfies RecentExercisePayload);

    block.sets.push(serializeSetRow(set));
    map.set(set.exerciseId, block);
  }

  for (const row of safeMeta) {
    const block = map.get(row.exerciseId);
    const exRef = row.exercise;

    if (block) {
      block.sessionExerciseId = row.id;
      block.displayName = row.displayName ?? null;
      block.notes = row.notes ?? null;
      continue;
    }

    if (!exRef?.id) {
      continue;
    }

    map.set(row.exerciseId, {
      id: exRef.id,
      name: exRef.name,
      sessionExerciseId: row.id,
      displayName: row.displayName ?? null,
      notes: row.notes ?? null,
      sets: []
    });
  }

  const orderIds: string[] = [];
  for (const set of safeSets) {
    if (!map.has(set.exerciseId)) continue;
    if (!orderIds.includes(set.exerciseId)) orderIds.push(set.exerciseId);
  }
  for (const row of safeMeta) {
    if (!map.has(row.exerciseId)) continue;
    if (!orderIds.includes(row.exerciseId)) orderIds.push(row.exerciseId);
  }

  return orderIds
    .map((id) => map.get(id))
    .filter((x): x is RecentExercisePayload => x != null);
}

export function serializeWorkoutSessionForRecentApi(session: WorkoutSessionRecentInput) {
  const exercises = buildRecentExercisesPayload(
    session.sets ?? [],
    session.sessionExercises ?? []
  );

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
