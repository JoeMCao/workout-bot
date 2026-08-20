import { requireApiKey } from "@/lib/auth";
import { handleRouteError, json } from "@/lib/http";
import { getWeeklyTrainingReview } from "@/lib/services/weekly-training-review";

export async function GET(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("weekStart") ?? undefined;
    return json(await getWeeklyTrainingReview({ weekStart }));
  } catch (error) {
    return handleRouteError(error);
  }
}
