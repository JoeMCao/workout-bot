import assert from "node:assert/strict";
import test from "node:test";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL must identify a disposable local workout_bot_weight_test database");
const url = new URL(testUrl);
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.pathname !== "/workout_bot_weight_test") throw new Error("Refusing non-test database");
process.env.DATABASE_URL = testUrl;
process.env.WEIGHT_SYNC_KEY = "test-weight-only-key";
process.env.WORKOUT_API_KEY = "test-coach-key";

test("weight sync through real routes and database", async (t) => {
  const { prisma } = await import("../lib/prisma");
  const { POST } = await import("../app/api/body-weight/import/route");
  const { GET } = await import("../app/api/body-weight/route");
  const { getBodyWeight } = await import("../lib/services/body-weight");
  const { buildOpenApiSpec } = await import("../lib/openapi");
  await prisma.bodyWeight.deleteMany();
  t.after(async () => { await prisma.bodyWeight.deleteMany(); await prisma.$disconnect(); });
  const payload = { weight: 180, unit: "lb", measuredAt: "2026-10-19T07:35:00-07:00" };
  const request = (body: unknown, key = "test-weight-only-key") => new Request("http://localhost/api/body-weight/import", {
    method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify(body)
  });

  await t.test("auth is scoped and absent data is explicit", async () => {
    assert.equal((await POST(request(payload, ""))).status, 401);
    assert.equal((await POST(request(payload, "test-coach-key"))).status, 401);
    assert.equal((await GET(new Request("http://localhost/api/body-weight", { headers: { authorization: "Bearer test-weight-only-key" } }))).status, 401);
    assert.equal((await getBodyWeight()).latest, null);
  });
  await t.test("invalid values, timestamps and malformed requests cannot write", async () => {
    for (const invalid of [
      { ...payload, weight: 0 }, { ...payload, weight: -1 }, { ...payload, weight: "180" },
      { ...payload, weight: 99999 }, { ...payload, unit: "stone" },
      { ...payload, measuredAt: "2026-02-30T10:00:00Z" },
      { ...payload, measuredAt: "2026-10-19" }, { ...payload, measuredAt: "2026-10-19T07:35:00" },
      { ...payload, measuredAt: "2099-01-01T00:00:00Z" }, { ...payload, source: "whoop" }
    ]) assert.equal((await POST(request(invalid))).status, 400);
    const malformed = new Request("http://localhost/api/body-weight/import", { method: "POST", headers: { authorization: "Bearer test-weight-only-key" }, body: "{" });
    assert.equal((await POST(malformed)).status, 400);
    assert.equal((await POST(request({ padding: "x".repeat(5000) }))).status, 413);
    assert.equal(await prisma.bodyWeight.count(), 0);
  });
  await t.test("concurrent retries preserve one dated reading; units normalize", async () => {
    const responses = await Promise.all([POST(request(payload)), POST(request(payload)), POST(request(payload))]);
    assert.ok(responses.every((r) => r.status === 200));
    assert.equal(await prisma.bodyWeight.count(), 1);
    const original = (await getBodyWeight()).latest!;
    assert.equal(original.weightKg, 81.646627);
    assert.equal(original.weightLb, 180);
    assert.equal(original.measuredAt.toISOString(), "2026-10-19T14:35:00.000Z");
    assert.notEqual(original.receivedAt.toISOString(), original.measuredAt.toISOString());
    await POST(request({ weight: 81.646627, unit: "kg", measuredAt: "2026-10-19T14:35:00Z" }));
    assert.equal(await prisma.bodyWeight.count(), 1);
    assert.equal((await getBodyWeight()).latest!.receivedAt.toISOString(), original.receivedAt.toISOString());
  });
  await t.test("correction replaces same measurement; late uploads do not become latest", async () => {
    await POST(request({ ...payload, weight: 181 }));
    assert.equal(await prisma.bodyWeight.count(), 1);
    assert.equal((await getBodyWeight()).latest!.weightLb, 181);
    await POST(request({ ...payload, measuredAt: "2026-10-18T07:35:00-07:00", weight: 182 }));
    const result = await GET(new Request("http://localhost/api/body-weight?limit=1", { headers: { authorization: "Bearer test-coach-key" } }));
    assert.equal(result.status, 200);
    const data = await result.json();
    assert.equal(data.latest.weightLb, 181);
    assert.equal(data.measurements.length, 1);
  });
  await t.test("coach Action stays within budget; upload is not a coach action", () => {
    const spec = buildOpenApiSpec("https://example.com");
    const operations = Object.values(spec.paths).flatMap((p) => Object.values(p).filter((o) => typeof o === "object" && "operationId" in o));
    assert.ok(operations.length <= 30);
    assert.ok(operations.some((o) => o.operationId === "getHealthMeasurements"));
    assert.ok(!Object.keys(spec.paths).includes("/api/body-weight/import"));
  });
});
