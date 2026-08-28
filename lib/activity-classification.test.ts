import assert from "node:assert/strict";
import test from "node:test";
import { isIntentionalCardioActivity } from "./activity-classification.ts";

test("counts intentional cardio without treating walks as training sessions", () => {
  for (const type of ["zone2", "hiit", "stairmaster", "run", "hike", "swim", "bike"]) {
    assert.equal(isIntentionalCardioActivity(type), true, type);
  }

  for (const type of ["walk", "surf", "sauna", "strength", "other"]) {
    assert.equal(isIntentionalCardioActivity(type), false, type);
  }
});
