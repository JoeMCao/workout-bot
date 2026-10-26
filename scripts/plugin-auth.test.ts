import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from "jose";
import { PluginAuthError, pluginConfig, verifyPluginToken, READ_SCOPE, WRITE_SCOPE } from "../lib/plugin-auth";

// No production credentials, database, Auth0 calls or workout mutations in this suite.
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/workout_plugin_test";
process.env.WORKOUT_API_KEY = "legacy-test-key";
const resource = "https://workout.example/api/plugin/mcp";
Object.assign(process.env, {
  WORKOUT_PLUGIN_ENABLED: "true", WORKOUT_MCP_RESOURCE: resource,
  WORKOUT_OAUTH_ISSUER: "https://auth.example/", WORKOUT_OAUTH_JWKS_URL: "https://auth.example/keys",
  WORKOUT_OAUTH_OWNER_SUBJECT: "google-oauth2|test-owner"
});

test("Workout OAuth isolates the audience, identity, permissions and transport", async (t) => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const localKeys = createLocalJWKSet({ keys: [{ ...await exportJWK(publicKey), kid: "test" }] });
  const config = pluginConfig();
  const token = (overrides: Record<string, unknown> = {}) => new SignJWT({
    iss: config.issuer, aud: config.resource, sub: config.ownerSubject,
    iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+900,
    scope: `${READ_SCOPE} ${WRITE_SCOPE}`, ...overrides
  }).setProtectedHeader({ alg: "RS256", kid: "test" }).sign(privateKey);
  const verify: typeof verifyPluginToken = (value, settings) => verifyPluginToken(value, settings, localKeys);
  const { handlePluginMcp } = await import("../lib/plugin-http");
  const { POST: legacy } = await import("../app/api/mcp/route");
  const { GET: metadata } = await import("../app/.well-known/oauth-protected-resource/route");
  const { prisma } = await import("../lib/prisma");
  t.after(() => prisma.$disconnect());
  const fullToken = await token();
  const readonlyToken = await token({ scope: READ_SCOPE });
  const request = (body: unknown, bearer: string | null = fullToken, extra: Record<string,string> = {}) => new Request(resource, {
    method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream",
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), ...extra }, body: JSON.stringify(body)
  });
  const rpc = (method: string, params: unknown = {}) => ({ jsonrpc: "2.0", id: 1, method, params });
  async function decode(response: Response) {
    assert.equal(response.status, 200, await response.clone().text());
    const text = await response.text();
    return JSON.parse(text.startsWith("data:") || text.startsWith("event:") ? text.split("\n").find(line => line.startsWith("data:"))!.slice(5) : text);
  }

  await t.test("valid owner token works; Compass tokens and invalid claims fail", async () => {
    assert.deepEqual((await verify(fullToken, config)).scopes, [READ_SCOPE, WRITE_SCOPE]);
    for (const [overrides, status] of [
      [{ aud: "https://the-weekly-alpha.vercel.app/api/mcp" },401],
      [{ iss: "https://other.example/" },401], [{ sub: "another-user" },403],
      [{ exp: Math.floor(Date.now()/1000)-60 },401], [{ scope: WRITE_SCOPE },403],
      [{ exp: undefined },401], [{ iat: undefined },401], [{ sub: undefined },401]
    ] as const) {
      await assert.rejects(verify(await token(overrides), config), (e: unknown) => e instanceof PluginAuthError && e.status === status);
    }
    await assert.rejects(verify("legacy-test-key", config), (e: unknown) => e instanceof PluginAuthError && e.status === 401);
    const other = await generateKeyPair("RS256");
    const forged = await new SignJWT({ iss: config.issuer, aud: resource, sub: config.ownerSubject, scope: READ_SCOPE })
      .setProtectedHeader({ alg: "RS256", kid: "test" }).setIssuedAt().setExpirationTime("15m").sign(other.privateKey);
    await assert.rejects(verify(forged,config), (e: unknown) => e instanceof PluginAuthError && e.status === 401);
  });

  await t.test("metadata exposes only discovery; missing config fails closed", async () => {
    const body = await (await metadata()).json();
    assert.deepEqual(body.scopes_supported, [READ_SCOPE,WRITE_SCOPE]);
    assert.equal(body.resource, resource);
    assert.ok(!JSON.stringify(body).includes(config.ownerSubject));
    process.env.WORKOUT_PLUGIN_ENABLED = "false";
    assert.equal((await handlePluginMcp(request(rpc("tools/list")),verify)).status,503);
    assert.equal((await metadata()).status,503);
    process.env.WORKOUT_PLUGIN_ENABLED = "true";
    process.env.WORKOUT_OAUTH_OWNER_SUBJECT = "";
    assert.throws(pluginConfig, PluginAuthError);
    process.env.WORKOUT_OAUTH_OWNER_SUBJECT = config.ownerSubject;
  });

  await t.test("HTTP rejects missing/invalid credentials, foreign origins and malformed bodies", async () => {
    const missing = await handlePluginMcp(request(rpc("tools/list"),null),verify);
    assert.equal(missing.status,401);
    assert.match(missing.headers.get("www-authenticate")!, /oauth-protected-resource/);
    assert.equal((await handlePluginMcp(request(rpc("tools/list"),"legacy-test-key"),verify)).status,401);
    assert.equal((await handlePluginMcp(request(rpc("tools/list"),fullToken,{origin:"https://evil.example"}),verify)).status,403);
    assert.equal((await handlePluginMcp(new Request("https://wrong-host.example/api/plugin/mcp",{method:"POST"}),verify)).status,403);
    assert.equal((await handlePluginMcp(request(rpc("tools/list"),fullToken,{"content-type":"text/plain"}),verify)).status,415);
    assert.equal((await handlePluginMcp(request("x".repeat(262144)),verify)).status,413);
    const malformed = new Request(resource,{method:"POST",headers:{authorization:`Bearer ${fullToken}`,"content-type":"application/json"},body:"{"});
    assert.equal((await handlePluginMcp(malformed,verify)).status,400);
    assert.equal((await handlePluginMcp(new Request(resource,{headers:{authorization:`Bearer ${fullToken}`}}),verify)).status,405);
  });

  await t.test("initialize and full tool discovery work with correct permission metadata", async () => {
    const init=await decode(await handlePluginMcp(request(rpc("initialize",{protocolVersion:"2025-03-26",capabilities:{},clientInfo:{name:"test",version:"1"}})),verify));
    assert.equal(init.result.serverInfo.name,"workout-bot");
    const result=await decode(await handlePluginMcp(request(rpc("tools/list")),verify));
    assert.equal(result.result.tools.length, 34);
    for(const tool of result.result.tools) {
      assert.deepEqual(tool._meta.securitySchemes,[{type:"oauth2",scopes:[tool.annotations?.readOnlyHint ? READ_SCOPE : WRITE_SCOPE]}],tool.name);
    }
  });

  await t.test("read-only tokens cannot delete or start WHOOP imports before any service runs", async () => {
    for(const [name,args] of [
      ["delete_sensation_check_in",{checkInId:"test-id",confirm:true}],
      ["delete_activity_session",{activityId:"test-id",confirm:true}],
      ["log_completed_sets",{sessionId:"test-session",sets:[{exerciseName:"Squat",clientEventId:"set-1",reps:5}]}],
      ["sync_whoop_workouts",{}], ["sync_whoop_recovery",{}]
    ] as const) {
      const result=await decode(await handlePluginMcp(request(rpc("tools/call",{name,arguments:args}),readonlyToken),verify));
      assert.equal(result.result.isError,true, name);
      assert.equal(JSON.parse(result.result.content[0].text).code,"INSUFFICIENT_SCOPE",name);
      assert.match(result.result._meta["mcp/www_authenticate"][0], /workout:write/);
    }
  });

  await t.test("read and write permissions stay isolated across concurrent requests", async () => {
    let deletes = 0;
    const clock = prisma.$queryRaw;
    prisma.$queryRaw = (async () => [{dbNow:"2026-10-25T12:00:00.000Z"}]) as typeof clock;
    const remove = prisma.sensationCheckIn.deleteMany;
    prisma.sensationCheckIn.deleteMany = (async () => { deletes++; return {count:1}; }) as typeof remove;
    try {
      const call = rpc("tools/call",{name:"delete_sensation_check_in",arguments:{checkInId:"test-id",confirm:true}});
      const [denied,allowed,read] = await Promise.all([
        handlePluginMcp(request(call,readonlyToken),verify).then(decode),
        handlePluginMcp(request(call,fullToken),verify).then(decode),
        handlePluginMcp(request(rpc("tools/call",{name:"get_current_time",arguments:{}}),readonlyToken),verify).then(decode)
      ]);
      assert.equal(denied.result.isError,true);
      assert.ok(!allowed.result.isError);
      assert.equal(deletes,1);
      assert.equal(JSON.parse(read.result.content[0].text).dbNow,"2026-10-25T12:00:00.000Z");
    } finally { prisma.$queryRaw = clock; prisma.sensationCheckIn.deleteMany = remove; }
  });

  await t.test("legacy endpoint still authenticates only with its existing key", async () => {
    assert.equal((await legacy(request(rpc("tools/list"),null))).status,401);
    assert.equal((await legacy(request(rpc("tools/list"),fullToken))).status,401);
    const response=await decode(await legacy(request(rpc("tools/list"),"legacy-test-key")));
    assert.equal(response.result.tools.length,34);
    assert.ok(response.result.tools.every((tool: {_meta?: unknown}) => !tool._meta));
  });
});
