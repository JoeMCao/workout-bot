import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

// Never default to .env: this suite creates fixtures and requires a disposable local database.
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("Set TEST_DATABASE_URL to a disposable local workout_bot_batch_test database");
const url = new URL(testUrl);
if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.pathname !== "/workout_bot_batch_test") {
  throw new Error("Integration tests require a local database named workout_bot_batch_test");
}
process.env.DATABASE_URL = testUrl;
process.env.WORKOUT_API_KEY = "batch-integration-test-key";

test("batch set persistence through the REST handler", async (t) => {
  const { prisma } = await import("../lib/prisma");
  const { createApprovedExercise } = await import("../lib/services/exercise-catalog");
  const { createWorkoutSession, createCompletedSet, updateExerciseSet } = await import("../lib/services/workout");
  const { POST } = await import("../app/api/sets/batch/route");
  const { buildOpenApiSpec } = await import("../lib/openapi");
  t.after(() => prisma.$disconnect());
  const prefix = randomUUID();
  const name = `Test Press ${prefix}`;
  const exerciseInput = { name, userApproved: true as const };
  const exercise = await createApprovedExercise(exerciseInput, { clientEventId: `${prefix}-catalog` });
  const catalogReplay = await createApprovedExercise(exerciseInput, { clientEventId: `${prefix}-catalog` });
  assert.equal(catalogReplay.value.id, exercise.value.id);
  assert.equal(catalogReplay.receipt?.status, "replayed");
  const sessionInput = { sessionType: "Batch integration test" };
  const session = await createWorkoutSession(sessionInput, { clientEventId: `${prefix}-session` });
  const sessionReplay = await createWorkoutSession(sessionInput, { clientEventId: `${prefix}-session` });
  assert.equal(sessionReplay.value.id, session.value.id);
  const sessionId = session.value.id;
  const set = (suffix: string, reps = 12) => ({
    clientEventId: `${prefix}-${suffix}`, exerciseName: name, weight: 40, reps
  });
  const post = async (body: unknown, authenticated = true) => {
    const response = await POST(new Request("http://localhost/api/sets/batch", {
      method: "POST", headers: {
        "content-type": "application/json",
        ...(authenticated ? { authorization: "Bearer batch-integration-test-key" } : {})
      }, body: JSON.stringify(body)
    }));
    return { status: response.status, body: await response.json() };
  };
  const count = () => prisma.exerciseSet.count({ where: { sessionId } });
  const batch = { sessionId, sets: [
    { ...set("first"), setNumber: 1, completedAt: "2026-09-23T12:00:00.000Z" },
    { ...set("second", 10), setNumber: 2, notes: "Reported 10 instead of 12" },
    { ...set("third", 10), setNumber: 3, weight: 35 }
  ] };

  await t.test("auth and malformed requests write nothing", async () => {
    assert.equal((await post(batch, false)).status, 401);
    for (const body of [ { sessionId, sets: [] }, { sessionId, sets: [set("dup"), set("dup")] },
      { sessionId, sets: [{ exerciseName: name }] },
      { sessionId, sets: [{ ...set("bad"), reps: 10.5 }] },
      { sessionId, sets: [{ ...set("other-session"), sessionId: "other" }] },
      { sessionId, sets: Array.from({ length: 101 }, (_, i) => set(`large-${i}`)) } ]) {
      assert.equal((await post(body)).status, 400);
    }
    assert.equal(await count(), 0);
  });
  await t.test("three confirmations persist as three rows with actual deviations", async () => {
    const result = await post(batch);
    assert.equal(result.status, 201);
    assert.deepEqual(result.body.sets.map((s: { weight: number; reps: number }) => [s.weight, s.reps]), [[40, 12], [40, 10], [35, 10]]);
    assert.equal(result.body.sets[0].completedAt, "2026-09-23T12:00:00.000Z");
    assert.equal(result.body.sets[1].rpe, null);
    assert.equal(result.body.sets[1].notes, "Reported 10 instead of 12");
    assert.equal(result.body.receipts.length, 3);
    assert.equal(await count(), 3);
  });
  await t.test("a timeout retry replays all rows, also through the legacy single-set API", async () => {
    const result = await post(batch);
    assert.equal(result.status, 200);
    assert.ok(result.body.receipts.every((r: { status: string }) => r.status === "replayed"));
    const { clientEventId, ...data } = batch.sets[0];
    const legacy = await createCompletedSet({ ...data, sessionId }, { clientEventId });
    assert.equal(legacy.receipt?.status, "replayed");
    assert.equal(legacy.value.id, result.body.sets[0].id);
    assert.equal(await count(), 3);
  });
  await t.test("unknown exercise rolls back earlier sets AND their receipts", async () => {
    const result = await post({ sessionId, sets: [set("rollback"), { ...set("unknown"), exerciseName: "Not approved" }] });
    assert.equal(result.status, 409);
    assert.equal(await count(), 3);
    assert.equal(await prisma.writeEvent.findUnique({ where: { clientEventId: set("rollback").clientEventId } }), null);
  });
  await t.test("changed payload under an existing event ID rolls back the entire batch", async () => {
    assert.equal((await post({ sessionId, sets: [set("conflict-rollback"), { ...batch.sets[0], reps: 5 }] })).status, 409);
    assert.equal(await count(), 3);
    assert.equal(await prisma.writeEvent.findUnique({ where: { clientEventId: set("conflict-rollback").clientEventId } }), null);
  });
  await t.test("missing session writes nothing", async () => {
    assert.equal((await post({ sessionId: "missing-session", sets: [set("missing")] })).status, 404);
    assert.equal(await count(), 3);
  });
  await t.test("mixed saved and new sets support finishing remaining work", async () => {
    const result = await post({ sessionId, sets: [batch.sets[0], set("fourth")] });
    assert.equal(result.status, 201);
    assert.deepEqual(result.body.receipts.map((r: { status: string }) => r.status), ["replayed", "created"]);
    assert.equal(await count(), 4);
  });
  await t.test("saved corrections survive a replay and create no duplicate", async () => {
    const original = await post(batch);
    await updateExerciseSet(original.body.sets[1].id, { reps: 9 });
    const replay = await post(batch);
    assert.equal(replay.body.sets[1].reps, 9);
    assert.equal(await count(), 4);
  });
  await t.test("concurrent overlapping retries create each event exactly once", async () => {
    const common = [set("concurrent-a"), set("concurrent-b")];
    const results = await Promise.all([
      post({ sessionId, sets: common }),
      post({ sessionId, sets: [...common, set("concurrent-c")] }),
      post({ sessionId, sets: common })
    ]);
    assert.ok(results.every((r) => [200, 201].includes(r.status)));
    assert.equal(await count(), 7);
    assert.equal(new Set(results.flatMap((r) => r.body.sets.map((s: { id: string }) => s.id))).size, 3);
  });
  await t.test("OpenAPI exposes the same batch contract and legacy operation", () => {
    const spec = buildOpenApiSpec("http://localhost");
    assert.equal(spec.paths["/api/sets/batch"].post.operationId, "logExerciseSets");
    assert.ok(spec.paths["/api/sets/batch"].post.description.length <= 300, "GPT Actions descriptions must fit the editor limit");
    assert.equal(spec.paths["/api/sets"].post.operationId, "logExerciseSet");
    assert.deepEqual(spec.components.schemas.CreateSetsBatchRequest.required, ["sessionId", "sets"]);
  });
});
