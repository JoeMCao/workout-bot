import { PluginAuthError, authChallenge, pluginConfig, verifyPluginToken } from "@/lib/plugin-auth";
import { createWorkoutMcpHandler } from "@/lib/mcp/server";

const MAX_BYTES = 256 * 1024;

// Bound the body before the MCP library clones/parses it. No data is logged.
async function boundedRequest(request: Request) {
  if (!request.body) throw new PluginAuthError(400, "A JSON request is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new PluginAuthError(413, "Request is too large.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = Buffer.concat(chunks);
  try { JSON.parse(body.toString("utf8")); }
  catch { throw new PluginAuthError(400, "Invalid JSON."); }
  return new Request(request.url, { method: "POST", headers: request.headers, body });
}

export async function handlePluginMcp(request: Request, verify = verifyPluginToken) {
  let config;
  try {
    config = pluginConfig();
    const origin = new URL(config.resource).origin;
    if (new URL(request.url).origin !== origin ||
      (request.headers.has("origin") && ![origin, "https://chatgpt.com"].includes(request.headers.get("origin")!))) {
      throw new PluginAuthError(403, "Origin is not allowed.");
    }
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ") || authorization.length > 16384) {
      throw new PluginAuthError(401, "Connect your Workout Buddy account.");
    }
    const principal = await verify(authorization.slice(7), config);
    if (request.method !== "POST") {
      return new Response(null, { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } });
    }
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      throw new PluginAuthError(415, "Use application/json.");
    }
    const response = await createWorkoutMcpHandler(principal.scopes, config.resource)(await boundedRequest(request));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    const status = error instanceof PluginAuthError ? error.status : 500;
    const headers: Record<string, string> = { "Cache-Control": "no-store" };
    if (config && (status === 401 || status === 403)) headers["WWW-Authenticate"] = authChallenge(config, status === 403);
    return Response.json({ error: error instanceof PluginAuthError ? error.message : "Workout Buddy connection is temporarily unavailable." }, { status, headers });
  }
}
