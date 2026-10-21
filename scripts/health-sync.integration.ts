import assert from "node:assert/strict";
import test from "node:test";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("Set TEST_DATABASE_URL to a disposable local workout_bot_health_test database");
const url = new URL(testUrl);
if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.pathname !== "/workout_bot_health_test") throw new Error("Refusing non-test database");
process.env.DATABASE_URL = testUrl;
process.env.WEIGHT_SYNC_KEY = "test-import-key";
process.env.WORKOUT_API_KEY = "test-coach-key";

test("OMRON sync persists correctly and the coach sees only complete BP readings", async (t) => {
  const { prisma } = await import("../lib/prisma");
  const { POST } = await import("../app/api/health-measurements/import/route");
  const { GET } = await import("../app/api/health-measurements/route");
  const { getHealthMeasurements } = await import("../lib/services/health-measurements");
  const { importBodyWeight } = await import("../lib/services/body-weight");
  const { buildOpenApiSpec } = await import("../lib/openapi");
  async function clear() { await prisma.bloodPressure.deleteMany(); await prisma.omronPulse.deleteMany(); await prisma.bodyWeight.deleteMany(); }
  await clear();
  t.after(async () => { await clear(); await prisma.$disconnect(); });
  const sample = { metric: "systolic", value: 120, unit: "mmHg", sourceName: "OMRON connect", measuredAt: "2026-10-20T07:30:00-07:00" };
  const send = (body: unknown, key = "test-import-key") => POST(new Request("http://localhost/api/health-measurements/import", {
    method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify(body)
  }));

  await t.test("import key is write-only; unrelated sources and invalid data cannot write", async () => {
    assert.equal((await send(sample, "test-coach-key")).status, 401);
    assert.equal((await GET(new Request("http://localhost/api/health-measurements", { headers: { authorization: "Bearer test-import-key" } }))).status, 401);
    for (const invalid of [
      { ...sample, sourceName: "WHOOP" }, { ...sample, sourceName: "Apple Watch" }, { ...sample, sourceName: "" },
      { ...sample, metric: "resting_heart_rate" }, { ...sample, unit: "bpm" }, { ...sample, value: 0 },
      { ...sample, value: "120" }, { ...sample, value: 9999 }, { ...sample, measuredAt: "2026-02-30T00:00:00Z" },
      { ...sample, measuredAt: "2099-01-01T00:00:00Z" }, { ...sample, measuredAt: "2026-10-20T07:30:00" },
      { ...sample, metric: "pulse", unit: "mmHg" }
    ]) assert.equal((await send(invalid)).status, 400);
    assert.equal(await prisma.bloodPressure.count(), 0);
    const empty = await getHealthMeasurements();
    assert.equal(empty.weight.latest, null); assert.equal(empty.bloodPressure.latest, null); assert.equal(empty.pulse.latest, null);
  });
  await t.test("an incomplete BP upload stays incomplete across source/time mismatches", async () => {
    assert.equal((await send(sample)).status, 200);
    assert.equal((await getHealthMeasurements()).bloodPressure.latest, null);
    await send({ ...sample, metric: "diastolic", value: 80, measuredAt: "2026-10-20T07:30:01-07:00" });
    await send({ ...sample, metric: "diastolic", value: 80, sourceName: "OMRON connect US/CAN/EMEA" });
    const data = await getHealthMeasurements();
    assert.equal(data.bloodPressure.latest, null);
    assert.equal(data.bloodPressure.incompleteCount, 3);
  });
  await t.test("matching component completes BP; retries/corrections preserve the other half and first import time", async () => {
    const first = await prisma.bloodPressure.findFirstOrThrow({ where: { sourceName: sample.sourceName, systolic: 120 } });
    await send({ ...sample, metric: "diastolic", value: 80, measuredAt: "2026-10-20T14:30:00Z" });
    const complete = (await getHealthMeasurements()).bloodPressure.latest!;
    assert.equal(complete.systolic, 120); assert.equal(complete.diastolic, 80);
    assert.equal(complete.measuredAt.toISOString(), "2026-10-20T14:30:00.000Z");
    assert.equal(complete.receivedAt.toISOString(), first.receivedAt.toISOString());
    await Promise.all([send(sample), send({ ...sample, metric: "diastolic", value: 80 })]);
    await send({ ...sample, value: 121 });
    const corrected = (await getHealthMeasurements()).bloodPressure.latest!;
    assert.equal(corrected.systolic, 121); assert.equal(corrected.diastolic, 80);
    assert.equal(await prisma.bloodPressure.count(), 3);
  });
  await t.test("new concurrent components form one pair without losing either value", async () => {
    const next = { ...sample, measuredAt: "2026-10-20T07:40:00-07:00" };
    const results = await Promise.all([send(next), send({ ...next, metric: "diastolic", value: 82 }), send(next)]);
    assert.ok(results.every((r) => r.status === 200));
    const latest = (await getHealthMeasurements()).bloodPressure.latest!;
    assert.equal(latest.systolic, 120); assert.equal(latest.diastolic, 82);
    assert.equal(await prisma.bloodPressure.count(), 4);
  });
  await t.test("pulse retains its own time/source, no WHOOP writes; late data does not become latest", async () => {
    const pulse = { ...sample, metric: "pulse", value: 65, unit: "bpm", measuredAt: "2026-10-20T07:29:00-07:00" };
    await Promise.all([send(pulse), send(pulse)]);
    await send({ ...pulse, value: 60, measuredAt: "2026-10-19T07:29:00-07:00" });
    await importBodyWeight({ weight: 180, unit: "lb", measuredAt: "2026-10-20T07:20:00-07:00" });
    const response = await GET(new Request("http://localhost/api/health-measurements?limit=1", { headers: { authorization: "Bearer test-coach-key" } }));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.weight.latest.weightLb, 180);
    assert.equal(data.bloodPressure.latest.systolic, 120);
    assert.equal(data.bloodPressure.measurements.length, 1);
    assert.equal(data.pulse.latest.bpm, 65);
    assert.equal(data.pulse.latest.sourceName, "OMRON connect");
    assert.notEqual(data.pulse.latest.measuredAt, data.bloodPressure.latest.measuredAt);
    assert.equal(data.pulse.measurements.length, 1);
    assert.equal(await prisma.omronPulse.count(), 2);
    assert.equal(await prisma.whoopRecovery.count(), 0);
  });
  await t.test("coach Action uses one combined read within the 30-operation budget", () => {
    const spec = buildOpenApiSpec("https://example.com");
    const operations = Object.values(spec.paths).flatMap((p) => Object.values(p).filter((o) => typeof o === "object" && "operationId" in o));
    assert.ok(operations.length <= 30);
    assert.ok(operations.some((o) => o.operationId === "getHealthMeasurements"));
    assert.ok(!Object.keys(spec.paths).includes("/api/health-measurements/import"));
  });
});
