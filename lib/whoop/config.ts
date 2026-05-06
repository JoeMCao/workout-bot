export const WHOOP_AUTHORIZATION_URL =
  "https://api.prod.whoop.com/oauth/oauth2/auth";
export const WHOOP_TOKEN_URL =
  "https://api.prod.whoop.com/oauth/oauth2/token";
/**
 * Data API base — matches WHOOP OpenAPI `servers[0].url` (workout collection: `GET /v2/activity/workout`, scope `read:workout`).
 * @see https://developer.whoop.com/api — OpenAPI download lists server `https://api.prod.whoop.com/developer`
 */
export const WHOOP_API_BASE_URL = "https://api.prod.whoop.com/developer";
export const WHOOP_PROVIDER = "whoop";
export const WHOOP_SCOPES = [
  "read:workout",
  "read:recovery",
  "read:sleep",
  "read:cycles",
  "offline"
];

/** Public origin for OAuth redirect_uri when WHOOP_REDIRECT_URI is unset (Vercel uses x-forwarded-proto). */
function inferPublicOrigin(request: Request) {
  const url = new URL(request.url);
  const forwarded = request.headers.get("x-forwarded-proto");
  const proto = forwarded?.split(",")[0]?.trim();
  if (proto === "https" || proto === "http") {
    return `${proto}://${url.host}`;
  }
  return url.origin;
}

export function getWhoopClientConfig(request?: Request) {
  const clientId = process.env.WHOOP_CLIENT_ID;
  const clientSecret = process.env.WHOOP_CLIENT_SECRET;
  const redirectUri =
    process.env.WHOOP_REDIRECT_URI ??
    (request
      ? `${inferPublicOrigin(request)}/api/auth/whoop/callback`
      : undefined);

  if (!clientId) {
    throw new Error("WHOOP_CLIENT_ID is not configured");
  }

  if (!clientSecret) {
    throw new Error("WHOOP_CLIENT_SECRET is not configured");
  }

  if (!redirectUri) {
    throw new Error("WHOOP_REDIRECT_URI is not configured");
  }

  return {
    clientId,
    clientSecret,
    redirectUri
  };
}
