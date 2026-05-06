import { logApiRequestDebug } from "@/lib/api-debug";
import { requireApiKey } from "@/lib/auth";
import { handleRouteError, json } from "@/lib/http";
import { getWhoopStatus } from "@/lib/whoop/sync";

export async function GET(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  logApiRequestDebug(request, { operation: "whoop_status_get" });

  try {
    return json({ whoop: await getWhoopStatus() });
  } catch (error) {
    return handleRouteError(error);
  }
}
