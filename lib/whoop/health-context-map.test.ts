import assert from "node:assert/strict";
import test from "node:test";
import {
  mapWhoopRecoveryToUpsert,
  mapWhoopSleepToUpsert,
  stableWhoopRecoverySourceId
} from "./health-context-map.ts";

test("sleep localDate uses wake day (endedAt) in America/Los_Angeles", () => {
  const row = mapWhoopSleepToUpsert({
    id: "sleep-1",
    start: "2026-05-05T06:00:00.000Z",
    end: "2026-05-05T14:00:00.000Z",
    score_state: "SCORED",
    score: {}
  });
  assert.ok(row);
  assert.equal(row!.sourceSleepId, "sleep-1");
  assert.equal(row!.localDate, "2026-05-05");
});

test("recovery stable id from cycle_id when id missing", () => {
  assert.equal(
    stableWhoopRecoverySourceId({ cycle_id: 93845 }),
    "whoop:recovery:cycle:93845"
  );
  assert.equal(
    stableWhoopRecoverySourceId({ id: "rec-uuid", cycle_id: 1 }),
    "rec-uuid"
  );
});

test("mapWhoopRecoveryToUpsert derives localDate from updated_at", () => {
  const row = mapWhoopRecoveryToUpsert({
    cycle_id: 12,
    sleep_id: "s-1",
    created_at: "2026-05-06T10:00:00.000Z",
    updated_at: "2026-05-06T15:00:00.000Z",
    score_state: "SCORED",
    score: {
      recovery_score: 55,
      resting_heart_rate: 58,
      hrv_rmssd_milli: 32.5
    }
  });
  assert.ok(row);
  assert.equal(row!.sourceRecoveryId, "whoop:recovery:cycle:12");
  assert.equal(row!.sleepId, "s-1");
  assert.equal(row!.cycleId, "12");
  assert.equal(row!.recoveryScore, 55);
});
