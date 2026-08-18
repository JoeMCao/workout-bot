import { requireApiKey } from "@/lib/auth";
import { handleRouteError, json, parseJson } from "@/lib/http";
import { getTrainingPlan, saveTrainingPlan } from "@/lib/services/training-plan";
import { saveTrainingPlanSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("weekStart") ?? undefined;
    return json(await getTrainingPlan({ weekStart }));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const body = saveTrainingPlanSchema.parse(await parseJson(request));
    const result = await saveTrainingPlan(body, {
      source: "rest",
      clientEventId: request.headers.get("idempotency-key")?.trim() || undefined
    });
    return json({ plan: result.value, receipt: result.receipt });
  } catch (error) {
    return handleRouteError(error);
  }
}
