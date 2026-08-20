import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_USER_TIMEZONE,
  formatLocalDate,
  getLocalDateKey,
  getStartOfLocalDateUtc,
  getStartOfLocalWeekUtc
} from "./time.ts";

test("getLocalDateKey uses America/Los_Angeles calendar dates", () => {
  assert.equal(
    getLocalDateKey(new Date("2026-05-05T01:30:00.000Z")),
    "2026-05-04"
  );
  assert.equal(
    getLocalDateKey(new Date("2026-05-06T01:04:43.082Z")),
    "2026-05-05"
  );
});

test("formatLocalDate displays UTC-midnight-adjacent sessions on the LA day", () => {
  assert.equal(formatLocalDate("2026-05-05T01:30:00.000Z"), "May 4, 2026");
  assert.equal(formatLocalDate("2026-05-06T01:04:43.082Z"), "May 5, 2026");
});

test("getStartOfLocalWeekUtc returns Monday midnight in the user timezone", () => {
  assert.equal(
    getStartOfLocalWeekUtc(
      new Date("2026-05-06T01:04:43.082Z"),
      DEFAULT_USER_TIMEZONE
    ).toISOString(),
    "2026-05-04T07:00:00.000Z"
  );
});

test("getStartOfLocalDateUtc respects Los Angeles daylight saving time", () => {
  assert.equal(
    getStartOfLocalDateUtc("2026-08-19").toISOString(),
    "2026-08-19T07:00:00.000Z"
  );
  assert.equal(
    getStartOfLocalDateUtc("2026-01-19").toISOString(),
    "2026-01-19T08:00:00.000Z"
  );
});
