import assert from "node:assert/strict";
import test from "node:test";
import { WHOOP_API_BASE_URL } from "./config.ts";

test("workout collection URL resolves with OpenAPI /developer base", () => {
  const url = new URL(
    `${WHOOP_API_BASE_URL.replace(/\/$/, "")}/v2/activity/workout`
  );
  url.searchParams.set("limit", "25");
  assert.equal(
    url.toString(),
    "https://api.prod.whoop.com/developer/v2/activity/workout?limit=25"
  );
});
