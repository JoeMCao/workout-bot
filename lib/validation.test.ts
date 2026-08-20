import assert from "node:assert/strict";
import test from "node:test";
import { weeklyTrainingTargetsSchema } from "./training-targets.ts";

test("weekly plans accept aggregate strength, cardio, Zone 2, and heat targets", () => {
  const parsed = weeklyTrainingTargetsSchema.parse({
    strengthSessions: 3,
    cardioSessions: 2,
    zone2Minutes: 90,
    heatSessions: 2
  });

  assert.equal(parsed.strengthSessions, 3);
  assert.equal(parsed.zone2Minutes, 90);
});

test("weekly targets reject unknown fields", () => {
  const parsed = weeklyTrainingTargetsSchema.safeParse({ surfMustBeHard: true });

  assert.equal(parsed.success, false);
});
