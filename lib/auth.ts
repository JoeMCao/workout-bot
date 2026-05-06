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
  const expected = process.env.WORKOUT_API_KEY;

  // TEMP DEBUG (unconditional): prove guard execution + how we parsed the token.
  // Do not log secrets.
  {
    const authorization = request.headers.get("authorization");
    const xApiKey = request.headers.get("x-api-key");
    const bearerMatch = authorization?.match(/^Bearer\s+(.+)$/i);
    const bearerToken = bearerMatch?.[1];
    const rawAuthorizationToken =
      authorization && !bearerMatch ? authorization.trim() : undefined;
    const token = bearerToken ?? xApiKey?.trim() ?? rawAuthorizationToken;
    const authMode =
      bearerToken != null
        ? "authorization_bearer"
        : xApiKey != null
          ? "x_api_key"
          : rawAuthorizationToken != null
            ? "authorization_raw"
            : "missing";

    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "auth",
        phase: "requireApiKey_entered",
        hasAuthorizationHeader: Boolean(authorization),
        authorizationStartsWithBearer: Boolean(
          authorization?.toLowerCase().startsWith("bearer ")
        ),
        hasXApiKeyHeader: Boolean(xApiKey),
        hasXDebugAuthHeader: Boolean(request.headers.get("x-debug-auth")),
        authMode,
        parsedTokenLength: token?.length ?? 0,
        envKey: "WORKOUT_API_KEY",
        expectedConfigured: Boolean(expected),
        // match evaluation happens below (only meaningful if expectedConfigured is true)
      })
    );
  }

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
  const bearerToken = bearerMatch?.[1];

  // Support common caller formats:
  // - Authorization: Bearer <key>  (preferred)
  // - x-api-key: <key>            (common for GPT actions)
  // - Authorization: <key>        (fallback)
  const rawAuthorizationToken =
    authorization && !bearerMatch ? authorization.trim() : undefined;
  const token = bearerToken ?? xApiKey?.trim() ?? rawAuthorizationToken;

  const match = token === expected;
  // TEMP DEBUG (unconditional): show match outcome without secrets.
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      service: "auth",
      phase: "requireApiKey_result",
      matchesConfiguredEnv: match,
      expectedConfigured: true
    })
  );
  if (shouldDebugAuth(request)) {
    safeAuthDebugLog({
      phase: "auth_guard",
      ok: match,
      hasAuthorizationHeader: Boolean(authorization),
      authorizationStartsWithBearer: Boolean(authorization?.toLowerCase().startsWith("bearer ")),
      hasXApiKeyHeader: Boolean(xApiKey),
      parsedTokenNonEmpty: Boolean(token && token.length > 0),
      parsedTokenLength: token?.length ?? 0,
      authMode:
        bearerToken != null
          ? "authorization_bearer"
          : xApiKey != null
            ? "x_api_key"
            : rawAuthorizationToken != null
              ? "authorization_raw"
              : "missing",
      expectedConfigured: true,
      matchesConfiguredEnv: match
    });
  }

  if (!match) {
    return errorJson("Unauthorized", 401);
  }

  return null;
}
