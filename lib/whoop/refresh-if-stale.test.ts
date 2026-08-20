import assert from "node:assert/strict";
import test from "node:test";
import { timestampIsStale } from "./refresh-staleness.ts";

const now = new Date("2026-08-20T05:00:00.000Z");

test("missing or invalid WHOOP timestamps are stale", () => {
  assert.equal(timestampIsStale(null, now, 60), true);
  assert.equal(timestampIsStale("not-a-date", now, 60), true);
});

test("WHOOP timestamps refresh only after the configured age", () => {
  assert.equal(timestampIsStale("2026-08-20T04:30:01.000Z", now, 30), false);
  assert.equal(timestampIsStale("2026-08-20T04:30:00.000Z", now, 30), true);
});
