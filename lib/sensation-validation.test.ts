import assert from "node:assert/strict";
import test from "node:test";
import { createSensationCheckInSchema, updateSensationCheckInSchema, sensationHistorySchema, sensationHistoryWindow } from "./sensation-validation.ts";

test("observations preserve words, whitespace and uncertainty without requiring categories", () => {
  const description = " Left pinky feels odd.\nRight fingers seem fine; grip feels normal. ";
  assert.equal(createSensationCheckInSchema.parse({ description }).description, description);
  for (const body of [{ description: "  " }, { description: "x", severity: "mild" }, { description: "x", timezone: "invalid" }, { description: "x", observedAt: "yesterday" }]) {
    assert.equal(createSensationCheckInSchema.safeParse(body).success, false);
  }
  assert.equal(updateSensationCheckInSchema.safeParse({}).success, false);
});

test("history uses inclusive LA calendar dates across UTC boundaries and DST", () => {
  const defaults = sensationHistoryWindow({}, new Date("2026-09-26T01:00:00Z"));
  assert.equal(defaults.startDate, "2026-08-29");
  assert.equal(defaults.endDate, "2026-09-25");
  assert.equal(defaults.endExclusive.toISOString(), "2026-09-26T07:00:00.000Z");
  for (const [date, hours] of [["2026-03-08", 23], ["2026-11-01", 25]] as const) {
    const window = sensationHistoryWindow({ startDate: date, endDate: date });
    assert.equal((window.endExclusive.getTime() - window.start.getTime()) / 3600000, hours);
  }
  for (const input of [{ startDate: "2026-09-25" }, { startDate: "2026-02-30", endDate: "2026-03-01" }, { startDate: "2026-09-26", endDate: "2026-09-25" }, { limit: 0 }, { limit: 501 }]) {
    assert.equal(sensationHistorySchema.safeParse(input).success, false);
  }
});
