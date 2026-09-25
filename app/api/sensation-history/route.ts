import { requireApiKey } from "@/lib/auth";
import { handleRouteError, json } from "@/lib/http";
import { sensationHistorySchema } from "@/lib/sensation-validation";
import { getSensationHistory } from "@/lib/services/sensation";

export async function GET(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;
  try {
    const params = new URL(request.url).searchParams;
    const input = sensationHistorySchema.parse({
      startDate: params.get("startDate") ?? undefined,
      endDate: params.get("endDate") ?? undefined,
      limit: params.has("limit") ? Number(params.get("limit")) : undefined
    });
    return json(await getSensationHistory(input));
  } catch (error) { return handleRouteError(error); }
}
