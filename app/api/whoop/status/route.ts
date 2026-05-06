import { requireApiKey } from "@/lib/auth";
import { handleRouteError, json } from "@/lib/http";
import { getWhoopStatus } from "@/lib/whoop/sync";

export async function GET(request: Request) {
  // TEMP DEBUG (unconditional): prove route execution + header presence.
  // Do not log secrets.
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      service: "route",
      route: "GET /api/whoop/status",
      entered: true,
      hasAuthorizationHeader: Boolean(request.headers.get("authorization")),
      hasXApiKeyHeader: Boolean(request.headers.get("x-api-key")),
      hasXDebugAuthHeader: Boolean(request.headers.get("x-debug-auth"))
    })
  );

  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    return json({ whoop: await getWhoopStatus() });
  } catch (error) {
    return handleRouteError(error);
  }
}
