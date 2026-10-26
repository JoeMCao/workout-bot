import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export const READ_SCOPE = "workout:read";
export const WRITE_SCOPE = "workout:write";
export type PluginConfig = { resource: string; issuer: string; jwksUrl: string; ownerSubject: string };
export class PluginAuthError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function httpsUrl(value: string | undefined) {
  if (!value) throw new Error("Missing configuration");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("Invalid configuration");
  }
  return value;
}

export function pluginConfig(): PluginConfig {
  try {
    if (process.env.WORKOUT_PLUGIN_ENABLED !== "true" || !process.env.WORKOUT_OAUTH_OWNER_SUBJECT?.trim()) {
      throw new Error("Disabled or missing owner");
    }
    const resource = httpsUrl(process.env.WORKOUT_MCP_RESOURCE);
    if (new URL(resource).pathname !== "/api/plugin/mcp") throw new Error("Invalid resource path");
    return {
      resource,
      issuer: httpsUrl(process.env.WORKOUT_OAUTH_ISSUER),
      jwksUrl: httpsUrl(process.env.WORKOUT_OAUTH_JWKS_URL),
      ownerSubject: process.env.WORKOUT_OAUTH_OWNER_SUBJECT
    };
  } catch {
    throw new PluginAuthError(503, "Workout Buddy plugin is not configured.");
  }
}

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function verifyPluginToken(token: string, config: PluginConfig, key?: JWTVerifyGetKey) {
  if (!keySets.has(config.jwksUrl)) {
    keySets.set(config.jwksUrl, createRemoteJWKSet(new URL(config.jwksUrl), { timeoutDuration: 5000 }));
  }
  try {
    const { payload } = await jwtVerify(token, key ?? keySets.get(config.jwksUrl)!, {
      issuer: config.issuer,
      audience: config.resource,
      algorithms: ["RS256"],
      requiredClaims: ["exp", "iat", "sub"],
      clockTolerance: 5
    });
    if (payload.sub !== config.ownerSubject) throw new PluginAuthError(403, "This connection is restricted to the Workout Buddy owner.");
    const scopes = typeof payload.scope === "string" ? payload.scope.split(/\s+/) : [];
    if (!scopes.includes(READ_SCOPE)) throw new PluginAuthError(403, "Missing workout:read permission.");
    return { scopes };
  } catch (error) {
    if (error instanceof PluginAuthError) throw error;
    throw new PluginAuthError(401, "Connect or reconnect your Workout Buddy account.");
  }
}

export function resourceMetadata(config: PluginConfig) {
  return { resource: config.resource, authorization_servers: [config.issuer],
    scopes_supported: [READ_SCOPE, WRITE_SCOPE], bearer_methods_supported: ["header"] };
}

export function authChallenge(config: PluginConfig, insufficient = false) {
  const metadata = new URL("/.well-known/oauth-protected-resource", config.resource);
  return `Bearer resource_metadata="${metadata}", scope="${READ_SCOPE} ${WRITE_SCOPE}"${insufficient ? ', error="insufficient_scope"' : ""}`;
}
