import assert from "node:assert/strict";
import test from "node:test";
import { strengthUnlinkedResyncSyncStatusDecision } from "./strength-resync-sync-status.ts";
import type { WhoopStrengthMatch } from "./strength-match.ts";

const workoutRow = {
  id: "ws-1",
  startedAt: new Date(),
  endedAt: null,
  sessionType: null,
  goal: null,
  notes: null,
  timeSource: null,
  timezone: "America/Los_Angeles",
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
  createdAt: new Date(),
  updatedAt: new Date(),
  readinessScore: null,
  energy: null,
  soreness: null,
  sleepQuality: null
} as const;

function shell(id: string) {
  return {
    id,
    type: "strength",
    modality: "weightlifting",
    sourceActivityType: null,
    rawPayloadJson: null,
    startedAt: new Date(),
    timeSource: null,
    timezone: "America/Los_Angeles",
    endedAt: null,
    durationMinutes: null,
    intensity: null,
    avgHeartRate: null,
    maxHeartRate: null,
    minHeartRate: null,
    calories: null,
    distanceMeters: null,
    elevationGainMeters: null,
    elevationLossMeters: null,
    paceSecondsPerKm: null,
    strain: null,
    zone0Minutes: null,
    zone1Minutes: null,
    zone2Minutes: null,
    zone3Minutes: null,
    zone4Minutes: null,
    zone5Minutes: null,
    source: "manual",
    notes: null,
    syncStatus: null,
    relatedWorkoutSessionId: "ws-1",
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

test("ambiguous strength re-sync keeps needs_review (decision)", () => {
  const match: WhoopStrengthMatch = {
    kind: "ambiguous",
    candidates: [workoutRow as never, { ...workoutRow, id: "ws-2" } as never]
  };
  assert.equal(
    strengthUnlinkedResyncSyncStatusDecision({ match, activityId: "act-whoop" }),
    "needs_review"
  );
});

test("no matching workout keeps needs_review (decision)", () => {
  const match: WhoopStrengthMatch = { kind: "none" };
  assert.equal(
    strengthUnlinkedResyncSyncStatusDecision({ match, activityId: "act-whoop" }),
    "needs_review"
  );
});

test("unique match with no shell clears review and allows link (decision)", () => {
  const match: WhoopStrengthMatch = {
    kind: "unique",
    workout: workoutRow as never,
    shell: null
  };
  assert.equal(
    strengthUnlinkedResyncSyncStatusDecision({ match, activityId: "act-whoop" }),
    "clear"
  );
});

test("unique match when WHOOP row is the shell clears review (decision)", () => {
  const match: WhoopStrengthMatch = {
    kind: "unique",
    workout: workoutRow as never,
    shell: shell("act-whoop")
  };
  assert.equal(
    strengthUnlinkedResyncSyncStatusDecision({ match, activityId: "act-whoop" }),
    "clear"
  );
});

test("unique match with a different existing shell stays needs_review (decision)", () => {
  const match: WhoopStrengthMatch = {
    kind: "unique",
    workout: workoutRow as never,
    shell: shell("act-backfill")
  };
  assert.equal(
    strengthUnlinkedResyncSyncStatusDecision({ match, activityId: "act-whoop" }),
    "needs_review"
  );
});
