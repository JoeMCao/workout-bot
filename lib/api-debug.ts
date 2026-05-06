/**
 * Opt-in request logging for /api routes. Enable with header:
 *   x-debug-api: 1
 * or (legacy, same effect for auth routes):
 *   x-debug-auth: 1
 *
 * Never logs secrets. OAuth query params like `code` / `state` are redacted.
 */

const TRUTHY = new Set(["1", "true"]);

export function isDebugEnabled(request: { headers: Headers }) {
  const v =
    request.headers.get("x-debug-api") ?? request.headers.get("x-debug-auth");
  if (v == null) return false;
  return TRUTHY.has(v.trim().toLowerCase());
}

const REDACT_QUERY_KEYS = new Set([
  "code",
  "state",
  "access_token",
  "refresh_token",
  "token"
]);

export function safeSearchParamsForDebug(url: URL): Record<string, string> {
  const out: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    out[key] = REDACT_QUERY_KEYS.has(key.toLowerCase()) ? "[redacted]" : value;
  });
  return out;
}

export function logApiRequestDebug(
  request: Request,
  event: Record<string, unknown>
) {
  if (!isDebugEnabled(request)) return;
  const url = new URL(request.url);
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      service: "api",
      phase: "handler",
      method: request.method,
      route: url.pathname.replace(/^\/api\//, ""),
      pathname: url.pathname,
      query: safeSearchParamsForDebug(url),
      ...event
    })
  );
}
