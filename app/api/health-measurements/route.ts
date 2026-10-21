import { requireApiKey } from "@/lib/auth";
import { handleRouteError, json, parseLimit } from "@/lib/http";
import { getHealthMeasurements } from "@/lib/services/health-measurements";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;
  try {
    return json(await getHealthMeasurements(parseLimit(new URL(request.url).searchParams.get("limit"), 7, 30)));
  } catch (error) {
    return handleRouteError(error);
  }
}
