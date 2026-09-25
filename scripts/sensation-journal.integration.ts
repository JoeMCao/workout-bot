import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("Set TEST_DATABASE_URL to a disposable local workout_bot_sensation_test database");
const url = new URL(testUrl);
if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.pathname !== "/workout_bot_sensation_test") {
  throw new Error("Integration tests require a local database named workout_bot_sensation_test");
}
process.env.DATABASE_URL = testUrl;
process.env.WORKOUT_API_KEY = "sensation-integration-test-key";

test("sensation journal persists through REST and shared MCP services", async (t) => {
  const { prisma } = await import("../lib/prisma");
  const { POST } = await import("../app/api/sensation-check-ins/route");
  const { PATCH, DELETE } = await import("../app/api/sensation-check-ins/[id]/route");
  const { GET } = await import("../app/api/sensation-history/route");
  const { POST: recordActivity } = await import("../app/api/activity-sessions/route");
  const { createSensationCheckIn, getSensationHistory } = await import("../lib/services/sensation");
  const { buildOpenApiSpec } = await import("../lib/openapi");
  const prefix = randomUUID();
  const ids: string[] = [];
  const activityIds: string[] = [];
  t.after(async () => {
    await prisma.sensationCheckIn.deleteMany({ where: { id: { in: ids } } });
    await prisma.activitySession.deleteMany({ where: { id: { in: activityIds } } });
    await prisma.writeEvent.deleteMany({ where: { clientEventId: { startsWith: prefix } } });
    await prisma.$disconnect();
  });
  const request = (path: string, method: string, body?: unknown, auth = true) => new Request(`http://localhost${path}`, {
    method, headers: { "content-type": "application/json", ...(auth ? { authorization: "Bearer sensation-integration-test-key" } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  const context = (id: string) => ({ params: Promise.resolve({ id }) });
  const report = { clientEventId: `${prefix}-first`, description: " Left pinky feels strange.\nRight fingers feel normal; grip feels normal. ", observedAt: "2026-09-25T00:30:00-07:00" };
  const save = async (body: unknown) => {
    const response = await POST(request("/api/sensation-check-ins", "POST", body));
    const data = await response.json();
    if (data.checkIn) ids.push(data.checkIn.id);
    return { status: response.status, ...data };
  };
  let firstId = "";

  await t.test("every route rejects unauthorized access; malformed writes create nothing", async () => {
    assert.equal((await POST(request("/api/sensation-check-ins", "POST", report, false))).status, 401);
    assert.equal((await GET(request("/api/sensation-history", "GET", undefined, false))).status, 401);
    assert.equal((await PATCH(request("/api/sensation-check-ins/x", "PATCH", { description: "x" }, false), context("x"))).status, 401);
    assert.equal((await DELETE(request("/api/sensation-check-ins/x", "DELETE", undefined, false), context("x"))).status, 401);
    for (const body of [{ description: "x" }, { ...report, description: " " }, { ...report, observedAt: "yesterday" }, { ...report, timezone: "Bad/Zone" }]) {
      assert.equal((await save(body)).status, 400);
    }
    assert.equal(await prisma.writeEvent.count({ where: { clientEventId: { startsWith: prefix } } }), 0);
  });
  await t.test("finger-only report preserves exact words, hands, and backdated timestamp", async () => {
    const saved = await save(report);
    assert.equal(saved.status, 201);
    firstId = saved.checkIn.id;
    assert.equal(saved.checkIn.description, report.description);
    assert.equal(saved.checkIn.observedAt, "2026-09-25T07:30:00.000Z");
    assert.equal(saved.checkIn.timezone, "America/Los_Angeles");
    assert.equal(saved.receipt.status, "created");
  });
  await t.test("concurrent retries and MCP replay return one observation; changed payload conflicts", async () => {
    const retries = await Promise.all([save(report), save(report)]);
    assert.ok(retries.every((r) => r.status === 200 && r.checkIn.id === firstId));
    const { clientEventId, ...body } = report;
    const mcpReplay = await createSensationCheckIn(body, { clientEventId, source: "mcp" });
    assert.equal(mcpReplay.value.id, firstId);
    assert.equal(mcpReplay.receipt.status, "replayed");
    assert.equal((await save({ ...report, description: "Changed" })).status, 409);
    const concurrent = { ...report, clientEventId: `${prefix}-concurrent` };
    const results = await Promise.all([save(concurrent), save(concurrent)]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 201]);
    assert.equal(results[0].checkIn.id, results[1].checkIn.id);
  });
  await t.test("multiple same-day changes are distinct, omissions use server time", async () => {
    const later = await save({ ...report, clientEventId: `${prefix}-later`, description: "Later my left fingers feel different; forearm pressure unchanged.", observedAt: "2026-09-25T19:00:00-07:00" });
    assert.equal(later.status, 201);
    assert.notEqual(later.checkIn.id, firstId);
    const before = Date.now();
    const current = await save({ clientEventId: `${prefix}-now`, description: "Current finger observation" });
    assert.ok(Date.parse(current.checkIn.observedAt) >= before - 1000);
    assert.ok(Date.parse(current.checkIn.observedAt) <= Date.now() + 1000);
  });
  await t.test("Iron Neck notes need no duration or strength workout; retry IDs work in Action bodies", async () => {
    for (const [suffix, notes, minutes] of [["small", "small session, eight rounds", undefined], ["full", "full version", 5]] as const) {
      const body = { type: "mobility", modality: "iron_neck", notes, durationMinutes: minutes, startedAt: "2026-09-25T16:00:00-07:00", clientEventId: `${prefix}-${suffix}` };
      const response = await recordActivity(request("/api/activity-sessions", "POST", body));
      const data = await response.json();
      assert.equal(response.status, 201);
      activityIds.push(data.activity.id);
      assert.equal(data.activity.notes, notes);
      assert.equal(data.activity.durationMinutes, minutes ?? null);
      assert.equal(data.activity.relatedWorkoutSessionId, null);
      const retry = await recordActivity(request("/api/activity-sessions", "POST", body));
      assert.equal(retry.status, 200);
      assert.equal((await retry.json()).activity.id, data.activity.id);
    }
    const unrelated = await prisma.activitySession.create({ data: { type: "mobility", modality: "stretching", startedAt: new Date("2026-09-25T10:00:00Z"), notes: "unrelated" } });
    activityIds.push(unrelated.id);
  });
  await t.test("fresh history reads join both logs, include end-of-day entries and flag truncation", async () => {
    const response = await GET(request("/api/sensation-history?startDate=2026-09-25&endDate=2026-09-25", "GET"));
    const history = await response.json();
    assert.equal(response.status, 200);
    assert.ok(history.checkIns.some((r: { id: string; description: string }) => r.id === firstId && r.description === report.description));
    assert.ok(history.checkIns.some((r: { observedAt: string }) => r.observedAt === "2026-09-26T02:00:00.000Z"));
    assert.ok(history.ironNeckSessions.some((r: { notes: string }) => r.notes === "small session, eight rounds"));
    assert.ok(history.ironNeckSessions.every((r: { notes: string }) => r.notes !== "unrelated"));
    const bounded = await getSensationHistory({ startDate: "2026-09-25", endDate: "2026-09-25", limit: 1 });
    assert.deepEqual(bounded.truncated, { checkIns: true, ironNeckSessions: true });
    for (const query of ["startDate=2026-09-25", "startDate=2026-02-30&endDate=2026-03-01", "limit=bad"]) {
      assert.equal((await GET(request(`/api/sensation-history?${query}`, "GET"))).status, 400);
    }
    const empty = await getSensationHistory({ startDate: "1900-01-01", endDate: "1900-01-01" });
    assert.deepEqual(empty.checkIns, []);
    assert.deepEqual(empty.ironNeckSessions, []);
  });
  await t.test("corrections preserve timestamp and ID; deleted observations cannot be resurrected", async () => {
    const path = `/api/sensation-check-ins/${firstId}`;
    assert.equal((await PATCH(request(path, "PATCH", {}), context(firstId))).status, 400);
    const corrected = await PATCH(request(path, "PATCH", { description: "Correction: right ring finger, grip still feels normal." }), context(firstId));
    assert.equal(corrected.status, 200);
    const data = await corrected.json();
    assert.equal(data.checkIn.id, firstId);
    assert.equal(data.checkIn.observedAt, "2026-09-25T07:30:00.000Z");
    assert.equal((await save(report)).checkIn.description, data.checkIn.description);
    assert.equal((await PATCH(request(path, "PATCH", { observedAt: "2026-09-24T10:00:00-07:00" }), context(firstId))).status, 200);
    assert.equal((await DELETE(request(path, "DELETE"), context(firstId))).status, 200);
    assert.equal((await DELETE(request(path, "DELETE"), context(firstId))).status, 200);
    assert.equal((await save(report)).status, 409);
    assert.equal((await PATCH(request(path, "PATCH", { description: "x" }), context(firstId))).status, 404);
  });
  await t.test("GPT Action schemas expose valid contracts and concise descriptions", () => {
    const spec = buildOpenApiSpec("http://localhost");
    assert.equal(spec.paths["/api/sensation-history"].get.operationId, "getSensationHistory");
    assert.deepEqual(spec.components.schemas.RecordSensationCheckInRequest.required, ["description", "clientEventId"]);
    assert.ok(spec.components.schemas.CreateActivitySessionRequest.properties.clientEventId);
    for (const [path, methods] of Object.entries(spec.paths)) {
      if (!path.startsWith("/api/sensation") && path !== "/api/activity-sessions") continue;
      for (const operation of Object.values(methods)) {
        if ("description" in operation) assert.ok(operation.description.length <= 300, path);
      }
    }
  });
});
