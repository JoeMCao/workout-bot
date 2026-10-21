import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
// Tests use a stubbed connection and never access a database or WHOOP.
process.env.DATABASE_URL ??= "postgresql://unused:unused@localhost/unused";
process.env.WHOOP_TOKEN_ENCRYPTION_KEY = "body-measurement-test-only";
process.env.WHOOP_CLIENT_ID = "test-client";
process.env.WHOOP_CLIENT_SECRET = "test-secret";
process.env.WHOOP_REDIRECT_URI = "http://localhost/api/auth/whoop/callback";
process.env.WORKOUT_API_KEY = "test-api-key";

test("WHOOP weight lookup and permission handling", async (t) => {
  const { prisma } = await import("../lib/prisma");
  const { encryptWhoopToken } = await import("../lib/whoop/crypto");
  const { getWhoopBodyMeasurement } = await import("../lib/whoop/body-measurement");
  const { refreshWhoopConnection } = await import("../lib/whoop/oauth");
  const { GET } = await import("../app/api/whoop/body-measurement/route");
  const { WhoopSyncError } = await import("../lib/whoop/sync-error");

  const connection = {
    id: "test", provider: "whoop", whoopUserId: null,
    scope: "read:body_measurement offline",
    accessTokenEncrypted: encryptWhoopToken("test-access"),
    refreshTokenEncrypted: encryptWhoopToken("test-refresh"),
    expiresAt: new Date(Date.now() + 3_600_000),
    tokenType: "Bearer", lastSyncAt: null, lastSyncError: null,
    createdAt: new Date(), updatedAt: new Date()
  };

  t.after(() => prisma.$disconnect());

  function stubConnection(t: TestContext, value: typeof connection) {
    const original = prisma.whoopConnection.findUnique;
    prisma.whoopConnection.findUnique = (async () => value) as unknown as typeof original;
    t.after(() => { prisma.whoopConnection.findUnique = original; });
  }

  await t.test("rejects unauthenticated requests before reading the connection", async () => {
    const result = await GET(new Request("http://localhost/api/whoop/body-measurement"));
    assert.equal(result.status, 401);
  });

  await t.test("old connections require reconnection without fetching or refreshing", async (t) => {
    stubConnection(t, { ...connection, scope: "read:workout offline" });
    const fetchMock = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected network request"); });
    const response = await GET(new Request("http://localhost/api/whoop/body-measurement", { headers: { "x-api-key": "test-api-key" } }));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.details.code, "WHOOP_BODY_MEASUREMENT_RECONNECT_REQUIRED");
    assert.equal(fetchMock.mock.callCount(), 0);
  });

  await t.test("returns kg and lb with retrieval time but no invented measurement date", async (t) => {
    stubConnection(t, connection);
    t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
      assert.equal(url, "https://api.prod.whoop.com/developer/v2/user/measurement/body");
      assert.equal(init.cache, "no-store");
      assert.equal(new Headers(init.headers).get("Authorization"), "Bearer test-access");
      return Response.json({ weight_kilogram: 80, height_meter: 1.8, max_heart_rate: 190 });
    });
    const result = await getWhoopBodyMeasurement();
    assert.equal(result.weightKg, 80);
    assert.equal(result.weightLb, 176.4);
    assert.equal(result.measuredAt, null);
    assert.ok(Number.isFinite(Date.parse(result.fetchedAt)));
  });

  for (const status of [401, 403, 429, 500]) {
    await t.test(`handles WHOOP HTTP ${status} without fabricating measurements`, async (t) => {
      stubConnection(t, connection);
      t.mock.method(globalThis, "fetch", async () => new Response("vendor error", { status }));
      await assert.rejects(getWhoopBodyMeasurement, (error: unknown) =>
        error instanceof WhoopSyncError && error.httpStatus === (status === 401 || status === 403 ? 409 : 502));
    });
  }

  await t.test("rejects missing weight rather than coercing it to zero", async (t) => {
    stubConnection(t, connection);
    t.mock.method(globalThis, "fetch", async () => Response.json({ weight_kilogram: null, height_meter: 1.8, max_heart_rate: 190 }));
    await assert.rejects(getWhoopBodyMeasurement, (error: unknown) =>
      error instanceof WhoopSyncError && error.code === "WHOOP_BODY_MEASUREMENT_INVALID");
  });

  await t.test("refresh without returned scopes preserves the original grant", async (t) => {
    t.mock.method(globalThis, "fetch", async () => Response.json({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 3600 }));
    const original = prisma.whoopConnection.upsert;
    let savedScope: unknown;
    prisma.whoopConnection.upsert = (async (args) => {
      savedScope = args.update.scope;
      return connection;
    }) as typeof original;
    t.after(() => { prisma.whoopConnection.upsert = original; });
    await refreshWhoopConnection({ ...connection, scope: "read:workout offline" }, { clientId: "test-client", clientSecret: "test-secret" });
    assert.equal(savedScope, "read:workout offline");
  });
});
