import assert from "node:assert/strict";
import test from "node:test";
import { whoopWorkoutToActivityData } from "./adapter.ts";
import type { WhoopWorkout } from "./types.ts";

const workout: WhoopWorkout = {
  id: "ecfc6a15-4661-442f-a9a4-f160dd7afae8",
  user_id: 9012,
  created_at: "2022-04-24T11:25:44.774Z",
  updated_at: "2022-04-24T14:25:44.774Z",
  start: "2022-04-24T02:25:44.774Z",
  end: "2022-04-24T03:25:44.774Z",
  timezone_offset: "-05:00",
  sport_name: "running",
  score_state: "SCORED",
  score: {
    strain: 8.2463,
    average_heart_rate: 123,
    max_heart_rate: 146,
    kilojoule: 1569.34033203125,
    distance_meter: 1772.77035916,
    altitude_gain_meter: 46.64384460449,
    altitude_change_meter: -0.781372010707855,
    zone_durations: {
      zone_zero_milli: 300000,
      zone_one_milli: 600000,
      zone_two_milli: 900000,
      zone_three_milli: 900000,
      zone_four_milli: 600000,
      zone_five_milli: 300000
    }
  }
};

test("maps WHOOP workout payload into ActivitySession canonical fields", () => {
  const activity = whoopWorkoutToActivityData(workout);

  assert.equal(activity.type, "run");
  assert.equal(activity.modality, "run");
  assert.equal(activity.sourceActivityType, "running");
  assert.equal(activity.source, "whoop_api");
  assert.equal(activity.timeSource, "whoop_api");
  assert.equal(activity.durationMinutes, 60);
  assert.equal(activity.avgHeartRate, 123);
  assert.equal(activity.maxHeartRate, 146);
  assert.equal(activity.calories, 375);
  assert.equal(activity.distanceMeters, 1772.77035916);
  assert.equal(activity.elevationGainMeters, 46.64384460449);
  assert.equal(activity.elevationLossMeters, undefined);
  assert.equal(activity.zone2Minutes, 15);
  assert.ok(activity.rawPayloadJson && typeof activity.rawPayloadJson === "object");
});

test("tolerates missing score when score_state is pending", () => {
  const pending: WhoopWorkout = {
    ...workout,
    score_state: "PENDING_SCORE",
    score: undefined
  };
  const activity = whoopWorkoutToActivityData(pending);
  assert.equal(activity.avgHeartRate, undefined);
  assert.equal(activity.notes, undefined);
});

test("maps WHOOP strength-like sports to type strength and preserves source label", () => {
  const ff = whoopWorkoutToActivityData({
    ...workout,
    sport_name: "Functional Fitness"
  });
  assert.equal(ff.type, "strength");
  assert.equal(ff.modality, "functional_fitness");
  assert.equal(ff.sourceActivityType, "Functional Fitness");

  const wl = whoopWorkoutToActivityData({
    ...workout,
    sport_name: "Weightlifting"
  });
  assert.equal(wl.type, "strength");
  assert.equal(wl.modality, "weightlifting");
});
