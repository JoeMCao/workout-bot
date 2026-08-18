import assert from "node:assert/strict";
import test from "node:test";
import { canonicalizeJson } from "./canonical-json.ts";

test("canonicalizeJson sorts object keys and removes undefined values", () => {
  assert.deepEqual(
    canonicalizeJson({ b: 2, ignored: undefined, a: { d: 4, c: 3 } }),
    { a: { c: 3, d: 4 }, b: 2 }
  );
});

test("canonicalizeJson normalizes dates to ISO strings", () => {
  assert.deepEqual(
    canonicalizeJson({ at: new Date("2026-08-03T12:34:56.000Z") }),
    { at: "2026-08-03T12:34:56.000Z" }
  );
});
