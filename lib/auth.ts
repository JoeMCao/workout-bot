import { errorJson } from "@/lib/http";

function shouldDebugAuth(request: Request) {
  const v = request.headers.get("x-debug-auth");
  return v === "1" || v?.toLowerCase() === "true";
}

function safeAuthDebugLog(event: Record<string, unknown>) {
  // Never log secrets/tokens. This is intentionally minimal + boolean/length only.
  console.log(JSON.stringify({ ts: new Date().toISOString(), service: "auth", ...event }));
}

export function requireApiKey(request: Request) {
  const expectedRaw = process.env.WORKOUT_API_KEY;
  const expected =
    typeof expectedRaw === "string" ? expectedRaw.trim() : undefined;

  if (!expected) {
    if (shouldDebugAuth(request)) {
      safeAuthDebugLog({
        phase: "auth_guard",
        ok: false,
        reason: "missing_env",
        envKey: "WORKOUT_API_KEY"
      });
    }
    return errorJson("WORKOUT_API_KEY is not configured", 500);
  }

  const authorization = request.headers.get("authorization");
  const xApiKey = request.headers.get("x-api-key");
  const bearerMatch = authorization?.match(/^Bearer\s+(.+)$/i);
  const bearerToken = bearerMatch?.[1]?.trim();

  // Support common caller formats:
  // - Authorization: Bearer <key>  (preferred)
  // - x-api-key: <key>            (common for GPT actions)
  // - Authorization: <key>        (fallback)
  const rawAuthorizationToken =
    authorization && !bearerMatch ? authorization.trim() : undefined;
  const token = bearerToken ?? xApiKey?.trim() ?? rawAuthorizationToken;

  const match = token === expected;

  if (shouldDebugAuth(request)) {
    const authMode =
      bearerToken != null
        ? "authorization_bearer"
        : xApiKey != null
          ? "x_api_key"
          : rawAuthorizationToken != null
            ? "authorization_raw"
            : "missing";
    safeAuthDebugLog({
      phase: "requireApiKey_debug",
      ok: match,
      hasAuthorizationHeader: Boolean(authorization),
      authorizationStartsWithBearer: Boolean(authorization?.toLowerCase().startsWith("bearer ")),
      hasXApiKeyHeader: Boolean(xApiKey),
      parsedTokenNonEmpty: Boolean(token && token.length > 0),
      parsedTokenLength: token?.length ?? 0,
      expectedLength: expected.length,
      authMode,
      expectedConfigured: true,
      matchesConfiguredEnv: match
    });
  }

  if (!match) {
    return errorJson(
      "Unauthorized: WORKOUT_API_KEY mismatch. Use the same secret as in Vercel Project Settings → Environment Variables (Production/Preview).",
      401
    );
  }

  return null;
}
