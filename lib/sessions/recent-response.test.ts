import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRecentExercisesPayload,
  serializeWorkoutSessionForRecentApi,
  type WorkoutSessionRecentInput
} from "./recent-response.ts";

const baseSet = {
  sessionId: "s1",
  setNumber: 1,
  weight: 100,
  reps: 8,
  rpe: null,
  rir: null,
  painFlag: false,
  painNotes: null,
  notes: "slow eccentric",
  completedAt: new Date("2026-05-01T12:00:00.000Z"),
  createdAt: new Date("2026-05-01T12:00:00.000Z"),
  updatedAt: new Date("2026-05-01T12:00:00.000Z"),
  exercise: { id: "e1", name: "Bench Press" }
};

test("groups sets by exerciseId with canonical name only", () => {
  const exercises = buildRecentExercisesPayload([
    {
      ...baseSet,
      id: "set-1",
      exerciseId: "e1"
    },
    {
      ...baseSet,
      id: "set-2",
      exerciseId: "e1",
      setNumber: 2,
      notes: null
    }
  ]);
  assert.equal(exercises.length, 1);
  assert.equal(exercises[0].id, "e1");
  assert.equal(exercises[0].name, "Bench Press");
  assert.equal(exercises[0].sets.length, 2);
});

test("serializeWorkoutSessionForRecentApi uses simplified exercise shape", () => {
  const session = {
    id: "s1",
    startedAt: new Date("2026-05-01T10:00:00.000Z"),
    timeSource: "api_default",
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
    createdAt: new Date("2026-05-01T10:00:00.000Z"),
    updatedAt: new Date("2026-05-01T10:00:00.000Z"),
    sets: [
      {
        ...baseSet,
        id: "set-1",
        exerciseId: "e1"
      }
    ]
  } satisfies WorkoutSessionRecentInput;

  const out = serializeWorkoutSessionForRecentApi(session);
  assert.equal(out.exercises[0].name, "Bench Press");
  assert.equal(Object.keys(out.exercises[0]).sort().join(","), "id,name,sets");
});
