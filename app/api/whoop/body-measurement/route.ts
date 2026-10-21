import { requireApiKey } from "@/lib/auth";
import { errorJson, handleRouteError, json } from "@/lib/http";
import { getWhoopBodyMeasurement } from "@/lib/whoop/body-measurement";
import { WhoopSyncError } from "@/lib/whoop/sync-error";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;
  try {
    return json({ bodyMeasurement: await getWhoopBodyMeasurement() });
  } catch (error) {
    if (error instanceof WhoopSyncError) {
      return errorJson(error.message, error.httpStatus, { code: error.code });
    }
    return handleRouteError(error);
  }
}
