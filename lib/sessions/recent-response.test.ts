import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRecentExercisesPayload,
  serializeRecentWorkoutSessionsForApi,
  serializeWorkoutSessionForRecentApi,
  type WorkoutSessionRecentInput
} from "./recent-response.ts";

const t0 = new Date("2026-01-15T12:00:00.000Z");

function baseSet(
  overrides: Partial<{
    id: string;
    exerciseId: string;
    exercise: { id: string; name: string } | null;
  }> = {}
) {
  let exercise: { id: string; name: string } | null;
  if ("exercise" in overrides) {
    exercise =
      overrides.exercise === undefined ? null : overrides.exercise;
  } else {
    exercise = { id: "ex-1", name: "Pull-Up" };
  }
  return {
    id: overrides.id ?? "set-1",
    sessionId: "sess-1",
    exerciseId: overrides.exerciseId ?? "ex-1",
    setNumber: 1,
    weight: 100,
    reps: 5,
    rpe: null,
    rir: null,
    painFlag: false,
    painNotes: null,
    notes: "top set",
    completedAt: t0,
    createdAt: t0,
    updatedAt: t0,
    exercise
  };
}

test("a. sets without WorkoutSessionExercise metadata: canonical exercise + null sessionExerciseId", () => {
  const exercises = buildRecentExercisesPayload([baseSet()], []);
  assert.equal(exercises.length, 1);
  assert.equal(exercises[0].id, "ex-1");
  assert.equal(exercises[0].name, "Pull-Up");
  assert.equal(exercises[0].sessionExerciseId, null);
  assert.equal(exercises[0].displayName, null);
  assert.equal(exercises[0].notes, null);
  assert.equal(exercises[0].sets.length, 1);
  assert.equal(exercises[0].sets[0].weight, 100);
});

test("b. merges WorkoutSessionExercise displayName and notes", () => {
  const exercises = buildRecentExercisesPayload(
    [baseSet()],
    [
      {
        id: "wse-1",
        exerciseId: "ex-1",
        displayName: "Pull-Up (Neutral Grip)",
        notes: "Unassisted. 1s hold.",
        exercise: { id: "ex-1", name: "Pull-Up" }
      }
    ]
  );
  assert.equal(exercises[0].sessionExerciseId, "wse-1");
  assert.equal(exercises[0].displayName, "Pull-Up (Neutral Grip)");
  assert.equal(exercises[0].notes, "Unassisted. 1s hold.");
  assert.equal(exercises[0].sets.length, 1);
});

test("c. workout with no sets returns empty exercises", () => {
  const session: WorkoutSessionRecentInput = {
    id: "s-empty",
    startedAt: t0,
    timeSource: null,
    timezone: "America/Los_Angeles",
    endedAt: null,
    sessionType: "Push",
    goal: null,
    readinessScore: null,
    energy: null,
    soreness: null,
    sleepQuality: null,
    notes: null,
    lowBackPain: null,
    lowBackPainSeverity: null,
    elbowIrritation: null,
    neckTightness: null,
    shoulderIrritation: null,
    fatigueLevel: null,
    motivationLevel: null,
    sorenessAreas: null,
    readinessNotes: null,
    whoopRecoveryScore: null,
    whoopSleepPerformance: null,
    whoopSleepEfficiency: null,
    whoopHrvRmssd: null,
    whoopRestingHeartRate: null,
    whoopStrainYesterday: null,
    whoopDataFetchedAt: null,
    whoopRaw: null,
    createdAt: t0,
    updatedAt: t0,
    sets: [],
    sessionExercises: []
  };
  const out = serializeWorkoutSessionForRecentApi(session);
  assert.deepEqual(out.exercises, []);
});

test("metadata-only session exercise: empty sets array", () => {
  const exercises = buildRecentExercisesPayload(
    [],
    [
      {
        id: "wse-m",
        exerciseId: "ex-2",
        displayName: "Planned move",
        notes: "warm-up",
        exercise: { id: "ex-2", name: "Row" }
      }
    ]
  );
  assert.equal(exercises.length, 1);
  assert.equal(exercises[0].sessionExerciseId, "wse-m");
  assert.equal(exercises[0].sets.length, 0);
  assert.equal(exercises[0].name, "Row");
});

test("skips sets with missing exercise relation without crashing", () => {
  const exercises = buildRecentExercisesPayload(
    [baseSet({ exercise: null })],
    []
  );
  assert.equal(exercises.length, 0);
});

test("d. empty sessions list", () => {
  assert.deepEqual(serializeRecentWorkoutSessionsForApi([]), []);
});
