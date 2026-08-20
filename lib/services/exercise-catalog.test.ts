import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeExerciseLookupName,
  rankExerciseSuggestions
} from "../exercise-name.ts";

test("normalizes abbreviations, misspellings, punctuation, and hyphenation", () => {
  assert.equal(
    normalizeExerciseLookupName(" Chest-Supported DB Row "),
    "chest supported dumbbell row"
  );
  assert.equal(
    normalizeExerciseLookupName("Incline Dumbell Press"),
    "incline dumbbell press"
  );
  assert.equal(normalizeExerciseLookupName("Neutral Grip Pull-Up"), "neutral grip pull up");
});

test("ambiguous generic row suggests specific approved rows without auto-merging", () => {
  const suggestions = rankExerciseSuggestions("DB Row", [
    { id: "one-arm", name: "One-Arm Dumbbell Row" },
    { id: "chest-supported", name: "Chest-Supported Dumbbell Row" },
    { id: "press", name: "Incline Dumbbell Press" }
  ]);

  assert.deepEqual(
    suggestions.map((row) => row.name).sort(),
    ["Chest-Supported Dumbbell Row", "One-Arm Dumbbell Row"].sort()
  );
});
